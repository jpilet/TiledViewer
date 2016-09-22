
var Canvas = require('canvas');
var fs = require('fs');
var vm = require('vm');
var CanvasTilesRenderer = require('../nodeinterface.js');

Bezier = require('bezier-js');

var sources = [
"TripGraph.js",
"TripGraphLayer.js",
"TripGraphEditor.js"];
for (var i in sources) {
  vm.runInThisContext(fs.readFileSync(__dirname + '/' + sources[i]) + '', { filename: sources[i] });
}

var format = 'pdf';
var canvas = new Canvas(800, 600, format);


var canvasTilesRenderer = CanvasTilesRenderer.create({
  canvas: canvas,
  forceDevicePixelRatio: 1,
  initialLocation: {x:0.5137435332434739,y:0.32862555455727877,scale:0.0002892879213498567},
  url: "https://tiles.wmflabs.org/bw-mapnik/$scale/$x/$y.png"
});

var graph = TripGraph.createFromStopovers([
    { name: 'A', coord: [ 0.5137081056967938, 0.3285825337142506 ], label: 'One' },
    { name: 'B', coord: [ 0.5137305609845453, 0.3285931138521079 ], label: 'Two' },
    { name: 'C', coord: [ 0.5137481056967938, 0.3286025337142506 ], label: 'Three' },
    { name: 'D', coord: [ 0.5137381056967938, 0.3286125337142506 ], label: 'Four' },
    { name: 'E', coord: [ 0.5137081056967938, 0.3286225337142506 ], label: 'Five' },
    { name: 'F', coord: [ 0.5137181056967938, 0.3286425337142506 ], label: 'Six' }
  ]);

var tripLayer = new TripGraphLayer({
  renderer: canvasTilesRenderer,
  graph: graph
});

canvasTilesRenderer.addLayer(tripLayer);

canvasTilesRenderer.render(function() {
  fs.writeFile('out.' + format, canvas.toBuffer());
});

