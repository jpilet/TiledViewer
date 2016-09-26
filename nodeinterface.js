/*
 * Use several node tricks to pretend to be a browser to render a map using
 * CanvasTilesRenderer.
 *
 * Usage example:

var canvas = new Canvas(800, 600, 'pdf');

var canvasTilesRenderer = CanvasTilesRenderer.create({
  canvas: canvas,
  forceDevicePixelRatio: 1,
  initialLocation: {x:0.5137435332434739,y:0.32862555455727877,scale:0.0002892879213498567},
  url: "https://tiles.wmflabs.org/bw-mapnik/$scale/$x/$y.png"
});

canvasTilesRenderer.render(function() {
  fs.writeFile('out.pdf', canvas.toBuffer());
});

 */

var Canvas = require('canvas');
var fs = require('fs');
var vm = require('vm');
var request = require('request');
var cachedRequest = require('cached-request')(request)

// These are necessary to fake the browser
window = { setTimeout: setTimeout };
document = { createElement: function() { return {}; } };
addWheelListener = function() { };

var sources = [
  "frontend/utils.js",
  "frontend/affinetransform.js",
  "frontend/pinchzoom.js",
  "frontend/CanvasTilesRenderer.js",
  "frontend/TileLayer.js"];

for (var i in sources) {
  vm.runInThisContext(fs.readFileSync(__dirname + '/' + sources[i]) + '', { filename: sources[i] });
}


cachedRequest.setCacheDirectory('/tmp/imgcache');
cachedRequest.setValue('ttl', 7 * 24 * 60 * 60 * 1000);


module.exports.create = function(params) {
  if (!params.canvas) {
    throw(new Error('params.canvas has to be set'));
  }
  params.canvas.addEventListener = function() { };

  params.maxSimultaneousLoads = 500;

  var canvasTilesRenderer = new CanvasTilesRenderer(params);

  var numLoading = 0;
  var loadImage = function(url, success, error) {
    //console.log('Loading ' + url);
    ++numLoading;
    cachedRequest.get({ url: url, encoding: null }, function(err, res, body) {
        if (err) {
          error(err);
        }

        var image = new Canvas.Image();

        image.onerror = function() {
            console.error(arguments);
            --numLoading;
        };

        image.onload = function() {
            //console.log('loaded image: ' + url + '(' + numLoading + ' loading)');
            --numLoading;
            success(image);
            if (numLoading == 0) {
              setTimeout(canvasTilesRenderer.renderingDone, 10);
            }
        };

        image.src = new Buffer(body, 'binary');
    });
  };

  canvasTilesRenderer.loadImage = loadImage;
  canvasTilesRenderer.render = function(cb) {
    // If images have to be loaded, the loadImage function will call
    // this function when they are all here.
    this.renderingDone = function() {
      canvasTilesRenderer.draw();
      cb();
    };

    // the first call to draw() will queue all image load queries
    this.draw();

    // if there was no image to load, no need to wait.
    if (numLoading == 0) {
      this.renderingDone();
    }
  };
  return canvasTilesRenderer;
};


