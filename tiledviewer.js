/**
 * @author Julien Pilet
 */
function InitializeTiledViewer(element) {
  element.tiledViewer = new TiledViewer(element);  
}

function TiledViewer(element) {
  this.initialized = true;
  this.ongoingTouches = {};
  this.view2world = [1,0,0, 0,1,0];
  this.imageObj = new Image();
  
  element.addEventListener("touchstart", this.handleStart, false);
  element.addEventListener("touchend", this.handleEnd, false);
  element.addEventListener("touchcancel", this.handleEnd, false);
  element.addEventListener("touchleave", this.handleEnd, false);
  element.addEventListener("touchmove", this.handleMove, false);
  
  this.imageObj.src = "http://video.jpmguides.com/headers/fr/1.jpg";
  this.imageObj.onload = function() { element.tiledViewer.draw(element); };
}

TiledViewer.prototype.worldPosFromViewerPos = function(x, y) {
      // We want u,v where
      // a b * u + e = x
      // c d   v   f = y
      var a = this.view2world[0];
      var b = this.view2world[1];
      var c = this.view2world[3];
      var d = this.view2world[4];

      var invdet = 1 / (a * d - b * c);
      var u = x - this.view2world[2];
      var v = y - this.view2world[5];
      return {
        x: (d * u - b * v) * invdet,
        y: (-c * u + a * v) * invdet, 
      };                
};

TiledViewer.prototype.viewerPosFromWorldPos = function(x, y) {
  return {
    x: this.view2world[0] * x + this.view2world[1] * y + this.view2world[2],
    y: this.view2world[3] * x + this.view2world[4] * y + this.view2world[5],
  };
};
    
TiledViewer.prototype.handleStart = function(event) {
	event.preventDefault();
	var tiledViewer = event.srcElement.tiledViewer;
	Utils.assert (tiledViewer && tiledViewer.initialized);
	
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		var viewerPos = Utils.eventPosInElementCoordinates(touches[i], event.srcElement);
		tiledViewer.ongoingTouches[touches[i].identifier] = {
			startWorldPos: tiledViewer.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
			startViewerPos: viewerPos,
		};
	}
};
	
TiledViewer.prototype.handleEnd = function(event) {
	var tiledViewer = event.srcElement.tiledViewer;
	Utils.assert (tiledViewer && tiledViewer.initialized);
	var touches = event.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		Utils.assert(touches[i].identifier in tiledViewer.ongoingTouches);
		delete tiledViewer.ongoingTouches[touches[i].identifier];
	}	
};
	
TiledViewer.prototype.handleMove = function(event) {
	event.preventDefault();
	var tiledViewer = event.srcElement.tiledViewer;
	Utils.assert (tiledViewer && tiledViewer.initialized);
	var touches = event.touches;
	var constraints = [];
	for (var i = 0; i < touches.length; i++) {
		if (!touches[i].identifier in tiledViewer.ongoingTouches) {
			// For some reason, we did not get the start event.
			var viewerPos = Utils.eventPosInElementCoordinates(touches[i], event.srcElement);
		  tiledViewer.ongoingTouches[touches[i].identifier] = {
			  startWorldPos: tiledViewer.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
			  startViewerPos: viewerPos,
		  };
		}
		var touch = tiledViewer.ongoingTouches[touches[i].identifier];
		
		// Every touch is a constraint
		constraints.push({
			viewer: Utils.eventPosInElementCoordinates(touches[i], event.srcElement),
			world: touch.startWorldPos,
		});
	}
	
	// Compute the transform that best fits the constraints
	var T = tiledViewer.view2world;
	
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
	tiledViewer.debug(T[0] +', ' + T[1] + ', ' + T[2] + '\n'
  	          +T[3] +', ' + T[4] + ', ' + T[5]);
	window.requestAnimFrame(function() { tiledViewer.draw(event.srcElement); });
};
	
TiledViewer.prototype.handleCancel = function(event) {
		var element = event.srcElement;
		var tiledViewer = element.tiledViewer;
		assert (tiledViewer && tiledViewer.initialized);	
};

TiledViewer.prototype.handleLeave = function(event) {
	var element = event.srcElement;
	var tiledViewer = element.tiledViewer;
	assert (tiledViewer && tiledViewer.initialized);
};
	
TiledViewer.prototype.draw = function(canvas) {
	var tiledViewer = canvas.tiledViewer;
  var context = canvas.getContext('2d');

  var p1 = tiledViewer.viewerPosFromWorldPos(0, 0);
  var p2 = tiledViewer.viewerPosFromWorldPos(555, 260);
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.drawImage(tiledViewer.imageObj, p1.x, p1.y, (p2.x - p1.x), (p2.y - p1.y));
};

TiledViewer.prototype.debug = function(str) {
  //console.log(str);
};
