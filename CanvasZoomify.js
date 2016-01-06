/**
 * Canvas Zoomify - V1.0
 */
(function(window, document, exportName, undefined) {
  'use strict';

  // credit should go to 'Fearphage'
  // http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
  var format = function(fmtString) {
    var args = Array.prototype.slice.call(arguments, 1);
    return fmtString.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };

  var clamp = function(x, min, max) {
    return Math.min(Math.max(x, min), max);
  };

  var checkRequired = function(config, name) {
    var ret = config[name];
    if (_.isNull(ret) || _.isUndefined(ret)) {
      throw new Error("CanvasZoomify TileManager: config " + name + " is required!");
    }
    return ret;
  };

  function CanvasZoomify(el, config) {
    this.config = $.extend({}, CanvasZoomify.DEFAULTS, config,
                           typeof config === 'object' && config);

    this.isDebug = this.config['isDebug'];
    this.canvasWidth = checkRequired(this.config, 'width');
    this.canvasHeight = checkRequired(this.config, 'height');
    this.offsetX = checkRequired(this.config, 'offsetX');
    this.offsetY = checkRequired(this.config, 'offsetY');
    this.scale = checkRequired(this.config, 'scale');
    this.scaleStep = checkRequired(this.config, 'scaleStep');
    this.scaleMax = checkRequired(this.config, 'scaleMax');

    if (this.isDebug) {
      console.log('CanvasZoomify Debug: ', this.isDebug);
    }

    this.$element = $(el);
    this.$canvas = $('<canvas></canvas>');
    this.$canvas.appendTo(this.$element);

    this.canvas = this.$canvas[0];
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.context = this.canvas.getContext('2d');
    this.tileManager = new TileManager(this, this.config);

    this.imageLevel = 0;

    this.touchEventManager = new Hammer(this.canvas);
    this.touchEventManager.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    this.touchEventManager.get('pinch').set({ enable: true });
    _.each(['tap', 'doubletap', 'press', 'swipe'],
      function(act) { this.touchEventManager.get(act).set({ enable: false }); }.bind(this));

    this.mouseState = {
      isMouseDown: false,
      mouseMoveLastX: null,
      mouseMoveLastY: null
    };
    this.touchState = {
      touchPanLastX: null,
      touchPanLastY: null,
      touchPinchLastScale: null
    };

    this.init();
    this.config['afterInit']();

    this.trigger('cz_update');
    this.trigger('cz_clear');
    this.trigger('cz_repaint');
  }

  CanvasZoomify.DEFAULTS = {
    isDebug: false,
    levelValues: null,
    rowsPerLevel: null,
    colsPerLevel: null,
    tileWidth: null,
    tileHeight: null,
    tilesBasePath: null,
    tileNamePrefix: null,
    tileImageType: 'jpg',
    tiles: null,

    width: null,
    height: null,
    offsetX: 0,
    offsetY: 0,
    scale: 1.0,
    scaleStep: 1.1,
    scaleMax: 16.0,

    afterInit: function() {},

    onCz_update: function(ev) {},
    onCz_clear: function(ev) {},
    onCz_repaint: function(ev) {},

    onPanstart: function(ev) {},
    onPanmove: function(ev) {},
    onPinchstart: function(ev) {},
    onPinch: function(ev) {},

    onMousedown: function(ev) {},
    onMouseup: function(ev) {},
    onMousemove: function(ev) {},
    onMousewheel: function(ev) {},
    onDOMMouseScroll: function(ev) {}
  };

  CanvasZoomify.EVENTS = {
    'cz_update': 'custom',
    'cz_clear': 'custom',
    'cz_repaint': 'custom',

    'panstart': 'multitouch',
    'panmove': 'multitouch',
    'pinchstart': 'multitouch',
    'pinch': 'multitouch',

    'mousedown': 'mouse',
    'mouseup': 'mouse',
    'mousemove': 'mouse',
    'mousewheel': 'mouse',
    'DOMMouseScroll': 'mouse'
  };

  CanvasZoomify.prototype.trigger = function(evName) {
    if (this.isDebug) {
      console.log('trigger: ', evName, arguments);
    }
    $(this).trigger.apply($(this), arguments);
  };

  CanvasZoomify.prototype._mousePosX = function(ev) {
    // Get the mouse position relative to the canvas element.
    var x = 0;
    if (ev.layerX || ev.layerX === 0) { // Firefox
      x = ev.layerX - this.canvas.offsetLeft;
    } else if (ev.offsetX || ev.offsetX === 0) { // Opera
      x = ev.offsetX;
    }
    return x;
  };

  CanvasZoomify.prototype._mousePosY = function(ev) {
    var y = 0;
    if (ev.layerY || ev.layerY === 0) { // Firefox
      y = ev.layerY - this.canvas.offsetTop;
    } else if (ev.offsetY || ev.offsetY === 0) { // Opera
      y = ev.offsetY;
    }
    return y;
  };

  CanvasZoomify._getHandlerName = function(evName) {
    var ret = 'on' + evName.charAt(0).toUpperCase() + evName.slice(1);
    if (this.isDebug) {
      console.log('_getHandlerName', ret);
    }
    return ret;
  };

  CanvasZoomify._getDefaultHandlerName = function(evName) {
    var ret = this._getHandlerName(evName) + '_default';
    if (this.isDebug) {
      console.log('_getDefaultHandlerName: ', ret);
    }
    return ret;
  };

  CanvasZoomify.prototype._initEvents = function() {
    _.each(CanvasZoomify.EVENTS, function(evCategory, evName, list) {
      var evCategory = CanvasZoomify.EVENTS[evName];
      if (evCategory == 'custom') {
        $(this).on(evName, this._getInitEvents_custom(evName));
      } else if (evCategory == 'multitouch') {
        this.touchEventManager.on(evName, this._getInitEvents_multitouch(evName));
        $(this).on(evName, this._getInitEvents_multitouch(evName));
      } else if (evCategory == 'mouse') {
        // jQuery does not work with 'mousewheel' on chrome
        this.canvas.addEventListener(evName, this._getInitEvents_mouse(evName));
        $(this).on(evName, this._getInitEvents_mouse(evName));
      } else {
        throw new Error('CanvasZoomify: Unknown event `' + evName + '`');
      }
    }.bind(this));
  };

  CanvasZoomify.prototype._getInitEvents_custom = function(evName) {
    return function(ev) {
      var args = Array.prototype.slice.call(arguments, 1);
      args.unshift(ev); // prepend `ev` to args list
      // Call the user handler in config
      var userHandlerName = CanvasZoomify._getHandlerName(evName);
      var userHandler = this.config[userHandlerName];
      if (userHandler) {
        userHandler.apply(this.config, args);
      }
      if (ev.isDefaultPrevented()) {
        return;
      }
      // Call the default handler
      var defaultHandlerName = CanvasZoomify._getDefaultHandlerName(evName);
      var defaultHandler = this[defaultHandlerName];
      if (defaultHandler) {
        defaultHandler.apply(this, args);
      }
    }.bind(this);
  };

  CanvasZoomify.prototype._getInitEvents_mouse = function(evName) {
    return function(canvasEv) {
      var args = Array.prototype.slice.call(arguments, 1);
      // extend to get the correct event name and event info,
      // but still perserves canvas's info
      var canvasZoomifyEvent = $.extend({}, canvasEv, $.Event(evName));
      args.unshift(canvasZoomifyEvent); // prepend `canvasZoomifyEvent` to args list
      var userHandler = this.config[CanvasZoomify._getHandlerName(evName)];
      if (userHandler) {
        userHandler.apply(this.config, args);
      }
      if (canvasZoomifyEvent.isDefaultPrevented()) {
        canvasEv.preventDefault();
        return;
      }
      // Call the default handler
      var defaultHandler = this[CanvasZoomify._getDefaultHandlerName(evName)];
      if (defaultHandler) {
        defaultHandler.apply(this, args);
      }
    }.bind(this);
  };

  CanvasZoomify.prototype._getInitEvents_multitouch = function(evName) {
    return function(canvasEv) {
      var args = Array.prototype.slice.call(arguments, 1);
      // extend to get the correct event name and event info,
      // but still perserves canvas's info
      var canvasZoomifyEvent = $.extend({}, canvasEv, $.Event(evName));
      args.unshift(canvasZoomifyEvent); // prepend `canvasZoomifyEvent` to args list
      var userHandler = this.config[CanvasZoomify._getHandlerName(evName)];
      if (userHandler) {
        userHandler.apply(this.config, args);
      }
      if (canvasZoomifyEvent.isDefaultPrevented()) {
        canvasEv.preventDefault();
        return;
      }
      // Call the default handler
      var defaultHandler = this[CanvasZoomify._getDefaultHandlerName(evName)];
      if (defaultHandler) {
        defaultHandler.apply(this, args);
      }
    }.bind(this);
  };

  CanvasZoomify.prototype.init = function(ev) {
    this._initEvents();
  };

  CanvasZoomify.prototype.onCz_update_default = function(ev) {
    var level = _.findIndex(this.tileManager.levelValues, function(levelV) { return levelV >= this.scale; }.bind(this));
    if (level == -1) {
      // Otherwise, the greatest level
      level = this.tileManager.levelValues.length-1;
    }
    this.imageLevel = level;

    // Scale Limitations
    if (this.scaleMax != null) {
      if (this.scale > this.scaleMax) {
        this.scale = this.scaleMax;
      }
    }

    // Move Limitations
    var tileScale = this.scale / this.tileManager.levelValues[level];
    var tileWidth = Math.round(this.tileManager._tileWidthAtLevel[level] * tileScale);
    var tileHeight = Math.round(this.tileManager._tileHeightAtLevel[level] * tileScale);
    var tileRows = this.tileManager._rowsAtLevel[level];
    var tileCols = this.tileManager._colsAtLevel[level];
    var imageWidth = tileWidth * tileCols;
    var imageHeight = tileHeight * tileRows;
    var offsetX_min = null, offsetY_min = null;
    var offsetX_max = null, offsetY_max = null;
    if (tileWidth == -1 || tileHeight == -1) {
      // if current level tiles are not initialized, just don't force the limitations
    } else {
      if (imageWidth < this.canvasWidth) {
        // the image is smaller than the canvas: relax the restrictions
        offsetX_min = -imageWidth;
        offsetX_max = this.canvasWidth;
      } else {
        offsetX_min = this.canvasWidth - imageWidth;
        offsetX_max = 0;
      }
      this.offsetX = clamp(this.offsetX, offsetX_min, offsetX_max);

      if (imageHeight < this.canvasHeight) {
        // the image is smaller than the canvas: relax the restrictions
        offsetY_min = -imageHeight;
        offsetY_max = this.canvasHeight;
      } else {
        offsetY_min = this.canvasHeight - imageHeight;
        offsetY_max = 0;
      }
      this.offsetY = clamp(this.offsetY, offsetY_min, offsetY_max);
    }

    if (this.isDebug) {
      console.log(format('onCz_update_default: offset clamp (({0},{1}),({2},{3}))',
                         offsetX_min, offsetX_max, offsetY_min, offsetY_max));
      console.log(format('onCz_update_default: level {0}, offset ({1},{2}), scale {3}, scaleMax {4}',
                         this.imageLevel, this.offsetX, this.offsetY,
                         this.scale, this.scaleMax));
    }
  };

  CanvasZoomify.prototype.onCz_clear_default = function(ev) {
    if (this.isDebug) {
      console.log('onCz_clear_default');
    }

    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.fillStyle = "#fff";
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.restore();
  };

  CanvasZoomify.prototype.onCz_repaint_default = function(ev) {
    var level = this.imageLevel;
    var tileScale = this.scale / this.tileManager.levelValues[level];
    var tileWidth = Math.round(this.tileManager.tileWidth * tileScale);
    var tileHeight = Math.round(this.tileManager.tileHeight * tileScale);
    var tileRowEnd_max = this.tileManager._rowsAtLevel[level];
    var tileColEnd_max = this.tileManager._colsAtLevel[level];
    var tileRowStart = clamp(-Math.ceil(this.offsetY / tileHeight), 0, tileRowEnd_max);
    var tileColStart = clamp(-Math.ceil(this.offsetX / tileWidth), 0, tileColEnd_max);
    var tileRowEnd = clamp(Math.ceil((this.canvasHeight - this.offsetY) / tileHeight), 0, tileRowEnd_max);
    var tileColEnd = clamp(Math.ceil((this.canvasWidth - this.offsetX) / tileWidth), 0, tileColEnd_max);
    if (this.isDebug) {
      console.log('onCz_repaint_default');
      console.log(format('Image Info: offset ({0},{1}), scale {2}',
                         this.offsetX, this.offsetY, this.scale));
      console.log(format('Repaint: tileWidth/Height ({0},{1}), '
                         + 'tileRowStart/End: ({2},{3}), tileColStart/End: ({4},{5})',
                         tileWidth, tileHeight, tileRowStart, tileRowEnd, tileColStart, tileColEnd));
    }
    this.tileManager.drawTileAtLevel(this.context, level,
      tileRowStart, tileColStart, tileRowEnd, tileColEnd,
      this.offsetX, this.offsetY, tileScale);
  };

  CanvasZoomify.prototype.onPanstart_default = function(ev) {
    if (this.isDebug) {
      console.log('onPanstart_default');
    }
    var panCenter = ev['center'];
    var panX = panCenter['x'];
    var panY = panCenter['y'];
    this.touchState.touchPanLastX = panX;
    this.touchState.touchPanLastY = panY;
  };

  CanvasZoomify.prototype.onPanmove_default = function(ev) {
    if (ev['pointerType'] == 'mouse') {
      return;
    }

    var panCenter = ev['center'];
    var panX = panCenter['x'];
    var panY = panCenter['y'];
    if (!(_.isNull(this.touchState.touchPanLastX)) && !(_.isNull(this.touchState.touchPanLastY))) {
      this.offsetX += panX - this.touchState.touchPanLastX;
      this.offsetY += panY - this.touchState.touchPanLastY;
    }

    this.touchState.touchPanLastX = panX;
    this.touchState.touchPanLastY = panY;

    this.trigger('cz_update');
    this.trigger('cz_clear');
    this.trigger('cz_repaint');
  };

  CanvasZoomify.prototype.onPinchstart_default =  function(ev) {
    if (this.isDebug) {
      console.log('onPinchstart_default');
    }
    this.touchState.touchPinchLastScale = 1;
  };

  CanvasZoomify.prototype.onPinch_default = function(ev, customDeltaScale) {
    var deltaScale = null;
    var deltaCorrectionRate = 100;

    if (customDeltaScale) {
      deltaScale = Math.abs(customDeltaScale);
    } else {
      var newScale = ev['scale'];
      var delta = newScale / this.touchState.touchPinchLastScale;
      if (delta > 1) {
        // zoom in
        deltaScale = 1 + this.scaleStep * delta / deltaCorrectionRate;
      } else {
        // zoom out
        deltaScale = 1 / (1 + this.scaleStep / delta / deltaCorrectionRate);
      }
    }

    this.scale *= deltaScale;
    this.offsetX = Math.floor(this.offsetX * deltaScale);
    this.offsetY = Math.floor(this.offsetY * deltaScale);

    if (this.isDebug) {
      console.log(format('onPinch_default: offset ({0},{1}), scale {2}, delta scale: {3}',
                         this.offsetX, this.offsetY, this.scale, deltaScale));
    }

    this.trigger('cz_update');
    this.trigger('cz_clear');
    this.trigger('cz_repaint');
  };

  CanvasZoomify.prototype.onMousedown_default = function(ev) {
    this.mouseState.isMouseDown = true;
    this.mouseState.mouseMoveLastX = this._mousePosX(ev);
    this.mouseState.mouseMoveLastY = this._mousePosY(ev);
    if (this.isDebug) {
      console.log('onMousedown_default: ', this.mouseState);
    }
  };

  CanvasZoomify.prototype.onMouseup_default = function(ev) {
    this.mouseState.isMouseDown = false;
    if (this.isDebug) {
      console.log('onMouseup_default: ', this.mouseState);
    }
  };

  CanvasZoomify.prototype.onMousemove_default = function(ev) {
    if (this.mouseState.isMouseDown) {
      var mouseX = this._mousePosX(ev);
      var mouseY = this._mousePosY(ev);
      var newOffsetX = this.offsetX + (mouseX - this.mouseState.mouseMoveLastX);
      var newOffsetY = this.offsetY + (mouseY - this.mouseState.mouseMoveLastY);

      this.mouseState.mouseMoveLastX = mouseX;
      this.mouseState.mouseMoveLastY = mouseY;
      this.offsetX = newOffsetX;
      this.offsetY = newOffsetY;

      this.trigger('cz_update');
      this.trigger('cz_clear');
      this.trigger('cz_repaint');

      if (this.isDebug) {
        console.log('onMousemove_default: ', this.mouseState);
      }
    }
  };

  CanvasZoomify.prototype.onMousewheel_default = function(ev, customDeltaScale) {
    var getWheelDelta = function(ev) {
      var delta = null;
      if ('wheelDelta' in ev) {
        delta = ev.wheelDelta; // IE/Opera/Chrome/Safari
      } else if (ev.detail) {
        delta = -40 * ev.detail; // Firefox
      }
      return -delta / 120;
    };

    var deltaScale = null;

    if (customDeltaScale) {
      deltaScale = Math.abs(customDeltaScale);
    } else {
      var delta = getWheelDelta(ev);
      if (_.isNull(delta)) {
        throw new Error("Cannot extract Mouse Wheel Delta value!");
      }

      var deltaScaleTmp = this.scaleStep * Math.abs(delta);
      if (delta < 0) {
        deltaScale = deltaScaleTmp;
      } else {
        deltaScale = 1 / deltaScaleTmp;
      }
    }

    this.scale *= deltaScale;
    this.offsetX = Math.floor(this.offsetX * deltaScale);
    this.offsetY = Math.floor(this.offsetY * deltaScale);

    if (this.isDebug) {
      console.log(format('onMousewheel_default: offset ({0},{1}), scale {2}, delta scale: {3}',
                         this.offsetX, this.offsetY, this.scale, deltaScale));
    }

    this.trigger('cz_update');
    this.trigger('cz_clear');
    this.trigger('cz_repaint');

    if (ev.preventDefault) {
      ev.preventDefault();
    }
    ev.returnValue = false;
  };

  CanvasZoomify.prototype.onDOMMouseScroll_default = CanvasZoomify.prototype.onMousewheel_default;

  function TileManager(canvasZoomify, config) {
    this.canvasZoomify = canvasZoomify;

    this.config = config;
    this.isDebug = this.config['isDebug'];
    if (this.isDebug) {
      console.log("TileManager Debug: ", this.isDebug);
    }

    this.levelValues = checkRequired(this.config, 'levelValues');
    this.rowsPerLevel = checkRequired(this.config, 'rowsPerLevel');
    this.colsPerLevel = checkRequired(this.config, 'colsPerLevel');
    this.tileWidth = checkRequired(this.config, 'tileWidth');
    this.tileHeight = checkRequired(this.config, 'tileHeight');
    this.tilesBasePath = checkRequired(this.config, 'tilesBasePath');
    this.tileNamePrefix = checkRequired(this.config, 'tileNamePrefix');
    this.tileImageType = checkRequired(this.config, 'tileImageType');
    this.tilesList = this.config['tiles'];
    if (_.isNull(this.tilesList) || _.isUndefined(this.tilesList)) {
      this.tilesList = function() {
        return _.map(this.levelValues, function(levelV) {
          return _.map(_.range(0, this.rowsPerLevel*levelV), function(row) {
            return _.map(_.range(0, this.colsPerLevel*levelV), function(col) {
              return format('{0}/{1}/{2}-{3}-{4}-{5}.{6}',
                            this.tilesBasePath, levelV, this.tileNamePrefix,
                            levelV, row, col, this.tileImageType);
            }.bind(this));
          }.bind(this));
        }.bind(this));
      }.bind(this)();
    }
    if (this.isDebug) {
      console.log('tilesList: ', this.tilesList);
    }

    // { level-row-col: Image }
    this.tilesCache = {};

    this._rowsAtLevel = _.map(this.levelValues, function(levelV) { return levelV * this.rowsPerLevel; }.bind(this));
    this._colsAtLevel = _.map(this.levelValues, function(levelV) { return levelV * this.colsPerLevel; }.bind(this));
    this._tileWidthAtLevel = _.map(this.levelValues, function(levelV) { return -1; });
    this._tileHeightAtLevel = _.map(this.levelValues, function(levelV) { return -1; });
    // This is a suggestion list, which -1 suggests that this tile is not loaded,
    // and other values suggest the level of tile should be used
    this._tileSuggestionCache = (function() {
      return _.map(this.levelValues, function(levelV) {
        return _.map(_.range(levelV*this.rowsPerLevel*levelV*this.colsPerLevel), function(i) { return -1; });
      }.bind(this));
    }.bind(this))();

    this._uniquePaintId = null;
    this._tileRequireNum = null;
    this._requireRepaint = false;
  }

  TileManager.prototype._getTileSuggestion = function(level, row, col) {
    return this._tileSuggestionCache[level][row*this._colsAtLevel[level]+col];
  };

  TileManager.prototype._setTileSuggestion = function(level, row, col, value) {
    this._tileSuggestionCache[level][row*this._colsAtLevel[level]+col] = value;
  };

  TileManager.prototype._tileOnLoadHandler = function(level, row, col) {
    var oldV = this._getTileSuggestion(level, row, col);
    if (oldV >= level) {
      return;
    }
    var recurseUp = function(curLevel, curRow, curCol) {
      if (curLevel <= 0) {
        return;
      }
      var upperTileRow = Math.floor(curRow / 2);
      var upperTileCol = Math.floor(curCol / 2);
      var upperTileOldSuggest = this._getTileSuggestion(curLevel-1, upperTileRow, upperTileCol);
      var suggestsForUpperTile = [
        this._getTileSuggestion(curLevel, upperTileRow*2,   upperTileCol*2),
        this._getTileSuggestion(curLevel, upperTileRow*2,   upperTileCol*2+1),
        this._getTileSuggestion(curLevel, upperTileRow*2+1, upperTileCol*2),
        this._getTileSuggestion(curLevel, upperTileRow*2+1, upperTileCol*2+1),
      ];
      var suggest = _.min(suggestsForUpperTile);
      if (suggest == upperTileOldSuggest) {
        return;
      }
      // update upper tile suggestion
      this._setTileSuggestion(curLevel-1, upperTileRow, upperTileCol, suggest);
      recurseUp(curLevel-1, upperTileRow, upperTileCol);
    }.bind(this);

    this._tileSuggestionCache[level][row*this._colsAtLevel[level]+col] = level;
    recurseUp(level, row, col);
  };

  // ret: 0 for already loaded, 1 for not loaded, 2 for being loaded
  TileManager.prototype.isTileLoaded = function(level, row, col) {
    var name = '' + level + '-' + row + '-' + col;
    var img = this.tilesCache[name];
    if (img) {
      if (img == 0) {
        return 2; // being loaded
      } else {
        return 0; // is already loaded
      }
    }
    // img is not loaded
    return 1;
  };

  TileManager.prototype.getTile = function(level, row, col) {
    var name = '' + level + '-' + row + '-' + col;
    if (this.isTileLoaded(level, row, col) != 0) {
      return null;
    }
    return this.tilesCache[name];
  };

  // f signature: function(img, level, row, col) {}
  TileManager.prototype.loadTileFromDisk = function(level, row, col, f) {
    if (this.isDebug) {
      console.log(format('loadTileFromDisk: {0}-{1}-{2}', level, row, col));
    }
    var img = new Image();
    img.onload = function() {
      if (this._tileWidthAtLevel[level] == -1) {
        this._tileWidthAtLevel[level] = img.width;
        this._tileHeightAtLevel[level] = img.height;
      }
      var name = '' + level + '-' + row + '-' + col;
      this.tilesCache[name] = img;
      this._tileOnLoadHandler(level, row, col);
      f && f(img, level, row, col);
    }.bind(this);
    img.src = this.tilesList[level][row][col];
  };

  TileManager.prototype.generateUniquePaintId = function() {
    return Date.now();
  };

  TileManager.prototype.drawTileScaled = function(context, img, x, y, scale) {
    if (_.isNull(img) || _.isUndefined(img)) {
      return;
    }
    var width = img.width * scale;
    var height = img.height * scale;
    context.drawImage(img, x, y, width, height);
    if (this.isDebug) {
      context.save();
      context.strokeStyle = "#ff0000";
      context.strokeRect(x, y, width, height);
      context.fillStyle = "rgba(255, 0, 0, 0.3)";
      context.fillRect(x, y, width, height);
      context.restore();
    }
  };

  TileManager.prototype.drawTileAtLevel = function(context, level, rowStart, colStart, rowEnd, colEnd, offsetX, offsetY, scale) {
    // @example: im.drawTileAtLevel(canvasZoomify.context, 3, 0,8,8,16, 0,0, 0.083565)
    if (this.isDebug) {
      console.log(format('drawTileAtLevel: level {0}, rowStart/End ({1},{2}), '
                         + 'colStart/End ({3},{4}), offset ({5},{6}), scale {7}',
                         level, rowStart, rowEnd, colStart, colEnd, offsetX, offsetY, scale));
    }

    var handleTileAlreadyLoaded = function(level, row, col) {
      --this._tileRequireNum;
      if (this._requireRepaint == false) {
        var tile = this.getTile(level, row, col);
        var x = tile.width * scale * col;
        var y = tile.height * scale * row;
        this.drawTileScaled(context, tile, x + offsetX, y + offsetY, scale);
      }
    }.bind(this);
    var handleTileNotLoaded = function(level, row, col) {
      // if the tile is not loaded
      this.loadTileFromDisk(level, row, col, function (_uniquePaintIdExpected, tile, level, row, col) {
        if (this._uniquePaintId != _uniquePaintIdExpected) {
          if (this.isDebug) {
            console.log(format('ignore a loadTile: expected({0}) != actual({1})',
                               _uniquePaintIdExpected, this._uniquePaintId));
          }
          return;
        }
        --this._tileRequireNum;
        this._requireRepaint = true;
        if (this._requireRepaint == true && this._tileRequireNum == 0) {
          this.canvasZoomify.trigger("cz_repaint");
        }
      }.bind(this, this._uniquePaintId));
    }.bind(this);

    this._uniquePaintId = this.generateUniquePaintId();
    this._tileRequireNum = (rowEnd - rowStart) * (colEnd - colStart);
    this._requireRepaint = false;
    for (var row = rowStart; row < rowEnd; ++row) {
      for (var col = colStart; col < colEnd; ++col) {
        var tileState = this.isTileLoaded(level, row, col);
        if (tileState == 0) {
          handleTileAlreadyLoaded(level, row, col);
        } else if (tileState == 1) {
          handleTileNotLoaded(level, row, col);
        } else if (tileState == 2) {
          // if the tile is being loaded
          // just pass, do nothing
        } else {
          throw new Error("Unexpected tile state: ", tileState);
        }
      }
    }
  };

  if (typeof define == 'function' && define.amd) {
      define(function() {
          return CanvasZoomify;
      });
  } else if (typeof module != 'undefined' && module.exports) {
      module.exports = CanvasZoomify;
  } else {
      window[exportName] = CanvasZoomify;
  }
})(window, document, 'CanvasZoomify');
