// from https://gist.github.com/THEtheChad/1297590
// @returns array [r,g,b{,o}]
var parseColor = function(color) {

    var cache
      , p = parseInt // Use p as a byte saving reference to parseInt
      , color = color.replace(/\s\s*/g,'') // Remove all spaces
    ;//var
    
    // Checks for 6 digit hex and converts string to integer
    if (cache = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/.exec(color)) 
        cache = [p(cache[1], 16), p(cache[2], 16), p(cache[3], 16)];
        
    // Checks for 3 digit hex and converts string to integer
    else if (cache = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])/.exec(color))
        cache = [p(cache[1], 16) * 17, p(cache[2], 16) * 17, p(cache[3], 16) * 17];
        
    // Checks for rgba and converts string to
    // integer/float using unary + operator to save bytes
    else if (cache = /^rgba\(([\d]+),([\d]+),([\d]+),([\d]+|[\d]*.[\d]+)\)/.exec(color))
        cache = [+cache[1], +cache[2], +cache[3], +cache[4]];
        
    // Checks for rgb and converts string to
    // integer/float using unary + operator to save bytes
    else if (cache = /^rgb\(([\d]+),([\d]+),([\d]+)\)/.exec(color))
        cache = [+cache[1], +cache[2], +cache[3]];
        
    // Otherwise throw an exception to make debugging easier
    else throw Error(color + ' is not supported by $.parseColor');
    
    // Performs RGBA conversion by default
    isNaN(cache[3]) && (cache[3] = 1);
    
    return cache.slice(0,4);
}

function colorAsHashedFormat(color) {
  var c = parseColor(color);
  var result = '#';
  for (var i = 0; i < 3; ++i) {
    var s = c[i].toString(16);
    if (s.length == 1) {
      s = '0' + s;
    }
    result += s;
  }
  return result;
}

function onRendererInitialized(canvasTilesRenderer) {

  var worldLayer;
  var selectedCountry;


  var selectCountry = function (id) {
    if (selectedCountry) {
      delete worldLayer.params.countryStyle[selectedCountry].lineWidth;
    }
    if (id) {
      var style = worldLayer.params.countryStyle[id] =
        worldLayer.params.countryStyle[id] || {};
      style.lineWidth = 5;
      selectedCountry = id;
    }
  };
 
  worldLayer = new WorldBackgroundLayer({
    renderer: canvasTilesRenderer,
    onCountryClic: function(country) {
      $('#countrySelector').val(country.id);
      var style = worldLayer.params.countryStyle[country.id] || {};
      var color = (style.color || worldLayer.params.landColor);
      $('#countryColor').val(color).focus();
      editor.deselectLabel();
      selectCountry(country.id);
    },
    onSeaClic: function() {
      editor.deselectLabel();
      selectCountry();
    }
  });
  canvasTilesRenderer.layers[0] = worldLayer;

  var tripLayer = new TripGraphLayer({
    renderer: canvasTilesRenderer,
    graph: graph
  });

  canvasTilesRenderer.addLayer(tripLayer);

  tripLayer.loadIcons(function(err) { canvasTilesRenderer.refresh(); });

  var editor = new TripGraphEditor(canvasTilesRenderer, graph);
  canvasTilesRenderer.pinchZoom.touchEventHandlers.push(editor);

  var selectedTextProperties = function() {
    var properties = tripLayer.defaultTextProp;
    if (editor.selectedLabel) {
      properties = editor.selectedLabel.properties =
        editor.selectedLabel.properties || {};
    }
    return properties;
  };
  editor.onLabelSelect = function(label) {
    selectCountry();
    var properties = selectedTextProperties();
    $('#selectedLabel').val(label ? label.label : '');
    $('#selectedLabelFontSize').val(
        properties.fontSize || tripLayer.defaultTextProp.fontSize);
    $('#selectedLabelColor').val(
        properties.fill | tripLayer.defaultTextProp.fill);
    $('#selectedLabelShadowColor').val(
        colorAsHashedFormat(
            properties.stroke || tripLayer.defaultTextProp.stroke));
    $('#selectedLabelShadowAlpha').val(
        parseColor(properties.stroke || tripLayer.defaultTextProp.stroke)[3]);
  };
  editor.onLabelSelect();

  $('#selectedLabel').change(function() {
    if (editor.selectedLabel) {
      editor.selectedLabel.label = $(this).val();
      canvasTilesRenderer.refreshIfNotMoving();
    }
  });
  $('#selectedLabelFontSize').change(function() {
    selectedTextProperties().fontSize = $(this).val();
    canvasTilesRenderer.refreshIfNotMoving();
  });

  $('#selectedLabelColor').change(function() {
    selectedTextProperties().fill = $(this).val();
    canvasTilesRenderer.refreshIfNotMoving();
  });

  var setLabelShadow = function() {
    var color = $('#selectedLabelShadowColor').val();
    var alpha = $('#selectedLabelShadowAlpha').val();
    var channels = [];
    for (var i = 0; i < 3; ++i) {
      channels.push(parseInt(color.substring(1 + i * 2, 1 + i * 2 + 2), 16));
    }
    channels.push(alpha);
    selectedTextProperties().stroke = 'rgba(' + channels.join(',') +')';

    canvasTilesRenderer.refreshIfNotMoving();
  };

  $('#selectedLabelShadowColor').change(setLabelShadow);
  $('#selectedLabelShadowAlpha').change(setLabelShadow);


  setFrame = function(width, height) {
    var canvas = canvasTilesRenderer.canvas;
    var w = width || canvas.width;
    var h = height || canvas.height;
    canvasTilesRenderer.setLocation(graph.location(w/h, 1.2));
  };

  placeLabels = function() {
    tripLayer.graph = tripLayer.makeFusedGraph(graph);
    editor.graph = tripLayer.graph;
    tripLayer.placeLabels(canvasTilesRenderer.canvas.getContext('2d'));
    canvasTilesRenderer.refresh();
  };

  resetCurves = function() {
    graph.createDefaultBezier();
    tripLayer.graph = tripLayer.makeFusedGraph(graph);
    editor.graph = tripLayer.graph;

    tripLayer.placeLabels(canvasTilesRenderer.canvas.getContext('2d'));
    canvasTilesRenderer.refresh();
  }

  save = function() {
    editor.deselectLabel();
    selectCountry();
    $('#savedData').text(tripLayer.saveToString());
  };

  downloadFile = function(type) {
    editor.deselectLabel();
    selectCountry();
    var trip = tripLayer.saveToString();
    $.ajax({
      url: '/api/' + encodeURI(tripName),
      type: 'POST',
      data: {s: trip},
      success: function(respoonse) {
        window.open(
            window.location.origin + '/api/' + type + '/'  + encodeURI(tripName));
      },
      dataType: 'json'
    });
  };

  setPageSize = function() {
    var res = $('#pageSizeSelector').val().split('x');
    console.log('Res: ' + res[0] + ' x ' + res[1]);
    var mmToPoint = 2.83465;
    var w = Math.floor(res[0] * mmToPoint);
    var h = Math.floor(res[1] * mmToPoint);
    $('#mapContainer').width(w);
    $('#mapContainer').height(h);
    setFrame(w, h);
    setTimeout(function() {
      placeLabels();
    }, 20);
  };

  setPageSize();


  $('#pageSizeSelector').change(setPageSize);

  ['seaColor', 'borderColor', 'landColor'].map(function(key) {
    $('#' + key).change(function() {
      worldLayer.params[key] = this.value;
      canvasTilesRenderer.refresh();
    });
  });

  $('#countryColor').change(function() {
    var color = this.value;
    var country = $('#countrySelector').val();
    var style = worldLayer.params.countryStyle[country] = 
      worldLayer.params.countryStyle[country] || {};
    style.color = color;
    canvasTilesRenderer.refresh();
  });

  $('#countrySelector').change(function() {
    var country = $('#countrySelector').val();
    var style = worldLayer.params.countryStyle[country] || {};
    var color = (style.color || worldLayer.params.landColor);
    $('#countryColor').val(color).focus();
  });


}

function fillCountrySelector() {
  var selector = $('#countrySelector');

  var countries =WorldBackgroundLayer.countries; 
  for (var i in countries) {
    var country = countries[i];
    selector.append($('<option>', {value: country.id}).text(country.title));
  }
}

