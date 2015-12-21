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

var geojsonToView = function(pinchZoom, point) {
  return pinchZoom.viewerPosFromWorldPos(Utils.latLonToWorld(point));
};

function renderPath(context, pinchZoom, points, closed) {
  var start = geojsonToView(pinchZoom, points[0]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  for (var i = 1; i < points.length; ++i) {
    var p = geojsonToView(pinchZoom, points[i]);
    context.lineTo(p.x, p.y);
  }
  if (closed) {
    context.closePath();
  }
}

POILayer.prototype.renderPolygon = function(canvas, pinchZoom, feature, context) {
  context.strokeStyle = feature.properties.stroke || '#000000';
  context.lineWidth =
    feature.properties['stroke-width'] * this.renderer.pixelRatio;
  context.fillStyle = feature.properties.fill || '#ffffff';

  for (var j = 0; j < feature.geometry.coordinates.length; ++j) {
    var connectedPoly = feature.geometry.coordinates[j];
    renderPath(context, pinchZoom, connectedPoly, true);
    context.fill();
    context.stroke();
  }
};

POILayer.prototype.renderLineString =
    function(canvas, pinchZoom, feature, context) {
  context.lineWidth =
    (feature.properties['stroke-width'] || 5) * this.renderer.pixelRatio;
  context.strokeStyle = feature.properties.stroke || '#000000';
  context.lineCap = 'round';

  renderPath(context, pinchZoom, feature.geometry.coordinates, false);
  context.stroke();
};


POILayer.prototype.handleClic = function(pos) {
  var bestDist =
    this.renderer.pinchZoom.worldDistanceFromViewerDistance(this.featureRadius());
  var bestFeature = undefined;

  forEachFeature(this.params.geojson, function(feature) {
    if (feature.geometry.type != 'Point' || feature.properties.hideIcon) {
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

function getPathVisibleCoordinates(points, array) {
  for (var i = 0; i < points.length; ++i) {
    array.push(Utils.latLonToWorld(points[i]));
  }
}

POILayer.prototype.visibleCoordinateArray = function() {
  var me = this;

  var result = [];

  var f = {
    'Point' : function(feature, result) {
      if (!('hideIcon' in feature.properties) || !feature.properties.hideIcon) {
        result.push(geojsonGetCoordinates(feature));
      }
    },
    'Polygon' : function(feature, result) {
      for (var j = 0; j < feature.geometry.coordinates.length; ++j) {
        getPathVisibleCoordinates(feature.geometry.coordinates[j], result);
      }
    },
    'LineString': function(feature, result) {
      getPathVisibleCoordinates(feature.geometry.coordinates, result);
    },
  };

  forEachFeature(geojson, function(feature) {
    var type = feature.geometry && feature.geometry.type;
    if (type && f[type]) {
      f[type](feature, result);
    }
  });

  return result;
};

function boundingBox(coords) {
  var result = {
    min: { x: undefined, y: undefined},
    max: { x: undefined, y: undefined}
  };
  if (coords.length == 0) {
    return result;
  }
  result.min.x = result.max.x = coords[0].x;
  result.min.y = result.max.y = coords[0].y;
  for (var i = 1; i < coords.length; ++i) {
    result.min.x = Math.min(result.min.x, coords[i].x);
    result.min.y = Math.min(result.min.y, coords[i].y);
    result.max.x = Math.max(result.max.x, coords[i].x);
    result.max.y = Math.max(result.max.y, coords[i].y);
  }
  return result;
}

POILayer.prototype.getVisibleFeatureLocation = function(minScale, margin) {
  var bbox = boundingBox(this.visibleCoordinateArray());
  var ratio = this.renderer.canvas.width / this.renderer.canvas.height;
  var width = bbox.max.x - bbox.min.x;
  var height = bbox.max.y - bbox.min.y;
  margin = margin || 1.1;
  return {
    x: width / 2 + bbox.min.x,
    y: height / 2 + bbox.min.y,
    scale: Math.max(width * margin, height * ratio * margin, minScale)
  };
};

POILayer.prototype.zoomOnVisibleFeatures = function(minScale, margin) {
  this.renderer.setLocation(this.getVisibleFeatureLocation(minScale, margin));
};
