var fs = require('fs');
var parseString = require('xml2js').parseString;

function convertCountries(countries) {
  var result = [];
  for (var i in countries) {
    country = countries[i].$;
    result.push({
      id: country.id,
      title: country.title,
      d: country.d
    });
  }
  return result;
}

parseString(fs.readFileSync('./worldLow.svg', 'utf-8'), 
  function (err, result) {
    var r = convertCountries(result.svg.g[0].path);
    console.dir(r);
  });
