var AlarmManager = function() {
    this.init.apply(this, arguments);
};

AlarmManager.prototype = {
    init: function() {
        if(!io) {
            console.error("require socket.io");
            return;
        }
        if(!$) {
            console.error("require jquery.js");
            return;
        }

        this.socket = io.connect();
        this.socket.on("status", function(data) {
            if(data.status == "setup") {
                this.updateSetup(data);
            }
            else if(data.status == "running") {
                this.updateStatus(data);
            }
        }.bind(this));
    },
    updateSetup: function(data) {
        if(!this.setupActive) {
            $("#setup .step").hide();
            $("#setup").addClass("active").show();
            this.setupActive = true;
            $("#auth_button").on("click", function(e) {
                if(this.setupStep == 1) {
                    this.authWindow = window.open("/authorize", "googleApiAuth", 'width=800, height=600');
                }
            }.bind(this));

            $("#calendar_ok").on("click", function(e) {
                if(this.setupStep == 2) {
                    this.socket.emit("calendar select", $("#calendar_select").val());
                }
            }.bind(this));

            $("#setup .jumbotron").css({
                marginTop: "20px",
                opacity: 0
            }).animate({
                marginTop: "70px",
                opacity: 1
            })
        }

        if(data.setupStep) this.setupStep = data.setupStep;
        $(".step").removeClass("done active");
        $("#setup a.btn, #setup select").removeClass("disabled").attr("disabled", false);
        if(this.setupStep == 1) {
            $("#step-1").addClass("active").show();
        }
        else if(this.setupStep == 2) {
            this.socket.emit("get calendar list", null, function(data) {
                $("#calendar_select").children().remove();
                for(var i = 0; i < data.length; i++) {
                    $("#calendar_select").append(
                        $("<option>", {value: data[i].id}).html(data[i].name)
                    );
                }
            });
            $("#step-1").addClass("done").show().find("a.btn, select").addClass("disabled").attr("disabled", true);
            $("#step-2").addClass("active").show();
            if(this.authWindow) this.authWindow.close();
        }
        else  {
            $("#step-1, #step-2").addClass("done").find("a.btn, select").addClass("disabled").attr("disabled", true);
            $("#step-3").addClass("active");
            $("#setup .step").show();

            $("#setup_done").on("click", function(e) {
                this.socket.emit("setup done");
            }.bind(this));
        }

        $('html, body').animate({
            scrollTop: $("#step-" + this.setupStep).offset().top
        }, 2000);
    },
    updateStatus: function(data) {
        if(this.setupActive) {
            this.setupActive = false;
            $("#setup").fadeOut();
        }

        $('#main').show();

        if(data.nextEvent) {
            this.nextEventStart = new Date(data.nextEvent.start.dateTime);
            var hours = this.nextEventStart.getHours();
            if(hours < 10) hours = "0" + hours;
            var minutes = this.nextEventStart.getMinutes();
            if(minutes < 10) minutes = "0" + minutes;
            $("#next_lesson_time").text(hours + ":" + minutes);
        }
    }
};

var theManager;

$(document).ready( function() {
    theManager = new AlarmManager();
});