"use strict";
import * as models from './models';

const socketPath = () => {
    const secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws';
};

/**
    Manages a websocket connection
 */
export default class StreamManager {
    constructor() {
        var self = this;
        self.streams = {};
        self.collections = {};
        self.ready = false;

        const processMessage = msg => {
            if (!msg || !msg.type)
                return;

            const type = msg.type;
            const target = (msg.source ? self.collections[msg.source] : self.streams[msg.from]);
            (target ? target.listeners : []).forEach(x =>
                x[type] && x[type](msg));
        };

        const openWebsocket = () => {
            const socket = new WebSocket(socketPath());

            socket.onopen = e => {
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
                    targetCollections.forEach(x => {
                        socket.send(JSON.stringify({
                            "type": "SubscribeCollection",
                            "to": x
                        }));
                    });
                }
            };

            socket.onmessage = event => {
                const data = JSON.parse(event.data);
                if (data)
                    processMessage(data);
            };

            socket.onclose = function() {
                console.log('reopen');
                if (self.ready) {
                    self.ready = false;
                    self.socket = openWebsocket();
                }
            };
        };

        self.socket = openWebsocket();
    }

    subscribe(path, callback) {
        this.subscribeAll([path], callback);
    }

    subscribeAll(paths, callback) {
        const self = this;

        const newSubscriptions = [];
        paths.map(models.normalizeUri).forEach(path => {
            const current = self.streams[path];
            if (current) {
                current.listeners.push(callback);
            } else {
                self.streams[path] = {
                    listeners: [callback]
                };
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
    }

    subscribeCollection(path, callback) {
        var self = this;
        path = models.normalizeUri(path);

        var current = self.collections[path];
        if (current) {
            current.listeners.push(callback);
        } else {
            self.collections[path] = {
                listeners: [callback]
            };
            if (self.ready) {
                self.socket.send(JSON.stringify({
                    "type": "SubscribeCollection",
                    "to": path
                }));
            }
        }
    }
}

/**
    Get the stream_manager singleton.
*/
StreamManager.getInstance = (() => {
    let instance;
    return function() {
        if (!instance)
            instance = new StreamManager();
        return instance;
    };
})();
