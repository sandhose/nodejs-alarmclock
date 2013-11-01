App = Ember.Application.create({
    LOG_TRANSITIONS: true
});

App.Router.map(function() {
  this.route("setup");
  this.route("settings");
});

App.IndexRoute = Ember.Route.extend({
  model: function() {
    return ['red', 'yellow', 'blue'];
  }
});
