function TripGraphLayer(params) {
  this.params = params;
  this.renderer = params.renderer;
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
    this.drawNodePoint(context, pinchZoom, graph.nodes[i]);
  }
  for (var i in graph.nodes) {
    this.drawNodeLabel(context, pinchZoom, graph.nodes[i]);
  }
};

TripGraphLayer.drawBezier = function(context, pinchZoom, curve) {
  context.beginPath();

  var viewcurve = new Array(4);
  var points = curve.points;
  for (var j = 0; j < 4; ++j) {
    viewcurve[j] = pinchZoom.viewerPosFromWorldPos(points[j]);
  }
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

TripGraphLayer.prototype.drawNodePoint = function(context, pinchZoom, node) {
  var pos = pinchZoom.viewerPosFromWorldPos(node.coord);
  drawPoint(context, pos, this.renderer.pixelRatio, node.properties || {});
};

TripGraphLayer.prototype.drawNodeLabel = function(context, pinchZoom, node) {
  var pos = pinchZoom.viewerPosFromWorldPos(node.coord);
  if (node.label) {
    drawText(context, node.label, pos, this.renderer.pixelRatio, node.properties || {});
  }
};

function drawPoint(context, p, pixelRatio, properties) {
    context.strokeStyle = "rgba(0,0,0,1)";
    context.fillStyle = "rgba(255,255,255,1)";
    context.lineWidth = 2 * pixelRatio;
    context.beginPath();
    context.arc(p.x, p.y, (properties.radius || 6) * pixelRatio,
                0, 2 * Math.PI, false);
    context.stroke();
    context.fill();
}

function drawText(context, text, pos, pixelRatio, properties) {
  var offset = (properties.textOffset || 20) * pixelRatio;

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

  var fontSize = properties.fontSize || 20;
  context.font = (fontSize * pixelRatio) + 'px '
    + properties.font || 'Roboto, "Helvetica Neue", HelveticaNeue, "Helvetica-Neue", Helvetica, Arial, "Lucida Grande", sans-serif';
  context.strokeStyle = properties.stroke || 'rgba(255,255,255,.8)';
  context.lineWidth = (properties.haloWidth || 4) * pixelRatio;
  context.strokeText(text, x, y);

  context.fillStyle = properties.fill || 'rgba(0,0,0,1)';
  context.fillText(text, x, y);
}

