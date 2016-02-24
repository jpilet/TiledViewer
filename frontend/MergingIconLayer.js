function MergingIcon(params) {
  this.super_ = POILayer;
  this.super_(params);
  this.points = [];
}

MergingIcon.prototype.super_ = POILayer;
MergingIcon.prototype = POILayer.prototype;

MergingIcon.prototype.drawMergedIcon = function(stats, canvas, pinchZoom) {
  if (stats.count > 0) {
    var count = stats.count;
    var context = canvas.getContext('2d');
    context.strokeStyle = "rgba("
      + Math.min(255, 50 * count) + ','
      + Math.min(255, 20 * count) + ','
      + Math.min(255, 5 * count) + ', .8)';
    var radius = this.featureRadius();
    context.lineWidth = 3  * this.renderer.pixelRatio;
    context.beginPath();

    var p = pinchZoom.viewerPosFromWorldPos(stats.x, stats.y);
    context.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
    context.stroke();
  }
};

function searchForHighestValue(cells) {
  var bestValue = -1;
  var bestIndex = -1;
  for (var i = 0; i < cells.length; ++i) {
    if (cells[i] && cells[i].count && cells[i].count > 0
        && cells[i].count > bestValue) {
        bestValue = cells[i].count;
        bestIndex = i;
    }
  }
  return bestIndex;
}

function d3_geom_quadtreeReduce(node, reduced, f) {
  var children = node.nodes;
  if (children.length == 0) {
    return f(node, [], []);
  }

  var reduced = [];
  for (var i in children) {
    reduced.push(d3_geom_quadtreeReduce(children[i], reduced, f));
  }
  return f(node, reduced, children);
}

MergingIcon.prototype.setPoints = function(points) {
  this.points = points;
  var Quadtree = d3.geom.quadtree();
  Quadtree.x(function(p) { return p.x; });
  Quadtree.y(function(p) { return p.y; });

  // D3 assumes that 0.01 is a distance small enough to stop recursing.
  // working in a 0-1 range does not work. We scale to 1024 instead.
  Quadtree.extent([[0, 0], [1024, 1024]]);
  var scaledPoints = new Array(points.length);
  for (var i in points) {
    scaledPoints[i] = { x: 1024 * points[i].x, y: 1024 * points[i].y };
  }
  this.quadtree = Quadtree(scaledPoints);
  this.quadtree.reduce = function(f) {
    return d3_geom_quadtreeReduce(this, undefined, f);
  };

  this.quadtree.reduce(function(node, values, nodes) {
    var reduced = {
     x: 0,
     y: 0,
     count : 0
    };
    if (node.point) {
      reduced.x = node.x;
      reduced.y = node.y;
      reduced.count = 1;
    }
    for (var i in values) {
      var count = values[i].count;
      if (count > 0) {
        var total = count + reduced.count;
        reduced.x = (reduced.x * reduced.count + values[i].x * count) / total;
        reduced.y = (reduced.y * reduced.count + values[i].y * count) / total;
        reduced.count = total;
      }
    }
    node.reduced = reduced;
    return reduced;
  });

  Utils.assert(this.quadtree.reduced.count == points.length);
};

MergingIcon.prototype.draw = function(canvas, pinchZoom,
                                      bboxTopLeft, bboxBottomRight) {
  var radius = this.featureRadius();
  var dx = radius;
  var dy = radius;
  var screenWidth = canvas.width;
  var screenHeight = canvas.height;


  var viewToWorld = pinchZoom.transform.getInverse();
  var radiusInWorld = viewToWorld.matrix[0] * this.featureRadius();
  // We approximate the radius with the closest quad-tree grid size
  var cellWidthWorld = 1 / Math.pow(2, Math.round(-Math.log2(radiusInWorld)));
  var cellWidth = Math.round(cellWidthWorld / viewToWorld.matrix[0]);
  var numCellsX = Math.ceil(screenWidth / cellWidth);
  var numCellsY = Math.ceil(screenHeight / cellWidth);
  var windowSize = radiusInWorld * 1.5;

  var topLeft = viewToWorld.transform(0,0);
  var bottomRight = viewToWorld.transform(screenWidth, screenHeight);
  var worldDelta = cellWidthWorld;


  var gridOffset = {
    x: Math.floor(topLeft.x / worldDelta),
    y: Math.floor(topLeft.y / worldDelta)
  };
  var worldToGrid = function(p) {
    return {
      x: Math.floor(p.x / worldDelta) - gridOffset.x,
      y: Math.floor(p.y / worldDelta) - gridOffset.y
    };
  };
  var gridToWorld = function(g) {
    return {
      x: (g.x + gridOffset.x) * worldDelta,
      y: (g.y + gridOffset.y) * worldDelta
    };
  };
  var gridTopLeft = worldToGrid(topLeft);
  var gridBottomRight = worldToGrid(bottomRight);
  numCellsX = 1 + gridBottomRight.x - gridTopLeft.x;
  numCellsY = 1 + gridBottomRight.y - gridTopLeft.y;
  var cells = new Array(numCellsX * numCellsY);

  var keepInside = function(p) {
    return {
      x: Math.min(numCellsX-1, Math.max(0, p.x)),
      y: Math.min(numCellsY-1, Math.max(0, p.y))
    };
  };

  var gridIndex = function(p) {
    return p.y * numCellsX + p.x;
  };

  for (var y = gridTopLeft.y; y < gridBottomRight.y; ++y) {
    for (var x = gridTopLeft.x; x < gridBottomRight.x; ++x) {
      var p = {x: x, y: y};
      cells[gridIndex(p)] =
        this.statsForWindow(gridToWorld(p),
                            gridToWorld({x: x + 1, y: y + 1}));
    }
  }

  var worldToCell = function(x, y) {
    var viewerP = pinchZoom.viewerPosFromWorldPos(x, y);
    return { 
      x: Math.min(numCellsX - 1, Math.max(0, Math.floor(viewerP.x / cellWidth))),
      y: Math.min(numCellsY - 1, Math.max(0, Math.floor(viewerP.y / cellWidth)))
    };
  };

  var clearWindow = function(win) {
    var topLeft = win.topLeft, bottomRight = win.bottomRight;
    for (var y = topLeft.y; y <= bottomRight.y; ++y) {
      for (var x = topLeft.x; x <= bottomRight.x; ++x) {
        cells[y * numCellsX + x] = undefined;
      }
    }
  }

  var statWindow = function(win) {
    var topLeft = win.topLeft, bottomRight = win.bottomRight;
    var sum = {
      count: 0,
      x: 0,
      y: 0
    };
    for (var y = topLeft.y; y <= bottomRight.y; ++y) {
      for (var x = topLeft.x; x <= bottomRight.x; ++x) {
        var cell = cells[y * numCellsX + x];
        if (cell && cell.count > 0) {
          sum.count += cell.count;
          sum.x += cell.x * cell.count;
          sum.y += cell.y * cell.count;
        }
      }
    }
    if (sum.count > 0) {
      sum.x /= sum.count;
      sum.y /= sum.count;
      return sum;
    }
    return undefined;
  }

  var getWindow = function(p) {
    return {
      topLeft: keepInside(worldToGrid(
                       {x: p.x - windowSize, y: p.y - windowSize})),
      bottomRight: keepInside(worldToGrid(
                           {x: p.x + windowSize, y: p.y + windowSize}))
    };
  };

  for (var i = 0; i < 10000; ++i) {
    var highest = searchForHighestValue(cells);
    if (highest < 0) {
      break;
    }

    var cellX = highest % numCellsX;
    var cellY = Math.floor(highest / numCellsX);

    var p = cells[highest];

    for (var j = 0; j < 5; ++j) {
      var win = getWindow(p);
      var stats = statWindow(win);
      if (p.x == stats.x && p.y == stats.y) {
        break;
      }
      p = stats;
    }

    this.drawMergedIcon(p, canvas, pinchZoom);
    clearWindow(win);
  }
}


MergingIcon.prototype.drawMergedIconsInWindow =
    function(topLeft, bottomRight, canvas, pinchZoom) {
  var stats = this.statsForWindow(topLeft, bottomRight);
  this.drawMergedIcon(stats, canvas, pinchZoom);
}

function isInside(p, topLeft, bottomRight) {
  return p.x >= topLeft.x && p.x <= bottomRight.x
    && p.y >= topLeft.y && p.y <= bottomRight.y;
}

MergingIcon.prototype.statsForWindow = function(topLeft, bottomRight) {
  var result = { x:0, y:0, count: 0 };
  Utils.assert(topLeft.x <= bottomRight.x);
  Utils.assert(topLeft.y <= bottomRight.y);

  var minX = 1024 * topLeft.x;
  var maxX = 1024 * bottomRight.x;
  var minY = 1024 * topLeft.y;
  var maxY = 1024 * bottomRight.y;
  this.quadtree.visit(function(node, x1, y1, x2, y2) {
    if (x1 > maxX || x2 < minX
        || y1 > maxY || y2 < minY) {
      // Fully outside. stop recursion, count nothing.
      return 1;
    }
    if (x1 >= minX && x2 <= maxX
        && y1 >= minY && y2 <= maxY) {
      // Fully inside. We count the whole subtree without recursing.
      var p = { x: node.reduced.x / 1024, y: node.reduced.y / 1024 };
      result.x += p.x * node.reduced.count;
      result.y += p.y * node.reduced.count;
      result.count += node.reduced.count;
      return 1;
    }

    if (node.point) {
      var p = { x: node.x / 1024, y: node.y / 1024 };
      if (isInside(p, topLeft, bottomRight)) {
          result.x += p.x;
          result.y += p.y;
          result.count++;
      }
      return 0;
    }
  });

  if (result.count) {
    result.x /= result.count;
    result.y /= result.count;
  }

  if (false) {
    var ref = this.statsForWindowRef(topLeft, bottomRight);
    //Utils.assert(ref.count == result.count);
    if (ref.count != result.count) {
      console.log('Ref: ' + ref.count + ' quadtree: ' + result.count);
    }
    if (ref.count > 0 && (ref.x != result.x || ref.y != result.y)) {
      console.log("ref: " + ref.x + "," + ref.y + "  result: " + result.x + "," + result.y);
    }
  }
  return result;
}

MergingIcon.prototype.statsForWindowRef = function(topLeft, bottomRight) {
  var sum = { x: 0, y: 0 };
  var count = 0;
  for (var i = 0; i < this.points.length; ++i) {
    var p = this.points[i];
    if (isInside(p, topLeft, bottomRight)) {
      sum.x += p.x;
      sum.y += p.y;
      ++count;
    }
  }
  if (count == 0) {
    return { count: 0 };
  }
  return {
   x: sum.x / count,
   y: sum.y / count,
   count : count
  };
}
