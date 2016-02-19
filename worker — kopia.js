var express = require('express');
var http=require('http');
var app = express();
var async = require('async');
var AWS = require('aws-sdk');
var bucket = "lab4-weeia";
var lwip=require('lwip');
var sqsUrl = "https://sqs.us-west-2.amazonaws.com/983680736795/aandrzejewskiSQS";

//var Policy = require('./s3post.js').Policy;
//AWS.config.loadFromPath('./config.json');
AWS.config.loadFromPath('config.json');
var s3= new AWS.S3();
var sqs = new AWS.SQS();
var extension;
var key;
var filters;
var messageId;

var queueParams = {
  QueueUrl: sqsUrl, /* required */
  VisibilityTimeout: 0,
  WaitTimeSeconds: 0
};

async.whilst(
        function () { return true },
    function (callback) {
//        console.log("aaaa");
        sqs.receiveMessage(queueParams, function(err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else     console.log(data);           // successful response
        });
        //xxx();
//        console.log("bbbb");
        callback();
    },
    function (err, n) {}
);





//var awsConfig = helpers.readJSONFile('config.json');

var bodyParser = require('body-parser')
app.use(bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

var xxx = function(){
    extension = req.body.key.split('.').pop();
    filters=req.body.filters;
    key=req.body.key;
    console.log(req.body);
    if (filters){
        downloadImage(key)
    }
}

//app.post('/', function (req, res) {
//    res.header('Access-Control-Allow-Origin', '*');
//    extension = req.body.key.split('.').pop();
//    filters=req.body.filters;
//    key=req.body.key;
//    console.log(req.body);
//    if (filters){
//        downloadImage(key)
//    }
//    res.send("Okay!")
//});

//app.listen(4000, function () {
//  console.log('Example app listening on port 4000!');
//});

var downloadImage = function(key){
    var params = {
      Bucket: bucket, /* required */
      Key: key /* required */
    };
    
    s3.getObject(params, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else     {
          var file=data.Body;
//          file = new Buffer(data.Body, 'base64');
          processImage(file);
      }
    });
}

var processImage= function(f){
    console.log(extension);
    console.log(f);
    var img = lwip.open(f, extension,function(err,image){
        var batch=image.batch();
        if (filters.scale){
            var params=filters.scale;
            batch.scale(parseFloat(params.scaleW), parseFloat(params.scaleH));
        }
        if (filters.rotate){
            var params=filters.rotate;
            console.log(params.angle);
            batch.rotate(parseFloat(params.angle));
        }
        if (filters.blur){
            var params=filters.blur;
            batch.blur(parseFloat(params.amount));
        }
        if (filters.mirror){
            var params=filters.mirror;
            if (params.axes){
               batch.mirror(params.axes); 
            }
        }
        batch.toBuffer(extension, function(er, buffer) {
            if (err) throw err;
            else uploadImage(buffer);
          });
//            .writeFile('./output.jpg', function(err) {
//            if (err) throw err;
//          });
    });
//    uploadImage(f2);
}

var uploadImage = function(image){
    var params = {
      Bucket: bucket, /* required */
      Key: key, /* required */
      Body: image
    };
    console.log(params);
    s3.putObject(params, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else     console.log(data);           // successful response
    });
}

var port = process.env.port || 8081;
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Worker\n');
}).listen(port);

