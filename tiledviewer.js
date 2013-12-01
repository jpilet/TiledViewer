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

  var p1 = this.pinchZoom.viewerPosFromWorldPos(0, 0);
  var p2 = this.pinchZoom.viewerPosFromWorldPos(555, 260);
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.drawImage(this.imageObj, p1.x, p1.y, (p2.x - p1.x), (p2.y - p1.y));
};

TiledViewer.prototype.debug = function(str) {
  //console.log(str);
};
