
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
  "D3-Labeler/labeler.js",
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

  var graph = TripGraph.createFromStopovers([
    { name: 1, label: 'Hanoi', coord: latLonToCoord(21.027764, 105.83416) },
    { name: 2, label: 'Sapa', coord: latLonToCoord(22.339931, 103.852319) },
    { name: 3, label: 'Thanh Phu', coord: latLonToCoord(22.28276, 103.92579) },
    { name: 4, label: 'Sin Chai', coord: latLonToCoord(22.263698, 103.991708) },
    { name: 1, label: 'Hanoi', coord: latLonToCoord(21.027764, 105.83416) },
    { name: 6, label: 'Halong', coord: latLonToCoord(20.792083, 106.939477) },
    { name: 7, label: 'Tam Coc', coord: latLonToCoord(20.243855, 105.925645) },
    { name: 8, label: 'Hoi-An', coord: latLonToCoord(15.871443, 108.382874) },
    { name: 9, label: 'Saigon', coord: latLonToCoord(10.85653, 106.726685) },
    {
      name: 10,
      labelIcon: { url: 'plane.png', width: 20, autorotate: - Math.PI/2 },
      coord: latLonToCoord(10.85653, 106.726685),
      properties: { point: false, leaderLine: 'center', dashed: [5,3], leaderLineWidth: 2 }
    },{
      name: 11,
      labelIcon: { url: 'plane.png', width: 20, autorotate: Math.PI/2 },
      coord: latLonToCoord(21.027764, 105.83416),
      properties: { point: false, leaderLine: 'center', dashed: [5,3], leaderLineWidth: 2 }
    }
  ]);
  /*
var graph = TripGraph.createFromStopovers([
    { name: 'A', coord: [ 0.5137081056967938, 0.3285825337142506 ], label: 'One' },
    { name: 'B', coord: [ 0.5137305609845453, 0.3285931138521079 ], label: 'Two' },
    { name: 'C', coord: [ 0.5137481056967938, 0.3286025337142506 ], label: 'Three' },
    { name: 'D', coord: [ 0.5137381056967938, 0.3286125337142506 ], label: 'Four' },
    { name: 'E', coord: [ 0.5137081056967938, 0.3286225337142506 ], label: 'Five' },
    { name: 'F', coord: [ 0.5137181056967938, 0.3286425337142506 ], label: 'Six' }
  ]);
*/
var format = 'pdf';

// Horizontal A5
var width_mm = 210;
var height_mm = 148;

// Canvas size is specified in "points", ie 1/72 inch or 0.352778 mm
var mmToPoint = 2.83465;

var canvas = new Canvas(width_mm * mmToPoint, height_mm * mmToPoint, format);

var location = graph.location(width_mm / height_mm, 1.3);

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
  graph: graph
});

tripLayer.graph = tripLayer.makeFusedGraph(graph);
tripLayer.placeLabels(renderer.canvas.getContext('2d'));

renderer.addLayer(tripLayer);

tripLayer.loadIcons(function(err) {
  if (err) {
    throw(new Error(err));
  }
  renderer.render(function(err) {
    if (err) {
      console.log(err);
      process.exit(1);
    } else {
      fs.writeFile('out.' + format, canvas.toBuffer());
    }
  });
});
