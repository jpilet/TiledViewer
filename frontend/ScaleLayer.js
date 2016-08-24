function ScaleLayer(params, renderer) {
  this.renderer = renderer;
  this.params = params || {};
  this.sizeRatio = this.params.sizeRatio || .3;
  this.margin = this.params.margin || 15;
}

function nice(x) {
  var r = Math.pow(10, Math.floor(Math.log10(x))) / 2;
  return Math.round(x / r) * r;
}

function formatScale(km) {
  if (km <= 1) {
    return '~ ' + (km * 1000).toFixed(0) + ' m';
  } else {
    return '~ ' + km.toFixed(0) + ' km';
  }
}

ScaleLayer.prototype.draw = function(canvas, pinchZoom,
                                     bboxTopLeft, bboxBottomRight) {

  var latLon = Utils.worldToLatLon(
      pinchZoom.worldPosFromViewerPos({x: canvas.width/2, y: canvas.height/2}));

  var earthCircumference = 40075.017; // in km
  var xToKm = earthCircumference * Math.cos(latLon.lat * Math.PI / 180);
  var scaleWorld =
    Math.min(pinchZoom.bottomRightWorld().x, bboxBottomRight.x)
    - Math.max(pinchZoom.topLeftWorld().x, bboxTopLeft.x);

  var scaleKm = nice(scaleWorld / 4 * xToKm);

  if (this.params.maxDist && scaleKm > this.params.maxDist) {
    // for very large distances, it does not really make sense
    // to have a linear scale: the mercator projection distorts too much.
    return;
  }

  var pixelRatio = this.renderer.pixelRatio;

  var margin = this.margin * pixelRatio;

  var topLeftViewer =
    pinchZoom.viewerPosFromWorldPos(pinchZoom.topLeftWorld());
  var bottomRightViewer =
    pinchZoom.viewerPosFromWorldPos(pinchZoom.bottomRightWorld());

  var startViewer = {
    x: Math.min(canvas.width, bottomRightViewer.x) - margin,
    y: Math.max(topLeftViewer.y, 0) + margin
  };

  var startWorld = pinchZoom.worldPosFromViewerPos(startViewer);
  var endWorld = {
    x: startWorld.x - scaleKm / xToKm,
    y: startWorld.y
  };
  var endViewer = pinchZoom.viewerPosFromWorldPos(endWorld);
  endViewer.x = Math.round(endViewer.x);
  endViewer.y = Math.round(endViewer.y);

  if (endViewer.x > canvas.width) {
    // oops.. the screen is too thin.
    return;
  }

  var context = canvas.getContext('2d');

  var dy = 4 * pixelRatio;

  context.strokeStyle = "#000000";
  context.lineWidth = 1 * pixelRatio;
  context.beginPath();
  context.moveTo(startViewer.x, startViewer.y);
  context.lineTo(endViewer.x, endViewer.y);

  context.moveTo(startViewer.x, startViewer.y - dy);
  context.lineTo(startViewer.x, startViewer.y + dy);

  context.moveTo(endViewer.x, endViewer.y - dy);
  context.lineTo(endViewer.x, endViewer.y + dy);

  context.stroke();


  context.textAlign = 'end';
  context.textBaseline = 'bottom';
  var fontSize = 12;
  context.font = (fontSize * this.renderer.pixelRatio) + 'px '
      + 'Roboto, "Helvetica Neue", HelveticaNeue, "Helvetica-Neue", Helvetica, Arial, "Lucida Grande", sans-serif';
  context.fillStyle = '#000000';
  context.fillText(formatScale(scaleKm), startViewer.x - dy, startViewer.y + (14 * pixelRatio));
};
