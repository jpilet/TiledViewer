/**
 * @author Julien Pilet
 */
function InitializeTiledViewer(element) {
  function assert(condition) {
  	if (!condition) {
  		throw('Assertion failed.');
  	}
  }
  
  function invert3x3Matrix(a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20,

        // Calculate the determinant
        det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    var out = [];
    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
  };
  
  function multiply3x3MatrixWithVector(A, b) {
  	var r = [0, 0, 0];
  	for (var i = 0; i < 3; ++i) {
  		r[i] = A[i*3 + 0] * b[0] + A[i*3 + 1] * b[1] + A[i*3 + 2] * b[2];
  	}
  	return r;
  }
  
  function eventPosInElementCoordinates(event, element){
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = element;

    do{
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    }
    while(currentElement = currentElement.offsetParent);

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    return {x:canvasX, y:canvasY};
  }
    
	function handleStart(event) {
		event.preventDefault();
		var tiledViewer = event.srcElement.tiledViewer;
		assert (tiledViewer && tiledViewer.initialized);
		
		var touches = event.changedTouches;
		for (var i = 0; i < touches.length; i++) {
			var viewerPos = eventPosInElementCoordinates(touches[i], event.srcElement);
			tiledViewer.ongoingTouches[touches[i].identifier] = {
				startWorldPos: tiledViewer.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
				startViewerPos: viewerPos,
			};
		}
	}
	
	function handleEnd(event) {
		var tiledViewer = event.srcElement.tiledViewer;
		assert (tiledViewer && tiledViewer.initialized);
		var touches = event.changedTouches;
		for (var i = 0; i < touches.length; i++) {
			assert(touches[i].identifier in tiledViewer.ongoingTouches);
			delete tiledViewer.ongoingTouches[touches[i].identifier];
		}
		
	}
	
	function handleMove(event) {
		event.preventDefault();
		var tiledViewer = event.srcElement.tiledViewer;
		assert (tiledViewer && tiledViewer.initialized);
		var touches = event.touches;
		var constraints = [];
		for (var i = 0; i < touches.length; i++) {
			if (!touches[i].identifier in tiledViewer.ongoingTouches) {
				// For some reason, we did not get the start event.
				var viewerPos = eventPosInElementCoordinates(touches[i], event.srcElement);
			  tiledViewer.ongoingTouches[touches[i].identifier] = {
				  startWorldPos: tiledViewer.worldPosFromViewerPos(viewerPos.x, viewerPos.y),
				  startViewerPos: viewerPos,
			  };
			}
			var touch = tiledViewer.ongoingTouches[touches[i].identifier];
			
			// Every touch is a constraint
			constraints.push({
				viewer: eventPosInElementCoordinates(touches[i], event.srcElement),
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
			var Ainv = invert3x3Matrix([AtA00, AtA10, AtA20, AtA10, 2, 0, AtA20, 0, 2]);
			var AtB = [vx1*wx1 + vx2*wx2 + vy1*wy1 + vy2*wy2, vx1 + vx2, vy1 + vy2];
			var r = multiply3x3MatrixWithVector(Ainv, AtB);
			 
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
		console.log(T[0] +', ' + T[1] + ', ' + T[2] + '\n'
		          +T[3] +', ' + T[4] + ', ' + T[5]);
		window.requestAnimFrame(draw);
	}
	
	function handleCancel(event) {
		var element = event.srcElement;
		var tiledViewer = element.tiledViewer;
		assert (tiledViewer && tiledViewer.initialized);
		
	}
	
	function handleLeave() {
		var element = event.srcElement;
		var tiledViewer = element.tiledViewer;
		assert (tiledViewer && tiledViewer.initialized);
		
	}
	
	function draw() {
		var canvas = element;
		var tiledViewer = element.tiledViewer;
    var context = canvas.getContext('2d');

	  var p1 = tiledViewer.viewerPosFromWorldPos(100,20);
	  var p2 = tiledViewer.viewerPosFromWorldPos(400,160);
	  
	  context.clearRect(0, 0, canvas.width, canvas.height);
	  
    context.beginPath();
    context.moveTo(p1.x, p1.y);

    // line 1
    context.lineTo(p2.x, p2.y);

    context.lineWidth = 5;
    context.strokeStyle = 'blue';
    context.stroke();
	}
	
	element.tiledViewer = {
		initialized: true,
		ongoingTouches: {},
		view2world: [1,0,0, 0,1,0],
		worldPosFromViewerPos: function(x, y) {
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
		},
		viewerPosFromWorldPos: function(x, y) {
			return {
				x: this.view2world[0] * x + this.view2world[1] * y + this.view2world[2],
				y: this.view2world[3] * x + this.view2world[4] * y + this.view2world[5],
			};
		},
	};
  element.addEventListener("touchstart", handleStart, false);
  element.addEventListener("touchend", handleEnd, false);
  element.addEventListener("touchcancel", handleEnd, false);
  element.addEventListener("touchleave", handleEnd, false);
  element.addEventListener("touchmove", handleMove, false);
  draw();
}

// shim layer with setTimeout fallback
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();
