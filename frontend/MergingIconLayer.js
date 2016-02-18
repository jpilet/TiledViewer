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

MergingIcon.prototype.setPoints = function(points) {
  this.points = points;
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
    
    /*
    clearWindow(
        { x: Math.max(0, cellX - 2), y : Math.max(0, cellY - 2) },
        { x: Math.min(numCellsX - 1, cellX + 2), y : Math.min(numCellsY - 1, cellY + 2) });
    */

    /*
    var c = worldToCell(p.x, p.y);
    Utils.assert(c.x == cellX);
    Utils.assert(c.y == cellY);
    clearWindow(worldToCell(p.x - rad, p.y - rad),
                worldToCell(p.x + rad, p.y + rad))
                */
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
