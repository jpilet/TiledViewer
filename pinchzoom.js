/**
 * @author Julien Pilet
 */

function PinchZoom(element, transformChanged) {
  this.ongoingTouches = {};
  this.transform = new AffineTransform();
  this.transformChanged = transformChanged;
  
  element.addEventListener("touchstart", this.handleStart, false);
  element.addEventListener("touchend", this.handleEnd, false);
  element.addEventListener("touchmove", this.handleMove, false);
  element.addEventListener("mousedown", this.handleMouseDown, false);
  element.addEventListener("mousemove", this.handleMouseMove, false);
  element.addEventListener("mouseup", this.handleMouseUp, false);
  addWheelListener(element, this.handleMouseWheel);
  
  element.pinchZoomInstance = this;
}

PinchZoom.prototype.setTransform = function(transform) {
  this.transform = new AffineTransform(transform);
  
  var viewerPos = Utils.eventPosInElementCoordinates(event, event.srcElement);
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
  event.preventDefault();
  var pinchZoom = event.srcElement.pinchZoomInstance;
  
  var viewerPos = Utils.eventPosInElementCoordinates(event, event.srcElement);
    pinchZoom.ongoingTouches.mouse = {
      startWorldPos: pinchZoom.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
      startViewerPos: viewerPos,
    };
};

PinchZoom.prototype.handleMouseUp = function(event) {
  event.preventDefault();
  var pinchZoom = event.srcElement.pinchZoomInstance;
  pinchZoom.handleMouseMove(event);
  pinchZoom.ongoingTouches.mouse = undefined;
};

PinchZoom.prototype.handleMouseMove = function(event) {
  event.preventDefault();
  var pinchZoom = event.srcElement.pinchZoomInstance;
    
  if (pinchZoom.ongoingTouches.mouse) {
    var constraints = [{
      viewer: Utils.eventPosInElementCoordinates(event, event.srcElement),
      world: pinchZoom.ongoingTouches.mouse.startWorldPos,
    }];
    pinchZoom.processConstraints(constraints);
  }
};

PinchZoom.prototype.handleMouseWheel = function(event) {
  event.preventDefault();
  var pinchZoom = event.srcElement.pinchZoomInstance;
  
  var viewerPos = Utils.eventPosInElementCoordinates(event, event.srcElement);
  var constraints = [{
      viewer: viewerPos,
      world: pinchZoom.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
  }];
  var scaleFactor = 1.0 - Math.max(-.2, Math.min(.2, event.deltaY / 20.0));
  
  pinchZoom.transform.scale(scaleFactor);
  pinchZoom.processConstraints(constraints);
};

PinchZoom.prototype.handleStart = function(event) {
	event.preventDefault();
  var pinchZoom = event.srcElement.pinchZoomInstance;
	
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		var viewerPos = Utils.eventPosInElementCoordinates(touches[i], event.srcElement);
		pinchZoom.ongoingTouches[touches[i].identifier] = {
			startWorldPos: pinchZoom.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
			startViewerPos: viewerPos,
		};
	}
};
	
PinchZoom.prototype.handleEnd = function(event) {
	var tiledViewer = event.srcElement.tiledViewer;
  var pinchZoom = event.srcElement.pinchZoomInstance;
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		Utils.assert(touches[i].identifier in pinchZoom.ongoingTouches);
		delete pinchZoom.ongoingTouches[touches[i].identifier];
	}	
};

PinchZoom.prototype.handleMove = function(event) {
	event.preventDefault();
  var pinchZoom = event.srcElement.pinchZoomInstance;
	var touches = event.touches;
	var constraints = [];
	for (var i = 0; i < touches.length; i++) {
		if (!touches[i].identifier in pinchZoom.ongoingTouches) {
			// For some reason, we did not get the start event.
			var viewerPos = Utils.eventPosInElementCoordinates(touches[i], event.srcElement);
		  pinchZoom.ongoingTouches[touches[i].identifier] = {
			  startWorldPos: tiledViewer.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
			  startViewerPos: viewerPos,
		  };
		}
		var touch = pinchZoom.ongoingTouches[touches[i].identifier];
		
		// Every touch is a constraint
		constraints.push({
			viewer: Utils.eventPosInElementCoordinates(touches[i], event.srcElement),
			world: touch.startWorldPos,
		});
	}
	pinchZoom.processConstraints(constraints);
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
