(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
"use-strict";

var models = require('./models');
var stream_manager = require('./stream_manager');

/**
*/
var AppViewModel = function AppViewModel(user, page) {
    var self = this;
    self.user = ko.observable(user);
    self.page = ko.observable(page);
    self.favorites = ko.observable(new models.Collection(user.userName()));

    self.manager = new stream_manager.StreamManager();

    self.addFavorite = function (child) {
        self.favorites().addChild(child);
    };

    self.removeFavorite = function (childUri) {
        return self.favorites().children.remove(function (x) {
            return x.uri() === childUri;
        });
    };

    // Subscribe to user status updates
    self.manager.subscribe(user.userName(), {
        'StatusUpdated': function StatusUpdated(msg) {
            self.user().status(new models.StatusModel(msg.status.color));
        }
    });

    if (!user || !user.rootStream()) return;

    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.apiGetChildren(user.rootStream()).url,
        headers: {
            accept: "application/json"
        },
        error: function error(e) {
            console.error(e);
        }
    }).done(function (result) {
        self.favorites().children((result || []).map(models.StreamModel.fromJson));
    });

    // Subscribe to user collection updates
    self.manager.subscribeCollection(user.userName(), {
        'StatusUpdated': function StatusUpdated(msg) {
            var existingChild = self.removeFavorite(msg.from);
            if (existingChild.length) {
                existingChild[0].status(models.StatusModel.fromJson(msg.status));
                self.addFavorite(existingChild[0]);
            }
        },
        'ChildAdded': function ChildAdded(msg) {
            self.addFavorite(models.StreamModel.fromJson(msg.child));
        },
        'ChildRemoved': function ChildRemoved(msg) {
            self.removeFavorite(msg.child);
        }
    });
};

var initialUser = function initialUser() {
    return models.UserModel.fromJson(window.initialUserData);
};

module.exports = {
    AppViewModel: AppViewModel,
    initialUser: initialUser
};

},{"./models":2,"./stream_manager":5}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var slice = Function.prototype.call.bind(Array.prototype.slice);

var DEFAULT_COLOR = exports.DEFAULT_COLOR = '#777777';

/**
 */
var normalizeUri = exports.normalizeUri = function normalizeUri(uri) {
    return decodeURI(uri).trim().toLowerCase().replace(' ', '/');
};

/**
    Pretty prints a data.
*/
var dateToDisplay = exports.dateToDisplay = function () {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var pad = function pad(min, input) {
        input += '';
        while (input.length < min) {
            input = '0' + input;
        }return input;
    };

    return function (date) {
        if (!date) return '-';

        return months[date.getMonth()] + ' ' + pad(2, date.getDate()) + ', ' + date.getFullYear() + ' ' + pad(2, date.getHours()) + ':' + pad(2, date.getMinutes()) + '.' + pad(2, date.getSeconds()) + pad(3, date.getMilliseconds());
    };
}();

/**
 */
var StatusModel = exports.StatusModel = function StatusModel(color) {
    var self = this;
    self.color = ko.observable(color);
};

StatusModel.empty = function () {
    return new StatusModel(DEFAULT_COLOR);
};

StatusModel.fromJson = function (data) {
    return new StatusModel(data && data.color);
};

/**
 */
var TagModel = exports.TagModel = function TagModel(value) {
    var self = this;
    self.value = ko.observable(value);

    self.url = ko.computed(function () {
        return jsRoutes.controllers.Stream.getTag(self.value()).url;
    });
};

/**
 */
var PathComponent = function PathComponent(name, uri) {
    var self = this;
    self.name = ko.observable(name);
    self.uri = ko.observable('/s' + uri);
};

/**
 */
var StreamModel = exports.StreamModel = function StreamModel(id, name, uri, status, updated, tags) {
    var self = this;
    self.id = ko.observable(id);
    self.name = ko.observable(name || '');
    self.uri = ko.observable(uri || '');
    self.status = ko.observable(status || StatusModel.empty());
    self.updated = ko.observable(updated);
    self.tags = ko.observableArray(tags || []);

    self.url = ko.computed(function () {
        return jsRoutes.controllers.Stream.getStream(self.uri()).url;
    });

    self.color = ko.computed(function () {
        var status = self.status();
        return status ? status.color() : DEFAULT_COLOR;
    });

    self.setColor = function (color) {
        var status = self.status() || StatusModel.empty();
        status.color(color);
        self.status(status);
    };

    self.displayUpdated = ko.computed(function () {
        return dateToDisplay(self.updated());
    });

    self.isOwner = function (user) {
        var ownerUri = normalizeUri(user.userName());
        return ownerUri === self.uri() || self.uri().indexOf(ownerUri + '/') === 0;
    };

    self.pathComponents = ko.computed(function () {
        var paths = [];
        self.uri().split('/').reduce(function (path, c) {
            path += '/' + c;
            paths.push(new PathComponent(c, path));
            return path;
        }, '');
        return paths;
    });
};

StreamModel.fromJson = function (data) {
    return new StreamModel(data && data.id, data && data.name, data && data.uri, StatusModel.fromJson(data && data.status), new Date(data && data.updated), (data && data.tags || []).map(function (x) {
        return new TagModel(x.tag);
    }));
};

/**
 */
var UserModel = exports.UserModel = function UserModel(userName, status, rootStream) {
    var self = this;
    self.userName = ko.observable(userName || '');
    self.status = ko.observable(status || StatusModel.empty());
    self.rootStream = ko.observable(rootStream);

    self.color = ko.computed(function () {
        var status = self.status();
        return status ? status.color() : DEFAULT_COLOR;
    });
};

UserModel.fromJson = function (data) {
    return new UserModel(data && data.userName, StatusModel.fromJson(data && data.status), data && data.rootStream);
};

/**
 */
var Collection = exports.Collection = function Collection(uri) {
    var self = this;
    self.uri = ko.observable(uri);
    self.children = ko.observableArray();

    self.addChild = function (child) {
        self.children.remove(function (x) {
            return x.uri() === child.uri();
        });
        self.children.unshift(child);
    };
};

},{}],3:[function(require,module,exports){
"use strict";
"use-strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var parseQueryString = exports.parseQueryString = function parseQueryString(queryString) {
    return queryString.substr(1).split("&").reduce(function (dict, item) {
        var kv = item.split("=");
        var k = kv[0];
        var v = decodeURIComponent(kv[1]);
        if (k in dict) dict[k].push(v);else dict[k] = [v];
        return dict;
    }, {});
};

var getQueryString = exports.getQueryString = function getQueryString() {
    return parseQueryString(window.location.search);
};

var lockButton = exports.lockButton = function lockButton(sel) {
    sel.prop("disabled", true).children('.glyphicon').addClass('glyphicon-refresh glyphicon-refresh-animate');
};

var unlockButton = exports.unlockButton = function unlockButton(sel) {
    sel.prop("disabled", false).children('.glyphicon').removeClass('glyphicon-refresh  glyphicon-refresh-animate');
};

},{}],4:[function(require,module,exports){
"use strict";

var models = require('./models');
var stream_manager = require('./stream_manager');
var application_model = require('./application_model');
var shared = require('./shared');

var AppViewModel = function AppViewModel(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);
};

var getTarget = function getTarget() {
    var path = decodeURIComponent(window.location.pathname).match('/s/(.+)');
    return path && path[1] || '';
};

$(function () {
    var model = new AppViewModel(application_model.initialUser());

    $('.create-child-button').click(function (e) {
        var btn = $(this);
        shared.lockButton(btn);

        var rawUri = getTarget();
        var parentIndex = rawUri.lastIndexOf('/');
        var parent = rawUri.slice(0, parentIndex);
        var name = rawUri.slice(parentIndex + 1).trim();
        var uri = parent + "/" + name;
        $.ajax({
            type: "PUT",
            url: jsRoutes.controllers.StreamApiController.apiCreateStream().url,
            contentType: 'application/json',
            data: JSON.stringify({
                name: name,
                uri: uri
            }),
            error: function error(e) {
                shared.unlockButton(btn);
            }
        }).then(function (result) {
            if (result && !result.error) {
                document.location.href = jsRoutes.controllers.Stream.getStream(result.uri).url;
            } else {
                shared.unlockButton(btn);
            }
        });
    });

    ko.applyBindings(model);
});

},{"./application_model":1,"./models":2,"./shared":3,"./stream_manager":5}],5:[function(require,module,exports){
"use strict";

var models = require('./models');

var socketPath = function socketPath() {
    var secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws';
};

/**
*/
var StreamManager = function StreamManager() {
    var self = this;
    self.streams = {};
    self.collections = {};

    var processMessage = function processMessage(msg) {
        if (!msg || !msg.type) return;

        var type = msg.type;
        var target = msg.source ? self.collections[msg.source] : self.streams[msg.from];
        (target ? target.listeners : []).forEach(function (x) {
            if (x[type]) x[type](msg);
        });
    };

    self.ready = false;

    var openWebsocket = function openWebsocket() {
        var socket = new WebSocket(socketPath());

        socket.onopen = function (e) {
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
                targetCollections.forEach(function (x) {
                    socket.send(JSON.stringify({
                        "type": "SubscribeCollection",
                        "to": x
                    }));
                });
            }
        };

        socket.onmessage = function (event) {
            var data = JSON.parse(event.data);
            if (data) processMessage(data);
        };

        socket.onclose = function () {
            console.log('reopen');
            if (self.ready) {
                self.ready = false;
                self.socket = openWebsocket();
            }
        };
    };

    self.socket = openWebsocket();
};

StreamManager.prototype.subscribe = function (path, callback) {
    this.subscribeAll([path], callback);
};

StreamManager.prototype.subscribeAll = function (paths, callback) {
    var self = this;

    var newSubscriptions = [];
    paths.map(models.normalizeUri).forEach(function (path) {
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

StreamManager.prototype.subscribeCollection = function (path, callback) {
    var self = this;
    path = models.normalizeUri(path);

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

module.exports = {
    StreamManager: StreamManager
};

},{"./models":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fY3JlYXRlX2NoaWxkLmpzIiwiY2xpZW50L2pzL3N0cmVhbV9tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBOztBQUNBLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDtBQUNOLElBQU0saUJBQWlCLFFBQVEsa0JBQVIsQ0FBakI7Ozs7QUFJTixJQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUI7QUFDcEMsUUFBSSxPQUFPLElBQVAsQ0FEZ0M7QUFFcEMsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBRm9DO0FBR3BDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUhvQztBQUlwQyxTQUFLLFNBQUwsR0FBaUIsR0FBRyxVQUFILENBQWMsSUFBSSxPQUFPLFVBQVAsQ0FBa0IsS0FBSyxRQUFMLEVBQXRCLENBQWQsQ0FBakIsQ0FKb0M7O0FBTXBDLFNBQUssT0FBTCxHQUFlLElBQUksZUFBZSxhQUFmLEVBQW5CLENBTm9DOztBQVFwQyxTQUFLLFdBQUwsR0FBbUIsVUFBUyxLQUFULEVBQWdCO0FBQy9CLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixLQUExQixFQUQrQjtLQUFoQixDQVJpQjs7QUFZcEMsU0FBSyxjQUFMLEdBQXNCLFVBQVMsUUFBVCxFQUFtQjtBQUNyQyxlQUFPLEtBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixNQUExQixDQUFpQyxVQUFTLENBQVQsRUFBWTtBQUMvQyxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHdDO1NBQVosQ0FBeEMsQ0FEcUM7S0FBbkI7OztBQVpjLFFBbUJwQyxDQUFLLE9BQUwsQ0FBYSxTQUFiLENBQXVCLEtBQUssUUFBTCxFQUF2QixFQUF3QztBQUNwQyx5QkFBaUIsdUJBQVMsR0FBVCxFQUFjO0FBQzNCLGlCQUFLLElBQUwsR0FBWSxNQUFaLENBQW1CLElBQUksT0FBTyxXQUFQLENBQW1CLElBQUksTUFBSixDQUFXLEtBQVgsQ0FBMUMsRUFEMkI7U0FBZDtLQURyQixFQW5Cb0M7O0FBeUJwQyxRQUFJLENBQUMsSUFBRCxJQUFTLENBQUMsS0FBSyxVQUFMLEVBQUQsRUFDVCxPQURKOztBQUdBLE1BQUUsSUFBRixDQUFPO0FBQ0gsY0FBTSxLQUFOO0FBQ0EsYUFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGNBQXpDLENBQXdELEtBQUssVUFBTCxFQUF4RCxFQUEyRSxHQUEzRTtBQUNMLGlCQUFTO0FBQ0wsb0JBQVEsa0JBQVI7U0FESjtBQUdBLGVBQU8sZUFBUyxDQUFULEVBQVk7QUFBRSxvQkFBUSxLQUFSLENBQWMsQ0FBZCxFQUFGO1NBQVo7S0FOWCxFQU9HLElBUEgsQ0FPUSxVQUFTLE1BQVQsRUFBaUI7QUFDckIsYUFBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLENBQUMsVUFBVSxFQUFWLENBQUQsQ0FBZSxHQUFmLENBQW1CLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE3QyxFQURxQjtLQUFqQixDQVBSOzs7QUE1Qm9DLFFBd0NwQyxDQUFLLE9BQUwsQ0FBYSxtQkFBYixDQUFpQyxLQUFLLFFBQUwsRUFBakMsRUFBa0Q7QUFDOUMseUJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixnQkFBSSxnQkFBZ0IsS0FBSyxjQUFMLENBQW9CLElBQUksSUFBSixDQUFwQyxDQUR1QjtBQUUzQixnQkFBSSxjQUFjLE1BQWQsRUFBc0I7QUFDdEIsOEJBQWMsQ0FBZCxFQUFpQixNQUFqQixDQUF3QixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBSSxNQUFKLENBQXBELEVBRHNCO0FBRXRCLHFCQUFLLFdBQUwsQ0FBaUIsY0FBYyxDQUFkLENBQWpCLEVBRnNCO2FBQTFCO1NBRmE7QUFPakIsc0JBQWMsb0JBQVMsR0FBVCxFQUFjO0FBQ3hCLGlCQUFLLFdBQUwsQ0FBaUIsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksS0FBSixDQUE3QyxFQUR3QjtTQUFkO0FBR2Qsd0JBQWdCLHNCQUFTLEdBQVQsRUFBYztBQUMxQixpQkFBSyxjQUFMLENBQW9CLElBQUksS0FBSixDQUFwQixDQUQwQjtTQUFkO0tBWHBCLEVBeENvQztDQUFyQjs7QUF5RG5CLElBQUksY0FBYyxTQUFkLFdBQWMsR0FBVztBQUN6QixXQUFPLE9BQU8sU0FBUCxDQUFpQixRQUFqQixDQUEwQixPQUFPLGVBQVAsQ0FBakMsQ0FEeUI7Q0FBWDs7QUFJbEIsT0FBTyxPQUFQLEdBQWlCO0FBQ2Isa0JBQWMsWUFBZDtBQUNBLGlCQUFhLFdBQWI7Q0FGSjs7O0FDbkVBOzs7OztBQUNBLElBQU0sUUFBUSxTQUFTLFNBQVQsQ0FBbUIsSUFBbkIsQ0FBd0IsSUFBeEIsQ0FBNkIsTUFBTSxTQUFOLENBQWdCLEtBQWhCLENBQXJDOztBQUVDLElBQU0sd0NBQWdCLFNBQWhCOzs7O0FBSU4sSUFBTSxzQ0FBZSxTQUFmLFlBQWUsQ0FBUyxHQUFULEVBQWM7QUFDdEMsV0FBTyxVQUFVLEdBQVYsRUFDRixJQURFLEdBRUYsV0FGRSxHQUdGLE9BSEUsQ0FHTSxHQUhOLEVBR1csR0FIWCxDQUFQLENBRHNDO0NBQWQ7Ozs7O0FBVXJCLElBQU0sd0NBQWlCLFlBQVc7QUFDckMsUUFBSSxTQUFTLENBQUMsS0FBRCxFQUFRLEtBQVIsRUFBZSxLQUFmLEVBQXNCLEtBQXRCLEVBQTZCLEtBQTdCLEVBQW9DLEtBQXBDLEVBQTJDLEtBQTNDLEVBQWtELEtBQWxELEVBQXlELEtBQXpELEVBQWdFLEtBQWhFLEVBQXVFLEtBQXZFLEVBQThFLEtBQTlFLENBQVQsQ0FEaUM7O0FBR3JDLFFBQUksTUFBTSxTQUFOLEdBQU0sQ0FBUyxHQUFULEVBQWMsS0FBZCxFQUFxQjtBQUMzQixpQkFBUyxFQUFULENBRDJCO0FBRTNCLGVBQU8sTUFBTSxNQUFOLEdBQWUsR0FBZjtBQUNILG9CQUFRLE1BQU0sS0FBTjtTQURaLE9BRU8sS0FBUCxDQUoyQjtLQUFyQixDQUgyQjs7QUFVckMsV0FBTyxVQUFTLElBQVQsRUFBZTtBQUNsQixZQUFJLENBQUMsSUFBRCxFQUNBLE9BQU8sR0FBUCxDQURKOztBQUdBLGVBQU8sT0FBTyxLQUFLLFFBQUwsRUFBUCxJQUEwQixHQUExQixHQUFnQyxJQUFJLENBQUosRUFBTyxLQUFLLE9BQUwsRUFBUCxDQUFoQyxHQUF5RCxJQUF6RCxHQUFnRSxLQUFLLFdBQUwsRUFBaEUsR0FBcUYsR0FBckYsR0FDSCxJQUFJLENBQUosRUFBTyxLQUFLLFFBQUwsRUFBUCxDQURHLEdBQ3VCLEdBRHZCLEdBQzZCLElBQUksQ0FBSixFQUFPLEtBQUssVUFBTCxFQUFQLENBRDdCLEdBQ3lELEdBRHpELEdBRUgsSUFBSSxDQUFKLEVBQU8sS0FBSyxVQUFMLEVBQVAsQ0FGRyxHQUV5QixJQUFJLENBQUosRUFBTyxLQUFLLGVBQUwsRUFBUCxDQUZ6QixDQUpXO0tBQWYsQ0FWOEI7Q0FBWCxFQUFqQjs7OztBQXNCTixJQUFNLG9DQUFjLFNBQWQsV0FBYyxDQUFTLEtBQVQsRUFBZ0I7QUFDdkMsUUFBSSxPQUFPLElBQVAsQ0FEbUM7QUFFdkMsU0FBSyxLQUFMLEdBQWEsR0FBRyxVQUFILENBQWMsS0FBZCxDQUFiLENBRnVDO0NBQWhCOztBQUszQixZQUFZLEtBQVosR0FBb0IsWUFBVztBQUMzQixXQUFPLElBQUksV0FBSixDQUFnQixhQUFoQixDQUFQLENBRDJCO0NBQVg7O0FBSXBCLFlBQVksUUFBWixHQUF1QixVQUFTLElBQVQsRUFBZTtBQUNsQyxXQUFPLElBQUksV0FBSixDQUFnQixRQUFRLEtBQUssS0FBTCxDQUEvQixDQURrQztDQUFmOzs7O0FBTWhCLElBQU0sOEJBQVcsU0FBWCxRQUFXLENBQVMsS0FBVCxFQUFnQjtBQUNwQyxRQUFJLE9BQU8sSUFBUCxDQURnQztBQUVwQyxTQUFLLEtBQUwsR0FBYSxHQUFHLFVBQUgsQ0FBYyxLQUFkLENBQWIsQ0FGb0M7O0FBSXBDLFNBQUssR0FBTCxHQUFXLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDOUIsZUFBTyxTQUFTLFdBQVQsQ0FBcUIsTUFBckIsQ0FBNEIsTUFBNUIsQ0FBbUMsS0FBSyxLQUFMLEVBQW5DLEVBQWlELEdBQWpELENBRHVCO0tBQVgsQ0FBdkIsQ0FKb0M7Q0FBaEI7Ozs7QUFXeEIsSUFBTSxnQkFBZ0IsU0FBaEIsYUFBZ0IsQ0FBUyxJQUFULEVBQWUsR0FBZixFQUFvQjtBQUN0QyxRQUFNLE9BQU8sSUFBUCxDQURnQztBQUV0QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGc0M7QUFHdEMsU0FBSyxHQUFMLEdBQVcsR0FBRyxVQUFILENBQWMsT0FBTyxHQUFQLENBQXpCLENBSHNDO0NBQXBCOzs7O0FBUWYsSUFBTSxvQ0FBYyxTQUFkLFdBQWMsQ0FBUyxFQUFULEVBQWEsSUFBYixFQUFtQixHQUFuQixFQUF3QixNQUF4QixFQUFnQyxPQUFoQyxFQUF5QyxJQUF6QyxFQUErQztBQUN0RSxRQUFJLE9BQU8sSUFBUCxDQURrRTtBQUV0RSxTQUFLLEVBQUwsR0FBVSxHQUFHLFVBQUgsQ0FBYyxFQUFkLENBQVYsQ0FGc0U7QUFHdEUsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsUUFBUSxFQUFSLENBQTFCLENBSHNFO0FBSXRFLFNBQUssR0FBTCxHQUFXLEdBQUcsVUFBSCxDQUFjLE9BQU8sRUFBUCxDQUF6QixDQUpzRTtBQUt0RSxTQUFLLE1BQUwsR0FBYyxHQUFHLFVBQUgsQ0FBYyxVQUFVLFlBQVksS0FBWixFQUFWLENBQTVCLENBTHNFO0FBTXRFLFNBQUssT0FBTCxHQUFlLEdBQUcsVUFBSCxDQUFjLE9BQWQsQ0FBZixDQU5zRTtBQU90RSxTQUFLLElBQUwsR0FBWSxHQUFHLGVBQUgsQ0FBbUIsUUFBUSxFQUFSLENBQS9CLENBUHNFOztBQVN0RSxTQUFLLEdBQUwsR0FBVyxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQzlCLGVBQU8sU0FBUyxXQUFULENBQXFCLE1BQXJCLENBQTRCLFNBQTVCLENBQXNDLEtBQUssR0FBTCxFQUF0QyxFQUFrRCxHQUFsRCxDQUR1QjtLQUFYLENBQXZCLENBVHNFOztBQWF0RSxTQUFLLEtBQUwsR0FBYSxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQ2hDLFlBQUksU0FBUyxLQUFLLE1BQUwsRUFBVCxDQUQ0QjtBQUVoQyxlQUFRLFNBQVMsT0FBTyxLQUFQLEVBQVQsR0FBMEIsYUFBMUIsQ0FGd0I7S0FBWCxDQUF6QixDQWJzRTs7QUFrQnRFLFNBQUssUUFBTCxHQUFnQixVQUFTLEtBQVQsRUFBZ0I7QUFDNUIsWUFBSSxTQUFTLEtBQUssTUFBTCxNQUFpQixZQUFZLEtBQVosRUFBakIsQ0FEZTtBQUU1QixlQUFPLEtBQVAsQ0FBYSxLQUFiLEVBRjRCO0FBRzVCLGFBQUssTUFBTCxDQUFZLE1BQVosRUFINEI7S0FBaEIsQ0FsQnNEOztBQXdCdEUsU0FBSyxjQUFMLEdBQXNCLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDekMsZUFBTyxjQUFjLEtBQUssT0FBTCxFQUFkLENBQVAsQ0FEeUM7S0FBWCxDQUFsQyxDQXhCc0U7O0FBNEJ0RSxTQUFLLE9BQUwsR0FBZSxVQUFTLElBQVQsRUFBZTtBQUMxQixZQUFJLFdBQVcsYUFBYSxLQUFLLFFBQUwsRUFBYixDQUFYLENBRHNCO0FBRTFCLGVBQVEsYUFBYSxLQUFLLEdBQUwsRUFBYixJQUEyQixLQUFLLEdBQUwsR0FBVyxPQUFYLENBQW1CLFdBQVcsR0FBWCxDQUFuQixLQUF1QyxDQUF2QyxDQUZUO0tBQWYsQ0E1QnVEOztBQWlDdEUsU0FBSyxjQUFMLEdBQXNCLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDekMsWUFBTSxRQUFRLEVBQVIsQ0FEbUM7QUFFekMsYUFBSyxHQUFMLEdBQVcsS0FBWCxDQUFpQixHQUFqQixFQUFzQixNQUF0QixDQUE2QixVQUFDLElBQUQsRUFBTyxDQUFQLEVBQWE7QUFDdEMsb0JBQVEsTUFBTSxDQUFOLENBRDhCO0FBRXRDLGtCQUFNLElBQU4sQ0FBVyxJQUFJLGFBQUosQ0FBa0IsQ0FBbEIsRUFBcUIsSUFBckIsQ0FBWCxFQUZzQztBQUd0QyxtQkFBTyxJQUFQLENBSHNDO1NBQWIsRUFJMUIsRUFKSCxFQUZ5QztBQU96QyxlQUFPLEtBQVAsQ0FQeUM7S0FBWCxDQUFsQyxDQWpDc0U7Q0FBL0M7O0FBNEMzQixZQUFZLFFBQVosR0FBdUIsVUFBUyxJQUFULEVBQWU7QUFDbEMsV0FBTyxJQUFJLFdBQUosQ0FDSCxRQUFRLEtBQUssRUFBTCxFQUNSLFFBQVEsS0FBSyxJQUFMLEVBQ1IsUUFBUSxLQUFLLEdBQUwsRUFDUixZQUFZLFFBQVosQ0FBcUIsUUFBUSxLQUFLLE1BQUwsQ0FKMUIsRUFLSCxJQUFJLElBQUosQ0FBUyxRQUFRLEtBQUssT0FBTCxDQUxkLEVBSzZCLENBQUMsUUFBUSxLQUFLLElBQUwsSUFBYSxFQUFyQixDQUFELENBQTBCLEdBQTFCLENBQThCLFVBQVMsQ0FBVCxFQUFZO0FBQ3RFLGVBQU8sSUFBSSxRQUFKLENBQWEsRUFBRSxHQUFGLENBQXBCLENBRHNFO0tBQVosQ0FMM0QsQ0FBUCxDQURrQztDQUFmOzs7O0FBYWhCLElBQU0sZ0NBQVksU0FBWixTQUFZLENBQVMsUUFBVCxFQUFtQixNQUFuQixFQUEyQixVQUEzQixFQUF1QztBQUM1RCxRQUFJLE9BQU8sSUFBUCxDQUR3RDtBQUU1RCxTQUFLLFFBQUwsR0FBZ0IsR0FBRyxVQUFILENBQWMsWUFBWSxFQUFaLENBQTlCLENBRjREO0FBRzVELFNBQUssTUFBTCxHQUFjLEdBQUcsVUFBSCxDQUFjLFVBQVUsWUFBWSxLQUFaLEVBQVYsQ0FBNUIsQ0FINEQ7QUFJNUQsU0FBSyxVQUFMLEdBQWtCLEdBQUcsVUFBSCxDQUFjLFVBQWQsQ0FBbEIsQ0FKNEQ7O0FBTTVELFNBQUssS0FBTCxHQUFhLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDaEMsWUFBSSxTQUFTLEtBQUssTUFBTCxFQUFULENBRDRCO0FBRWhDLGVBQVEsU0FBUyxPQUFPLEtBQVAsRUFBVCxHQUEwQixhQUExQixDQUZ3QjtLQUFYLENBQXpCLENBTjREO0NBQXZDOztBQVl6QixVQUFVLFFBQVYsR0FBcUIsVUFBUyxJQUFULEVBQWU7QUFDaEMsV0FBTyxJQUFJLFNBQUosQ0FDSCxRQUFRLEtBQUssUUFBTCxFQUNSLFlBQVksUUFBWixDQUFxQixRQUFRLEtBQUssTUFBTCxDQUYxQixFQUdILFFBQVEsS0FBSyxVQUFMLENBSFosQ0FEZ0M7Q0FBZjs7OztBQVNkLElBQU0sa0NBQWEsU0FBYixVQUFhLENBQVMsR0FBVCxFQUFjO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssR0FBTCxHQUFXLEdBQUcsVUFBSCxDQUFjLEdBQWQsQ0FBWCxDQUZvQztBQUdwQyxTQUFLLFFBQUwsR0FBZ0IsR0FBRyxlQUFILEVBQWhCLENBSG9DOztBQUtwQyxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxLQUFULEVBQWdCO0FBQzVCLGFBQUssUUFBTCxDQUFjLE1BQWQsQ0FBcUIsVUFBUyxDQUFULEVBQVk7QUFDN0IsbUJBQU8sRUFBRSxHQUFGLE9BQVksTUFBTSxHQUFOLEVBQVosQ0FEc0I7U0FBWixDQUFyQixDQUQ0QjtBQUk1QixhQUFLLFFBQUwsQ0FBYyxPQUFkLENBQXNCLEtBQXRCLEVBSjRCO0tBQWhCLENBTG9CO0NBQWQ7Ozs7QUN2SjFCOzs7OztBQUVPLElBQU0sOENBQW1CLFNBQW5CLGdCQUFtQixDQUFDLFdBQUQsRUFBaUI7QUFDN0MsV0FBTyxZQUFZLE1BQVosQ0FBbUIsQ0FBbkIsRUFBc0IsS0FBdEIsQ0FBNEIsR0FBNUIsRUFDRixNQURFLENBQ0ssVUFBUyxJQUFULEVBQWUsSUFBZixFQUFxQjtBQUN6QixZQUFJLEtBQUssS0FBSyxLQUFMLENBQVcsR0FBWCxDQUFMLENBRHFCO0FBRXpCLFlBQUksSUFBSSxHQUFHLENBQUgsQ0FBSixDQUZxQjtBQUd6QixZQUFJLElBQUksbUJBQW1CLEdBQUcsQ0FBSCxDQUFuQixDQUFKLENBSHFCO0FBSXpCLFlBQUksS0FBSyxJQUFMLEVBQVcsS0FBSyxDQUFMLEVBQVEsSUFBUixDQUFhLENBQWIsRUFBZixLQUFxQyxLQUFLLENBQUwsSUFBVSxDQUFDLENBQUQsQ0FBVixDQUFyQztBQUNBLGVBQU8sSUFBUCxDQUx5QjtLQUFyQixFQU1MLEVBUEEsQ0FBUCxDQUQ2QztDQUFqQjs7QUFXekIsSUFBTSwwQ0FBaUIsU0FBakIsY0FBaUIsR0FBTTtBQUNoQyxXQUFPLGlCQUFpQixPQUFPLFFBQVAsQ0FBZ0IsTUFBaEIsQ0FBeEIsQ0FEZ0M7Q0FBTjs7QUFJdkIsSUFBTSxrQ0FBYSxTQUFiLFVBQWEsQ0FBQyxHQUFELEVBQVM7QUFDOUIsUUFDSSxJQURKLENBQ1MsVUFEVCxFQUNxQixJQURyQixFQUVJLFFBRkosQ0FFYSxZQUZiLEVBR1EsUUFIUixDQUdpQiw2Q0FIakIsRUFEOEI7Q0FBVDs7QUFPbkIsSUFBTSxzQ0FBZSxTQUFmLFlBQWUsQ0FBQyxHQUFELEVBQVM7QUFDakMsUUFDSSxJQURKLENBQ1MsVUFEVCxFQUNxQixLQURyQixFQUVJLFFBRkosQ0FFYSxZQUZiLEVBR1EsV0FIUixDQUdvQiw4Q0FIcEIsRUFEaUM7Q0FBVDs7O0FDeEI1Qjs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCO0FBQ04sSUFBTSxvQkFBb0IsUUFBUSxxQkFBUixDQUFwQjtBQUNOLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDs7QUFFTixJQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsSUFBVCxFQUFlLE1BQWYsRUFBdUI7QUFDdEMsUUFBSSxPQUFPLElBQVAsQ0FEa0M7QUFFdEMsc0JBQWtCLFlBQWxCLENBQStCLElBQS9CLENBQW9DLElBQXBDLEVBQTBDLElBQTFDLEVBRnNDO0NBQXZCOztBQUtuQixJQUFJLFlBQVksU0FBWixTQUFZLEdBQVc7QUFDdkIsUUFBSSxPQUFPLG1CQUFtQixPQUFPLFFBQVAsQ0FBZ0IsUUFBaEIsQ0FBbkIsQ0FBNkMsS0FBN0MsQ0FBbUQsU0FBbkQsQ0FBUCxDQURtQjtBQUV2QixXQUFRLElBQUMsSUFBUSxLQUFLLENBQUwsQ0FBUixJQUFvQixFQUFyQixDQUZlO0NBQVg7O0FBS2hCLEVBQUUsWUFBVTtBQUNSLFFBQUksUUFBUSxJQUFJLFlBQUosQ0FDUixrQkFBa0IsV0FBbEIsRUFEUSxDQUFSLENBREk7O0FBSVIsTUFBRSxzQkFBRixFQUEwQixLQUExQixDQUFnQyxVQUFTLENBQVQsRUFBWTtBQUN4QyxZQUFJLE1BQU0sRUFBRSxJQUFGLENBQU4sQ0FEb0M7QUFFeEMsZUFBTyxVQUFQLENBQWtCLEdBQWxCLEVBRndDOztBQUl4QyxZQUFJLFNBQVMsV0FBVCxDQUpvQztBQUt4QyxZQUFJLGNBQWMsT0FBTyxXQUFQLENBQW1CLEdBQW5CLENBQWQsQ0FMb0M7QUFNeEMsWUFBSSxTQUFTLE9BQU8sS0FBUCxDQUFhLENBQWIsRUFBZ0IsV0FBaEIsQ0FBVCxDQU5vQztBQU94QyxZQUFJLE9BQU8sT0FBTyxLQUFQLENBQWEsY0FBYyxDQUFkLENBQWIsQ0FBOEIsSUFBOUIsRUFBUCxDQVBvQztBQVF4QyxZQUFJLE1BQU0sU0FBUyxHQUFULEdBQWUsSUFBZixDQVI4QjtBQVN4QyxVQUFFLElBQUYsQ0FBTztBQUNILGtCQUFNLEtBQU47QUFDQSxpQkFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGVBQXpDLEdBQTJELEdBQTNEO0FBQ0wseUJBQWEsa0JBQWI7QUFDQSxrQkFBTSxLQUFLLFNBQUwsQ0FBZTtBQUNuQixzQkFBTSxJQUFOO0FBQ0EscUJBQUssR0FBTDthQUZJLENBQU47QUFJQSxtQkFBTyxlQUFTLENBQVQsRUFBWTtBQUNmLHVCQUFPLFlBQVAsQ0FBb0IsR0FBcEIsRUFEZTthQUFaO1NBUlgsRUFZQyxJQVpELENBWU0sVUFBUyxNQUFULEVBQWlCO0FBQ25CLGdCQUFJLFVBQVUsQ0FBQyxPQUFPLEtBQVAsRUFBYztBQUN6Qix5QkFBUyxRQUFULENBQWtCLElBQWxCLEdBQXlCLFNBQVMsV0FBVCxDQUFxQixNQUFyQixDQUE0QixTQUE1QixDQUFzQyxPQUFPLEdBQVAsQ0FBdEMsQ0FBa0QsR0FBbEQsQ0FEQTthQUE3QixNQUVPO0FBQ0gsdUJBQU8sWUFBUCxDQUFvQixHQUFwQixFQURHO2FBRlA7U0FERSxDQVpOLENBVHdDO0tBQVosQ0FBaEMsQ0FKUTs7QUFrQ1IsT0FBRyxhQUFILENBQWlCLEtBQWpCLEVBbENRO0NBQVYsQ0FBRjs7O0FDaEJBOztBQUNBLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDs7QUFHTixJQUFJLGFBQWEsU0FBYixVQUFhLEdBQVc7QUFDeEIsUUFBSSxTQUFTLE9BQU8sUUFBUCxDQUFnQixRQUFoQixLQUE2QixRQUE3QixDQURXO0FBRXhCLFdBQU8sQ0FBQyxTQUFTLEtBQVQsR0FBaUIsSUFBakIsQ0FBRCxHQUEwQixLQUExQixHQUFrQyxPQUFPLFFBQVAsQ0FBZ0IsSUFBaEIsR0FBdUIsUUFBekQsQ0FGaUI7Q0FBWDs7OztBQU9qQixJQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLFFBQUksT0FBTyxJQUFQLENBRHVCO0FBRTNCLFNBQUssT0FBTCxHQUFlLEVBQWYsQ0FGMkI7QUFHM0IsU0FBSyxXQUFMLEdBQW1CLEVBQW5CLENBSDJCOztBQUszQixRQUFJLGlCQUFpQixTQUFqQixjQUFpQixDQUFTLEdBQVQsRUFBYztBQUMvQixZQUFJLENBQUMsR0FBRCxJQUFRLENBQUMsSUFBSSxJQUFKLEVBQ1QsT0FESjs7QUFHQSxZQUFJLE9BQU8sSUFBSSxJQUFKLENBSm9CO0FBSy9CLFlBQUksU0FBVSxJQUFJLE1BQUosR0FBYSxLQUFLLFdBQUwsQ0FBaUIsSUFBSSxNQUFKLENBQTlCLEdBQTRDLEtBQUssT0FBTCxDQUFhLElBQUksSUFBSixDQUF6RCxDQUxpQjtBQU0vQixTQUFDLFNBQVMsT0FBTyxTQUFQLEdBQW1CLEVBQTVCLENBQUQsQ0FBaUMsT0FBakMsQ0FBeUMsVUFBUyxDQUFULEVBQVk7QUFDakQsZ0JBQUksRUFBRSxJQUFGLENBQUosRUFDSSxFQUFFLElBQUYsRUFBUSxHQUFSLEVBREo7U0FEcUMsQ0FBekMsQ0FOK0I7S0FBZCxDQUxNOztBQWlCM0IsU0FBSyxLQUFMLEdBQWEsS0FBYixDQWpCMkI7O0FBbUIzQixRQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLFlBQUksU0FBUyxJQUFJLFNBQUosQ0FBYyxZQUFkLENBQVQsQ0FEdUI7O0FBRzNCLGVBQU8sTUFBUCxHQUFnQixVQUFTLENBQVQsRUFBWTtBQUN4QixpQkFBSyxLQUFMLEdBQWEsSUFBYixDQUR3QjtBQUV4QixnQkFBSSxnQkFBZ0IsT0FBTyxJQUFQLENBQVksS0FBSyxPQUFMLENBQTVCLENBRm9CO0FBR3hCLGdCQUFJLGNBQWMsTUFBZCxFQUFzQjtBQUN0Qix1QkFBTyxJQUFQLENBQVksS0FBSyxTQUFMLENBQWU7QUFDdkIsNEJBQVEsV0FBUjtBQUNBLDBCQUFNLGFBQU47aUJBRlEsQ0FBWixFQURzQjthQUExQjs7QUFPQSxnQkFBSSxvQkFBb0IsT0FBTyxJQUFQLENBQVksS0FBSyxXQUFMLENBQWhDLENBVm9CO0FBV3hCLGdCQUFJLGtCQUFrQixNQUFsQixFQUEwQjtBQUMxQixrQ0FBa0IsT0FBbEIsQ0FBMEIsVUFBUyxDQUFULEVBQVk7QUFDbEMsMkJBQU8sSUFBUCxDQUFZLEtBQUssU0FBTCxDQUFlO0FBQ3ZCLGdDQUFRLHFCQUFSO0FBQ0EsOEJBQU0sQ0FBTjtxQkFGUSxDQUFaLEVBRGtDO2lCQUFaLENBQTFCLENBRDBCO2FBQTlCO1NBWFksQ0FIVzs7QUF3QjNCLGVBQU8sU0FBUCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsZ0JBQUksT0FBTyxLQUFLLEtBQUwsQ0FBVyxNQUFNLElBQU4sQ0FBbEIsQ0FEMkI7QUFFL0IsZ0JBQUksSUFBSixFQUNJLGVBQWUsSUFBZixFQURKO1NBRmUsQ0F4QlE7O0FBOEIzQixlQUFPLE9BQVAsR0FBaUIsWUFBVztBQUN4QixvQkFBUSxHQUFSLENBQVksUUFBWixFQUR3QjtBQUV4QixnQkFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLHFCQUFLLEtBQUwsR0FBYSxLQUFiLENBRFk7QUFFWixxQkFBSyxNQUFMLEdBQWMsZUFBZCxDQUZZO2FBQWhCO1NBRmEsQ0E5QlU7S0FBWCxDQW5CTzs7QUEwRDNCLFNBQUssTUFBTCxHQUFjLGVBQWQsQ0ExRDJCO0NBQVg7O0FBNkRwQixjQUFjLFNBQWQsQ0FBd0IsU0FBeEIsR0FBb0MsVUFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUN6RCxTQUFLLFlBQUwsQ0FBa0IsQ0FBQyxJQUFELENBQWxCLEVBQTBCLFFBQTFCLEVBRHlEO0NBQXpCOztBQUlwQyxjQUFjLFNBQWQsQ0FBd0IsWUFBeEIsR0FBdUMsVUFBUyxLQUFULEVBQWdCLFFBQWhCLEVBQTBCO0FBQzdELFFBQUksT0FBTyxJQUFQLENBRHlEOztBQUc3RCxRQUFJLG1CQUFtQixFQUFuQixDQUh5RDtBQUk3RCxVQUFNLEdBQU4sQ0FBVSxPQUFPLFlBQVAsQ0FBVixDQUErQixPQUEvQixDQUF1QyxVQUFTLElBQVQsRUFBZTtBQUNsRCxZQUFJLFVBQVUsS0FBSyxPQUFMLENBQWEsSUFBYixDQUFWLENBRDhDO0FBRWxELFlBQUksT0FBSixFQUFhO0FBQ1Qsb0JBQVEsU0FBUixDQUFrQixJQUFsQixDQUF1QixRQUF2QixFQURTO1NBQWIsTUFFTztBQUNILGlCQUFLLE9BQUwsQ0FBYSxJQUFiLElBQXFCLEVBQUUsV0FBVyxDQUFDLFFBQUQsQ0FBWCxFQUF2QixDQURHO0FBRUgsNkJBQWlCLElBQWpCLENBQXNCLElBQXRCLEVBRkc7U0FGUDtLQUZtQyxDQUF2QyxDQUo2RDs7QUFjN0QsUUFBSSxpQkFBaUIsTUFBakIsRUFBeUI7QUFDekIsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLFdBQVI7QUFDQSxzQkFBTSxnQkFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FESjtDQWRtQzs7QUF3QnZDLGNBQWMsU0FBZCxDQUF3QixtQkFBeEIsR0FBOEMsVUFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUNuRSxRQUFJLE9BQU8sSUFBUCxDQUQrRDtBQUVuRSxXQUFPLE9BQU8sWUFBUCxDQUFvQixJQUFwQixDQUFQLENBRm1FOztBQUluRSxRQUFJLFVBQVUsS0FBSyxXQUFMLENBQWlCLElBQWpCLENBQVYsQ0FKK0Q7QUFLbkUsUUFBSSxPQUFKLEVBQWE7QUFDVCxnQkFBUSxTQUFSLENBQWtCLElBQWxCLENBQXVCLFFBQXZCLEVBRFM7S0FBYixNQUVPO0FBQ0gsYUFBSyxXQUFMLENBQWlCLElBQWpCLElBQXlCLEVBQUUsV0FBVyxDQUFDLFFBQUQsQ0FBWCxFQUEzQixDQURHO0FBRUgsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLHFCQUFSO0FBQ0Esc0JBQU0sSUFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FKSjtDQUwwQzs7QUFtQjlDLE9BQU8sT0FBUCxHQUFpQjtBQUNiLG1CQUFlLGFBQWY7Q0FESiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZS1zdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5jb25zdCBzdHJlYW1fbWFuYWdlciA9IHJlcXVpcmUoJy4vc3RyZWFtX21hbmFnZXInKTtcblxuLyoqXG4qL1xudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHBhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyID0ga28ub2JzZXJ2YWJsZSh1c2VyKTtcbiAgICBzZWxmLnBhZ2UgPSBrby5vYnNlcnZhYmxlKHBhZ2UpO1xuICAgIHNlbGYuZmF2b3JpdGVzID0ga28ub2JzZXJ2YWJsZShuZXcgbW9kZWxzLkNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpKSk7XG5cbiAgICBzZWxmLm1hbmFnZXIgPSBuZXcgc3RyZWFtX21hbmFnZXIuU3RyZWFtTWFuYWdlcigpO1xuXG4gICAgc2VsZi5hZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgc3RhdHVzIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi51c2VyKCkuc3RhdHVzKG5ldyBtb2RlbHMuU3RhdHVzTW9kZWwobXNnLnN0YXR1cy5jb2xvcikpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgIXVzZXIucm9vdFN0cmVhbSgpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGRyZW4odXNlci5yb290U3RyZWFtKCkpLnVybCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkgeyBjb25zb2xlLmVycm9yKGUpOyB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgY29sbGVjdGlvbiB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZUNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmZyb20pO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ2hpbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZXhpc3RpbmdDaGlsZFswXS5zdGF0dXMobW9kZWxzLlN0YXR1c01vZGVsLmZyb21Kc29uKG1zZy5zdGF0dXMpKTtcbiAgICAgICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmNoaWxkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxudmFyIGluaXRpYWxVc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5Vc2VyTW9kZWwuZnJvbUpzb24od2luZG93LmluaXRpYWxVc2VyRGF0YSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBBcHBWaWV3TW9kZWw6IEFwcFZpZXdNb2RlbCxcbiAgICBpbml0aWFsVXNlcjogaW5pdGlhbFVzZXJcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IHNsaWNlID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xPUiA9ICcjNzc3Nzc3JztcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBub3JtYWxpemVVcmkgPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHVyaSlcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgnICcsICcvJyk7XG59O1xuXG4vKipcbiAgICBQcmV0dHkgcHJpbnRzIGEgZGF0YS5cbiovXG5leHBvcnQgY29uc3QgZGF0ZVRvRGlzcGxheSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4gICAgdmFyIHBhZCA9IGZ1bmN0aW9uKG1pbiwgaW5wdXQpIHtcbiAgICAgICAgaW5wdXQgKz0gJyc7XG4gICAgICAgIHdoaWxlIChpbnB1dC5sZW5ndGggPCBtaW4pXG4gICAgICAgICAgICBpbnB1dCA9ICcwJyArIGlucHV0O1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihkYXRlKSB7XG4gICAgICAgIGlmICghZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnLSc7XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoc1tkYXRlLmdldE1vbnRoKCldICsgJyAnICsgcGFkKDIsIGRhdGUuZ2V0RGF0ZSgpKSArICcsICcgKyBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnICcgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0SG91cnMoKSkgKyAnOicgKyBwYWQoMiwgZGF0ZS5nZXRNaW51dGVzKCkpICsgJy4nICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldFNlY29uZHMoKSkgKyBwYWQoMywgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgfTtcbn0oKSk7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RhdHVzTW9kZWwgPSBmdW5jdGlvbihjb2xvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmNvbG9yID0ga28ub2JzZXJ2YWJsZShjb2xvcik7XG59O1xuXG5TdGF0dXNNb2RlbC5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoREVGQVVMVF9DT0xPUik7XG59O1xuXG5TdGF0dXNNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKGRhdGEgJiYgZGF0YS5jb2xvcik7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFRhZ01vZGVsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi52YWx1ZSA9IGtvLm9ic2VydmFibGUodmFsdWUpO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRUYWcoc2VsZi52YWx1ZSgpKS51cmw7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xuY29uc3QgUGF0aENvbXBvbmVudCA9IGZ1bmN0aW9uKG5hbWUsIHVyaSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKCcvcycgKyB1cmkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1Nb2RlbCA9IGZ1bmN0aW9uKGlkLCBuYW1lLCB1cmksIHN0YXR1cywgdXBkYXRlZCwgdGFncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmlkID0ga28ub2JzZXJ2YWJsZShpZCk7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lIHx8ICcnKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYudXBkYXRlZCA9IGtvLm9ic2VydmFibGUodXBkYXRlZCk7XG4gICAgc2VsZi50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KHRhZ3MgfHwgW10pO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0oc2VsZi51cmkoKSkudXJsO1xuICAgIH0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpIHx8IFN0YXR1c01vZGVsLmVtcHR5KCk7XG4gICAgICAgIHN0YXR1cy5jb2xvcihjb2xvcik7XG4gICAgICAgIHNlbGYuc3RhdHVzKHN0YXR1cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZGlzcGxheVVwZGF0ZWQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRhdGVUb0Rpc3BsYXkoc2VsZi51cGRhdGVkKCkpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5pc093bmVyID0gZnVuY3Rpb24odXNlcikge1xuICAgICAgICB2YXIgb3duZXJVcmkgPSBub3JtYWxpemVVcmkodXNlci51c2VyTmFtZSgpKTtcbiAgICAgICAgcmV0dXJuIChvd25lclVyaSA9PT0gc2VsZi51cmkoKSB8fCBzZWxmLnVyaSgpLmluZGV4T2Yob3duZXJVcmkgKyAnLycpID09PSAwKTtcbiAgICB9O1xuXG4gICAgc2VsZi5wYXRoQ29tcG9uZW50cyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBwYXRocyA9IFtdO1xuICAgICAgICBzZWxmLnVyaSgpLnNwbGl0KCcvJykucmVkdWNlKChwYXRoLCBjKSA9PiB7XG4gICAgICAgICAgICBwYXRoICs9ICcvJyArIGM7XG4gICAgICAgICAgICBwYXRocy5wdXNoKG5ldyBQYXRoQ29tcG9uZW50KGMsIHBhdGgpKTtcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICB9LCAnJyk7XG4gICAgICAgIHJldHVybiBwYXRocztcbiAgICB9KTtcbn07XG5cblN0cmVhbU1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS5pZCxcbiAgICAgICAgZGF0YSAmJiBkYXRhLm5hbWUsXG4gICAgICAgIGRhdGEgJiYgZGF0YS51cmksXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBuZXcgRGF0ZShkYXRhICYmIGRhdGEudXBkYXRlZCksIChkYXRhICYmIGRhdGEudGFncyB8fCBbXSkubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGFnTW9kZWwoeC50YWcpO1xuICAgICAgICB9KSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFVzZXJNb2RlbCA9IGZ1bmN0aW9uKHVzZXJOYW1lLCBzdGF0dXMsIHJvb3RTdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyTmFtZSA9IGtvLm9ic2VydmFibGUodXNlck5hbWUgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi5yb290U3RyZWFtID0ga28ub2JzZXJ2YWJsZShyb290U3RyZWFtKTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcbn07XG5cblVzZXJNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFVzZXJNb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVzZXJOYW1lLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnJvb3RTdHJlYW0pO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBDb2xsZWN0aW9uID0gZnVuY3Rpb24odXJpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGQudXJpKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpO1xuICAgIH07XG59O1xuIiwiXCJ1c2Utc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBwYXJzZVF1ZXJ5U3RyaW5nID0gKHF1ZXJ5U3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHF1ZXJ5U3RyaW5nLnN1YnN0cigxKS5zcGxpdChcIiZcIilcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihkaWN0LCBpdGVtKSB7XG4gICAgICAgICAgICB2YXIga3YgPSBpdGVtLnNwbGl0KFwiPVwiKTtcbiAgICAgICAgICAgIHZhciBrID0ga3ZbMF07XG4gICAgICAgICAgICB2YXIgdiA9IGRlY29kZVVSSUNvbXBvbmVudChrdlsxXSk7XG4gICAgICAgICAgICBpZiAoayBpbiBkaWN0KSBkaWN0W2tdLnB1c2godik7IGVsc2UgZGljdFtrXSA9IFt2XTtcbiAgICAgICAgICAgIHJldHVybiBkaWN0O1xuICAgICAgICB9LCB7fSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0UXVlcnlTdHJpbmcgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHBhcnNlUXVlcnlTdHJpbmcod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59O1xuXG5leHBvcnQgY29uc3QgbG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgICAgIC5hZGRDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcblxuZXhwb3J0IGNvbnN0IHVubG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICBzZWxcbiAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5jb25zdCBzdHJlYW1fbWFuYWdlciA9IHJlcXVpcmUoJy4vc3RyZWFtX21hbmFnZXInKTtcbmNvbnN0IGFwcGxpY2F0aW9uX21vZGVsID0gcmVxdWlyZSgnLi9hcHBsaWNhdGlvbl9tb2RlbCcpO1xuY29uc3Qgc2hhcmVkID0gcmVxdWlyZSgnLi9zaGFyZWQnKTtcblxudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcbn07XG5cbnZhciBnZXRUYXJnZXQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGF0aCA9IGRlY29kZVVSSUNvbXBvbmVudCh3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUpLm1hdGNoKCcvcy8oLispJyk7XG4gICAgcmV0dXJuICgocGF0aCAmJiBwYXRoWzFdKSB8fCAnJyk7XG59O1xuXG4kKGZ1bmN0aW9uKCl7XG4gICAgdmFyIG1vZGVsID0gbmV3IEFwcFZpZXdNb2RlbChcbiAgICAgICAgYXBwbGljYXRpb25fbW9kZWwuaW5pdGlhbFVzZXIoKSk7XG5cbiAgICAkKCcuY3JlYXRlLWNoaWxkLWJ1dHRvbicpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIGJ0biA9ICQodGhpcyk7XG4gICAgICAgIHNoYXJlZC5sb2NrQnV0dG9uKGJ0bik7XG5cbiAgICAgICAgdmFyIHJhd1VyaSA9IGdldFRhcmdldCgpO1xuICAgICAgICB2YXIgcGFyZW50SW5kZXggPSByYXdVcmkubGFzdEluZGV4T2YoJy8nKTtcbiAgICAgICAgdmFyIHBhcmVudCA9IHJhd1VyaS5zbGljZSgwLCBwYXJlbnRJbmRleCk7XG4gICAgICAgIHZhciBuYW1lID0gcmF3VXJpLnNsaWNlKHBhcmVudEluZGV4ICsgMSkudHJpbSgpO1xuICAgICAgICB2YXIgdXJpID0gcGFyZW50ICsgXCIvXCIgKyBuYW1lO1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJQVVRcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVTdHJlYW0oKS51cmwsXG4gICAgICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICB1cmk6IHVyaVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHNoYXJlZC51bmxvY2tCdXR0b24oYnRuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAocmVzdWx0ICYmICFyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5sb2NhdGlvbi5ocmVmID0ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShyZXN1bHQudXJpKS51cmw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNoYXJlZC51bmxvY2tCdXR0b24oYnRuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBrby5hcHBseUJpbmRpbmdzKG1vZGVsKTtcbn0pOyIsIlwidXNlIHN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcblxuXG52YXIgc29ja2V0UGF0aCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWN1cmUgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwczonO1xuICAgIHJldHVybiAoc2VjdXJlID8gJ3dzcycgOiAnd3MnKSArICc6Ly8nICsgd2luZG93LmxvY2F0aW9uLmhvc3QgKyAnL3YwL3dzJztcbn07XG5cbi8qKlxuKi9cbnZhciBTdHJlYW1NYW5hZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuc3RyZWFtcyA9IHsgfTtcbiAgICBzZWxmLmNvbGxlY3Rpb25zID0geyB9O1xuXG4gICAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgdHlwZSA9IG1zZy50eXBlO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gKG1zZy5zb3VyY2UgPyBzZWxmLmNvbGxlY3Rpb25zW21zZy5zb3VyY2VdIDogc2VsZi5zdHJlYW1zW21zZy5mcm9tXSk7XG4gICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgaWYgKHhbdHlwZV0pXG4gICAgICAgICAgICAgICAgeFt0eXBlXShtc2cpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgdmFyIG9wZW5XZWJzb2NrZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc29ja2V0UGF0aCgpKTtcblxuICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0U3RyZWFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHRhcmdldFN0cmVhbXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0YXJnZXRDb2xsZWN0aW9ucyA9IE9iamVjdC5rZXlzKHNlbGYuY29sbGVjdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGRhdGEpXG4gICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVBbGwgPSBmdW5jdGlvbihwYXRocywgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHsgbGlzdGVuZXJzOiBbY2FsbGJhY2tdIH07XG4gICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBuZXdTdWJzY3JpcHRpb25zXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVDb2xsZWN0aW9uID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uc1twYXRoXSA9IHsgbGlzdGVuZXJzOiBbY2FsbGJhY2tdIH07XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBwYXRoXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIFN0cmVhbU1hbmFnZXI6IFN0cmVhbU1hbmFnZXJcbn07XG4iXX0=
