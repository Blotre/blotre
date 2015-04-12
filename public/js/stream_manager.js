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
        (self.streams[path] || []).listeners.forEach(function(x) {
            x(msg.stream);
        });
    };

    var processMessage = function(msg) {
        switch (msg.type) {
        case "StatusUpdate":
            processStatusUpdate(msg);
        }
    };

    self.socket = new WebSocket("ws://localhost:9000/v0/ws");
    self.ready = false;
    self.socket.onopen = function(e) {
        self.socket.send(JSON.stringify({
            "type": "Subscribe",
            "to": Object.keys(self.streams)
        }));
        //self.socket.set()
    };

    self.socket.onmessage = function(event) {
        console.log(event);
        var data = JSON.parse(event.data);
        if (data)
            processMessage(data);
    }
};

StreamManager.prototype.subscribe = function(path, callback) {
    this.subscribeAll([path], callback);
};

StreamManager.prototype.subscribeAll = function(paths, callback) {
    var self = this;

    var newSubscriptions = [];
    paths.forEach(function(path) {
        var current = self.streams[path];
        if (current) {
            current.listeners.push(callback);
        } else {
            self.streams[path] = { listeners: [callback] };
            newSubscriptions.push(path);
        }
    });

    if (newSubscriptions.length) {
        if (self.ready) {
            self.socket.send(JSON.stringify({
                "type": "Subscribe",
                "to": newSubscriptions
            }));
        }
    }
};


return {
    StreamManager: StreamManager
};

});