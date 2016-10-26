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


  var tx = topleft.x;
  var ty = topleft.y;
  var sx = (bottomright.x - topleft.x) / 1009.6727;
  var sy = (bottomright.y - topleft.y) / 665.96301;

  tx += -0.80425156 * sx;
  ty += 0.25140147 * sy;

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

    if (country.bbox) {
      if ((country.bbox.max[0] * sx + tx) <= 0
          || (country.bbox.min[0] * sx + tx) >= canvas.width
          || (country.bbox.max[1] * sy + ty) <= 0
          || (country.bbox.min[1] * sy + ty) >= canvas.height) {
        continue;
      }
    } else {
      country.bbox = { min: undefined, max: undefined };
    }

    var coords = country.commands;

    var p = [0, 0];

    for (var j = 0; j < coords.length; ++j) {
      var c = coords[j];

      if (c == 'M') {
        moveAbsolute = false;
        ++j;
        p = coords[j].slice();
        addPointToBbox(country.bbox, p);
        context.beginPath();
        context.moveTo(p[0] * sx + tx, p[1] * sy + ty);
      } else if (c == 'm') {
        moveAbsolute = false;
        ++j;
        var delta = coords[j];
        p[0] += delta[0];
        p[1] += delta[1];
        context.beginPath();
        addPointToBbox(country.bbox, p);
        context.moveTo(p[0] * sx + tx, p[1] * sy + ty);
      } else if (c == 'z') {
        context.closePath();
        context.fill();
        context.stroke();
      } else if (c == 'l') {
        moveAbsolute = false;
      } else if (c == 'L') {
        moveAbsolute = true;
        ++j;
        var p = coords[j].slice();
        addPointToBbox(country.bbox, p);
        context.lineTo(p[0] * sx + tx, p[1] * sy + ty);
      } else if (c.length > 1) {
        if (moveAbsolute) {
          p = c.slice();
        } else {
          var delta = c;
          p[0] += delta[0];
          p[1] += delta[1];
        }
        addPointToBbox(country.bbox, p);
        context.lineTo(p[0] * sx + tx, p[1] * sy + ty);
      } else {
        console.log('unknown command: ' + c);
      }
    }
  }

};

