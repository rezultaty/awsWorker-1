var express = require('express');
var app = express();
var async = require('async');
var AWS = require('aws-sdk');
var bucket = "lab4-weeia";
var http = require('http');
var lwip=require('lwip');
var sqsUrl = "https://sqs.us-west-2.amazonaws.com/983680736795/aandrzejewskiSQS";
var inProgress=false;

AWS.config.loadFromPath('config.json');
var s3= new AWS.S3();
var sqs = new AWS.SQS();
var extension;
var key;
var filters;
var messageId;
var messageBody;
var bodyParser = require('body-parser');

app.use(bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

var queueParams = {
  QueueUrl: sqsUrl, /* required */
  VisibilityTimeout: 0,
  WaitTimeSeconds: 0
};

async.forever(
    function (next) {
        if (!inProgress){
            process.nextTick(receiveMessage);
        }
        next();
    },
    function () { return true; }
);


function receiveMessage(){
    inProgress=true;
    console.log("Polling...");
    sqs.receiveMessage(queueParams, function(err, data) {
    // dodać if data.Messages=0
      if (err) console.log(err, err.stack); 
      else {
          if (data.Messages){
            messageId=data.Messages[0].ReceiptHandle;
            messageBody=JSON.parse(data.Messages[0].Body);
            extension = messageBody.key.split('.').pop();
            filters=messageBody.filters;
            key=messageBody.key;
            processMessage();
          } else  {
              console.log("The queue is empty, polling...")
              inProgress=false;
          }
        }
    });
}

//var awsConfig = helpers.readJSONFile('config.json');

var deleteMessage = function(){
    var params = {
      QueueUrl: sqsUrl, /* required */
      ReceiptHandle: messageId /* required */
    };
    sqs.deleteMessage(params, function(err, data) {
      if (err) console.log(err, err.stack);
      else     {
          console.log("Message deleted successfully, polling...");
          inProgress=false;
      }
    });
}

var processMessage = function(){
    if (filters){
        downloadImage(key);
    }
}

var downloadImage = function(key){
    var params = {
      Bucket: bucket, /* required */
      Key: key /* required */
    };
    
    s3.getObject(params, function(err, data) {
      if (err) console.log(err, err.stack);
      else     {
          var file=data.Body;
          console.log("Image downloaded successfully, processing...");
          processImage(file);
      }
    });
}

var processImage= function(f){
    var img = lwip.open(f, extension,function(err,image){
        var batch=image.batch();
        if (filters.scale){
            var params=filters.scale;
            batch.scale(parseFloat(params.scaleW), parseFloat(params.scaleH));
        }
        if (filters.rotate){
            var params=filters.rotate;
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
            else {
                console.log("Image processed successfully, uploading...");
                uploadImage(buffer);
            }
          });
    });
}

var uploadImage = function(image){
    var params = {
      Bucket: bucket, /* required */
      Key: key, /* required */
      Body: image
    };
    s3.putObject(params, function(err, data) {
      if (err) console.log(err, err.stack);
      else {
          console.log("Image uploaded successfully, deleting message...");
            deleteMessage();
      };
    });
}

var port = 8080;
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Worker\n');
}).listen(port);

