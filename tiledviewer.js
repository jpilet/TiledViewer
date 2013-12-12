/**
 * @author Julien Pilet
 */
function InitializeTiledViewer(element) {
  element.tiledViewer = new TiledViewer(element);  
}

function TiledViewer(element) {
  this.imageObj = new Image();
  this.imageObj.src = "http://video.jpmguides.com/headers/fr/1.jpg";

  var tiledViewer = this;
  var draw = function(t) { tiledViewer.draw(element); };
  this.pinchZoom = new PinchZoom(element, draw);
  this.imageObj.onload = draw;  
}

TiledViewer.prototype.draw = function(canvas) {
  var context = canvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  this.pinchZoom.transform.canvasSetTransform(context);

  context.drawImage(this.imageObj, 0, 0, 555, 260);
  context.restore();
};

TiledViewer.prototype.debug = function(str) {
  //console.log(str);
};
