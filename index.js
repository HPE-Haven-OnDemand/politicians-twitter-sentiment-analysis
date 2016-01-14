require('dotenv').load();

var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');
var io = require('socket.io')(http);
var Twitter = require('twitter');
var havenondemand = require('havenondemand');

var hodClient = new havenondemand.HODClient('http://api.havenondemand.com', process.env.hpe_apikey);

var twitterClient = new Twitter({
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token_key: process.env.access_token,
  access_token_secret: process.env.access_token_secret
});

port = process.env.PORT || 5000;
app.use(express.static(path.join(__dirname, 'public')));

var bernieSanders = {
  averages: {newAvg: 0, oldAvg: 0},
  n: 0,
  nPositive: 0,
  nNegative: 0,
  nNeutral: 0
}

var hillaryClinton = {
  averages: {newAvg: 0, oldAvg: 0},
  n: 0,
  nPositive: 0,
  nNegative: 0,
  nNeutral: 0
}

function twitterStream(candidate, candidateStrings, candidateData) {
  twitterClient.stream('statuses/filter', {track: candidateStrings}, function(stream) {
    stream.on('data', function(tweet) {
      var data = {text: tweet.text};
      hodClient.call('analyzesentiment', data, function(err, resp){
        if (!err) {
          if (resp.body.aggregate !== undefined) {
            candidateData.n += 1; //increase n by one
            var sentiment = resp.body.aggregate.sentiment;
            var score = resp.body.aggregate.score;
            if (score > 0) {
              candidateData.nPositive += 1;
            } else if(score < 0) {
              candidateData.nNegative += 1;
            } else {
              candidateData.nNeutral += 1;
            }
            candidateData.averages = calculateRunningAverage(score, candidateData.n, candidateData.averages);
            rgbInstantaneous = mapColor(score);
            rgbAverage = mapColor(candidateData.averages.newAvg);
            console.log("------------------------------");
            console.log(tweet.text + " | " + sentiment + " | " + score);
            var tweetData = {candidate: candidate, tweet: tweet, positive: resp.body.positive, negative: resp.body.negative, aggregate: resp.body.aggregate, rgbInstantaneous: rgbInstantaneous, rgbAverage: rgbAverage, average: candidateData.averages.newAvg, n: candidateData.n, nNeutral: candidateData.nNeutral, nNegative: candidateData.nNegative, nPositive: candidateData.nPositive};
            io.emit('message', tweetData);
          }
        }
      });
    });

    stream.on('disconnect', function (disconnectMessage) {
      console.log(disconnectMessage);
    });

    stream.on('error', function(error) {
      throw error;
    });
  });
}

// twitterStream("Bernine Sanders", "Bernine Sanders,SenSanders", bernieSanders);
// twitterStream("Hillary Clinton", "Hillary Clinton,HillaryClinton", hillaryClinton);

// setInterval(function(){
//   var tweetData = {candidate: "candidate", tweet: tweet, positive: resp.body.positive, negative: resp.body.negative, aggregate: resp.body.aggregate, rgbInstantaneous: rgbInstantaneous, rgbAverage: rgbAverage, average: candidateData.averages.newAvg, n: candidateData.n, nNeutral: candidateData.nNeutral, nNegative: candidateData.nNegative, nPositive: candidateData.nPositive};
//   io.emit('message', tweetData);
// }, 3000)

app.get("/", function(req, res){
  res.sendFile(__dirname + '/views/index.html');
});

http.listen(port, function(){
  console.log("Listening on port: "+port);
});

mapColor = function (score) {
  weight = Math.floor(((0.5*score + 0.5)*100));
  r = Math.floor( (255 * (100 - weight)) / 100 );
  g = Math.floor( (255 * weight) / 100 );
  b = 0;
  return {r: r, g: g, b:b};
}

calculateRunningAverage = function(score, n, averages) {
  averages.newAvg = averages.oldAvg * (n-1)/n + score/n;   // New average = old average * (n-1)/n + new value /n
  averages.oldAvg = averages.newAvg; //set equal to new average for next go around of calling this function
  return averages
}
