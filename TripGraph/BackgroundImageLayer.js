'use strict';

function BackgroundImageLayer(params) {
  this.params = params;
  this.renderer = params.renderer;
  this.image = undefined;

  if (!this.renderer) {
    throw(new Error("BackgroundImageLayer: no renderer !"));
  }
  params.imageUrl = params.imageUrl || 'worldHigh.svg';

  var me = this;
  this.renderer.loadImage(
      params.imageUrl,
      function(imageData) {
        me.image = imageData;
        me.renderer.refresh();
      },
      function(err) {
        throw new Error(err);
      }
  );

  this.leftLongitude = params.leftLongitude || -169.110266;
  this.topLatitude = params.topLatitude || 83.63001;
  this.rightLongitude = params.rightLongitude || 190.480712;
  this.bottomLatitude = params.bottomLatitude || -58.488473;
}

BackgroundImageLayer.prototype.draw = function(canvas, pinchZoom,
                                      bboxTopLeft, bboxBottomRight) {
  if (!this.image) {
    return;
  }
  var context = canvas.getContext('2d');
  context.rect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#a0d2ff';
  context.fill();

  var topLeftWorld = Utils.latLonToWorld(
      [this.leftLongitude, this.topLatitude])

  var topleft = pinchZoom.viewerPosFromWorldPos(topLeftWorld);

  var bottomRightWorld = Utils.latLonToWorld(
      [this.rightLongitude, this.bottomLatitude])
  //bottomRightWorld.x += 1;
  var bottomright = pinchZoom.viewerPosFromWorldPos(bottomRightWorld);

  context.drawImage(this.image,
                    topleft.x,
                    topleft.y,
                    bottomright.x - topleft.x,
                    bottomright.y - topleft.y);

};

