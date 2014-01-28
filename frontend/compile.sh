#!/bin/bash

cat \
utils.js affinetransform.js pinchzoom.js CanvasTilesRenderer.js htmlinterface.js \
    | jsmin > mapviewer.min.js
