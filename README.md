# Canvas Zoomify

Huge Image Zoom Widget with HTML Canvas
---

# Getting Started

* Step 0:

Prepare the image:

```bash
python CanvasZoomifySlicer.py 'images/Huge1.jpg' 'img/Huge1-slices/' 'MyHugeSlice' 4 4 2
```

Meaning of the command line arguments:

```bash
CanvasZoomifySlicer usage: python CanvasZoomifySlicer.py [RawImagePath] [BaseDir] [Prefix] [Levels] [SliceRows] [SliceCols]
```

Output:

```json
{
    "isDebug": false,
    "levelValues": [1, 2, 4, 8],
    "rowsPerLevel": 4,
    "colsPerLevel": 2,
    "tileWidth": 100,
    "tileHeight": 37,
    "tilesBasePath": "examples/img/Huge1-slices/",
    "tileNamePrefix": "MyHugeSlice",
    "tileImageType": "jpg",
}
```

* Step 1:

Add following div into your html code:

CanvasZoomify just need an element, so choose your own class or id is fine

```html
<div class="mycanvaszoomify"></div>
```

* Step 2:

Add a new CanvasZoomify to your js code:

```javascript
var cz = new CanvasZoomify($('.mycanvaszoomify'), /* config json */);
```

Just use the python script's output as the config, and it'll just work!

```
var cz = new CanvasZoomify(
  $('.mycanvaszoomify'),
  {
    "isDebug": false,
    "levelValues": [1, 2, 4, 8],
    "rowsPerLevel": 4,
    "colsPerLevel": 2,
    "tileWidth": 100,
    "tileHeight": 37,
    "tilesBasePath": "examples/img/Huge1-slices/",
    "tileNamePrefix": "MyHugeSlice",
    "tileImageType": "jpg",
  }
);
```

# Default Configurations for CanvasZoomify

Any config will be its default values if not set

```javascript
{
    "isDebug": false,       // enable or not debug mode
    "levelValues": null,    // level values, must be 2^n, also the level directories name (required)
    "rowsPerLevel": null,   // number of tile rows each level (required)
    "colsPerLevel": null,   // number of tile colums each level (required)
    "tileWidth": null,      // the width of each tile (required)
    "tileHeight": null,     // the height of each tile (required)
    "tilesBasePath": null,  // the base path of the tile files (required)
    "tileNamePrefix": null, // the tile files prefix name (required)
    "tileImageType": "jpg", // the tile image type, usually "jpg"
    "tiles": null,          // use the default generated tile file path

    "width": 640,           // the canvas width
    "height": 480,          // the canvas height
    "offsetX": 0,           // the starting image offset in x axis
    "offsetY": 0,           // the starting image offset in y axis
    "scale": 0,             // the starting image scale, 0 for auto mode: Scale to fit the image in the canvas
    "scaleStep": 1.1,       // each pinch or mouse scroll, will cause `scale = scale * scaleStep`
    "scaleMax": 16.0,       // the max scale, setting it to null will enable infinite scale

    "afterInit": function() {},      // triggered right after CanvasZoomify initialization

    "onCz_update": function(ev) {},  // triggered every time the canvas updates its parameter
    "onCz_clear": function(ev) {},   // triggered every time the canvas clears
    "onCz_repaint": function(ev) {}, // triggered every time the canvas repaints

    "onPanstart": function(ev) {},   // triggered every time the canvas is at its panning start
    "onPanmove": function(ev) {},    // triggered every time the canvas is moved by panning
    "onPinchstart": function(ev) {}, // triggered every time the canvas is at its pinching start
    "onPinch": function(ev) {},      // triggered every time the canvas is scaled by pinching

    "onMousedown": function(ev) {},  // triggered every time the canvas is on its mousedown
    "onMouseup": function(ev) {},    // triggered every time the canvas is on its mouseup
    "onMousemove": function(ev) {},  // triggered every time the canvas is on its mousemove
    "onMousewheel": function(ev, customDeltaScale) {},    // triggered every time the canvas is scaled by mouse wheel
    "onDOMMouseScroll": function(ev, customDeltaScale) {} // triggered every time the canvas is scaled by mouse wheel (only for firefox)
}
```

# Documentation

You can browse the documentation online at http://adamcavendish.github.io/CanvasZoomify/. You can also get an offline version of the documentation by checking out the gh-pages branch. To avoid overwriting the current directory, you can clone the gh-pages branch into a subdirectory like doc/html:

git clone https://github.com/adamcavendish/CanvasZoomify.git --branch=gh-pages doc/html

After issuing this, doc/html will contain exactly the same static website that's available online. Note that doc/html is automatically ignored by Git so updating the documentation won't pollute your index.

