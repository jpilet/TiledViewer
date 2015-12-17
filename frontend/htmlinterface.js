
window.addEventListener("load", function load(event){
  //remove listener, no longer needed
  window.removeEventListener("load", load, false);
  MapHtmlInterface.init();
},false);

var MapHtmlInterface = {
  paramNames: ["url", "width", "height", "debug", "minScale", "tileSize",
               "maxNumCachedTiles", "maxSimultaneousLoads", "downgradeIfSlowerFPS",
               "initialLocation", "onLocationChange", "geoConv", "maxScale", "maxX", "maxY", "minY", "minX"],
  stringParamNames: {"url": true},

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
      canvas: canvas,
      geoConv: function(lon,lat) {
	  // default to OSM converter.
	  return [
	      ((lon + 180.0) / 360.0),
	      ((1.0 - Math.log( Math.tan(lat * Math.PI/180.0) + 1.0 / Math.cos(lat * Math.PI/180.0)) / Math.PI) / 2.0)
	  ];
      }
    }
    var attr = function(name) {
      var attributeName = "data-map-" + name;
      if (container.hasAttribute(attributeName)) {
        params[name] = container.getAttribute(attributeName);
        if (!(name in MapHtmlInterface.stringParamNames)) {
           eval("params[name] = (" + params[name] + ');');
        }
      }
    }
    for (var i in MapHtmlInterface.paramNames) {
      attr(MapHtmlInterface.paramNames[i]);
    }
    if (typeof(params.onLocationChange) == "function") {
      var userCallback = params.onLocationChange;
      params.onLocationChange = function(canvasRenderer) {
        MapHtmlInterface.placeMarks(container, canvasRenderer);
        userCallback(canvasRenderer);
      }
    } else {
      params.onLocationChange = function(canvasRenderer) {
        MapHtmlInterface.placeMarks(container, canvasRenderer);
      }
    }
    var canvasTilesRenderer = new CanvasTilesRenderer(params);

    canvasTilesRenderer.resizeListener = function() {
      canvasTilesRenderer.refresh();
    };

    window.addEventListener(
        "resize", canvasTilesRenderer.resizeListener, false);

    canvasTilesRenderer.container = container;

    return canvasTilesRenderer;
  },

  destroy: function(renderer) {
    window.removeEventListener("resize", renderer.resizeListener);
    renderer.container.removeChild(renderer.params.canvas);
    for (var i in renderer) {
      delete renderer[i];
    }
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

    var processFloatAttribute = function (elem, attrName, callback) {
      var name = "data-map-" + attrName;
      if (elem.hasAttribute(name)) {
          callback(parseFloat(elem.getAttribute(name)));
        }
    };

    var loc = canvasTilesRenderer.getLocation();

    for (var i = 0; i < container.childNodes.length; ++i) {
      var child = container.childNodes[i];
      if ("hasAttribute" in child && (
		  child.hasAttribute("data-map-pos")
		  || child.hasAttribute("data-map-geo"))) {
	if (child.hasAttribute("data-map-pos")) {
	    var pos = splitArrayArg(child.getAttribute("data-map-pos"));
	} else {
	    var geopos = splitArrayArg(child.getAttribute("data-map-geo"));
	    var pos = canvasTilesRenderer.params.geoConv(geopos[0], geopos[1]);
	}

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
          y: anchorPos.y - anchor.y * child.offsetHeight
        };

        child.style.position = "absolute";
        child.style.left = Math.round(topLeft.x) + "px";
        child.style.top = Math.round(topLeft.y) + "px";

        processFloatAttribute(child, "width", function(width) {
          var topRight = worldToElement(worldPos.x + width, worldPos.y);
          child.style.width = (topRight.x - topLeft.x) + "px";
        });

        processFloatAttribute(child, "height", function(height) {
          var bottomLeft = worldToElement(worldPos.x, worldPos.y + height);
          child.style.height = (bottomLeft.y - topLeft.y) + "px";
        });

        var display = undefined;
        processFloatAttribute(child, "min-scale", function(minScale) {
          if (loc.scale < minScale) {
            display = "none";
          }
        });
        processFloatAttribute(child, "max-scale", function(maxScale) {
          if (loc.scale > maxScale) {
            display = "none";
          }
        });
        child.style.display = display;
      }
    }
  }
};
