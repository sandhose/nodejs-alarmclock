var express = require('express'),
    http = require('http'),
    app = express(),
    server = http.createServer(app),
    path = require('path'),
    io = require('socket.io').listen(server),
    googleapis = require("googleapis")
    OAuth2Client = googleapis.OAuth2Client,
    MongoClient = require("mongodb").MongoClient;

io.set("log level", 2);

app.configure("all", function(){
    app.set('port', process.env.PORT || 1337);
    // app.set('views', __dirname + '/views');
    // app.set('view engine', 'jade');
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
    app.use(express.errorHandler());
});

server.listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});


// App
var AlarmClock = function() {
    this.init.apply(this, arguments);
};

AlarmClock.prototype = {
    // Variables
    OAuth2Config: {
        clientId: "789571319516-ch3j8s80nt0gmddnmeg5p6dijc50120k.apps.googleusercontent.com",
        clientSecret: "bfc3X3xKlikW-W5Ja2CgF7VZ",
        redirectUrl: "http://localhost:1337/oauth2callback"
    },
    OAuth2Credentials: false,
    calendarId: false,
    nextEvent: false,
    // Methods
    init: function() {
        this.appSetupDone = false;
        this.initRoutes(app);
        this.initSockets(io.sockets);
        this.initDatabase();
    },
    initSockets: function (sockets) {
        sockets = sockets || this.sockets || io.sockets;
        sockets.on("connection", function(socket) {
            socket.on("get calendar list", this.fetchCalendarList.bind(this));
            socket.on("calendar select", this.calendarSelect.bind(this));
            socket.on("setup done", this.setupDone.bind(this));
            socket.on("update", this.update.bind(this));
            socket.on("reset config", this.resetConfig.bind(this, socket));
            socket.on("request log", this.requestLog.bind(this));
            this.emitStatus(socket);
        }.bind(this));
    },
    initRoutes: function(application) {
        application
            .get("/", function(req, res) {
                res.render("index");
                res.end();
            }).get("/authorize", function(req, res) {
                var url = this.generateAuthURL();
                res.setHeader('Content-Type', 'text/plain');
                res.redirect(url);
                res.end("Redirecting...");
            }.bind(this)).get("/oauth2callback", function(req, res) {
                res.setHeader('Content-Type', 'text/plain');
                res.end("Redirecting to the app...");
                this.getOAuth2Client().getToken(req.query.code, function(err, tokens) {
                    this.OAuth2Credentials = tokens;
                    this.emitStatus(io.sockets);
                }.bind(this));
            }.bind(this));
    },
    initDatabase: function() {
        MongoClient.connect("mongodb://127.0.0.1:27017/test", function(err, db) {
            if(err) throw err;

            this.db = db;
            this.loadConfig();
        }.bind(this));
    },
    loadConfig: function() {
        var collection = this.db.collection("config");
        collection.find().toArray(function(err, result) {
            if(err) throw err;

            for(var i = 0; i < result.length; i++) {
                if(result[i].key == "credentials") {
                    this.OAuth2Credentials = result[i].value;
                }
                else if(result[i].key == "calendarId") {
                    this.calendarId = result[i].value;
                }
            }
            
            if(this.getOAuth2Client()) {
                this.setupDone();
            }
        }.bind(this));
    },
    resetConfig: function(socket) {
        this.calendarId = null;
        this.OAuth2Credentials = undefined;
        this.OAuth2Client = undefined;
        this.appSetupDone = false;
        
        this.saveConfig();
        
        if(socket) {
            this.emitStatus(socket);
        }
    },
    requestLog: function() {
        console.log({
            credentials: this.OAuth2Credentials,
            calendarId: this.calendarId
        });
    },
    getOAuth2Client: function() {
        if(this.OAuth2Client == undefined) {
            this.OAuth2Client = new OAuth2Client(this.OAuth2Config.clientId, this.OAuth2Config.clientSecret, this.OAuth2Config.redirectUrl);
        }

        if(this.OAuth2Credentials) {
            this.OAuth2Client.credentials = this.OAuth2Credentials;
        }

        return this.OAuth2Client
    },
    generateAuthURL: function() {
        return this.getOAuth2Client().generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/calendar'
        });
    },
    emitStatus: function(socket) {
        if(!this.appSetupDone) {
            var step;
            if(this.OAuth2Credentials && this.calendarId) {
                step = 3;
            }
            else if(this.OAuth2Credentials) {
                step = 2;
            }
            else {
                step = 1;
            }

            socket.emit("status", {
                status: "setup",
                setupStep: step,
                calendarId: this.calendarId,
                calendarList: this.calendarList
            });
        }
        else {
            socket.emit("status", {
                status: "running",
                nextEvent: this.nextEvent
            });
        }
    },
    getNextEvent: function(/** */) {
        var d = new Date(),
            callback;
        for(var i in arguments) {
            if(typeof arguments[i] == "function") {
                callback = arguments[i];
            }
            else {
                d = new Date(arguments[i]);
            }
        }
        if(d.getHours() > 12) {
            d.setDate(d.getDate() + 1);
        }

        d.setHours(1);
        d.setMinutes(0);
        d.setSeconds(0);
        var dMax = new Date(d);
        dMax.setHours(12);
        dMax.setMinutes(0);
        dMax.setSeconds(0);

        var id = this.calendarId;
        var auth = this.getOAuth2Client();
        googleapis.discover("calendar", "v3").execute(function(err, client) {
            client.calendar.events.list({
                calendarId: id,
                timeMin: ISODateString(d),
                singleEvents: true,
                orderBy: "startTime",
                timeMax: ISODateString(dMax)
            })
                .withAuthClient(auth)
                .execute(function(err, result) {
                    if(!err) {
                        callback && callback({
                            status: "success",
                            data: result
                        });
                    }
                    else {
                        callback && callback({
                            status: "failed",
                            data: err
                        });
                    }
                });
        });
    },
    fetchCalendarList: function(arg, callback) {
        var auth = this.getOAuth2Client();
        var done = function(data) {
            this.calendarList = data;
            callback && callback(data);
        }.bind(this);

        googleapis.discover("calendar", "v3").execute(function(err, client) {
            client.calendar.calendarList.list()
                .withAuthClient(auth)
                .execute(function(err, result) {
                    if(err) return;
                    var outData = [];
                    for(var i = 0; i < result.items.length; i++) {
                        var item = result.items[i];
                        outData.push({
                            id: item.id,
                            name: item.summary
                        });
                    }
                    done(outData);
                });
        });
    },
    fetchCalendar: function(id, callback) {
        var auth = this.getOAuth2Client();
        googleapis.discover("calendar", "v3").execute(function(err, client) {
            client.calendar.calendars.get({calendarId: id})
                .withAuthClient(auth)
                .execute(function(err, result) {
                    if(!err) {
                        callback && callback({
                            status: "success",
                            data: result
                        });
                    }
                    else {
                        callback && callback({
                            status: "failed",
                            data: err
                        });
                    }
                });
        });
    },
    calendarSelect: function(id, fn) {
        this.fetchCalendar(id, function(result) {
            if(result.status == "success") {
                this.calendarId = result.data.id;
            }

            this.emitStatus(io.sockets);

            fn && fn(result);
        }.bind(this));
    },
    setupDone: function() {
        if(this.OAuth2Credentials && this.calendarId) {
            this.appSetupDone = true;
            this.update(this.emitStatus.bind(this, io.sockets));
            this.saveConfig();
            return true;
        }
        else return false;
    },
    saveConfig: function() {
        this.db.collection("config").update({
            key: "calendarId"
        }, {
            $set: {
                value: this.calendarId
            }
        }, {
            upsert: true,
            w: 0
        });
        this.db.collection("config").update({
            key: "credentials"
        }, {
            $set: {
                value: this.OAuth2Credentials
            }
        }, {
            upsert: true,
            w: 0
        });
    },
    update: function(callback) {
        var updated = {};
        var updateCallback = function(element) {
            updated[element] = true;
            for(var i in updated) {
                if(!updated[element]) return false;
            }
            callback && callback();
        }.bind(this);

        if(this.OAuth2Credentials && this.calendarId) {
            updated = {
                nextEvent: false
            };

            this.getNextEvent(function(result) {
                if(result.status == "success") {
                    this.nextEvent = result.data.items[0];
                }
                updateCallback("nextEvent");
            }.bind(this));
        }
    }
};


// Utility function: date to iso format
function ISODateString(d){
    function pad(n){return n<10 ? '0'+n : n}
    return d.getUTCFullYear()+'-'
        + pad(d.getUTCMonth()+1)+'-'
        + pad(d.getUTCDate())+'T'
        + pad(d.getUTCHours())+':'
        + pad(d.getUTCMinutes())+':'
        + pad(d.getUTCSeconds())+'Z'}


var theApp = new AlarmClock();