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
  var type = geojson.geometry && geojson.geometry.type;
  if (!type) {
    return;
  }
  var funcName = 'render' + type;
  if (this[funcName]) {
    this[funcName](canvas, pinchZoom, geojson, context);
  }
}

POILayer.prototype.featureRadius = function() {
  return this.params.radius * this.renderer.pixelRatio;
}

POILayer.prototype.renderPoint = function(canvas, pinchZoom, geojson, context) {
  var geom = geojson.geometry;
  var radius = this.featureRadius();

  var coord = geojsonGetCoordinates(geojson);
  var p = pinchZoom.viewerPosFromWorldPos(coord.x, coord.y);

  if (!geojson.properties.hideIcon && geojson.properties.circled) {
    context.strokeStyle = "rgba(255,255,255,.8)";
    context.lineWidth = 5 * this.renderer.pixelRatio;
    context.beginPath();
    context.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
    context.stroke();
  }

  if (!geojson.properties.hideIcon && geojson.properties.icon && this.icons[geojson.properties.icon]) {
    var size = radius * 2;
    context.drawImage(this.icons[geojson.properties.icon],
                      p.x - size / 2,
                      p.y - size / 2,
                      size, size);
  }

  if (geojson.properties.text) {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = (20 * this.renderer.pixelRatio) + 'px sans-serif';
    context.fillStyle = geojson.properties.fill || '#ffffff';
    context.strokeStyle = geojson.properties.stroke || '#000000';
    context.lineWidth = 8 * this.renderer.pixelRatio;
    context.strokeText(geojson.properties.text, p.x, p.y);
    context.fillText(geojson.properties.text, p.x, p.y);
  }
};

POILayer.prototype.renderPolygon = function(canvas, pinchZoom, feature, context) {
  context.strokeStyle = feature.properties.stroke || '#000000';
  context.lineWidth =
    feature.properties['stroke-width'] * this.renderer.pixelRatio;
  context.fillStyle = feature.properties.fill || '#ffffff';

  var geojsonToView = function(point) {
    return pinchZoom.viewerPosFromWorldPos(Utils.latLonToWorld(point));
  }

  for (var j = 0; j < feature.geometry.coordinates.length; ++j) {
    var connectedPoly = feature.geometry.coordinates[j];
    var start = geojsonToView(connectedPoly[0]);
    context.beginPath();
    context.moveTo(start.x, start.y);
    for (var i = 1; i < connectedPoly.length; ++i) {
      var p = geojsonToView(connectedPoly[i]);
      context.lineTo(p.x, p.y);
    }
    context.closePath();
    context.fill();
    context.stroke();
  }
};

POILayer.prototype.handleClic = function(pos) {
  var bestDist =
    this.renderer.pinchZoom.worldDistanceFromViewerDistance(this.featureRadius());
  var bestFeature = undefined;

  forEachFeature(this.params.geojson, function(feature) {
    if (!feature.properties.hideIcon && feature.geometry.type != 'Point') {
      return;
    }
    var featureCoord = geojsonGetCoordinates(feature);
    var d = Utils.distance(featureCoord, pos.startWorldPos);
    if (bestDist == undefined || d < bestDist) {
      bestDist = d;
      bestFeature = feature;
    }
  });

  this.params.onFeatureClic(bestFeature, pos);
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
