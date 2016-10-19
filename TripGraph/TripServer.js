var express = require('express');
var app = express();
var renderBuffer = require('./renderPdf.js').renderBuffer;

app.get('/', function (req, res) {
  res.redirect('/TripGraph/trip.html');
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});


app.use(express.static('..'));

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

[ ['pdf', 'application/pdf'], ['svg', 'image/svg+xml'] ].map(function(entry) {
  app.get('/api/' + entry[0] + '/:data', function(req, res) {
    renderBuffer(req.params.data, 'pdf', function(err, buffer) {
      if (err) {
        res.send(err).status(400);
      } else {
        res.type(entry[1]);
        res.setHeader('Content-disposition', 'attachment; filename=map.' + entry[0]);
        res.send(buffer);
      }
    });
  });
});
