function AffineTransform(transform) {
  if (transform instanceof Array && transform.length == 6) {
    this.matrix = transform.slice(0);
  } else if (transform && matrix in transform) {
    this.matrix = transform.matrix.slice(0);
  } else {
    this.matrix = [1,0,0, 0,1,0];
  }
}

AffineTransform.prototype.transform = function (x_, y_) {
  var x = (typeof(x_) == "object" ? x_.x : x_);
  var y = (typeof(x_) == "object" ? x_.y : y_);
  
  return {
    x: this.matrix[0] * x + this.matrix[1] * y + this.matrix[2],
    y: this.matrix[3] * x + this.matrix[4] * y + this.matrix[5],
  };
};

AffineTransform.prototype.inverseTransform = function (x_, y_) {
  var x = (typeof(x_) == "object" ? x_.x : x_);
  var y = (typeof(x_) == "object" ? x_.y : y_);

  // We want u,v where
  // a b * u + e = x
  // c d   v   f = y
  var a = this.matrix[0];
  var b = this.matrix[1];
  var c = this.matrix[3];
  var d = this.matrix[4];

  var invdet = 1 / (a * d - b * c);
  var u = x - this.matrix[2];
  var v = y - this.matrix[5];
  return {
    x: (d * u - b * v) * invdet,
    y: (-c * u + a * v) * invdet, 
  };  
};

AffineTransform.prototype.scale = function (scaleFactor) {
  this.matrix[0] *= scaleFactor;
  this.matrix[1] *= scaleFactor;
  this.matrix[3] *= scaleFactor;
  this.matrix[4] *= scaleFactor;
};

AffineTransform.prototype.canvasSetTransform = function(canvas) {
  var t = this.matrix;
  canvas.setTransform(t[0], t[3], t[1], t[4], t[2], t[5]);
};
