function Point(x, y) {
  if (typeof(x) == 'number' && typeof(y) == 'number') {
    this.x = x;
    this.y = y;
  } else if (Array.isArray(x)) {
    this.x = x[0];
    this.y = x[1];
  } else if (typeof(x) == 'object') {
    this.x = x.x;
    this.y = x.y;
  }
  if (this.x == undefined || this.y == undefined) {
    throw(new Error('invalid point'));
  }
}

Point.minus = function(a, b) { return new Point(a.x - b.x, a.y - b.y); };
Point.plus = function(a, b) { return new Point(a.x + b.x, a.y + b.y); };
Point.times = function(t, a) { return new Point(t * a.x, t * a.y); };
Point.min = function(a, b) {
  return new Point(Math.min(a.x, b.x), Math.min(a.y, b.y));
};
Point.max = function(a, b) {
  return new Point(Math.max(a.x, b.x), Math.max(a.y, b.y));
};

Point.prototype.add = function(p) { this.x += p.x; this.y += p.y; return this; };
Point.prototype.sub = function(p) { this.x -= p.x; this.y -= p.y; return this; };
Point.prototype.mul = function(t) { this.x *= t; this.y *= t; return this; };

Point.dist = function(a, b) {
  var dx = a.x - b.x;
  var dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

Point.norm = function(a) {
  return Math.sqrt(a.x * a.x + a.y * a.y);
};

Point.prototype.norm = function() { return Point.norm(this); };

function TripGraph(graph) {
  graph = graph || {};
  this.nodes = graph.nodes || {};
  this.edges = graph.edges || [];
}

TripGraph.createFromStopovers = function (stopovers) {
  var result = new TripGraph();

  for (var i in stopovers) {
    var stop = stopovers[i];
    result.nodes[stop.name] = stop;
    stop.coord = new Point(stop.coord);
  }

  var realstopovers = [];
  for (var i in stopovers) {
    var stop = stopovers[i];
    if (!stop.properties || stop.properties.point != false) {
      realstopovers.push(stop);
    }
  }

  for (var i = 1; i < realstopovers.length; ++i) {
    result.edges.push({
      from: realstopovers[i-1].name,
      to: realstopovers[i].name,
      controlPoints: TripGraph.generateControlPoints(
          (i >= 2 ? realstopovers[i-2].coord : undefined),
          realstopovers[i-1].coord,
          realstopovers[i].coord,
          ((i + 1) < realstopovers.length ? realstopovers[i+1].coord : undefined)
          )
      });
  }
  return result;
};

TripGraph.prototype.createDefaultBezier = function (stopovers) {
  for (var i in this.edges) {
    var e = this.edges[i];
    var from = this.nodes[e.from];
    var to = this.nodes[e.to];

    this.edges[i] = {
      from: e.from,
      to: e.to,
      controlPoints: TripGraph.generateControlPoints(undefined,
                                                     from.coord, to.coord)
    };
  }
};

TripGraph.replaceArray = function(a, b) {
  a.length = b.length;
  for (var i in b) {
    a[i] = b[i];
  }
};

TripGraph.prototype.splitEdge = function (edge) {
  var bezier = this.bezier(edge);
  if (bezier.length == 1) {
    bezier = bezier[0];

    /*
    var subBezier = bezier.split(.5);

    TripGraph.replaceArray(edge.controlPoints, [
      subBezier.left.points[1],
      subBezier.left.points[2],
      subBezier.left.points[3],
      subBezier.right.points[1],
      subBezier.right.points[2]
    ]);
    */

    var a = [];
    var n = 4;
    for (var i = 1; i <= n; ++i) {
      a.push(bezier.get(i / (n+1)));
    }

    TripGraph.replaceArray(edge.controlPoints, a);
  } else {
    TripGraph.replaceArray(edge.controlPoints, [
      edge.controlPoints[0],
      edge.controlPoints[edge.controlPoints.length - 1]
    ]);
  }
};

TripGraph.generateControlPoints = function(p0, p1, p2, p3) {
  var delta = Point.minus(p2, p1).mul(1/3);
  var norm = new Point(-delta.y, delta.x);
  return [
    Point.plus(Point.plus(p1,delta), norm),
    Point.plus(Point.minus(p2,delta), norm)
  ];

  /*
  p0 = p0 || p1;
  p3 = p3 || p2;
  var t = .25;
  return [
        Point.plus(p1, Point.times(t, Point.minus(p2, p0))),
        Point.minus(p2, Point.times(t, Point.minus(p3, p1)))
  ];
  */
};
TripGraph.bezierFromPoints = function(points) {
  var result = [];
  for (var i = 0; i < 4; ++i) {
    result.push(points[i].x);
    result.push(points[i].y);
  }
  return new Bezier(result);
};

TripGraph.bezierThroughPoints = function(points) {
  var result = [];
  var t = .2;
  for (var i = 1; i < points.length; ++i) {
    var prev = (i == 1 ? points[i-1] : points[i-2]);
    var a = points[i-1];
    var b = points[i];
    var next = (i == (points.length - 1) ? points[i] : points[i+1]);
    result.push(TripGraph.bezierFromPoints([
      a,
      Point.plus(a, Point.times(t, Point.minus(b, prev))),
      Point.plus(b, Point.times(t, Point.minus(a, next))),
      b]));
  }
  return result;
};

TripGraph.prototype.bezier = function(edge) {
  if (!edge.controlPoints || edge.hidden) {
    return [];
  }

  if (edge.controlPoints.length == 2) {
    var points = [
      this.nodes[edge.from].coord,
      edge.controlPoints[0],
      edge.controlPoints[1],
      this.nodes[edge.to].coord
    ];
    return [TripGraph.bezierFromPoints(points)];
  } else if (edge.controlPoints.length == 5) {
    var points1 = [
      this.nodes[edge.from].coord,
      edge.controlPoints[0],
      edge.controlPoints[1],
      edge.controlPoints[2],
    ];
    var points2 = [
      edge.controlPoints[2],
      edge.controlPoints[3],
      edge.controlPoints[4],
      this.nodes[edge.to].coord
    ];
    return [
      TripGraph.bezierFromPoints(points1),
      TripGraph.bezierFromPoints(points2)
    ];
  } else {
    var allPoints = [this.nodes[edge.from].coord]
      .concat(edge.controlPoints, [ this.nodes[edge.to].coord ]);
    return TripGraph.bezierThroughPoints(allPoints);
  }
}

TripGraph.prototype.bounds = function() {
  var min, max;
  for (var i in this.nodes) {
    var node = this.nodes[i].coord;
    min = (min == undefined ? node : Point.min(min, node));
    max = (max == undefined ? node : Point.max(max, node));
  }
  return {
    min: min,
    max: max
  };
}

// Returns a rectangle containing all the nodes with the desired aspect ratio
// and margin factor.
//
// aspectRatio: width / height
TripGraph.prototype.frame = function(aspectRatio, marginRatio) {
  var bounds = this.bounds();
  marginRatio = marginRatio || 1.1;
  aspectRatio = aspectRatio
    || (bounds.max.x - bounds.min.x) / (bounds.max.y - bounds.min.y);

  var margin = (typeof(marginRatio) == 'number' ?
                new Point(marginRatio, marginRatio) : marginRatio);

  var initialSize = Point.minus(bounds.max, bounds.min);
  initialSize.x *= margin.x;
  initialSize.y *= margin.y;

  var widthFromHeight = initialSize.y * aspectRatio;

  var size;
  if (initialSize.x > widthFromHeight) {
    size = new Point(initialSize.x, initialSize.x / aspectRatio);
  } else {
    size = new Point(initialSize.y * aspectRatio, initialSize.y);
  }

  size.mul(.5);
  var center = Point.times(0.5, Point.plus(bounds.max, bounds.min));
  return {
    min: Point.minus(center, size),
    max: Point.plus(center, size)
  };
}

TripGraph.prototype.location = function(aspectRatio, marginRatio) {
  var frame = this.frame(aspectRatio, marginRatio);
  return {
    x: (frame.max.x + frame.min.x) / 2,
    y: (frame.max.y + frame.min.y) / 2,
    scale: (frame.max.x - frame.min.x)
  };
};

function closestPointToBbox(point, bbox) {
  var r = {x:0, y:0};

  for (var i in r) {
    if (point[i] < bbox.min[i]) {
      r[i] = bbox.min[i];
    } else if (point[i] > bbox.max[i]) {
      r[i] = bbox.max[i];
    } else {
      r[i] = point[i];
    }
  }
  return r;
};

TripGraph.placeLeaderLine = function(node) {
  if (!node.properties) {
    node.properties = {};
  }
  var placement = node.properties.leaderLine || 'bestAnchor';

  var bbox = node.properties.labelBbox;
  var anchor;
  if (placement == 'center') {
    var width = bbox.max.x - bbox.min.x;
    var center = new Point((bbox.min.x + bbox.max.x) / 2,
                           (bbox.min.y + bbox.max.y) / 2);
    var toCoord = Point.minus(node.coord, center);
    toCoord.mul(.6 * width / Point.norm(toCoord));
    anchor = Point.plus(center, toCoord);
  } else if (placement == 'closestOnBbox') {
    anchor = closestPointToBbox(node.coord, bbox);
  } else {
    anchor = d3.labeler.closestLineAnchorPoint(
          node.coord,
          {
            left: bbox.min.x,
            right: bbox.max.x,
            top: bbox.min.y,
            bottom: bbox.max.y,
            cx: (bbox.min.x + bbox.max.x) / 2,
            cy: (bbox.min.y + bbox.max.y) / 2
          }
      );
  }

  node.properties.leaderLineAnchor = anchor;
}
