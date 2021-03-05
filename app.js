"use strict";

// Message variable will act as a mutable variable that will display the outcome of get and post requests:
var message = JSON.stringify({ error: "Wrong Format" });

var express     = require("express"),
    mongo       = require("mongodb"),
    mongoose    = require("mongoose"),
    dns         = require("dns"),
    { URL }     = require("url"),
    bodyParser  = require("body-parser"),
    cors        = require("cors"),
    app         = express(),
    getIP       = require("./getIP.js").getIP,
    User        = require("./make_user.js").User;

// Basic Configuration
var port = process.env.PORT || 3000;

// Connection to DB: //
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));

// Sets up CORS middleware for freeCodeCamp testing.
const corsOptions = {
  origin: ["https://www.freecodecamp.com", "http://learn.freecodecamp.org"],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

/** this project needs to parse POST bodies **/

app.use(bodyParser.urlencoded({ extended: "false" }));
app.use(bodyParser.json());

// Serve static files
app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});


// Routes
// Take info in req.body from the form and mutate message variable so that to display outcome based on user input
app.post("/api/shorturl", function(req, res) {
  // Identify user bind to User using info from request
  var client = getIP(req);

  // Define format of url string provided by the user in the form: (www.[...]) or (http(s)://www.[...]) accepted
  // Create a valid url object (or null) accordingly
  var incomingUrl = /^w{3}\u002e\D/.test(req.body.url)
    ? new URL("http://" + req.body.url)
    : /^http\:\/\/w{3}\u002e\D|^https\:\/\/w{3}\u002e\D/.test(req.body.url)
    ? new URL(req.body.url)
    : null;

  // Upload triggered in case dns.lookup finds the matching address
  var upload = function update(url) {
    User.findOne({ userIP: client }, function(err, foundUser) {
      // Return values either an obj or null
      if (err) {
        res.redirect("/");
      }
      if (foundUser) {
        // User exists in DB
        // Assign numbers from 1 to 10 (subsequently) to the incoming url string
        var arr_len = foundUser.urls.short.length;
        if (foundUser.urls.original.find(item => item === url)) {
          message = JSON.stringify({
            error: `You already have a shortened url assigned to that hostname (${foundUser.urls.original.indexOf(
              url
            ) + 1})`
          });
          res.redirect("/api/shorturl/new");
        } else if (arr_len >= 10) {
          message = JSON.stringify({
            error: "You exceeded the limit of urls assigned to you, sorry"
          });
          res.redirect("/api/shorturl/new");
        } else {
          foundUser.urls.original.push(url);
          foundUser.urls.short.push(arr_len + 1);
          foundUser.save(function(err, user) {
            if (err) {
              res.redirect("/");
            } else {
              message = JSON.stringify({
                original_url: url,
                shortened_url: arr_len + 1
              });
              res.redirect("/api/shorturl/new");
            }
          });
        }
        // User not in DB, the user input data is valid --> upload the new user to the collection
      } else {
        var newUser = new User({
          userIP: client
        });
        newUser.urls.original.push(url);
        newUser.urls.short.push(1);
        newUser.save(function(err, the_user) {
          if (err) {
            res.redirect("/");
          } else {
            message = JSON.stringify({ original_url: url, shortened_url: 1 });
            res.redirect("/api/shorturl/new");
          }
        });
      }
    });
  };

  if (incomingUrl) {
    // Resolve host name (e.g. 'www.example.com') into the first found A (IPv4) or AAAA (IPv6) record.
    // On success trigger function update() to find user (und update User)
    dns.lookup(incomingUrl.hostname, function(err, address, family) {
      if (err) {
        message = JSON.stringify({ error: "Invalid Hostname" });
        res.redirect("/api/shorturl/new");
      } else {
        upload(incomingUrl.href);
      }
    });
  } else {
    message = JSON.stringify({ error: "Wrong Format" });
    res.redirect("/api/shorturl/new");
  }
});

app.get("/api/shorturl/new", function(req, res) {
  res.send(message);
});

app.get("/api/shorturl/myurls", function(req, res) {
  // Show user's urls in a table
  var client = getIP(req);
  User.findOne({ userIP: client }, function(err, foundUser) {
    if (err) {
      res.redirect("/");
    }
    if (foundUser) {
      res.render("user_urls.ejs", { user: foundUser.urls });
    } else {
      res.json({
        error: "You don't have any urls yet. Use the API to set one."
      });
    }
  });
});

app.get("/api/shorturl/:n", function(req, res) {
  // Find short url for the user and redirect to the selected url:
  var client = getIP(req);
  var num_url = Number(req.params.n);
  if (message) {
    User.findOne({ userIP: client }, function(err, foundUser) {
      if (err) {
        res.send("\b:( \nTry again...");
      }
      if (foundUser) {
        var idx_of_url = foundUser.urls.short.indexOf(num_url);
        if (idx_of_url >= 0) {
          res.redirect(foundUser.urls.original[idx_of_url]);
        } else {
          res.json({ error: "No short URL found for the given input" });
        }
      } else {
        res.json({
          error: "You don't have any urls yet. Use the API to set one."
        });
      }
    });
  } else {
    // If there is any error, return to the HOMEPAGE:
    res.redirect("/");
  }
});

// In case I want to depopulate the 'users' collection we have created above.
// db.dropCollection('users');

app.listen(port, function() {
  console.log("Node.js listening on port: " + port);
});
