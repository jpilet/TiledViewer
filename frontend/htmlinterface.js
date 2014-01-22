
window.addEventListener("load", function load(event){
  //remove listener, no longer needed
  window.removeEventListener("load", load, false);
  MapHtmlInterface.init();  
},false);

var MapHtmlInterface = {
  paramNames: ["url", "width", "height", "debug", "minScale", "tileSize",
               "maxNumCachedTiles", "maxSimultaneousLoads", "downgradeIfSlowerFPS"],
  init: function() {
    var maps = document.querySelectorAll("[data-map-url]");
    for (var i = 0; i < maps.length; ++i) {
      MapHtmlInterface.initMap(maps[i]);
    }
  },
  initMap: function(container) {
    var canvas = document.createElement('canvas');
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.innerHtml = "Your browser does not support CANVAS.";
    container.insertBefore(canvas, container.childNodes[0]);

    var params = {canvas: canvas};
    var attr = function(name) {
      var attributeName = "data-map-" + name;
      if (container.hasAttribute(attributeName)) {
        params[name] = container.getAttribute(attributeName);
      }
    }
    for (var i in MapHtmlInterface.paramNames) {
      attr(MapHtmlInterface.paramNames[i]);
    }
    var canvasTilesRenderer = new CanvasTilesRenderer(params);

    window.addEventListener(
        "resize", function() {
          canvasTilesRenderer.refresh();
        }, false);
  }
};
