define(['./models'],
function(models)
{
"use-strict";

var socketPath = function() {
    var secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws'
};

var normalizeUri = function(uri) {
    return decodeURI(uri)
        .trim()
        .toLowerCase()
        .replace(' ', '/');
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

    self.socket = new WebSocket(socketPath());
    self.ready = false;
    self.socket.onopen = function(e) {
        var targetStreams = Object.keys(self.streams);
        if (targetStreams.length) {
            self.socket.send(JSON.stringify({
                "type": "Subscribe",
                "to": targetStreams
            }));
        }

        var targetCollections = Object.keys(self.streams);
        if (targetCollections.length) {
            targetCollections.forEach(function(x) {
                self.socket.send(JSON.stringify({
                    "type": "SubscribeCollection",
                    "to": x
                }));
            });
        }
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
    paths.map(normalizeUri).forEach(function(path) {
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
    var path = normalizeUri(path);

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