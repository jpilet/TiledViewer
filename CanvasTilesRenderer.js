function CanvasTilesRenderer(canvas, params) {
  this.params = (params != undefined ? params : {});
  this.canvas = canvas;
  
  if (!("tileSize" in this.params)) this.params.tileSize = 256;
  if (!("url" in this.params)) {
    this.params.url = function(scale, x, y) {
      return "http://a.tile.openstreetmap.org/" + scale + '/' + x + '/' + y + '.png';
    };
  }
  this.params.width = this.params.width || 1;
  this.params.height = this.params.height || 1;
  
  if (!this.params.maxNumCachedTiles) this.params.maxNumCachedTiles = 64;
  if (!this.params.maxSimultaneousLoads) this.params.maxSimultaneousLoads = 3;
  this.params.downgradeIfSlowerFPS = params.downgradeIfSlowerFPS || 20;
  
  this.tiles = {};
  this.numLoading = 0;
  this.loadQueue = [];

  this.canvasWidth = -1;
  this.canvasHeight = -1;

  if (params.debug) {
      this.debug = function(msg) { console.log(msg); }
  } else {
      this.debug = function(msg) { };
  }

  // Block drawing before we are ready.  
  this.inDraw = true;
  this.numDraw = 0;
  this.numCachedTiles = 0;
  this.disableResize = false;
  this.lastRefreshRequest = -1;
  
  var t = this;
  var drawClosure = function() {
    // Sets "this" to the correct object before calling draw.
    t.draw(canvas);
  };
  this.refresh = function() {
    if (t.lastRefreshRequest == t.numDraw) {
      return;
    }
    t.lastRefreshRequest = t.numDraw;

    window.requestAnimationFrame(drawClosure);
  };
  this.pinchZoom = new PinchZoom(canvas, function() {
    if (t.params.onLocationChange) { t.params.onLocationChange(t); }
    t.location = t.getLocation();
    t.debug('location: w:' + canvas.width
                + ' h:' + canvas.height
                + ' x:'+t.location.x + ' y:'+t.location.y
                +' s:'+t.location.scale);
    t.refresh();
  },
  this.params.width,
  this.params.height);
  
  // We are ready, let's allow drawing.  
  this.inDraw = false;
  
  this.location = params.initialLocation || {
    x: this.params.width / 2,
    y: this.params.height / 2,
    scale: this.params.width
  };
  this.setLocation(this.location);
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

CanvasTilesRenderer.prototype.resizeCanvas = function() {
  if (this.disableResize) {
    return;
  }

  var canvas = this.canvas;

  // devicePixelRatio should tell us about the current zoom level.
  var density = (this.params.forceDevicePixelRatio || window.devicePixelRatio || 1);

  // On some browsers/devices, filling the full resolution canvas
  // takes too long. During animations, we downsample the canvas
  // to make it fast enough. When motion stops, we render the map
  // at full resolution again.
  var factor = (this.params.downsampleDuringMotion &&
                this.pinchZoom.isMoving()) ?  density / 2 : density;

  var initialClientWidth = canvas.clientWidth;
  var initialClientHeight = canvas.clientHeight;

  // Is it Math.floor or Math.round ? Who knows...
  var newWidth = Math.floor(canvas.clientWidth * factor);
  var newHeight = Math.floor(canvas.clientHeight * factor);

  if (newWidth != 0 && newHeight != 0 && 
         (Math.abs(canvas.width - newWidth) > 3 ||
          Math.abs(canvas.height - newHeight) > 3)) {
      canvas.width = newWidth;
      canvas.height = newHeight;
  }

  if (canvas.width != this.canvasWidth || canvas.height != this.canvasHeight) {
      this.canvasWidth = canvas.width;
      this.canvasHeight = canvas.height;

      // We resized the canvas, but we want to express the same transform.
      // Let's update the transform for the new size.
      this.setLocation(this.location);
  }  
  
  if (initialClientWidth != canvas.clientWidth) {
     // Canvas size on page should be set by CSS, not by canvas.width and canvas.height.
     // It seems it is not the case. Let's forget about this devicePixelRatio stuff.
     this.disableResize = true;  
  }  
};

CanvasTilesRenderer.prototype.draw = function() {
  if (this.inDraw) {
    return;
  }
  this.inDraw = true;

  var startTimestamp = new Date().getTime();

  var canvas = this.canvas;
  var pinchZoom = this.pinchZoom;
  
  this.resizeCanvas();
  pinchZoom.checkAndApplyTransform();
  
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
  
  this.processQueue();

  // control memory usage.
  this.limitCacheSize();

  this.inDraw = false;
  ++this.numDraw;

  var endTimestamp = new Date().getTime();
  var renderingTime = (endTimestamp - startTimestamp);
  if (renderingTime > (1000/this.params.downgradeIfSlowerFPS)) {
      // If rendering is too slow, we degrade visual quality during motion,
      // to make it faster.
      this.params.downsampleDuringMotion = true;
  }
  this.debug('rendering time:' + renderingTime);

  // Continuously animate while moving.
  if (this.pinchZoom.isMoving()) {
      this.refresh();
  }
};

CanvasTilesRenderer.prototype.renderTile = function(scale, tileX, tileY, context) {
  var zoom = 1 / (1 << scale);
  var left = tileX * zoom;
  var top = tileY * zoom;

  if (left >= this.params.width || top >= this.params.height) {
    return;
  }

  var quarterPixel = .25 * this.location.scale / this.canvas.width;
    
  for (var upLevel = 0; upLevel <= scale && upLevel < 5; ++upLevel) {
    var upTileX = tileX >> upLevel;
    var upTileY = tileY >> upLevel;
    
    var tile = this.getTile(scale - upLevel, upTileX , upTileY, 1 - upLevel * .15);
    if (tile && tile.image && tile.image.width > 0 && tile.image.height > 0) {
      var skipX = tileX - (upTileX << upLevel);
      var skipY = tileY - (upTileY << upLevel);
      var size = this.params.tileSize >> upLevel;
      
      var right = (tileX + tile.image.width / this.params.tileSize) * zoom;
      var bottom = (tileY + tile.image.height / this.params.tileSize) * zoom;
      
      context.drawImage(tile.image,
        skipX * size, skipY * size,
        Math.min(size, tile.image.width - skipX * size),
        Math.min(size, tile.image.height - skipY * size),
        left - quarterPixel, top - quarterPixel,
        (right - left) + quarterPixel, (bottom - top) + quarterPixel);
      break;
    }
  }
};

CanvasTilesRenderer.prototype.getTile = function(scale, x, y, priority) {
  if (x < 0 || y < 0 || x >= (this.params.width * (1 << scale)) || y >= (this.params.height * (1 << scale))) {
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
  var tile = { lastDrawRequest: this.numDraw, priority: priority, state: "queue" };
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
      query.tile.state = "loading";
      query.tile.image = image;
      
      // Force the creation of a new scope to make sure
      // a new closure is created for every "query" object. 
      var f = (function(t, image, query) {
        image.onload = function() { 
          t.numLoading--;
          t.numCachedTiles++;
          query.tile.state = "loaded";
          t.draw();
        };
        image.onerror = function() {
          t.numLoading--;
          query.tile.state = "failed";
          delete query.tile.image;
          console.log('Failed to load: ' + query.url);
          t.processQueue();
        };  
      })(this, image, query);
      
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

