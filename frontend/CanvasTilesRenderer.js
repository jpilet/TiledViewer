// CanvasTilesRenderer.js - copyright Julien Pilet, 2013

/** Construct a CanvasTilesRenderer object on a canvas.
 *
 * \param canvas the canvas element to render tiles to.
 * \param url a function taking (scale,x,y) as arguments. Returns a tile URL.
 *            default: openstreetmap.
 * \param initialLocation the initial location (zoom and translation).
 *                        See setLocation().
 * \param tileSize the tileSize, in pixels. Default: 256.
 * \param width the image width. Unit: number of tiles at level 0 (float OK).
 * \param height image height. Unit: number of tiles at level 0.
 * \param maxNumCachedTiles the maximum number of hidden tiles to keep in cache.
 *                          default: 64.
 * \param maxSimultaneousLoads maximum parallel loading operations. Default: 3.
 * \param downgradeIfSlowerFPS If rendering falls below this framerate, degrade
 *                             image quality during animation.
 * \param debug if true, output debug info on console.
 */
function CanvasTilesRenderer(params) {
  this.params = (params != undefined ? params : {});
  this.canvas = params.canvas;
  
  if (!("tileSize" in this.params)) this.params.tileSize = 256;
  if (!("url" in this.params)) {
    this.params.url = function(scale, x, y) {
      return "http://a.tile.openstreetmap.org/" + scale + '/' + x + '/' + y + '.png';
    };
  }
  this.params.width = this.params.width || 1;
  this.params.height = this.params.height || 1;
  this.params.minScale = this.params.minScale || 0;
  
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
  this.pinchZoom = new PinchZoom(t.canvas, function() {
    if (t.params.onLocationChange) { t.params.onLocationChange(t); }
    t.location = t.getLocation();
    if (t.params.debug) {
      t.debug('location: w:' + t.canvas.width
              + ' h:' + t.canvas.height
              + ' x:'+t.location.x + ' y:'+t.location.y
              +' s:'+t.location.scale);
    }
    t.refresh();
  },
  this.params.width,
  this.params.height);
  this.pinchZoom.minScale = this.params.minScale;

  // We are ready, let's allow drawing.  
  this.inDraw = false;
  
  this.location = params.initialLocation || {
    x: this.params.width / 2,
    y: this.params.height / 2,
    scale: this.params.width
  };
  this.setLocation(this.location);
}

/** Get the current view location.
 *
 *  Returns an object containing:
 *  x: the x coordinate currently in the center of the screen, in tile 0 size units.
 *  y: the corresponding y coordinate.
 *  scale: the viewport width, in "tile 0" units.
 */
CanvasTilesRenderer.prototype.getLocation = function() {
  var left = this.pinchZoom.worldPosFromViewerPos({x: 0, y:this.canvas.height / 2});
  var right = this.pinchZoom.worldPosFromViewerPos({x: this.canvas.width, y:this.canvas.height / 2});
  
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    scale: Utils.distance(right, left)
  };
};

/** Set the current location.
 *
 * \param location the location in the format returned by getLocation().
 */
CanvasTilesRenderer.prototype.setLocation = function(location) {
  var canvas = this.canvas;
  var constraints = [
    { viewer: {x:0, y: canvas.height / 2}, world: {x:location.x - location.scale /2, y: location.y} },
    { viewer: {x:canvas.width, y: canvas.height / 2}, world: {x:location.x + location.scale /2, y: location.y} },
  ];
  this.pinchZoom.processConstraints(constraints);  
};

/** Refresh the canvas.
 *
 * this method has to be called if the canvas element is resized.
 * calling refresh mutliple times in a raw only causes 1 refresh to occur.
 */
CanvasTilesRenderer.prototype.refresh = function() {
  var t = this;
  if (t.lastRefreshRequest == t.numDraw) {
    return;
  }
  t.lastRefreshRequest = t.numDraw;

  window.requestAnimationFrame(function() { t.draw(t.canvas); });
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
  
  if (initialClientWidth != canvas.clientWidth || initialClientHeight != canvas.clientHeight) {
     // Canvas size on page should be set by CSS, not by canvas.width and canvas.height.
     // It seems it is not the case. Let's forget about this devicePixelRatio stuff.
     this.disableResize = true;  
     this.debug('Disabling resize :(');
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
    cornersWorld[0]);
    
  var bboxBottomRight = cornersWorld.reduce(
    function(a,b) { return {x: Math.max(a.x, b.x), y: Math.max(a.y, b.y)}; },
    cornersWorld[0]);
    
  // Compute the scale level
  var numTiles = canvas.width / this.params.tileSize;
  var targetUnitPerTile = (bboxBottomRight.x - bboxTopLeft.x) / numTiles;
  var scale = Math.max(0, Math.floor(- Math.log(targetUnitPerTile) / Math.LN2));
  var actualUnitPerTile = 1 / (1 << scale);

  var getTileX = function(unitX) { return  Math.floor(unitX * (1 << scale)); };
  var getTileY = function(unitY) { return  getTileX(unitY); };
  
  var firstTileX = getTileX(Math.max(0, bboxTopLeft.x));
  var firstTileY = getTileY(Math.max(0, bboxTopLeft.y));
  var lastTileX = getTileX(Math.min(this.params.width, bboxBottomRight.x));
  var lastTileY = getTileY(Math.min(this.params.height, bboxBottomRight.y));
  
  // Clear the canvas
  var context = canvas.getContext('2d');

  this.clearBorder(context);

  Utils.assert(firstTileY != undefined);
  
  var zoom = 1.0 / (1 << scale);
  var tileGeometry = {
    origin: pinchZoom.viewerPosFromWorldPos(firstTileX * zoom,
                                            firstTileY * zoom),
    delta: pinchZoom.viewerPosFromWorldPos((firstTileX + 1) * zoom,
                                           (firstTileY + 1) * zoom),
    firstTileX: firstTileX,
    firstTileY: firstTileY
  };
  // We address canvas pixels in integer coordinates to avoid
  // inconsistencies across browsers.
  tileGeometry.delta.x = Math.round(tileGeometry.delta.x - tileGeometry.origin.x);
  tileGeometry.delta.y = Math.round(tileGeometry.delta.y - tileGeometry.origin.y);
  tileGeometry.origin.x = Math.round(tileGeometry.origin.x);
  tileGeometry.origin.y = Math.round(tileGeometry.origin.y);

  for (var tileY = firstTileY; tileY <= lastTileY; ++tileY) {
    for (var tileX = firstTileX; tileX <= lastTileX; ++tileX) {
      this.renderTile(scale, tileX, tileY, context, tileGeometry);
    }
  }
  
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

  // Rendering resolution is decreased during motion.
  // To render high-res after a motion, we detect motion end
  // by setting and postponing a timeout during motion.
  var moving = this.pinchZoom.isMoving();
  if (moving) {
    if (this.moveEndTimeout != undefined) {
      window.clearTimeout(this.moveEndTimeout);
    }
    var t = this;
    this.moveEndTimeout = setTimeout(function() {
      t.moveEndTimeout = undefined;
      t.refresh();
    }, 100);
  }
  
  this.inDraw = false;
  ++this.numDraw;

  var endTimestamp = new Date().getTime();
  var renderingTime = (endTimestamp - startTimestamp);
  if (renderingTime > (1000/this.params.downgradeIfSlowerFPS)) {
      // If rendering is too slow, we degrade visual quality during motion,
      // to make it faster.
      this.params.downsampleDuringMotion = true;
  }

  if (this.params.debug) {
    var debugLocation = this.getLocation();
    this.debug('Draw at '
               + debugLocation.x + ', ' + debugLocation.y +' scale: ' + debugLocation.scale
               + ' rendering time:' + renderingTime
               + ' w:' + canvas.width + ' h:' + canvas.height);
  }
};

CanvasTilesRenderer.prototype.renderTile = function(scale, tileX, tileY, context, tileGeometry) {
  var left = tileGeometry.origin.x
      + tileGeometry.delta.x * (tileX - tileGeometry.firstTileX);
  var top = tileGeometry.origin.y
      + tileGeometry.delta.y * (tileY - tileGeometry.firstTileY);

  if (left >= this.canvas.width || top >= this.canvas.height) {
    return;
  }

  for (var upLevel = 0; upLevel <= scale && upLevel < 5; ++upLevel) {
    var upTileX = tileX >> upLevel;
    var upTileY = tileY >> upLevel;
    
    var tile = this.getTile(scale - upLevel, upTileX , upTileY, 1 - upLevel * .15);
    if (tile && tile.image && tile.image.complete && tile.image.width > 0 && tile.image.height > 0) {
      var skipX = tileX - (upTileX << upLevel);
      var skipY = tileY - (upTileY << upLevel);
      var size = this.params.tileSize >> upLevel;
      
      var texCoordX = skipX * size;
      var texCoordY = skipY * size;
      var texWidth = Math.min(size, tile.image.width - skipX * size);
      var texHeight = Math.min(size, tile.image.height - skipY * size);
      
      var width = tileGeometry.delta.x * (texWidth / size);
      var height = tileGeometry.delta.y * (texHeight / size);
      
      try {
          context.drawImage(tile.image,
            texCoordX, texCoordY, texWidth, texHeight,
            left, top, width, height);
      } catch (e) {
          this.debug('drawImage failed: ' + e.message);
      }
      return;
    }
  }
};

CanvasTilesRenderer.prototype.getTile = function(scale, x, y, priority) {
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
          if (!t.pinchZoom.isMoving()) {
            t.refresh();
          }
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
    var tile = this.tiles[key];
    // We do not remove tiles that are currently displayed.
    if (tile.image && tile.lastDrawRequest != this.numDraw) {
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

CanvasTilesRenderer.prototype.clearBorder = function(context) {
  var canvas = this.canvas;

  var topLeft = this.pinchZoom.viewerPosFromWorldPos(0, 0);
  var bottomRight = this.pinchZoom.viewerPosFromWorldPos(this.params.width,
                                               this.params.height);

  context.fillStyle = 'white';
  if (topLeft.x > 0) {
    context.fillRect(0, 0, Math.floor(topLeft.x), canvas.height);
  }

  if (topLeft.y > 0) {
    context.fillRect(0, 0, canvas.width, Math.floor(topLeft.y));
  }

  if (bottomRight.x < canvas.width) {
    context.fillRect(bottomRight.x, 0,
                      canvas.width - bottomRight.x, canvas.height);
  }
  if (bottomRight.y < canvas.height) {
    context.fillRect(0, bottomRight.y,
                      canvas.width, canvas.height - bottomRight.y);
  }
};
