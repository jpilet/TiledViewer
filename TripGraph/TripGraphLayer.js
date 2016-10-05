'use strict';

function TripGraphLayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  this.defaultRadius = params.defaultRadius || 6;
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

  graph.edges.forEach(function(edge) {
    var bezier = graph.bezier(edge);
    if (bezier) {
      me.setEdgeStrokeStyle(context, edge);
      TripGraphLayer.drawBezier(context, pinchZoom, bezier);
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

TripGraphLayer.drawBezier = function(context, pinchZoom, curve) {
  context.beginPath();

  var ptArray = new Array(8);
  var points = curve.points;
  for (var j = 0; j < 4; ++j) {
    var p = pinchZoom.viewerPosFromWorldPos(points[j]);
    ptArray[j * 2] = p.x;
    ptArray[j * 2 + 1] = p.y;
  }

  var bezier = new Bezier(ptArray);
  var l = bezier.length();
  var numArrows = Math.min(2, Math.floor(l / 60));
  var size = 10;
  for (var i = 1; i < numArrows; ++i) {
    var t = i / numArrows;
    var p = bezier.get(t);
    var n = bezier.normal(t);
    var tangent = new Point(bezier.derivative(t));
    tangent.mul(size / tangent.norm());
    var base = Point.minus(p, tangent);

    context.moveTo(base.x + (size/2) * n.x, base.y + (size/2) * n.y);
    context.lineTo(p.x, p.y);
    context.lineTo(base.x - (size/2) * n.x, base.y - (size/2) * n.y);
  }

  var viewcurve = bezier.points;

  context.moveTo(viewcurve[0].x, viewcurve[0].y);
  context.bezierCurveTo(
      viewcurve[1].x, viewcurve[1].y,
      viewcurve[2].x, viewcurve[2].y,
      viewcurve[3].x, viewcurve[3].y);

  context.stroke();
};

TripGraphLayer.prototype.setEdgeStrokeStyle = function(context, edge) {
  context.strokeStyle = edge.lineColor || '#003300';
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
  var pos = node.viewerPos;
  this.drawPoint(context, pos, this.renderer.pixelRatio, node.properties || {});
};

TripGraphLayer.prototype.drawNodeLabel = function(context, pinchZoom, node) {
  if (node.label) {

    if (node.properties && node.properties.labelCoord) {
      var labelPoint = pinchZoom.viewerPosFromWorldPos(node.properties.labelCoord);
    }
    var pos = pinchZoom.viewerPosFromWorldPos(node.coord);
    drawText(context, node.label, labelPoint || pos,
             this.renderer.pixelRatio, node.properties || {});
  }
};

TripGraphLayer.prototype.drawLeaderLine = function(context, pinchZoom, node) {
  if (node.label && node.properties && node.properties.leaderLineAnchor) {
    var pixelRatio = this.renderer.pixelRatio;
    var p = pinchZoom.viewerPosFromWorldPos(node.properties.leaderLineAnchor);
    context.lineWidth = pixelRatio;
    context.beginPath();

    var pos = pinchZoom.viewerPosFromWorldPos(node.coord);
    var radius = this.nodeRadius(node);
    if (Point.dist(p, pos) > (2*radius)) {
      context.moveTo(p.x, p.y);
      context.lineTo(pos.x, pos.y);
      context.strokeStyle = '#000000';
      context.stroke();
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
  var size = setTextStyle(context, pixelRatio, properties);
  return {
    width: context.measureText(text).width,
    height: size
  }; 
}

function setTextStyle(context, pixelRatio, properties) {
  properties = properties || {};
  var fontSize = properties.fontSize || 20;
  fontSize *= pixelRatio;
  context.font = fontSize + 'px '
    + properties.font || 'Roboto, "Helvetica Neue", HelveticaNeue, "Helvetica-Neue", Helvetica, Arial, "Lucida Grande", sans-serif';
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

  setTextStyle(context, pixelRatio, properties);

  context.strokeText(text, x, y);
  context.fillText(text, x, y);
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

// Modify TripGraph to place labels at appropriate places
TripGraphLayer.prototype.placeLabels = function(context) {
  var pinchZoom = this.renderer.pinchZoom;
  var pixelRatio = this.renderer.pixelRatio;
  var labelArray = [];
  var anchorArray = [];
  for (var i in this.graph.nodes) {
    var node = this.graph.nodes[i];
    if (!node.label) {
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
    var size = measureText(context, node.label, pixelRatio, node.properties);
    var margin = 2 * pixelRatio;
    labelArray.push({
      x: pos.x,
      y: pos.y,
      name: node.label,
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
    properties.labelCoord = pinchZoom.worldPosFromViewerPos(entry);
    properties.leaderLineAnchor = pinchZoom.worldPosFromViewerPos(labeler.closestLineAnchorPoint(anchorArray[i], labeler.boxOfLabel(i)));
    properties.textPlacement = 'C';
    properties.textOffset = 0;
  }
}

TripGraphLayer.prototype.makeFusedGraph = function(graph) {
  graph = graph || this.graph;

  var renameDict = {};
  var fuseNodePair = function(a, b) {
    var r = Object.create(a);
    r.name = a.name + '' + b.name;
    r.label = a.label + ', ' + b.label;
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
      var newEdge = Object.create(edge);
      newEdge.from = na;
      newEdge.to = nb;
      result.edges.push(newEdge);
    }
  }

  return result;
};
