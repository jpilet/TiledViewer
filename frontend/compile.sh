#!/bin/bash

cd "$( dirname "${BASH_SOURCE[0]}" )"

FILES="utils.js affinetransform.js pinchzoom.js CanvasTilesRenderer.js htmlinterface.js TileLayer.js ScaleLayer.js 
POILayer.js ArrowLayer.js"

cat $FILES | jsmin > ../build/mapviewer.min.js
cat $FILES > ../build/mapviewer.js
