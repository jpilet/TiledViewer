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
  this.refresh = function(t) {
      window.requestAnimationFrame(function() {
        tiledViewer.draw(element);
      });
  };
  this.pinchZoom = new PinchZoom(element, this.refresh, 5550, 2600);
  this.imageObj.onload = this.refresh;  
}

TiledViewer.prototype.draw = function(canvas) {
  var factor = (this.pinchZoom.isMoving() ? .5 : 2);
  var newWidth = Math.floor(canvas.clientWidth * factor);
  var newHeight = Math.floor(canvas.clientHeight * factor);
  if (Math.abs(canvas.width - newWidth) > 3
      || Math.abs(canvas.height - newHeight) > 3) {
      var oldWidth = canvas.width;
      var oldHeight = canvas.height;
      canvas.width = newWidth;
      canvas.height = newHeight;
      this.pinchZoom.transform.matrix[0] *= canvas.width / oldWidth;
      this.pinchZoom.transform.matrix[2] *= canvas.width / oldWidth;
      this.pinchZoom.transform.matrix[4] *= canvas.height / oldHeight;
      this.pinchZoom.transform.matrix[5] *= canvas.height / oldHeight;
      this.pinchZoom.setTransform(this.pinchZoom.transform);
  }
  var context = canvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  this.pinchZoom.transform.canvasSetTransform(context);

  var w = 555;
  var h = 260;

  for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
          context.drawImage(this.imageObj, x*w, y*h, w, h);
      }
  }
  context.restore();

  if (this.pinchZoom.isMoving()) {
      this.refresh();
  }
};

TiledViewer.prototype.debug = function(str) {
  //console.log(str);
};
