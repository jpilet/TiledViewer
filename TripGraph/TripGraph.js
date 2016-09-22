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
Point.add = function(p) { this.x += p.x; this.y += p.y; return this; };
Point.sub = function(p) { this.x -= p.x; this.y -= p.y; return this; };
Point.mul = function(t) { this.x *= t; this.y *= t; return this; };

function TripGraph() {
  this.nodes = {};
  this.edges = [];
}

TripGraph.createFromStopovers = function (stopovers) {
  var result = new TripGraph();

  for (var i in stopovers) {
    var stop = stopovers[i];
    result.nodes[stop.name] = stop;
    stop.coord = new Point(stop.coord);
  }

  for (var i = 1; i < stopovers.length; ++i) {
    result.edges.push({
      from: stopovers[i-1].name,
      to: stopovers[i].name,
      controlPoints: TripGraph.generateControlPoints(
          (i >= 2 ? stopovers[i-2].coord : undefined),
          stopovers[i-1].coord,
          stopovers[i].coord,
          ((i + 1) < stopovers.length ? stopovers[i+1].coord : undefined)
          )
      });
  }
  return result;
};

TripGraph.generateControlPoints = function(p0, p1, p2, p3) {
  p0 = p0 || p1;
  p3 = p3 || p2;
  var t = .25;
  return [
        Point.plus(p1, Point.times(t, Point.minus(p2, p0))),
        Point.minus(p2, Point.times(t, Point.minus(p3, p1)))
  ];
};

TripGraph.prototype.bezier = function(edge) {
  if (!edge.controlPoints || edge.hidden) {
    return undefined;
  }

  var points = [
    this.nodes[edge.from].coord,
    edge.controlPoints[0],
    edge.controlPoints[1],
    this.nodes[edge.to].coord
  ];
  var result = [];
  for (var i = 0; i < 4; ++i) {
    result.push(points[i].x);
    result.push(points[i].y);
  }
  return new Bezier(result);
}

