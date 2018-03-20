TiledViewer: a canvas-based map viewer
======================================

TiledViewer is a javascript viewer for tile-based maps such as OpenStreetMap.
TiledViewer depends a browser with canvas 2d support. It has no other external
dependency.

TiledViewer is meant to be pleasant to use and very responsive. It is designed for
touch screens.

Features
--------

- Pinch and zoom: TiledViewer hanles "pinch and zoom" gestures on multi-touch screens.
- Supports high resolution screens such as retina display.
- Progressive loading: low definition images are displayed first, while higher
  resolution tiles are getting loaded.
- Fetch queue: TiledViewer organizes the tile fetch queue very seriously. Tiles that
  were previously requested but that are not needed any more will not be fetched.

Requirements:
-------------
libcairo2-dev libjpeg-dev libgif-dev

Usage
-----

see ```Example/htmlinterface.html``` for an example on how to integrate a map on your page.

Author
------

TiledViewer is written by Julien Pilet <julien.pilet@opticode.ch>
see http://www.opticode.ch/

