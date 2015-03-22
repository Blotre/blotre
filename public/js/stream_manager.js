define(['./models'],
function(models)
{
"use-strict";

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
        this.streams[path] = current = { model: new models.StreamModel(path, path, null), listeners: [callback] };
        if (this.ready) {
            this.socket.send(JSON.stringify({
                "type": "Subscribe",
                "value": path
            }));
        }
    }
};


return {
    StreamManager: StreamManager
};

});