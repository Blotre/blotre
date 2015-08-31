define(['./models'],
function(models)
{
"use-strict";

var socketPath = function() {
    var secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws'
};

/**
*/
var StreamManager = function() {
    var self = this;
    self.streams = { };
    self.collections = { };

    var processMessage = function(msg) {
        if (!msg || !msg.type)
            return;

        var type = msg.type;
        var target = (msg.source ? self.collections[msg.source] : self.streams[msg.from]);
        (target ? target.listeners : []).forEach(function(x) {
            if (x[type])
                x[type](msg);
        });
    };

    self.ready = false;

    var openWebsocket = function() {
        var socket = new WebSocket(socketPath());

        socket.onopen = function(e) {
            self.ready = true;
            var targetStreams = Object.keys(self.streams);
            if (targetStreams.length) {
                socket.send(JSON.stringify({
                    "type": "Subscribe",
                    "to": targetStreams
                }));
            }

            var targetCollections = Object.keys(self.collections);
            if (targetCollections.length) {
                targetCollections.forEach(function(x) {
                    socket.send(JSON.stringify({
                        "type": "SubscribeCollection",
                        "to": x
                    }));
                });
            }
        };

        socket.onmessage = function(event) {
            var data = JSON.parse(event.data);
            if (data)
                processMessage(data);
        }

        socket.onclose = function() {
            console.log('reopen');
            if (self.ready) {
                self.ready = false;
                self.socket = openWebsocket();
            }
        };
    };

    self.socket = openWebsocket();
};

StreamManager.prototype.subscribe = function(path, callback) {
    this.subscribeAll([path], callback);
};

StreamManager.prototype.subscribeAll = function(paths, callback) {
    var self = this;

    var newSubscriptions = [];
    paths.map(models.normalizeUri).forEach(function(path) {
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

StreamManager.prototype.subscribeCollection = function(path, callback) {
    var self = this;
    var path = models.normalizeUri(path);

    var current = self.collections[path];
    if (current) {
        current.listeners.push(callback);
    } else {
        self.collections[path] = { listeners: [callback] };
        if (self.ready) {
            self.socket.send(JSON.stringify({
                "type": "SubscribeCollection",
                "to": path
            }));
        }
    }
};


return {
    StreamManager: StreamManager
};

});