var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var $ = jQuery = require('jquery');
require('./jquery.csv.min.js');
var https = require('https');
var http = require('http');
var fs = require('fs');
var querystring = require('querystring');

var Event = require('./app/models/event');
var Recent = require('./app/models/recent');

var pkey = fs.readFileSync('/etc/ssl/server.key').toString();
var pcert = fs.readFileSync('/etc/ssl/server.crt').toString();
var gd = [fs.readFileSync('/etc/ssl/gd_bundle.crt').toString()];

var options = {
    key: pkey,
    cert: pcert,
    ca: gd
};

// create index to url dict
// create url to index dict
var index_csv = 'mappings.csv';
var index_to_url_name = {};
var url_name_to_index = {};
fs.readFile(index_csv, 'UTF-8', function(err, csv) {
  $.csv.toArrays(csv, {}, function(err, data) {
    for(var i=1 , len=data.length; i<len; i++) {
      index_to_url_name[data[i][0]] = data[i][1];
      url_name_to_index[data[i][1]] = data[i][0];
    }
  });
});

// create path to name dict
// create name to path dict
var names_csv = 'axis.csv';
var path_to_name = {};
var url_name_to_path = {};
fs.readFile(names_csv, 'UTF-8', function(err, csv) {
  $.csv.toArrays(csv, {}, function(err, data) {
    for(var i=1 , len=data.length; i<len; i++) {
      path_to_name[data[i][7]] = data[i][6];
      url_name_to_path[data[i][1]] = data[i][7];
    }
  });
});

var mongoose = require('mongoose');
mongoose.connect('mongodb://server_here:port/db_name');

// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// set our port
var port = process.env.PORT || port;

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Accept, X-CSRFToken, chap, seq, vert");
  res.header("Access-Control-Allow-Methods", "PUT, GET, POST");
  next();
});

// find difference between two timestamps
function timeDiff(time1,time2) {
  var diff = time1 - time2;
  return diff.toString();
}

// find time category for student event
function timeCategory(diff) {
  var ret;
  if (diff < 10) {
    ret = 0;
  }
  else if (diff < 60) {
    ret = 1;
  }
  else if (diff < 60*30) {
    ret = 2;
  }
  else {
    ret = 3;
  }
  return ret.toString();
}

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();

// middleware to use for all requests
router.use(function(req, res, next) {
    next();
});

// test route to make sure everything is working (accessed at GET https://server:port/api)
// router.get('/', function(req, res) {
      // Code for testing sensor here
// });

// on routes that end in /events
// ----------------------------------------------------
router.route('/events')

    // create a event (accessed at POST https://server:port/api/events)
    .post(function(req, res) {

        var timestamp = new Date().getTime() / 1000;

        // creates a new event
        var event = new Event();
        var my_id = event._id;
        event.user = req.body.user;

        try {
          var parts = req.body.origin.split("/");
          var ch = parts[0];
          var sq = parts[1];
          var v = parts[2];
          var v_path = url_name_to_path[v];
      	  v = v_path.split("/");
      	  v = v[3];
          event.origin = url_name_to_index["/"+ch+"/"+sq+"/"+v];
        }
        catch(err) {
          console.log("Got an error because of origin");
          res.end();
        }

        event.timestamp = timestamp;
        event.recommendation = "-1"; // defaults to -1 but changed when user clicks on recommendation
        event.timeSeq = "2"; // defaults to 2 but changed when user makes the next event
        event.followed = "0"; // defaults to 0 but changed when user clicks on recommendation

        // check if there is an entry for this student in the recent db
        Recent.find(
          {user: req.body.user},
          function(err, old_recent) {

            // recent entry exists
            if (old_recent.length > 0) {
              event.prevId = old_recent[0].recentId;
              old_recent[0].recentId = my_id;
              old_recent[0].save(function(err) {
                if (err) {
                  res.end();
                }
              });

              // replace timeSeq of prevId
              Event.findById(event.prevId, function(err, prevEvent) {
                  if (err)
                    res.end();

                  var tD = timeDiff(timestamp, prevEvent.timestamp);
                  var timeSeq = timeCategory(tD);

                  prevEvent.timeSeq = timeSeq;

                  // save the prevEvent
                  prevEvent.save(function(err) {
                      if (err) {
                        res.end();
                      }
                  });
              });
            }

            // create a new entry in the recent db
            else {
              var new_recent = new Recent();
              new_recent.recentId = my_id;
              new_recent.user = req.body.user;
              new_recent.save(function(err) {
                if (err) {
                  res.end();
                }
              });
            }

            // save the event and check for errors
            event.save(function(err) {
              if (err) {
                res.end();
              }
            });

            res.json({id : event._id});

          });
    })

    // get all events (accessed at POST https://server:port/api/events)
    .get(function(req, res) {
        Event.find(function(err, events) {
            if (err) {
              res.end();
            }
            res.json(events);
        });
    });


// on routes that end in /recents
// ----------------------------------------------------
router.route('/recents')
  .get(function(req, res) {
      Recent.find(function(err, recents) {
          if (err) {
            res.end();
          }

          res.json(recents);
      });
  });

// on routes that end in /events/:event_id
// ----------------------------------------------------
router.route('/events/:event_id')

    // get the event with that id (accessed at GET https://server:port/api/events/:event_id)
    .get(function(req, res) {
        Event.findById(req.params.event_id, function(err, event) {
          if (err) {
            res.end();
          }
          res.json(event);
        });
    })

    // update the event with this id (accessed at PUT https://server:port/api/events/:event_id)
    .put(function(req, res) {
        // find event and update timeSeq and followed
        Event.findById(req.params.event_id, function(err, event) {
            if (err) {
              res.end();
            }

            if (req.body.timeSeq)
              event.timeSeq = req.body.timeSeq;

            if (req.body.followed)
              event.followed = req.body.followed;

            // save the event
            event.save(function(err) {
                if (err) {
                  res.end();
                }

                res.json({ message: 'event updated!' });
            });

        });
    })

    // delete the event with this id (accessed at DELETE https://server:port/api/events/:event_id)
   .delete(function(req, res) {
       Event.remove({
           _id: req.params.event_id
       }, function(err, event) {
           if (err) {
            res.end();
          }
           res.json({ message: 'Successfully deleted' });
       });
   });


 // on routes that end in /rec
 // ----------------------------------------------------
   router.route('/rec')
       // get the recommendation (accessed at POST http://server:1334/rec)
       .post(function(req, res) {
             var user = req.body.user;
             var myId = req.body.myId;
             var querySeq = Event.find({"user":user}).sort("timestamp").select({ "origin": 1, "_id": 0});
             var queryTime = Event.find({"user":user}).sort("timestamp").select({ "timeSeq": 1, "_id": 0});
             var final = "";
             var rec_from_model;

             querySeq.exec(function (err, output) {
                 if (err) {
                   return next(err);
                 }
                 else {
                   for(var i = 0; i < output.length; i++) {
                       var obj = output[i];
                       final += obj.origin + " ";
                   }

                   queryTime.exec(function (err, output) {
                      if (err) return next(err);
                      for(var i = 0; i < output.length; i++) {
                          var obj = output[i];
                          final += obj.timeSeq + " ";
                      }

                      // data to send to model
                      final = final.substr(0,final.length-1);
                      var post_data = querystring.stringify({"events": final});

                      var post_options = {
                         host: 'server',
                         port: 'port',
                         path: '/rec',
                         method: 'POST',
                         headers: {
                             'Content-Type': 'application/x-www-form-urlencoded',
                             'Content-Length': Buffer.byteLength(post_data)
                       }
                     };

                     // data is the response
                     var post_req = http.request(post_options, function(response) {
                           response.setEncoding('utf8');
                           response.on('data', function (data) {
                           var full, seq, vert;
                           if (data in index_to_url_name) {
                             full = index_to_url_name[data];
                             var path_name = full.substr(0,full.length-2);
                             if (path_name in path_to_name) {
                                seq = path_to_name[path_name];
                                if (full in path_to_name) {
                                    vert = path_to_name[full];
                                }
                                else {
                                    res.status(500).send('No data from Oracle');
                                }
                            }
                            else {
                                res.status(500).send('No data from Oracle');
                            }


                             Event.findById(myId, function(err, event) {
                                 if (err) {
                                   res.end();
                                 }

                                 if (data.length > 5) {
                                   event.recommendation = 0;
                                 }
                                 else {
                                   event.recommendation = data;
                                 }

                                 // save the event
                                 event.save(function(err) {
                                     if (err) {
                                       res.end();
                                     }
                                 });

                             });
                             res.json({url: index_to_url_name[data].substr(1), sequential: seq, vertical: vert});
                           }

                           else {
                             res.status(500).send('No data from Oracle');
                           }
                         });
                     });

                     post_req.on('error', function(e) {
                         res.end();
                     });

                     // post the data
                     post_req.write(post_data);
                     post_req.end();
                   });
                 }
             });
       });

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);
app.use(express.static('public'));
// START THE SERVER
// =============================================================================
https.createServer(options, app).listen(port);
console.log('Node server start on port: ' + port);
