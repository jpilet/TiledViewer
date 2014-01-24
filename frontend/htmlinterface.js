
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

    var params = {
      "canvas": canvas,
      "onLocationChange": function(canvasRenderer) {
        MapHtmlInterface.placeMarks(container, canvasRenderer);
      }
    };
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
  },

  placeMarks: function(container, canvasTilesRenderer) {
    var worldToElement = function(x, y) {
      var canvas = canvasTilesRenderer.params.canvas;
      var canvasPos = canvasTilesRenderer.pinchZoom.viewerPosFromWorldPos(x, y);
      return {
        x: canvasPos.x * (canvas.offsetWidth / canvas.width),
        y: canvasPos.y * (canvas.offsetHeight / canvas.height)
      };
    }

    var splitArrayArg = function(asString) {
      if (asString) {
        return asString.split(",").map(parseFloat);
      } else {
        return [];
      }
    }

    for (var i = 0; i < container.childNodes.length; ++i) {
      var child = container.childNodes[i];
      if ("hasAttribute" in child && child.hasAttribute("data-map-pos")) {
        var pos = splitArrayArg(child.getAttribute("data-map-pos"));
        if (pos.length != 2) {
          throw("data-map-pos syntax is: \"x,y\", for example: data-map-pos=\".1,.2\"");
        }
        var worldPos = { x: pos[0], y: pos[1] };
        var anchorPos = worldToElement(worldPos);

        var anchor = { x: 0, y: 0 };
        var anchorParam = splitArrayArg(child.getAttribute("data-map-anchor"));
        if (!isNaN(anchorParam[0])) {
          anchor.x = anchorParam[0];
        }
        if (!isNaN(anchorParam[1])) {
          anchor.y = anchorParam[1];
        }

        var topLeft = {
          x: anchorPos.x - anchor.x * child.offsetWidth,
          y: anchorPos.y - anchor.y * child.offsetHeight,
        };

        child.style.position = "absolute";
        child.style.left = Math.round(topLeft.x) + "px";
        child.style.top = Math.round(topLeft.y) + "px";

        if (child.hasAttribute("data-map-width")) {
          var width = parseFloat(child.getAttribute("data-map-width"));
          var topRight = worldToElement(worldPos.x + width, worldPos.y);
          child.style.width = (topRight.x - topLeft.x) + "px";
        }

        if (child.hasAttribute("data-map-height")) {
          var height = parseFloat(child.getAttribute("data-map-height"));
          var bottomLeft = worldToElement(worldPos.x, worldPos.y + height);
          child.style.height = (bottomLeft.y - topLeft.y) + "px";
        }
          
      }
    }
  },
};
