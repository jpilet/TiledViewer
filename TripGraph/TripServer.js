var express = require('express');
var app = express();
var renderBuffer = require('./renderPdf.js').renderBuffer;
var fs = require('fs');

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

var datafile = 'trips.json';
var data = {};
fs.readFile(datafile, function(err, content) {
  if (!err && content) { data = JSON.parse(content.toString('utf-8')); }
});

app.post('/api/:tripName', function(req, res) {
  data[req.params.tripName] = JSON.parse(req.body.s);
  res.status(200).send();

  fs.writeFile(datafile, JSON.stringify(data));
});
app.get('/api/:tripName', function(req, res) {
  if (data[req.params.tripName]) {
    req.send(data[req.params.tripName]);
  } else {
    res.status(404).send();
  }
});

[ ['pdf', 'application/pdf'], ['svg', 'image/svg+xml'] ].map(function(entry) {
  app.get('/api/' + entry[0] + '/:tripName', function(req, res) {
    if (!data[req.params.tripName]) {
      res.status(404).send();
    } else{
      console.log('Rendering ' + req.params.tripName + '.' + entry[0]);
      renderBuffer(data[req.params.tripName], entry[0], function(err, buffer) {
        if (err) {
          res.send(err).status(400);
        } else {
          res.type(entry[1]);
          res.setHeader('Content-disposition', 'attachment; filename=map.' + entry[0]);
          res.send(buffer);
        }
      });
    }
  });
});
