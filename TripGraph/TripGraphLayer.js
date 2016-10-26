'use strict';

function TripGraphLayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  this.defaultRadius = params.defaultRadius || 6;
  this.icons = {};

  if (!this.renderer) {
    throw(new Error("TripGraphLayer: no renderer !"));
  }
  this.graph = params.graph || new TripGraph();
}

TripGraphLayer.prototype.draw = function(canvas, pinchZoom,
                                      bboxTopLeft, bboxBottomRight) {
  var graph = this.graph;
  var me = this;
  var context = canvas.getContext('2d');
  var pixelRatio = this.renderer.pixelRatio;

  graph.edges.forEach(function(edge) {
    var bezier = graph.bezier(edge);
    if (bezier) {
      me.setEdgeStrokeStyle(context, edge);
      TripGraphLayer.drawBezier(context, pinchZoom, bezier, pixelRatio);
    }
  });


  for (var i in graph.nodes) {
    var node = graph.nodes[i];
    node.viewerPos = pinchZoom.viewerPosFromWorldPos(node.coord);
  }

  for (var i in graph.nodes) {
    this.drawNodePoint(context, pinchZoom, graph.nodes[i]);
  }
  for (var i in graph.nodes) {
    this.drawLeaderLine(context, pinchZoom, graph.nodes[i]);
  }
  for (var i in graph.nodes) {
    this.drawNodeLabel(context, pinchZoom, graph.nodes[i]);
  }
};

TripGraphLayer.drawBezier = function(context, pinchZoom, curve, pixelRatio) {

  var ptArray = new Array(8);
  var points = curve.points;
  for (var j = 0; j < 4; ++j) {
    var p = pinchZoom.viewerPosFromWorldPos(points[j]);
    ptArray[j * 2] = p.x;
    ptArray[j * 2 + 1] = p.y;
  }

  var bezier = new Bezier(ptArray);
  var l = bezier.length();
  var numArrows = Math.min(2, Math.floor(l / (pixelRatio * 30)));
  var size = 10 * pixelRatio;

  for (var i = 1; i < numArrows; ++i) {
    var t = i / numArrows;
    var p = bezier.get(t);
    var n = bezier.normal(t);
    var tangent = new Point(bezier.derivative(t));
    tangent.mul(size / tangent.norm());
    p = Point.plus(p, Point.times(.5, tangent));
    var base = Point.minus(p, tangent);

    context.beginPath();
    context.moveTo(base.x + (size/2) * n.x, base.y + (size/2) * n.y);
    context.lineTo(p.x, p.y);
    context.lineTo(base.x - (size/2) * n.x, base.y - (size/2) * n.y);
    context.closePath();
    context.fill();
  }

  var viewcurve = bezier.points;

  context.beginPath();
  context.moveTo(viewcurve[0].x, viewcurve[0].y);
  context.bezierCurveTo(
      viewcurve[1].x, viewcurve[1].y,
      viewcurve[2].x, viewcurve[2].y,
      viewcurve[3].x, viewcurve[3].y);

  context.stroke();
};

TripGraphLayer.prototype.setEdgeStrokeStyle = function(context, edge) {
  var style = edge.lineColor || '#003300';
  context.strokeStyle = style;
  context.fillStyle = style;
  context.lineWidth = this.renderer.pixelRatio * (edge.lineWidth || 2);
};

TripGraphLayer.prototype.nodeRadius = function(node) {
  var r = this.defaultRadius;
  if (node.properties && node.properties.radius) {
    r = node.properties.radius;
  }
  return r * this.renderer.pixelRatio;
};

TripGraphLayer.prototype.drawNodePoint = function(context, pinchZoom, node) {
  if (node.properties && node.properties.point == false) {
    return;
  }
  var pos = node.viewerPos;
  this.drawPoint(context, pos, this.renderer.pixelRatio, node.properties || {});
};

TripGraphLayer.prototype.drawNodeLabel = function(context, pinchZoom, node) {
  if (node.label || node.labelIcon) {
    if (node.properties && node.properties.labelCoord) {
      var labelPoint = pinchZoom.viewerPosFromWorldPos(node.properties.labelCoord);
    }
    var pos = labelPoint || pinchZoom.viewerPosFromWorldPos(node.coord);
    if (node.label) {
      drawText(context, node.label, pos,
               this.renderer.pixelRatio, node.properties || {});
    }
    if (node.labelIcon && node.labelIcon.url in this.icons) {
      if (node.labelIcon.autorotate != undefined) {
        node.labelIcon.angle = node.labelIcon.autorotate + Math.atan2(
            node.coord.y - node.properties.labelCoord.y,
            node.coord.x - node.properties.labelCoord.x);
      }
      drawIcon(context, this.icons[node.labelIcon.url], node.labelIcon,
               pos, this.renderer.pixelRatio);
    }
  }
};

TripGraphLayer.prototype.drawLeaderLine = function(context, pinchZoom, node) {
  if (node.properties && node.properties.leaderLineAnchor) {
    var pixelRatio = this.renderer.pixelRatio;
    var p = pinchZoom.viewerPosFromWorldPos(node.properties.leaderLineAnchor);
    context.lineWidth = (node.properties.leaderLineWidth || 1) * pixelRatio;
    context.beginPath();

    var pos = pinchZoom.viewerPosFromWorldPos(node.coord);
    var radius = this.nodeRadius(node);
    var closest = pinchZoom.viewerPosFromWorldPos(
        closestPointToBbox(node.coord, node.properties.labelBbox));

    if (Point.dist(closest, pos) > (3*radius)) {
      if (node.properties.dashed) {
        var scaled = [];
        for (var i in node.properties.dashed) {
          scaled.push(this.renderer.pixelRatio * node.properties.dashed[i]);
        }
        context.setLineDash(scaled);
      }

      context.moveTo(p.x, p.y);
      context.lineTo(pos.x, pos.y);
      context.strokeStyle = node.properties.leaderLineColor || '#000000';
      context.stroke();
      if (node.properties.dashed) {
        context.setLineDash([]);
      }
    }
  }
};

TripGraphLayer.prototype.drawPoint = function(context, p, pixelRatio, properties) {
    context.strokeStyle = "rgba(0,0,0,1)";
    context.fillStyle = "rgba(255,255,255,1)";
    context.lineWidth = 2 * pixelRatio;
    context.beginPath();
    context.arc(p.x, p.y, (properties.radius || this.defaultRadius) * pixelRatio,
                0, 2 * Math.PI, false);
    context.stroke();
    context.fill();
};

function measureText(context, text, pixelRatio, properties) {
  var lines = text.split('\n');
  var size = setTextStyle(context, pixelRatio, properties);

  var r = { width: 0, height: size * lines.length };

  for (var i in lines) {
    r.width = Math.max(r.width, context.measureText(lines[i]).width);
  }
    
  return r; 
}

function setTextStyle(context, pixelRatio, properties) {
  properties = properties || {};
  var fontSize = properties.fontSize || 20;
  fontSize *= pixelRatio;
  context.font = fontSize + 'px ' + (properties.font || 'Helvetica');
  context.strokeStyle = properties.stroke || 'rgba(255,255,255,.8)';
  context.lineWidth = (properties.haloWidth || 4) * pixelRatio;
  context.fillStyle = properties.fill || 'rgba(0,0,0,1)';
  return fontSize;
};

function drawText(context, text, pos, pixelRatio, properties) {
  var offset = (properties.textOffset != undefined ? properties.textOffset : 20)
    * pixelRatio;

  var dx, dy;
  var placement = ((properties.textPlacement || 'S') + '').toUpperCase();

  // horizontal settings
  switch (placement) {
    default:
    case 'C':
    case 'N':
    case 'S':
      context.textAlign = 'center';
      dx = 0;
      break;

    case 'E':
    case 'NE':
      context.textAlign = 'start';
      dx = offset;
      break;

    case 'O':
    case 'W':
      context.textAlign = 'end';
      dx = -offset;
      break;
  }

  // vertical settings
  switch (placement) {
    case 'C':
    case 'E':
    case 'W':
    case 'O':
      context.textBaseline = 'middle';
      dy = 0;
      break;

    case 'N':
    case 'NE':
      context.textBaseline = 'bottom';
      dy = -offset;
      break;

    default:
    case 'S':
      context.textBaseline = 'top';
      dy = offset;
      break;
  }
  var x = pos.x + dx;
  var y = pos.y + dy;

  var h = setTextStyle(context, pixelRatio, properties);

  var lines = text.split('\n');

  var vshift = (lines.length - 1) / 2;
  for (var i in lines) {
    context.strokeText(lines[i], x, y + (i - vshift) * h);
    context.fillText(lines[i], x, y + (i - vshift) * h);
  }
}

function drawIcon(context, iconData, icon, pos, pixelRatio) {
  if (!iconData) {
    return;
  }
  var width = (icon.width ? icon.width * pixelRatio : 16 * pixelRatio);
  var height = (icon.height ? icon.height * pixelRatio : width);
  var ratioX = icon.ratioX || .5;
  var ratioY = icon.ratioY || .5;
  var dx = width * ratioX;
  var dy = height * ratioY;
  if (icon.angle) {
    context.save();
    context.translate(pos.x, pos.y);
    context.rotate(icon.angle);
    context.drawImage(iconData, -dx, -dy, width, height);
    context.restore();
  } else {
    context.drawImage(iconData, pos.x - dx, pos.y - dy, width, height);
  }
}

function bboxOverlaps(a, b) {
  if (a.max.x < b.min.x) return false; // a is left of b
  if (a.min.x > b.max.x) return false; // a is right of b
  if (a.max.y < b.min.y) return false; // a is above b
  if (a.min.y > b.max.y) return false; // a is below b
  return true; // boxes overlap
}

function bboxContains(box, p) {
  return ((p.x >= box.min.x) && (p.x <= box.max.x)
          && (p.y >= box.min.y) && (p.y <= box.max.y));
}

TripGraphLayer.prototype.getLabelIconSize = function(context, node) {
  var pixelRatio = this.renderer.pixelRatio;
  var labelIcon = node.labelIcon;

  return {
    width: (labelIcon.width || 16) * pixelRatio,
    height: (labelIcon.height || labelIcon.width || 16) * pixelRatio,
  };
};

// Modify TripGraph to place labels at appropriate places
TripGraphLayer.prototype.placeLabels = function(context) {
  var pinchZoom = this.renderer.pinchZoom;
  var pixelRatio = this.renderer.pixelRatio;
  var labelArray = [];
  var anchorArray = [];
  for (var i in this.graph.nodes) {
    var node = this.graph.nodes[i];
    if (!node.label && !node.labelIcon) {
      continue;
    }
    var pos = pinchZoom.viewerPosFromWorldPos(node.coord);
    var radius = this.defaultRadius;
    if (node.properties && node.properties.radius) {
      radius = node.properties.radius;
    }
    anchorArray.push({
      x: pos.x,
      y: pos.y,
      r: radius * pixelRatio
    });
    var margin = 2 * pixelRatio;

    var size, name;
    if (node.label) {
      size = measureText(context, node.label, pixelRatio, node.properties);
      name = node.label;
    } else if (node.labelIcon) {
      size = this.getLabelIconSize(context, node);
      name = 'icon:' + node.labelIcon.url;
    }
    labelArray.push({
      x: pos.x,
      y: pos.y,
      name: name,
      width: size.width + 2 * margin,
      height: size.height + 2 * margin,
      node: node
    });
  }
  var labeler = d3.labeler()
    .label(labelArray)
    .anchor(anchorArray)
    .width(this.renderer.canvas.width)
    .height(this.renderer.canvas.height);

  var originalEnergy = labeler.alt_energy();
  var me = this;
  var bezierCurves = [];
  var bezierBbox = [];
  var bezierLUT = [];
  for (var e in this.graph.edges) {
    var curve = this.graph.bezier(this.graph.edges[e]);
    bezierCurves.push(curve);
    var bbox = curve.bbox();
    bezierBbox.push({
      min: pinchZoom.viewerPosFromWorldPos(bbox.x.min, bbox.y.min),
      max: pinchZoom.viewerPosFromWorldPos(bbox.x.max, bbox.y.max)
    });
    var lut = curve.getLUT(30);
    var transformedLut = [];
    for (var i in lut) {
      transformedLut.push(pinchZoom.viewerPosFromWorldPos(lut[i]));
    }
    bezierLUT.push(transformedLut);
  }

  labeler.alt_energy(function(index, lab, anc) {
    var curveOverlaps = 0;

    var box = labeler.boxOfLabel(index);
    var labBbox = {
      min: new Point(box.left, box.top),
      max: new Point(box.right, box.bottom)
    };

    for (var i in bezierCurves) {
      if (!bboxOverlaps(bezierBbox[i], labBbox)) {
        continue;
      }

      var lut = bezierLUT[i];
      for (var j in lut) {
        if (bboxContains(labBbox, lut[j])) {
          curveOverlaps++;
        }
      }
    }
    return curveOverlaps * 10 + originalEnergy(index);
  });

  var finalEnergy = labeler.start(5000, 1);

  for (var i in labelArray) {
    var entry = labelArray[i];
    if (!entry.node.properties) {
      entry.node.properties = {};
    }
    var properties = entry.node.properties;
    var halfSize = Point.times(1/2, new Point(entry.width, entry.height));
    properties.labelCoord = pinchZoom.worldPosFromViewerPos(entry);
    properties.labelBbox = {
      min: pinchZoom.worldPosFromViewerPos(Point.minus(entry, halfSize)),
      max: pinchZoom.worldPosFromViewerPos(Point.plus(entry, halfSize))
    };

    TripGraph.placeLeaderLine(entry.node);
    properties.textPlacement = 'C';
    properties.textOffset = 0;
  }
}

function shallowCopy( original )  
{
    // First create an empty object with
    // same prototype of our original source
    var clone = Object.create( Object.getPrototypeOf( original ) ) ;

    var i , keys = Object.getOwnPropertyNames( original ) ;

    for ( i = 0 ; i < keys.length ; i ++ )
    {
        // copy each property into the clone
        Object.defineProperty( clone , keys[ i ] ,
            Object.getOwnPropertyDescriptor( original , keys[ i ] )
        ) ;
    }

    return clone ;
}

TripGraphLayer.prototype.makeFusedGraph = function(graph) {
  graph = graph || this.graph;

  var renameDict = {};
  var fuseNodePair = function(a, b) {
    var r = shallowCopy(a);
    r.name = a.name + '' + b.name;
    r.label = a.label + '\n' + b.label;
    renameDict[a.name] = renameDict[b.name] = r.name;
    return r;
  };

  var lookup = function(name) {
    var r = name;
    while (r in renameDict) {
      r = renameDict[r];
    }
    return r;
  };

  var pinchZoom = this.renderer.pinchZoom;
  for (var i in graph.nodes) {
    var node = graph.nodes[i];
    node.viewerPos = pinchZoom.viewerPosFromWorldPos(node.coord);
  }

  var keptNodes = [];
  for (var j in graph.nodes) {
    var node = graph.nodes[j];

    if (!node.label) {
      continue;
    }

    var r = this.nodeRadius(node);
    var keep = true;

    for (var i in keptNodes) {
      var n = keptNodes[i];

      var dist = Point.dist(n.viewerPos, node.viewerPos);
      if (dist < (this.nodeRadius(n) + r)) {
        keptNodes[i] = fuseNodePair(n, node);
        keep = false;
        break;
      }
    }
    if (keep) {
      keptNodes.push(node);
    }
  }

  for (var j in graph.nodes) {
    var node = graph.nodes[j];

    if (!node.label) {
      keptNodes.push(node);
    }
  }


  var result = new TripGraph();

  for (var i in keptNodes) {
    var n = keptNodes[i];
    result.nodes[n.name] = n;
  }

  for (var i in graph.edges) {
    var edge = graph.edges[i];

    var na = lookup(edge.from);
    var nb = lookup(edge.to);

    if (na != nb) {
      var newEdge = shallowCopy(edge);
      newEdge.from = na;
      newEdge.to = nb;
      result.edges.push(newEdge);
    }
  }

  return result;
};

TripGraphLayer.prototype.forEachNode = function(cb) {
  for (var i in this.graph.nodes) {
    cb(this.graph.nodes[i]);
  }
};

TripGraphLayer.prototype.loadIcons = function(cb) {
  var me = this;
  this.iconsToLoad = 1;
  this.failedIcons = 0;
  var iconLoaded = function() {
    me.iconsToLoad--;
    if (cb && me.iconsToLoad == 0) {
      if (me.failedIcons > 0) {
        cb(new Error(me.failedIcons + ' icons failed to load.'));
      } else {
        cb();
      }
    }
  };

  this.forEachNode(function(node) {
    if (node.labelIcon) {
      var url = node.labelIcon.url;
      me.iconsToLoad++;
      me.renderer.loadImage(node.labelIcon.url,
        function(data) {
          me.icons[url] = data;
          iconLoaded();
        },
        function(err) {
          console.log('Failed to load: ' + url);
          me.failedIcons++;
          iconLoaded();
        }
      );
    }
  });

  iconLoaded();
};

TripGraphLayer.prototype.saveToObj = function() {
  return {
    graph: this.graph,
    location: this.renderer.location,
    defaultRadius: this.defaultRadius,
    width: this.renderer.canvas.width / this.renderer.pixelRatio,
    height: this.renderer.canvas.height / this.renderer.pixelRatio,
    world: this.renderer.layers[0].save()
  };
};

TripGraphLayer.prototype.saveToString = function() {
  return JSON.stringify(this.saveToObj());
};

TripGraphLayer.prototype.load = function(data) {
  if (typeof data == 'string') {
    data = JSON.parse(data);
  }
  this.graph = data.graph;
  this.defaultRadius = data.defaultRadius;

  for (var key in data.world) {
    this.renderer.layers[0].params[key] = data.world[key];
  }
};

