

function TripGraphEditor(renderer, graph) {
  this.graph = graph;
  this.renderer = renderer;
  this.startInfo = undefined;
}

TripGraphEditor.prototype.acceptTouchEvent = function(viewer, world, type) {
  if (type == 'wheel') {
    return false;
  }
  var p = this.closestBezier(world);

  var threshold = this.renderer.pinchZoom.worldDistanceFromViewerDistance(
      10 * this.renderer.pixelRatio);

  if (p && p.d < threshold) {
    this.startInfo = p;
    this.startWorldPos = world;
    return true;
  }
  return false;
};

TripGraphEditor.prototype.handleMouseDown = function(event) {
  event.preventDefault();
};

TripGraphEditor.prototype.handleMouseMove = function(event) {
  event.preventDefault();
  var viewerPos = Utils.eventPosInElementCoordinates(event, event.srcElement);
  this.handleMotion(viewerPos);
}

TripGraphEditor.prototype.handleMotion = function(viewerPos) {
  if (!this.startInfo) {
    return;
  }

  var worldPos = this.renderer.pinchZoom.worldPosFromViewerPos(
      viewerPos.x, viewerPos.y);
  var t = this.startInfo.t;

  var delta = {
    x: worldPos.x - this.startWorldPos.x,
    y: worldPos.y - this.startWorldPos.y
  };
  this.startWorldPos = worldPos;

  var controls = this.startInfo.edge.controlPoints;
  var i = (t < .5 ? 0 : 1);
  controls[i].x += delta.x;
  controls[i].y += delta.y;

  this.renderer.refreshIfNotMoving();
};

TripGraphEditor.prototype.handleMouseUp = function(event) {
  event.preventDefault();
  this.startInfo = undefined;
};

TripGraphEditor.prototype.handleMouseWheel = function(event) {
  event.preventDefault();
};

TripGraphEditor.prototype.handleStart = function(event) {
  event.preventDefault();
};

TripGraphEditor.prototype.handleEnd = function(event) {
  event.preventDefault();
  this.startInfo = undefined;
};

TripGraphEditor.prototype.handleMove = function(event) {
  event.preventDefault();
  if (event.touches.length != 1) {
    this.startInfo = undefined;
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
    var b = this.graph.bezier(e);
    if (b) {
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
