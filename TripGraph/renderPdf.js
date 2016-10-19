
var Canvas = require('canvas');
var fs = require('fs');
var vm = require('vm');

var OffscreenTileRenderer = require('../frontend/OffscreenTileRenderer.js')
  .OffscreenTileRenderer;

Bezier = require('bezier-js');

var sources = [
  "TripGraph.js",
  "TripGraphLayer.js",
  "TripGraphEditor.js",
  "labeler.js",
  "WorldBackgroundLayer.js",
  "world.js"
];
for (var i in sources) {
  vm.runInThisContext(fs.readFileSync(__dirname + '/' + sources[i]) + '', { filename: sources[i] });
}

  function latLonToCoord(lat, lon) {
    var p = Utils.latLonToWorld([lon, lat]);
    return [p.x, p.y];
  };

function renderBuffer(trip, format, cb) {
  if (typeof trip == 'string') {
    trip = JSON.parse(trip);
  }

  var canvas = new Canvas(trip.width, trip.height, format);

  var location = trip.location;

  var renderer = new OffscreenTileRenderer({
    canvas: canvas,
    forceDevicePixelRatio: 1,
    initialLocation: location,
    url: "https://tiles.wmflabs.org/bw-mapnik/$scale/$x/$y.png",
    localImagePath: __dirname
  });

  renderer.layers[0] =
      new WorldBackgroundLayer({ renderer: renderer});

  var tripLayer = new TripGraphLayer({
    renderer: renderer,
    graph: new TripGraph(trip.graph),
    defaultRadius: trip.defaultRadius
  });

  renderer.addLayer(tripLayer);

  tripLayer.loadIcons(function(err) {
    if (err) {
      cb(err);
    }
    renderer.render(function(err) {
      if (err) {
        cb(err);
      } else {
        cb(undefined, canvas.toBuffer());
      }
    });
  });
}

function renderFile(trip, format, file, cb) {
  renderBuffer(trip, format, function(err, buffer) {
    if (err) {
      cb(err);
    } else {
      fs.writeFile(filename, buffer, cb);
    }
  });
}

module.exports.renderBuffer = renderBuffer;
module.exports.renderFile = renderFile;
module.exports.renderPdf =
  function(trip, file, cb) { renderFile(trip, 'pdf', file, cb); };

