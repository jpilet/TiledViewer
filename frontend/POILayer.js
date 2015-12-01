function POILayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  if (!this.renderer) {
    throw(new Error("POILayer: no renderer !"));
  }

  this.icons = { };

  params.radius = params.radius || 16;
  params.color = params.color || '#008800';
  params.onFeatureClic = params.onFeatureClic || function(feature, pos) { };

  if (params.debug) {
      this.debug = function(msg) { console.log(msg); }
  } else {
      this.debug = function(msg) { };
  }

  this.renderer.addLayer(this);
  var me = this;
  this.renderer.pinchZoom.onClic = function(pos) {
    me.handleClic(pos);
  };
}

function forEachFeature(geojson, callback) {
  if (geojson.type == "FeatureCollection") {
    var n = geojson.features.length;
    for (var i = 0; i < n; ++i) {
      this.forEachFeature(geojson.features[i], callback);
    }
  } else if (geojson.type == "Feature") {
    callback(geojson);
  }
}

function geojsonGetCoordinates(feature) {
  var geom = feature.geometry;
  if (!geom) {
    return undefined;
  }

  if (!geom.osmCoordinates) {
    var coord = Utils.latLonToWorld(geom.coordinates);
    geom.osmCoordinates = coord;
  } else {
    var coord = geom.osmCoordinates;
  }

  return coord;
}

POILayer.prototype.draw = function(canvas, pinchZoom,
                                   bboxTopLeft, bboxBottomRight) {
  var geojson = this.params.geojson;

  var context = canvas.getContext('2d');
  context.strokeStyle = '#003300';
  context.lineWidth = 1;

  var me = this;
  forEachFeature(geojson, function(feature) {
    me.renderFeature(canvas, pinchZoom, feature, context);
  });
}

POILayer.prototype.renderFeature = function(canvas, pinchZoom, geojson, context) {
  var geom = geojson.geometry;
  var radius = this.params.radius * this.renderer.pixelRatio;

  if (geom.type == "Point") {
    var coord = geojsonGetCoordinates(geojson);
    var p = pinchZoom.viewerPosFromWorldPos(coord.x, coord.y);

    if (geojson.properties.icon && this.icons[geojson.properties.icon]) {
      var size = radius * 2;
      context.drawImage(this.icons[geojson.properties.icon],
                        p.x - size / 2,
                        p.y - size / 2,
                        size, size);
    } else {
      context.fillStyle = geojson.fillStyle || this.params.color;
      context.beginPath();
      context.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
      context.stroke();
      context.fill();
    }
  }
};

POILayer.prototype.handleClic = function(pos) {
  var bestDist = undefined;
  var bestFeature = undefined;

  forEachFeature(this.params.geojson, function(feature) {
    var featureCoord = geojsonGetCoordinates(feature);
    var d = Utils.distance(featureCoord, pos.startWorldPos);
    if (bestDist == undefined || d < bestDist) {
      bestDist = d;
      bestFeature = feature;
    }
  });

  if (bestFeature) {
    this.params.onFeatureClic(bestFeature, pos);
  }
};

POILayer.prototype.loadIcon = function(name, url) {
  if (name in this.icons) {
    return this.icons[name];
  }

  var icon = new Image();
  icon.src = url;
  var me = this;
  icon.onload = function() {
    me.renderer.refreshIfNotMoving();
    me.icons[name] = icon;
  }
  icon.onerror = function() {
    console.log(name + ": can't load icon from: " + url);
  }

  return icon;
}
