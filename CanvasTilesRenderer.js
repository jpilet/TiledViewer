function CanvasTilesRenderer(canvas, params) {
  this.params = (params != undefined ? params : {});
  this.canvas = canvas;
  
  if (!("tileSize" in this.params)) this.params.tileSize = 256;
  if (!("url" in this.params)) this.params.url = "http://a.tile2.opencyclemap.org/transport/";
  if (!this.params.ext) this.params.ext = ".png";
  
  this.tiles = {};
  this.numLoading = 0;
  this.loadQueue = [];
  
  this.inDraw = false;
  
  var t = this;
  var draw = function() { t.draw(canvas); };
  this.pinchZoom = new PinchZoom(canvas, draw);
  
  var constraints = [
    { viewer: {x:0, y:0}, world: {x:0, y:0} },
    { viewer: {x: canvas.width, y: canvas.height}, world: {x:1, y:1}}
  ];
  this.pinchZoom.processConstraints(constraints);
}

CanvasTilesRenderer.prototype.draw = function() {
  if (this.inDraw) {
    return;
  }
  this.inDraw = true;
  
  var canvas = this.canvas;
  var pinchZoom = this.pinchZoom;
  
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
  var scale = Math.max(0, Math.ceil(- Math.log(targetUnitPerTile) / Math.LN2));
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
  
  for (var tileY = firstTileY; tileY <= lastTileY; ++tileY) {
    for (var tileX = firstTileX; tileX <= lastTileX; ++tileX) {
      this.renderTile(scale, tileX, tileY, context);
    }
  }
  
  context.restore();
  this.inDraw = false;
};

CanvasTilesRenderer.prototype.renderTile = function(scale, tileX, tileY, context) {
  var zoom = 1 / (1 << scale);
  var left = tileX * zoom;
  var right = (tileX + 1) * zoom;
  var top = tileY * zoom;
  var bottom = (tileY + 1) * zoom;
  
  var tile = this.getTile(scale, tileX, tileY);
  if (tile && tile.complete) {
    context.drawImage(tile, left, top, (right - left), (bottom - top));
  }
};

CanvasTilesRenderer.prototype.getTile = function(scale, x, y) {
  if (x < 0 || y < 0 || x >= (1 << scale) || y >= (1 << scale)) {
    return undefined;
  }

  var key = scale + "," + x + "," + y;
  
  if (key in this.tiles) {
    return this.tiles[key];
  }
  
  // TODO: free memory..

  var url = this.params.url + scale + '/' + x + '/' + y + this.params.ext;
  this.queueTileRequest(key, url);
  return this.tiles[key];
};

CanvasTilesRenderer.prototype.queueTileRequest = function(key, url) {
  this.loadQueue.push({key: key, url: url});
  this.tiles[key] = false;
  this.processQueue();
};

CanvasTilesRenderer.prototype.processQueue = function() {
  if (this.numLoading >= 4 || this.loadQueue.length == 0) {
    // Busy..
    return;
  }
  
  var query = this.loadQueue.pop();
  
  this.numLoading++;
    
  var tile = new Image();
  tile.src = query.url;
  
  var t = this;
  tile.onload = function() { 
    t.numLoading--;
    t.tiles[query.key] = tile;
    t.processQueue();
    t.draw();
  };
  tile.onerror = function() {
    t.numLoading--;
    t.tiles[query.key] = false;
    t.processQueue();
    console.log('Failed to load: ' + query.url);
  };  
};
