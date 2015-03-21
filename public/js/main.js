require([
    "./models"],
function(
    models)
{
"use-strict";

/**
*/
var AppViewModel = function(user, stream) {
    var self = this;
    self.user = ko.observable(user);
    self.stream = ko.observable(stream);

    self.color = ko.computed(function() {
        var stream = self.stream();
        return (stream ? stream.color() : models.DEFAULT_COLOR);
    });

    self.setColor = function(color) {
        var stream = self.stream() || new models.StreamModel();
        stream.setColor(color);
        self.stream(stream);
    };
};

var loadInitialUserData = function(model) {
    if (window.initialUserData) {
        model.user(new models.UserModel(new models.StatusModel(initialUserData.status.color)));
    }
};

var loadInitialStreamData = function(model) {
    if (window.initialStreamData) {
        model.setColor(window.initialStreamData.status.color);
        model.stream().uri(window.initialStreamData.uri);
        model.stream().updated(new Date(window.initialStreamData.updated));
    }
};

/**
*/
var updateFavicon = function(color) {
    var canvas = document.createElement('canvas');
    var link = document.getElementById('favicon');

    canvas.width = canvas.height = 1;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    link.href = canvas.toDataURL('image/png');
};

/**
*/
var StreamManager = function() {
    var self = this;
    self.streams = { };

    var processStatusUpdate = function(msg) {
        var path = msg.stream.uri;
        var current = self.streams[path];
        if (current) {
            var color = msg.stream.status.color;
            current.model.setColor(color);
            current.model.updated(new Date(msg.stream.updated));
            current.listeners.forEach(function(x) {
                x(msg.stream);
            });
        }
    };

    var processMessage = function(msg) {
        switch (msg.type) {
        case "StatusUpdate":
            processStatusUpdate(msg);
        }
    };

    self.socket = new WebSocket("ws://localhost:9000/ws");
    self.ready = false;
    self.socket.onopen = function(e) {
        Object.keys(self.streams).forEach(function(path) {
            self.socket.send(JSON.stringify({
                "type": "Subscribe",
                "value": path
            }));
        });
    };

    self.socket.onmessage = function(event) {
        var data = JSON.parse(event.data);
        if (data)
            processMessage(data);
    }
};
StreamManager.prototype.subscribe = function(path, callback) {
    var current = this.streams[path];

    if (current) {
        current.listeners.push(callback);
    } else {
        this.streams[path] = current = { model: new models.StreamModel(null, path), listeners: [callback] };
        if (this.ready) {
            this.socket.send(JSON.stringify({
                "type": "Subscribe",
                "value": path
            }));
        }
    }
};

/**
*/
$(function(){
    var model = new AppViewModel(
        new models.UserModel(),
        new models.StreamModel(new models.StatusModel(models.DEFAULT_COLOR)));

    loadInitialUserData(model);
    loadInitialStreamData(model);

    var updateStatus = function(color) {
        var stream = model.stream();
        if (!stream)
            return;

        $.ajax({
            type: "POST",
            url: jsRoutes.controllers.Stream.postStreamUpdate(stream.uri()).url,
            data: "color=" + color
        });

        model.stream().updated(new Date());
        model.setColor(color);
    };

    var statusPicker = (function(){
        var currentColor = models.DEFAULT_COLOR;
        var pickedColor = models.DEFAULT_COLOR;
        var statusPicker = $('.status-picker')
            .spectrum({
                showInput: true,
                showPalette: true,
                showSelectionPalette: true,
                preferredFormat: "hex",
                localStorageKey: "blotre.stream.statusPicker"
            })
            .on('show.spectrum', function(e, color) {
                currentColor = color;
                pickedColor = color;
            })
            .on('move.spectrum change.spectrum', function(e, color) {
                model.setColor(color);
            })
            .on('hide.spectrum', function(e, color) {
                pickedColor = color;
                model.setColor(currentColor);
            });

        $('.sp-choose')
            .on('click', function() {
                updateStatus(pickedColor);
            });

        return statusPicker;
    }());

    $('.status-picker-form')
        .on('submit', function(e) {
            e.preventDefault();
            var color = $(this).children('.status-picker').val();
            updateStatus(color);
        });

    ko.applyBindings(model);

    model.color.subscribe(function(color) {

        updateFavicon(color);
    });

    var manager = new StreamManager();

    manager.subscribe(model.stream().uri(), function(stream) {
        model.setColor(stream.status.color);
        model.stream().updated(new Date(stream.updated));

         statusPicker.spectrum("set", stream.status.color);
    });

    manager.subscribe(model.stream().uri(), function(stream) {
        model.user().status(new models.StatusModel(stream.status.color));
    });
});

});