

// Ember.Application.initializer({
//     name: "socket.io",
//     initialize: function(container, application) {
//         console.log("Initialize socket.io");
//         if(!io) console.log("Socket.io could not load");

//         var socket = io.connect();
//         socket.on("status", function(data) {
//             for(var i in data) {
//                 application.Status.set(i, data[i]);
//             }
//             debugger;
//             application.ApplicationController.send("updateStatus");
//         });

//         application.Socket = socket;
//     }
// });


App = Ember.Application.create({
    LOG_TRANSITIONS: true
});

App.Status = Ember.Map.create({
    status: "connecting",
    statusChange: function() {
        console.log("Status changes", this.get("status"));
    }.observes("status")
});

App.Router.map(function() {
  this.resource("setup");
  this.resource("settings");
});

App.ApplicationController = Ember.Controller.extend({
    updateStatus: function() {
        var status = this.get("status");
        if(status == "setup") {
            this.transitionTo("setup");
        }
        console.log(status);
    }
});

App.ApplicationRoute = Ember.Route.extend({
    model: function() {
        return App.Status;
    },
    setupController: function() {
        var self = this;
        console.log("Initialize socket.io");
        if(!io) console.log("Socket.io could not load");

        var socket = io.connect();
        socket.on("status", function(data) {
            for(var i in data) {
                self.get("controller").set(i, data[i]);
            }
            self.get("controller").updateStatus();
        });

        this.get("controller").set("socket", socket);
    }
});

App.SetupController = Ember.Controller.extend({
    calendar: [],
    calendarId: null,
    setupStep: 0,
    updateStatus: function() {
        var step = App.Status.get("setupStep");
        this.set("step1", (step == 1));
        this.set("step2", (step == 2));
        this.set("step3", (step == 3));
        console.log(this);
    }
});

App.IndexRoute = Ember.Route.extend({
  model: function() {
    return {
        alarm: {
            next: "13:37",
            lesson: {
                time: "12:37",
                type: "Math"
            },
            wakeTime: "1:00"
        }
    };
  }
});
