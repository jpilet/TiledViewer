/**
 * @author Julien Pilet
 */

function PinchZoom(element, transformChanged) {
  this.ongoingTouches = {};
  this.transform = new AffineTransform();
  this.transformChanged = transformChanged;
  
  var t = this;
  var e = element;
  e.addEventListener("touchstart", function(event) { t.handleStart(event); }, false);
  e.addEventListener("touchend", function(event) { t.handleEnd(event); }, false);
  e.addEventListener("touchmove", function(event) { t.handleMove(event); }, false);
  e.addEventListener("mousedown", function(event) { t.handleMouseDown(event); }, false);
  e.addEventListener("mousemove", function(event) { t.handleMouseMove(event); }, false);
  e.addEventListener("mouseup", function(event) { t.handleMouseUp(event); }, false);
  addWheelListener(element, function(event) { t.handleMouseWheel(event); });
  
  element.pinchZoomInstance = this;
  this.element = element;
}

PinchZoom.prototype.eventElement = function(event) {
  if (event.srcElement) { return event.srcElement; }
  else if (event.currentTarget) { return event.currentTarget; }
  else {
    return undefined;
  }
};

PinchZoom.prototype.setTransform = function(transform) {
  this.transform = new AffineTransform(transform);
  
  var viewerPos = Utils.eventPosInElementCoordinates(event, this.eventElement(event));
  if (this.ongoingTouches.mouse) {
    var viewerPos =  this.ongoingTouches.mouse.startViewerPos;
    this.ongoingTouches.mouse.startWorldPos = this.worldPosFromViewerPos(viewerPos.x, viewerPos.y);
  } else {
    this.ongoingTouches = {};
  }
};

PinchZoom.prototype.worldPosFromViewerPos = function(x, y) {
  return this.transform.inverseTransform(x, y);
};

PinchZoom.prototype.viewerPosFromWorldPos = function(x, y) {
  return this.transform.transform(x, y);
};

PinchZoom.prototype.handleMouseDown = function(event) {
    var viewerPos = Utils.eventPosInElementCoordinates(event, this.element);
    this.ongoingTouches.mouse = {
      startWorldPos: this.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
      startViewerPos: viewerPos,
    };
};

PinchZoom.prototype.handleMouseUp = function(event) {
  event.preventDefault();
  this.handleMouseMove(event);
  this.ongoingTouches.mouse = undefined;
};

PinchZoom.prototype.handleMouseMove = function(event) {
  event.preventDefault();
  
  if (this.ongoingTouches.mouse) {
    this.ongoingTouches.mouse.currentViewerPos = Utils.eventPosInElementCoordinates(event, this.element);
    var constraints = [{
      viewer: this.ongoingTouches.mouse.currentViewerPos,
      world: this.ongoingTouches.mouse.startWorldPos,
    }];
    this.processConstraints(constraints);
  }
};

PinchZoom.prototype.handleMouseWheel = function(event) {
  event.preventDefault();
  
  var viewerPos = Utils.eventPosInElementCoordinates(event, this.element);
  var constraints = [{
      viewer: viewerPos,
      world: this.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
  }];
  var scaleFactor = 1.0 - Math.max(-.2, Math.min(.2, event.deltaY / 20.0));
  
  this.transform.scale(scaleFactor);
  this.processConstraints(constraints);
};

PinchZoom.prototype.handleStart = function(event) {
	event.preventDefault();
	
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		var viewerPos = Utils.eventPosInElementCoordinates(touches[i], this.element);

		this.ongoingTouches[touches[i].identifier] = {
			startWorldPos: this.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
			startViewerPos: viewerPos,
		};
	}
};
	
PinchZoom.prototype.handleEnd = function(event) {
  // If one finger leaves the screen, we forget all finger positions. Thus, it
  // starts a new motion if some other fingers keep moving.
	for (var i in this.ongoingTouches) {
	  delete this.ongoingTouches[i];
	}
};

PinchZoom.prototype.handleMove = function(event) {
  event.preventDefault();
  var touches = event.touches;
  var constraints = [];
  for (var i = 0; i < touches.length; i++) {
		if (!this.ongoingTouches[touches[i].identifier]) {
			// For some reason, we did not get the start event.
			var viewerPos = Utils.eventPosInElementCoordinates(touches[i], this.element);
		  this.ongoingTouches[touches[i].identifier] = {
			  startWorldPos: this.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
			  startViewerPos: viewerPos,
		  };
		}
		var touch = this.ongoingTouches[touches[i].identifier];
		
		// Every touch is a constraint
		constraints.push({
			viewer: Utils.eventPosInElementCoordinates(touches[i], this.element),
			world: touch.startWorldPos,
		});
  }
  this.processConstraints(constraints);
};

PinchZoom.prototype.processConstraints = function(constraints) {
	// Compute the transform that best fits the constraints
	var T = this.transform.matrix;
	
	if (constraints.length >= 2) {
		// pinch -> zoom
		// solve:
		//   s * worldx + tx = viewerx
		//   s * worldy + ty = viewery
		// For each constraint:
		//  worldx 1 0  * s  = viewerx
		//  worldy 0 1    tx   viewery
		//                ty
		// Let A be the 4 by 3 matrix composed of the two constraints, as shown above.
		// The solution is computed with: [s tx ty]' = inverse(A' * A) * A' [viewerx viewery]'
		var wx1 = constraints[0].world.x;
		var wy1 = constraints[0].world.y;
		var wx2 = constraints[1].world.x;
		var wy2 = constraints[1].world.y;
		var vx1 = constraints[0].viewer.x;
		var vy1 = constraints[0].viewer.y;
		var vx2 = constraints[1].viewer.x;
		var vy2 = constraints[1].viewer.y;
		
		var AtA00 = wx1*wx1 + wx2*wx2 + wy1*wy1 + wy2*wy2;
		var AtA10 = wx1 + wx2;
		var AtA20 = wy1 + wy2;
		var Ainv = Utils.invert3x3Matrix([AtA00, AtA10, AtA20, AtA10, 2, 0, AtA20, 0, 2]);
		var AtB = [vx1*wx1 + vx2*wx2 + vy1*wy1 + vy2*wy2, vx1 + vx2, vy1 + vy2];
		var r = Utils.multiply3x3MatrixWithVector(Ainv, AtB);
		 
		T[0] = T[4] = r[0];
		T[2] = r[1];
		T[5] = r[2];
	} else if (constraints.length == 1) {
		// scroll: Solve A* world + X = viewer
		// -> X = viewer - A * world
		var c = constraints[0];
		T[2] = c.viewer.x - (T[0] * c.world.x + T[1] * c.world.y);
		T[5] = c.viewer.y - (T[3] * c.world.x + T[4] * c.world.y);
	}
  var tiledViewer = this;
  
  if (this.transformChanged) {
    this.transformChanged(this.transform);
  }
};
