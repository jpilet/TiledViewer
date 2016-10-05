
var Canvas = require('canvas');
var fs = require('fs');
var vm = require('vm');

var OffscreenTileRenderer = require('../frontend/OffscreenTileRenderer.js')
  .OffscreenTileRenderer;

Bezier = require('bezier-js');

var sources = [
"TripGraph.js",
"TripGraphLayer.js",
"TripGraphEditor.js"];
for (var i in sources) {
  vm.runInThisContext(fs.readFileSync(__dirname + '/' + sources[i]) + '', { filename: sources[i] });
}

var graph = TripGraph.createFromStopovers([
    { name: 'A', coord: [ 0.5137081056967938, 0.3285825337142506 ], label: 'One' },
    { name: 'B', coord: [ 0.5137305609845453, 0.3285931138521079 ], label: 'Two' },
    { name: 'C', coord: [ 0.5137481056967938, 0.3286025337142506 ], label: 'Three' },
    { name: 'D', coord: [ 0.5137381056967938, 0.3286125337142506 ], label: 'Four' },
    { name: 'E', coord: [ 0.5137081056967938, 0.3286225337142506 ], label: 'Five' },
    { name: 'F', coord: [ 0.5137181056967938, 0.3286425337142506 ], label: 'Six' }
  ]);

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
  url: "https://tiles.wmflabs.org/bw-mapnik/$scale/$x/$y.png"
});


var tripLayer = new TripGraphLayer({
  renderer: renderer,
  graph: graph
});

renderer.addLayer(tripLayer);

renderer.render(function(err) {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    fs.writeFile('out.' + format, canvas.toBuffer());
  }
});

