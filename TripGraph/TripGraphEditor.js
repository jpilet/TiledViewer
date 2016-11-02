

function TripGraphEditor(renderer, graph) {
  this.graph = graph;
  this.renderer = renderer;
  this.applyDelta = undefined;
  this.selectedLabel = undefined;
  this.selectedBezier = undefined;
}

function nearestPoint(target, points) {
  var best;
  var bestDist;
  var bestIndex;
  for (var i in points) {
    var p = points[i];
    var dist = Point.dist(p, target);
    if (best == undefined || dist < bestDist) {
      bestDist = dist;
      best = p;
      bestIndex = i;
    }
  }
  console.log('best index: ' + bestIndex);
  return best;
};

TripGraphEditor.prototype.acceptTouchEvent = function(viewer, world, type) {
  if (type == 'wheel') {
    return false;
  }

  this.startWorldPos = world;
  var clickedLabel = this.findLabelAtWorldPos(world);
  if (clickedLabel) {
    this.selectLabel(clickedLabel);
    var properties = clickedLabel.properties;
    this.applyDelta = function(delta) {
      properties.labelCoord.x += delta.x;
      properties.labelCoord.y += delta.y;
      properties.labelBbox.min.x += delta.x;
      properties.labelBbox.min.y += delta.y;
      properties.labelBbox.max.x += delta.x;
      properties.labelBbox.max.y += delta.y;
      TripGraph.placeLeaderLine(clickedLabel);
    };
    return true;
  } else {
    var p = this.closestBezier(world);

    var threshold = this.renderer.pinchZoom.worldDistanceFromViewerDistance(
        10 * this.renderer.pixelRatio);

    if (p && p.d < threshold) {
      var me = this;
      var pointToMove = function(p) {
        me.applyDelta = function(delta) {
          var a = (Array.isArray(p) ? p: [p]);
          for (var i in a) {
            var point = a[i];
            point.x += delta.x;
            point.y += delta.y;
          }
        };
      };

      var movePointWithOpposite = function(a, pivot, b) {
        me.applyDelta = function(delta) {
          a.x += delta.x;
          a.y += delta.y;
          pivot.x += delta.x / 2;
          pivot.y += delta.y / 2;
        };
      }

      if (p.edge.controlPoints.length == 2) {
        pointToMove(p.edge.controlPoints[p.t < .5 ? 0 : 1]);
      } else if (p.edge.controlPoints.length == 5) {
        if (p.bezier.points[1].x == p.edge.controlPoints[0].x
            && p.bezier.points[1].y == p.edge.controlPoints[0].y) {
          if (p.t < .5) {
            pointToMove(p.edge.controlPoints[0]);
          } else if (p.t < .9) {
            movePointWithOpposite(p.edge.controlPoints[1],
                                  p.edge.controlPoints[2],
                                  p.edge.controlPoints[3]);
          } else {
            pointToMove([p.edge.controlPoints[1],
                        p.edge.controlPoints[2],
                        p.edge.controlPoints[3]]);
          }
        } else {
          if (p.t < .1) {
            pointToMove([p.edge.controlPoints[1],
                        p.edge.controlPoints[2],
                        p.edge.controlPoints[3]]);
          } else if (p.t < .5) {
            movePointWithOpposite(p.edge.controlPoints[3],
                                  p.edge.controlPoints[2],
                                  p.edge.controlPoints[1]);
          } else {
            pointToMove(p.edge.controlPoints[4]);
          }
        }
      } else {
        pointToMove(nearestPoint(world, p.edge.controlPoints));
      }
      this.selectBezier(p);
      return true;
    }
  }

  this.applyDelta = undefined;
  return false;
};

TripGraphEditor.prototype.selectLabel = function(label) {
  if (this.selectedLabel) {
    delete this.selectedLabel.properties.frame;
  }
  this.selectedLabel = undefined;
  this.selectBezier();
  this.selectedLabel = label;
  if (this.onLabelSelect) {
    this.onLabelSelect(label);
  }
  if (label) {
    label.properties = label.properties || {};
    label.properties.frame = '#000000';
  }
  this.renderer.refreshIfNotMoving();
};

TripGraphEditor.prototype.deselectLabel =
  function() { return this.selectLabel(); };

TripGraphEditor.prototype.handleMouseDown = function(event) {
  event.preventDefault();
};

TripGraphEditor.prototype.handleMouseMove = function(event) {
  event.preventDefault();
  var viewerPos = Utils.eventPosInElementCoordinates(event, event.srcElement);
  this.handleMotion(viewerPos);
}

TripGraphEditor.prototype.handleMotion = function(viewerPos) {
  if (!this.applyDelta) {
    return;
  }

  var worldPos = this.renderer.pinchZoom.worldPosFromViewerPos(
      viewerPos.x, viewerPos.y);

  var delta = {
    x: worldPos.x - this.startWorldPos.x,
    y: worldPos.y - this.startWorldPos.y
  };
  this.startWorldPos = worldPos;

  this.applyDelta(delta);
  this.renderer.refreshIfNotMoving();
};

TripGraphEditor.prototype.handleMouseUp = function(event) {
  event.preventDefault();
  this.applyDelta = undefined;
};

TripGraphEditor.prototype.handleMouseWheel = function(event) {
  event.preventDefault();
};

TripGraphEditor.prototype.handleStart = function(event) {
  event.preventDefault();
};

TripGraphEditor.prototype.handleEnd = function(event) {
  event.preventDefault();
  this.applyDelta = undefined;
};

TripGraphEditor.prototype.handleMove = function(event) {
  event.preventDefault();
  if (event.touches.length != 1) {
    this.applyDelta = undefined;
    return;
  }

  var viewerPos = Utils.eventPosInElementCoordinates(event.touches[0],
                                                     event.srcElement);
  this.handleMotion(viewerPos);
};

TripGraphEditor.prototype.closestBezier = function(p) {
  var nearest;
  for (var i in this.graph.edges) {
    var e = this.graph.edges[i];
    var curves = this.graph.bezier(e);
    for (var i in curves) {
      var b = curves[i];
      var candidate = b.project(p);
      if (!nearest || candidate.d < nearest.d) {
        nearest = candidate;
        nearest.edge = e;
        nearest.bezier = b;
      }
    }
  }
  return nearest;
};
TripGraphEditor.prototype.findLabelAtWorldPos = function(pos) {
  for (var i in this.graph.nodes) {
    var node = this.graph.nodes[i];
    if (node.properties && node.properties.labelBbox
        && bboxContains(node.properties.labelBbox, pos)) {
      return node;
    }
  }
  return undefined;
};

TripGraphEditor.prototype.selectBezier = function(b) {
  if (this.selectedBezier) {
    var edge = this.selectedBezier.edge;
    delete edge.drawMiddlePoint;
    if (edge._lineWidth != undefined) {
      edge.lineWidth = edge._lineWidth;
      delete edge._lineWidth;
    } else {
      delete edge.lineWidth;
    }
  }
  this.selectedBezier = b;

  if (b) {
    var edge = b.edge;
    edge.drawMiddlePoint = true;
    if (edge._lineWidth != undefined) {
      edge._lineWidth = edge.lineWidth;
    }
    edge.lineWidth = 5;
  }
  if (this.selectedLabel) {
    this.deselectLabel();
  }
  this.renderer.refreshIfNotMoving();
};

TripGraphEditor.prototype.splitCurve = function() {
  if (!this.selectedBezier) {
    return;
  }

  var edge = this.selectedBezier.edge;

  this.graph.splitEdge(edge);
};
