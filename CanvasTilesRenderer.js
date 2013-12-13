function CanvasTilesRenderer(canvas, params) {
  this.params = (params != undefined ? params : {});
  this.canvas = canvas;
  
  if (!("tileSize" in this.params)) this.params.tileSize = 256;
  if (!("url" in this.params)) {
    this.params.url = function(scale, x, y) {
      return "http://a.tile.openstreetmap.org/" + scale + '/' + x + '/' + y + '.png';
    };
  }
  
  if (!this.params.maxNumCachedTiles) this.params.maxNumCachedTiles = 64;
  if (!this.params.maxSimultaneousLoads) this.params.maxSimultaneousLoads = 3;
  
  this.tiles = {};
  this.numLoading = 0;
  this.loadQueue = [];

  // Block drawing before we are ready.  
  this.inDraw = true;
  this.numDraw = 0;
  this.numCachedTiles = 0;
  
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio ? window.devicePixelRatio : 1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio ? window.devicePixelRatio : 1);

  var t = this;
  var draw = function() {
    if (t.inDraw) { return; }
    if (t.params.onLocationChange) { t.params.onLocationChange(t); }
    t.draw(canvas);
  };
  this.pinchZoom = new PinchZoom(canvas, draw);

  canvas.addEventListener("onresize", draw, false);
  
  // We are ready, let's allow drawing.  
  this.inDraw = false;
  if (params.initialLocation) {
    this.setLocation(params.initialLocation);
  } else {
    this.setLocation({x:.5, y:.5, scale: 1});
  }
}

CanvasTilesRenderer.prototype.getLocation = function() {
  var left = this.pinchZoom.worldPosFromViewerPos({x: 0, y:this.canvas.height / 2});
  var right = this.pinchZoom.worldPosFromViewerPos({x: this.canvas.width, y:this.canvas.height / 2});
  
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    scale: Utils.distance(right, left)
  };
};

CanvasTilesRenderer.prototype.setLocation = function(location) {
  var canvas = this.canvas;
  var constraints = [
    { viewer: {x:0, y: canvas.height / 2}, world: {x:location.x - location.scale /2, y: location.y} },
    { viewer: {x:canvas.width, y: canvas.height / 2}, world: {x:location.x + location.scale /2, y: location.y} },
  ];
  this.pinchZoom.processConstraints(constraints);  
};

CanvasTilesRenderer.prototype.draw = function() {
  if (this.inDraw) {
    return;
  }
  this.inDraw = true;
  
  var canvas = this.canvas;
  var pinchZoom = this.pinchZoom;
  
  var newWidth = canvas.offsetWidth * (window.devicePixelRatio ? window.devicePixelRatio : 1);
  var newHeight = canvas.offsetHeight * (window.devicePixelRatio ? window.devicePixelRatio : 1);
  if (newWidth != canvas.width || newHeight != canvas.height) {
    canvas.width = newWidth;
    canvas.height = newHeight;
  }

  
  // Compute a bounding box of the viewer area in world coordinates.
  var cornersPix = [
    {x: 0, y: 0},
    {x: canvas.width, y: 0},
    {x: canvas.width, y: canvas.height},
    {x: 0, y: canvas.height},
  ];
  var cornersWorld = [];
  for (var i = 0; i < 4; ++i) {
    cornersWorld.push(pinchZoom.worldPosFromViewerPos(cornersPix[i]));
  }
  var bboxTopLeft = cornersWorld.reduce(
    function(a,b) { return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y)}; },
    {x:1, y:1});
    
  var bboxBottomRight = cornersWorld.reduce(
    function(a,b) { return {x: Math.max(a.x, b.x), y: Math.max(a.y, b.y)}; },
    {x:0, y:0});
    
  // Compute the scale level
  var numTiles = canvas.width / this.params.tileSize;
  var targetUnitPerTile = (bboxBottomRight.x - bboxTopLeft.x) / numTiles;
  var scale = Math.max(0, Math.floor(- Math.log(targetUnitPerTile) / Math.LN2));
  var actualUnitPerTile = 1 / (1 << scale);

  var getTileX = function(unitX) { return  Math.floor(unitX * (1 << scale)); };
  var getTileY = function(unitY) { return  getTileX(unitY); };
  
  var firstTileX = getTileX(bboxTopLeft.x);
  var firstTileY = getTileY(bboxTopLeft.y);
  var lastTileX = getTileX(bboxBottomRight.x);
  var lastTileY = getTileY(bboxBottomRight.y);
  
  // Clear the canvas
  var context = canvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);

  pinchZoom.transform.canvasSetTransform(context);
  
  Utils.assert(firstTileY != undefined);
  
  for (var tileY = firstTileY; tileY <= lastTileY; ++tileY) {
    for (var tileX = firstTileX; tileX <= lastTileX; ++tileX) {
      this.renderTile(scale, tileX, tileY, context);
    }
  }
  
  context.restore();
  
  if (0) {
    // Draw mouse position on canvas for debugging purpose
    if (this.pinchZoom.ongoingTouches.mouse && this.pinchZoom.ongoingTouches.mouse.currentViewerPos) {
      var pos = this.pinchZoom.ongoingTouches.mouse.currentViewerPos;
      context.beginPath();
        context.arc(pos.x, pos.y, 20, 0, 2 * Math.PI, false);
        context.fillStyle = 'green';
        context.fill();
    }
  }
  this.inDraw = false;
  ++this.numDraw;
  
  this.processQueue();

  // control memory usage.
  this.limitCacheSize();
};

CanvasTilesRenderer.prototype.renderTile = function(scale, tileX, tileY, context) {
  var zoom = 1 / (1 << scale);
  var left = tileX * zoom;
  var right = (tileX + 1) * zoom;
  var top = tileY * zoom;
  var bottom = (tileY + 1) * zoom;
  
  for (var upLevel = 0; upLevel <= scale && upLevel < 5; ++upLevel) {
    var upTileX = tileX >> upLevel;
    var upTileY = tileY >> upLevel;
    
    var tile = this.getTile(scale - upLevel, upTileX , upTileY, 1 - upLevel * .15);
    if (tile && tile.image && tile.image.complete) {
      var skipX = tileX - (upTileX << upLevel);
      var skipY = tileY - (upTileY << upLevel);
      var size = this.params.tileSize >> upLevel;
      context.drawImage(tile.image,
        skipX * size, skipY * size,
        size, size,
        left, top,
        (right - left), (bottom - top));
      break;
    }
  }
};

CanvasTilesRenderer.prototype.getTile = function(scale, x, y, priority) {
  if (x < 0 || y < 0 || x >= (1 << scale) || y >= (1 << scale)) {
    return undefined;
  }

  var key = scale + "," + x + "," + y;
  
  if (key in this.tiles) {
    var tile = this.tiles[key];
    if (tile.lastDrawRequest == this.numDraw) {
      tile.priority += priority;
    } else {
      tile.lastDrawRequest = this.numDraw;
      tile.priority = priority;
    }
    return tile;
  }
  
  var url = this.params.url(scale, x, y);
  return this.queueTileRequest(key, url, priority);
};

CanvasTilesRenderer.prototype.queueTileRequest = function(key, url, priority) {
  var tile = { lastDrawRequest: this.numDraw, priority: priority };
  Utils.assert(tile.priority != undefined);
  this.loadQueue.push({key: key, url: url, tile: tile});
  this.tiles[key] = tile;
  return tile;
};

CanvasTilesRenderer.prototype.processQueue = function() {
  var queue = this.loadQueue;
  
  // Prioritize loading
  if (this.numLoading < this.params.maxSimultaneousLoads && queue.length > 0) {
    this.loadQueue.sort(function(a, b) {
      if (a.tile.lastDrawRequest == b.tile.lastDrawRequest) {
        return a.tile.priority - b.tile.priority;
      }
      return a.tile.lastDrawRequest - b.tile.lastDrawRequest;
    });
  }
  while (this.numLoading < this.params.maxSimultaneousLoads && queue.length > 0) {  
    var query = this.loadQueue.pop();
    
    // Check if the tile is still required.
    if ((this.numDraw - query.tile.lastDrawRequest) < 3) {
      this.numLoading++;
        
      var image = new Image();
      image.src = query.url;
      
      var t = this;
      image.onload = function() { 
        t.numLoading--;
        t.numCachedTiles++;
        t.tiles[query.key].image = image;
        t.processQueue();
        t.draw();
      };
      image.onerror = function() {
        t.numLoading--;
        t.tiles[query.key].failed = true;
        t.processQueue();
        console.log('Failed to load: ' + query.url);
      };  
    } else {
      // There's no need to load this tile, it is not required anymore.
      delete this.tiles[query.key];
    }
  }
};

CanvasTilesRenderer.prototype.limitCacheSize = function() {
  if (this.numCachedTiles <= this.params.maxNumCachedTiles) {
    // The cache is small enough.
    return;
  }

  // Build an array of tiles we may need to remove from cache  
  var cache = [];
  for (var key in this.tiles) {
    if (this.tiles[key].image) {
      cache.push(key);
    }
  }
  
  // Sort it: oldest request first.
  var t = this;  
  cache.sort(function(a,b) { return t.tiles[a].lastDrawRequest - t.tiles[b].lastDrawRequest; });
  
  // Remove old tiles.
  var numToRemove = cache.length - this.params.maxNumCachedTiles;
  for (var i = 0; i < numToRemove; ++i) {
    var key = cache[i];
    delete this.tiles[key];
    this.numCachedTiles--;
  }
};

