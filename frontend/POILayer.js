function POILayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  if (!this.renderer) {
    throw(new Error("POILayer: no renderer !"));
  }

  params.radius = params.radius || 32;
  params.color = params.color || '#008800';

  if (params.debug) {
      this.debug = function(msg) { console.log(msg); }
  } else {
      this.debug = function(msg) { };
  }

  this.renderer.addLayer(this);
}


POILayer.prototype.draw = function(canvas, pinchZoom,
                                   bboxTopLeft, bboxBottomRight) {
  var radius = this.params.radius * this.renderer.pixelRatio;
  var geojson = this.params.geojson;
  this.renderGeoJson(canvas, pinchZoom, geojson);
}

POILayer.prototype.renderGeoJson = function(canvas, pinchZoom, geojson) {
  if (geojson.type == "FeatureCollection") {
    this.renderFeatureCollection(canvas, pinchZoom, geojson);
  } else if (geojson.type == "Feature") {
    this.renderFeature(canvas, pinchZoom, geojson);
  }
};

POILayer.prototype.renderFeatureCollection = function(canvas, pinchZoom, geojson) {
  var context = canvas.getContext('2d');
  context.strokeStyle = '#003300';
  context.lineWidth = 1;
  context.fillStyle = this.params.color;

  var n = geojson.features.length;
  for (var i = 0; i < n; ++i) {
    this.renderFeature(canvas, pinchZoom, geojson.features[i]);
  }
};

POILayer.prototype.renderFeature = function(canvas, pinchZoom, geojson) {
  var geom = geojson.geometry;
  if (geom.type == "Point") {
    var coord = Utils.latLonToWorld(geom.coordinates);
    var p = pinchZoom.viewerPosFromWorldPos(coord[0], coord[1]);

    var context = canvas.getContext('2d');
    context.beginPath();
    context.arc(p.x, p.y, this.params.radius, 0, 2 * Math.PI, false);
    context.stroke();
    context.fill();
  }
};
