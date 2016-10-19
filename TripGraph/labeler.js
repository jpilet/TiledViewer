(function() {

d3 = this.d3 || {};

d3.labeler = function() {
  var lab = [];
  var anc = [];
  var w = 1; // box width
  var h = 1; // box width
  var labeler = {};

  var acc = 0;
  var rej = 0;

  // weights
  var w_len = 0.05, // leader line length 
      w_inter = 10.0, // leader line intersection
      w_lab2 = 30.0, // label-label overlap
      w_lab_anc = 30.0; // label-anchor overlap
      w_orient = 0.0; // orientation bias
  var w_labelLeaderlineOverlap = 10;

  // booleans for user defined functions
  var user_energy = false,
      user_schedule = false;

  var user_defined_energy, 
      user_defined_schedule;

  boxOfLabel = function(index) {
    var halfWidth = lab[index].width / 2;
    var halfHeight = lab[index].height / 2;
    var cx = lab[index].x;
    var cy = lab[index].y;
    return {
      left: cx - halfWidth,
      top: cy - halfHeight,
      right: cx + halfWidth,
      bottom: cy + halfHeight,
      cx: cx,
      cy: cy,
      width: lab[index].width,
      height: lab[index].height
    };
  };

  var closestLineAnchorPoint = d3.labeler.closestLineAnchorPoint;

  clipLineToRect = function(p1, p2, box) {
    var t0 = 0.0;
    var t1 = 1.0;
    var xdelta = p2.x - p1.x;
    var ydelta = p2.y - p1.y;
    var p,q,r;

    for(var edge=0; edge<4; edge++) {   // Traverse through left, right, bottom, top edges.
        if (edge==0) {  p = -xdelta;    q = -(box.left-p1.x);  }
        if (edge==1) {  p = xdelta;     q =  (box.right-p1.x); }
        if (edge==2) {  p = -ydelta;    q = -(box.bottom-p1.y);}
        if (edge==3) {  p = ydelta;     q =  (box.top-p1.y);   }   
        r = q/p;
        if(p==0 && q<0) return undefined;   // Don't draw line at all. (parallel line outside)

        if(p<0) {
            if(r>t1) return undefined;         // Don't draw line at all.
            else if(r>t0) t0=r;            // Line is clipped!
        } else if(p>0) {
            if(r<t0) return undefined;      // Don't draw line at all.
            else if(r<t1) t1=r;         // Line is clipped!
        }
    }

    return {
      x1: p1.x + t0 * xdelta,
      y1: p1.y + t0 * ydelta,
      x2: p1.x + t1 * xdelta,
      y2: p1.y + t1 * ydelta
    };
}



  boxOverlapArea = function(box, box2) {
    var x_overlap = Math.max(0,
                             Math.min(box2.right, box.right)
                             - Math.max(box2.left, box.left));
    var y_overlap = Math.max(0,
                             Math.min(box2.bottom,box.bottom)
                             - Math.max(box2.top,box.top));
    return x_overlap * y_overlap;
  };

  energy = function(index) {
    // energy function, tailored for label placement
      var box = boxOfLabel(index);
      var lineAnchor = closestLineAnchorPoint(anc[index], box);

      var m = lab.length, 
          ener = 0,
          dx = lineAnchor.x - anc[index].x,
          dy = lineAnchor.y - anc[index].y,
          dist = Math.sqrt(dx * dx + dy * dy),
          overlap = true,
          amount = 0
          theta = 0;

      // penalty for length of leader line
      if (dist > 0) ener += dist * w_len;

      for (var i = 0; i < m; i++) {
        if (i != index) {

          // penalty for intersection of leader lines

          var box2 = boxOfLabel(i);
          var ap2 = closestLineAnchorPoint(anc[index], box2);
          var overlap = intersect(anc[index].x, lineAnchor.x, anc[i].x, ap2.x,
                          anc[index].y, lineAnchor.y, anc[i].y, ap2.y);
          if (overlap) ener += w_inter;

          // penalty for label-label overlap
          ener += (boxOverlapArea(box, box2) * w_lab2);
         
          // TODO: penalty for label-leader line overlap
          var l = clipLineToRect(anc[index], lineAnchor, box2);
          if (l) {
            var dx = l.x1 - l.x2;
            var dy = l.y1 - l.y2;
            ener += Math.sqrt(dx * dx + dy * dy) * w_labelLeaderlineOverlap;
          }

        }

        // penalty for label-anchor overlap
        var r = anc[i].r + 1;

        var ancBox = {
          left: anc[i].x - r,
          right: anc[i].x + r,
          top: anc[i].y - r,
          bottom: anc[i].y + r
        };
        ener += boxOverlapArea(box, ancBox) * w_lab_anc;

      }
      return ener;
  };

  mcmove = function(currT) {
  // Monte Carlo translation move

      // select a random label
      var i = Math.floor(Math.random() * lab.length); 

      // save old coordinates
      var x_old = lab[i].x;
      var y_old = lab[i].y;

      // old energy
      var old_energy;
      if (user_energy) {old_energy = user_defined_energy(i, lab, anc)}
      else {old_energy = energy(i)}

      // random translation
      lab[i].x += (Math.random() - 0.5) * (w/8) * (currT + 0.1);
      lab[i].y += (Math.random() - 0.5) * (h/8) * (currT + 0.1);

      // hard wall boundaries
      var box = boxOfLabel(i);
      if (box.right > w) lab[i].x = x_old;
      if (box.left < 0) lab[i].x = x_old;
      if (box.bottom > h) lab[i].y = y_old;
      if (box.top < 0) lab[i].y = y_old;

      // new energy
      var new_energy;
      if (user_energy) {new_energy = user_defined_energy(i, lab, anc)}
      else {new_energy = energy(i)}

      // delta E
      var delta_energy = new_energy - old_energy;

      if (Math.random() < Math.exp(-delta_energy / currT)) {
        acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        rej += 1;
      }

  };

  mcrotate = function(currT) {
  // Monte Carlo rotation move

      // select a random label
      var i = Math.floor(Math.random() * lab.length); 

      // save old coordinates
      var x_old = lab[i].x;
      var y_old = lab[i].y;

      // old energy
      var old_energy;
      if (user_energy) {old_energy = user_defined_energy(i, lab, anc)}
      else {old_energy = energy(i)}

      // random angle
      var angle = (Math.random() - 0.5) * 2 * Math.PI * (currT + 1e-4);

      var s = Math.sin(angle);
      var c = Math.cos(angle);

      // translate label (relative to anchor at origin):
      lab[i].x -= anc[i].x
      lab[i].y -= anc[i].y

      // rotate label
      var x_new = lab[i].x * c - lab[i].y * s,
          y_new = lab[i].x * s + lab[i].y * c;

      // translate label back
      lab[i].x = x_new + anc[i].x
      lab[i].y = y_new + anc[i].y

      // hard wall boundaries
      var box = boxOfLabel(i);
      if (box.right > w) lab[i].x = x_old;
      if (box.left < 0) lab[i].x = x_old;
      if (box.bottom > h) lab[i].y = y_old;
      if (box.top < 0) lab[i].y = y_old;

      // new energy
      var new_energy;
      if (user_energy) {new_energy = user_defined_energy(i, lab, anc)}
      else {new_energy = energy(i)}

      // delta E
      var delta_energy = new_energy - old_energy;

      if (Math.random() < Math.exp(-delta_energy / currT)) {
        acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        rej += 1;
      }
      
  };

  intersect = function(x1, x2, x3, x4, y1, y2, y3, y4) {
  // returns true if two lines intersect, else false
  // from http://paulbourke.net/geometry/lineline2d/

    var mua, mub;
    var denom, numera, numerb;

    denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    numera = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
    numerb = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);

    /* Is the intersection along the the segments */
    mua = numera / denom;
    mub = numerb / denom;
    if (!(mua < 0 || mua > 1 || mub < 0 || mub > 1)) {
        return true;
    }
    return false;
  }

  cooling_schedule = function(currT, initialT, nsweeps) {
  // linear cooling
    return (currT - (initialT / nsweeps));
  }

  simulatedAnnealing = function(nsweeps) {
  // main simulated annealing function
      var m = lab.length,
          currT = 1.0,
          initialT = 1.0;

      for (var i = 0; i < nsweeps; i++) {
        for (var j = 0; j < m; j++) { 
          if (Math.random() < 0.5) { mcmove(currT); }
          else { mcrotate(currT); }
        }
        currT = cooling_schedule(currT, initialT, nsweeps);
      }
      var sum = 0;
      for (var i = 0; i < m; ++i) {
        sum += energy(i);
      }
      console.log('acc: ' + acc + ', rej: ' + rej + ', energy: ' + sum);
      return sum;
  };

  labeler.start = function(nsweeps, nruns) {
    var bestEnergy;
    var bestLabels = [];
    var initialLabels = lab;
    nruns = nruns || 1;
    for (var i = 0; i < nruns; ++i) {
      lab = initialLabels.slice(0);
      acc = rej = 0;
      var e = simulatedAnnealing(nsweeps);
      if (!bestEnergy || bestEnergy > e) {
        bestEnergy = e;
        bestLabels = lab.slice(0);
      }
    }
    lab = bestLabels.slice(0);
    console.log('Final energy: ' + bestEnergy);
    return bestEnergy;
  };

  labeler.boxOfLabel = boxOfLabel;

  labeler.width = function(x) {
  // users insert graph width
    if (!arguments.length) return w;
    w = x;
    return labeler;
  };

  labeler.height = function(x) {
  // users insert graph height
    if (!arguments.length) return h;
    h = x;    
    return labeler;
  };

  labeler.label = function(x) {
  // users insert label positions
    if (!arguments.length) return lab;
    lab = x;
    return labeler;
  };

  labeler.anchor = function(x) {
  // users insert anchor positions
    if (!arguments.length) return anc;
    anc = x;
    return labeler;
  };

  labeler.alt_energy = function(x) {
  // user defined energy
    if (!arguments.length) return energy;
    user_defined_energy = x;
    user_energy = true;
    return labeler;
  };

  labeler.alt_schedule = function(x) {
  // user defined cooling_schedule
    if (!arguments.length) return  cooling_schedule;
    user_defined_schedule = x;
    user_schedule = true;
    return labeler;
  };

  return labeler;
};

d3.labeler.closestLineAnchorPoint = function(p, box) {
    var candidates = [
      { x: box.cx, y: box.top }, 
      { x: box.cx, y: box.bottom }, 
      { x: box.left, y: box.cy }, 
      { x: box.right, y: box.cy }
    ];
    var bestDist;
    var bestPoint;
    for (var i = 0; i < candidates.length; ++i) {
      var c = candidates[i];
      var dx = p.x - c.x;
      var dy = p.y - c.y;
      var d = dx*dx + dy*dy;
      if (!bestDist || bestDist > d) {
        bestDist = d;
        bestPoint = c;
      }
    }
    return bestPoint;
    var r = { x: 0, y: 0 };
    var qw = box.width / 4;
    var qh = box.height / 4;
    if (p.x > (box.right - qw)) {
      r.x = box.right;
    } else if (p.x > (box.left + qw)) {
      r.x = box.cx;
    } else {
      r.x = box.left;
    }
    if (p.y > (box.bottom - qh)) {
      r.y = box.bottom;
    } else if (p.y > (box.top + qw)) {
      r.y = box.cy;
    } else {
      r.y = box.top;
    }
    return r;
};

})();

