var renderPdf = require('./renderPdf.js').renderPdf;
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));

var out = argv.o || "out.pdf";

if (argv._.length != 1) {
  console.log('usage: node tripToPdf.js <trip file> [-o output.pdf]');
  process.exit(1);
} else {
  var file = argv._[0];
  var trip = fs.readFileSync(file, 'utf-8');
  if (!trip) {
    console.log('cant\'t load ' + file);
    process.exit(2);
  } else {
    renderPdf(trip, out, function(err) {
      if (err) {
        console.log('When rendering ' + file + ': ' + err);
        process.exit(3);
      }
    });
  }
}

