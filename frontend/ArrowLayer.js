function ArrowLayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  if (!this.renderer) {
    throw(new Error("ArrowLayer: no renderer !"));
  }

  this.icons = { };

  this.params.color = params.color || '#000000';
  this.params.width = 100;
  this.point = (params.point ? params.point : undefined);

  if (params.debug) {
      this.debug = function(msg) { console.log(msg); }
  } else {
      this.debug = function(msg) { };
  }

  this.renderer.addLayer(this);
};

ArrowLayer.prototype.setPoint = function(point) {
  this.point = point;
  this.renderer.refreshIfNotMoving();
};

ArrowLayer.prototype.draw = function(canvas, pinchZoom,
                                   bboxTopLeft, bboxBottomRight) {
  if (!this.point) {
    return;
  }

  var p = pinchZoom.viewerPosFromWorldPos(this.point.x, this.point.y);

  var context = canvas.getContext("2d");
  context.fillStyle = this.params.color;
  context.beginPath();
  var w = this.params.width * this.renderer.pixelRatio;
  context.moveTo(p.x - w / 2, canvas.height);
  context.lineTo(p.x + w / 2, canvas.height);
  context.lineTo(p.x, p.y);
  context.closePath();
  context.fill();
};

