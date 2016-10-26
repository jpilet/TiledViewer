'use strict';


function WorldBackgroundLayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  this.image = undefined;

  params.landColor = params.landColor || '#cccccc';
  params.seaColor = params.seaColor || '#a0d2ff';
  params.borderColor = params.borderColor || '#ffffff';
  params.countryColors = params.countryColors || {};

  if (!this.renderer) {
    throw(new Error("WorldBackgroundLayer: no renderer !"));
  }

  var me = this;
  if (this.params.onCountryClic) {
    this.renderer.addClicHandler(function(pos) {
      return me.handleClic(pos);
    });
  }

  this.leftLongitude = params.leftLongitude || -169.110266;
  this.topLatitude = params.topLatitude || 83.63001;
  this.rightLongitude = params.rightLongitude || 190.480712;
  this.bottomLatitude = params.bottomLatitude || -58.488473;
}

WorldBackgroundLayer.prototype.save = function() {
  var r = {};
  var me = this;
  ['landColor', 'seaColor', 'borderColor', 'countryColors'].map(
      function(key) {
      r[key] = me.params[key];
      });
  return r;
};

WorldBackgroundLayer.bboxContains = function(bbox, p) {
  return (
      (bbox.min[0] < p.x)
      && (bbox.max[0] > p.x)
      && (bbox.min[1] < p.y)
      && (bbox.max[1] > p.y));
};

WorldBackgroundLayer.prototype.countryAtPos = function(pos) {
  var countries =WorldBackgroundLayer.countries; 
  var context = this.renderer.canvas.getContext('2d');
  var clickedCountry;
  var me = this;
  for (var i in countries) {
    var country = countries[i];
    if (WorldBackgroundLayer.bboxContains(country.bbox, pos)) {
      this.canvasCommands(context,
                          country.commands,
                          function() {
                            if (context.isPointInPath(pos.x * me.sx + me.tx,
                                                      pos.y * me.sy + me.ty)) {
                              clickedCountry = country;
                            }
                          }
                         );
      if (clickedCountry) {
        return clickedCountry;
      }
    }
  }
  return undefined;
};

WorldBackgroundLayer.prototype.handleClic = function(pos) {
  if (!this.params.onCountryClic) {
    return false;
  }

  var p = {
    x: (pos.startViewerPos.x - this.tx) / this.sx,
    y: (pos.startViewerPos.y - this.ty) / this.sy
  };
  var country = this.countryAtPos(p);
  if (country) {
    this.params.onCountryClic(country);
    return true;
  }
  return false;
};

WorldBackgroundLayer.prototype.canvasCommands
  = function(context, coords, pathCallback, pointCallback) {
  var p = [0, 0];

  var moveAbsolute = false;

  var tx = this.tx;
  var ty = this.ty;
  var sx = this.sx;
  var sy = this.sy;

  for (var j = 0; j < coords.length; ++j) {
    var c = coords[j];

    if (c == 'M') {
      moveAbsolute = false;
      ++j;
      p = coords[j].slice();
      if (pointCallback) { pointCallback(p); }
      context.beginPath();
      context.moveTo(p[0] * sx + tx, p[1] * sy + ty);
    } else if (c == 'm') {
      moveAbsolute = false;
      ++j;
      var delta = coords[j];
      p[0] += delta[0];
      p[1] += delta[1];
      context.beginPath();
      if (pointCallback) { pointCallback(p); }
      context.moveTo(p[0] * sx + tx, p[1] * sy + ty);
    } else if (c == 'z') {
      context.closePath();
      if (pathCallback) { pathCallback(); }
    } else if (c == 'l') {
      moveAbsolute = false;
    } else if (c == 'L') {
      moveAbsolute = true;
      ++j;
      var p = coords[j].slice();
      if (pointCallback) { pointCallback(p); }
      context.lineTo(p[0] * sx + tx, p[1] * sy + ty);
    } else if (c.length > 1) {
      if (moveAbsolute) {
        p = c.slice();
      } else {
        var delta = c;
        p[0] += delta[0];
        p[1] += delta[1];
      }
      if (pointCallback) { pointCallback(p); }
      context.lineTo(p[0] * sx + tx, p[1] * sy + ty);
    } else {
      console.log('unknown command: ' + c);
    }
  }
};

WorldBackgroundLayer.prototype.draw = function(canvas, pinchZoom,
                                      bboxTopLeft, bboxBottomRight) {
  var context = canvas.getContext('2d');
  context.rect(0, 0, canvas.width, canvas.height);
  context.fillStyle = this.params.seaColor;
  context.fill();

  var topLeftWorld = Utils.latLonToWorld(
      [this.leftLongitude, this.topLatitude])

  var topleft = pinchZoom.viewerPosFromWorldPos(topLeftWorld);

  var bottomRightWorld = Utils.latLonToWorld(
      [this.rightLongitude, this.bottomLatitude])
  //bottomRightWorld.x += 1;
  var bottomright = pinchZoom.viewerPosFromWorldPos(bottomRightWorld);


  this.tx = topleft.x;
  this.ty = topleft.y;
  var sx = this.sx = (bottomright.x - topleft.x) / 1009.6727;
  var sy = this.sy = (bottomright.y - topleft.y) / 665.96301;

  var tx = this.tx += -0.80425156 * this.sx;
  var ty = this.ty += 0.25140147 * this.sy;

  var parseCoord = function(c) {
    var a = c.split(',');
    return [ parseFloat(a[0]), parseFloat(a[1]) ];
  }

  var addPointToBbox = function(bbox, p) {
    if (!bbox.min) {
      bbox.min = p.slice();
    } else {
      bbox.min[0] = Math.min(bbox.min[0], p[0]);
      bbox.min[1] = Math.min(bbox.min[1], p[1]);
    }
    if (!bbox.max) {
      bbox.max = p.slice();
    } else {
      bbox.max[0] = Math.max(bbox.max[0], p[0]);
      bbox.max[1] = Math.max(bbox.max[1], p[1]);
    }
  };


  context.lineWidth = 1 * this.renderer.pixelRatio;
  context.strokeStyle = this.params.borderColor;
  context.fillStyle = this.params.landColor;

  var moveAbsolute = false;

  var countries =WorldBackgroundLayer.countries; 
  for (var i in countries) {
    var country = countries[i];

    context.fillStyle = (this.params.countryColors[country.id]
                         || this.params.landColor);
    //if (country.id != 'CA') { continue; }
    if (!country.commands) {
      country.commands = country.d.split(' ');
      for (var i in country.commands) {
        if (country.commands[i].length > 1) {
          country.commands[i] = parseCoord(country.commands[i]);
        }
      }
    }

    var computeBbox = undefined;
    if (country.bbox) {
      if ((country.bbox.max[0] * sx + tx) <= 0
          || (country.bbox.min[0] * sx + tx) >= canvas.width
          || (country.bbox.max[1] * sy + ty) <= 0
          || (country.bbox.min[1] * sy + ty) >= canvas.height) {
        continue;
      }
    } else {
      country.bbox = { min: undefined, max: undefined };
      computeBbox = 
        function(p) {
          addPointToBbox(country.bbox, p);
        };
    }

    this.canvasCommands(
        context,
        country.commands,
        function() {
          context.fill();
          context.stroke();
        },
        computeBbox
    );
  }

};

