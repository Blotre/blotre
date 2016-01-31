(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.initialUser = exports.AppViewModel = undefined;

var _models = require('./models');

var models = _interopRequireWildcard(_models);

var _stream_manager = require('./stream_manager');

var stream_manager = _interopRequireWildcard(_stream_manager);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 */
var AppViewModel = exports.AppViewModel = function AppViewModel(user, page) {
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

var initialUser = exports.initialUser = function initialUser() {
    return models.UserModel.fromJson(window.initialUserData);
};

},{"./models":2,"./stream_manager":5}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var slice = Function.prototype.call.bind(Array.prototype.slice);

var DEFAULT_COLOR = exports.DEFAULT_COLOR = "#777777";

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

var _models = require('./models');

var models = _interopRequireWildcard(_models);

var _stream_manager = require('./stream_manager');

var stream_manager = _interopRequireWildcard(_stream_manager);

var _application_model = require('./application_model');

var application_model = _interopRequireWildcard(_application_model);

var _shared = require('./shared');

var shared = _interopRequireWildcard(_shared);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.StreamManager = undefined;

var _models = require('./models');

var models = _interopRequireWildcard(_models);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var socketPath = function socketPath() {
    var secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws';
};

/**
 */
var StreamManager = exports.StreamManager = function StreamManager() {
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
};

StreamManager.prototype.subscribeCollection = function (path, callback) {
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
};

},{"./models":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fY3JlYXRlX2NoaWxkLmpzIiwiY2xpZW50L2pzL3N0cmVhbV9tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7Ozs7Ozs7OztJQUNZOzs7O0lBQ0E7Ozs7OztBQUlMLElBQU0sc0NBQWUsU0FBZixZQUFlLENBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUI7QUFDN0MsUUFBSSxPQUFPLElBQVAsQ0FEeUM7QUFFN0MsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBRjZDO0FBRzdDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUg2QztBQUk3QyxTQUFLLFNBQUwsR0FBaUIsR0FBRyxVQUFILENBQWMsSUFBSSxPQUFPLFVBQVAsQ0FBa0IsS0FBSyxRQUFMLEVBQXRCLENBQWQsQ0FBakIsQ0FKNkM7O0FBTTdDLFNBQUssT0FBTCxHQUFlLElBQUksZUFBZSxhQUFmLEVBQW5CLENBTjZDOztBQVE3QyxTQUFLLFdBQUwsR0FBbUIsVUFBUyxLQUFULEVBQWdCO0FBQy9CLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixLQUExQixFQUQrQjtLQUFoQixDQVIwQjs7QUFZN0MsU0FBSyxjQUFMLEdBQXNCLFVBQVMsUUFBVCxFQUFtQjtBQUNyQyxlQUFPLEtBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixNQUExQixDQUFpQyxVQUFTLENBQVQsRUFBWTtBQUNoRCxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHlDO1NBQVosQ0FBeEMsQ0FEcUM7S0FBbkI7OztBQVp1QixRQW1CN0MsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7QUFDcEMseUJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixpQkFBSyxJQUFMLEdBQVksTUFBWixDQUFtQixJQUFJLE9BQU8sV0FBUCxDQUFtQixJQUFJLE1BQUosQ0FBVyxLQUFYLENBQTFDLEVBRDJCO1NBQWQ7S0FEckIsRUFuQjZDOztBQXlCN0MsUUFBSSxDQUFDLElBQUQsSUFBUyxDQUFDLEtBQUssVUFBTCxFQUFELEVBQ1QsT0FESjs7QUFHQSxNQUFFLElBQUYsQ0FBTztBQUNILGNBQU0sS0FBTjtBQUNBLGFBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxjQUF6QyxDQUF3RCxLQUFLLFVBQUwsRUFBeEQsRUFBMkUsR0FBM0U7QUFDTCxpQkFBUztBQUNMLG9CQUFRLGtCQUFSO1NBREo7QUFHQSxlQUFPLGVBQVMsQ0FBVCxFQUFZO0FBQ2Ysb0JBQVEsS0FBUixDQUFjLENBQWQsRUFEZTtTQUFaO0tBTlgsRUFTRyxJQVRILENBU1EsVUFBUyxNQUFULEVBQWlCO0FBQ3JCLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixDQUFDLFVBQVUsRUFBVixDQUFELENBQWUsR0FBZixDQUFtQixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBN0MsRUFEcUI7S0FBakIsQ0FUUjs7O0FBNUI2QyxRQTBDN0MsQ0FBSyxPQUFMLENBQWEsbUJBQWIsQ0FBaUMsS0FBSyxRQUFMLEVBQWpDLEVBQWtEO0FBQzlDLHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsZ0JBQUksZ0JBQWdCLEtBQUssY0FBTCxDQUFvQixJQUFJLElBQUosQ0FBcEMsQ0FEdUI7QUFFM0IsZ0JBQUksY0FBYyxNQUFkLEVBQXNCO0FBQ3RCLDhCQUFjLENBQWQsRUFBaUIsTUFBakIsQ0FBd0IsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksTUFBSixDQUFwRCxFQURzQjtBQUV0QixxQkFBSyxXQUFMLENBQWlCLGNBQWMsQ0FBZCxDQUFqQixFQUZzQjthQUExQjtTQUZhO0FBT2pCLHNCQUFjLG9CQUFTLEdBQVQsRUFBYztBQUN4QixpQkFBSyxXQUFMLENBQWlCLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE0QixJQUFJLEtBQUosQ0FBN0MsRUFEd0I7U0FBZDtBQUdkLHdCQUFnQixzQkFBUyxHQUFULEVBQWM7QUFDMUIsaUJBQUssY0FBTCxDQUFvQixJQUFJLEtBQUosQ0FBcEIsQ0FEMEI7U0FBZDtLQVhwQixFQTFDNkM7Q0FBckI7O0FBMkRyQixJQUFNLG9DQUFjLFNBQWQsV0FBYyxHQUFXO0FBQ2xDLFdBQU8sT0FBTyxTQUFQLENBQWlCLFFBQWpCLENBQTBCLE9BQU8sZUFBUCxDQUFqQyxDQURrQztDQUFYOzs7QUNqRTNCOzs7OztBQUNBLElBQU0sUUFBUSxTQUFTLFNBQVQsQ0FBbUIsSUFBbkIsQ0FBd0IsSUFBeEIsQ0FBNkIsTUFBTSxTQUFOLENBQWdCLEtBQWhCLENBQXJDOztBQUVDLElBQU0sd0NBQWdCLFNBQWhCOzs7O0FBSU4sSUFBTSxzQ0FBZSxTQUFmLFlBQWUsQ0FBUyxHQUFULEVBQWM7QUFDdEMsV0FBTyxVQUFVLEdBQVYsRUFDRixJQURFLEdBRUYsV0FGRSxHQUdGLE9BSEUsQ0FHTSxHQUhOLEVBR1csR0FIWCxDQUFQLENBRHNDO0NBQWQ7Ozs7O0FBVXJCLElBQU0sd0NBQWlCLFlBQVc7QUFDckMsUUFBSSxTQUFTLENBQUMsS0FBRCxFQUFRLEtBQVIsRUFBZSxLQUFmLEVBQXNCLEtBQXRCLEVBQTZCLEtBQTdCLEVBQW9DLEtBQXBDLEVBQTJDLEtBQTNDLEVBQWtELEtBQWxELEVBQXlELEtBQXpELEVBQWdFLEtBQWhFLEVBQXVFLEtBQXZFLEVBQThFLEtBQTlFLENBQVQsQ0FEaUM7O0FBR3JDLFFBQUksTUFBTSxTQUFOLEdBQU0sQ0FBUyxHQUFULEVBQWMsS0FBZCxFQUFxQjtBQUMzQixpQkFBUyxFQUFULENBRDJCO0FBRTNCLGVBQU8sTUFBTSxNQUFOLEdBQWUsR0FBZjtBQUNILG9CQUFRLE1BQU0sS0FBTjtTQURaLE9BRU8sS0FBUCxDQUoyQjtLQUFyQixDQUgyQjs7QUFVckMsV0FBTyxVQUFTLElBQVQsRUFBZTtBQUNsQixZQUFJLENBQUMsSUFBRCxFQUNBLE9BQU8sR0FBUCxDQURKOztBQUdBLGVBQU8sT0FBTyxLQUFLLFFBQUwsRUFBUCxJQUEwQixHQUExQixHQUFnQyxJQUFJLENBQUosRUFBTyxLQUFLLE9BQUwsRUFBUCxDQUFoQyxHQUF5RCxJQUF6RCxHQUFnRSxLQUFLLFdBQUwsRUFBaEUsR0FBcUYsR0FBckYsR0FDSCxJQUFJLENBQUosRUFBTyxLQUFLLFFBQUwsRUFBUCxDQURHLEdBQ3VCLEdBRHZCLEdBQzZCLElBQUksQ0FBSixFQUFPLEtBQUssVUFBTCxFQUFQLENBRDdCLEdBQ3lELEdBRHpELEdBRUgsSUFBSSxDQUFKLEVBQU8sS0FBSyxVQUFMLEVBQVAsQ0FGRyxHQUV5QixJQUFJLENBQUosRUFBTyxLQUFLLGVBQUwsRUFBUCxDQUZ6QixDQUpXO0tBQWYsQ0FWOEI7Q0FBWCxFQUFqQjs7OztBQXNCTixJQUFNLG9DQUFjLFNBQWQsV0FBYyxDQUFTLEtBQVQsRUFBZ0I7QUFDdkMsUUFBSSxPQUFPLElBQVAsQ0FEbUM7QUFFdkMsU0FBSyxLQUFMLEdBQWEsR0FBRyxVQUFILENBQWMsS0FBZCxDQUFiLENBRnVDO0NBQWhCOztBQUszQixZQUFZLEtBQVosR0FBb0IsWUFBVztBQUMzQixXQUFPLElBQUksV0FBSixDQUFnQixhQUFoQixDQUFQLENBRDJCO0NBQVg7O0FBSXBCLFlBQVksUUFBWixHQUF1QixVQUFTLElBQVQsRUFBZTtBQUNsQyxXQUFPLElBQUksV0FBSixDQUFnQixRQUFRLEtBQUssS0FBTCxDQUEvQixDQURrQztDQUFmOzs7O0FBTWhCLElBQU0sOEJBQVcsU0FBWCxRQUFXLENBQVMsS0FBVCxFQUFnQjtBQUNwQyxRQUFJLE9BQU8sSUFBUCxDQURnQztBQUVwQyxTQUFLLEtBQUwsR0FBYSxHQUFHLFVBQUgsQ0FBYyxLQUFkLENBQWIsQ0FGb0M7O0FBSXBDLFNBQUssR0FBTCxHQUFXLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDOUIsZUFBTyxTQUFTLFdBQVQsQ0FBcUIsTUFBckIsQ0FBNEIsTUFBNUIsQ0FBbUMsS0FBSyxLQUFMLEVBQW5DLEVBQWlELEdBQWpELENBRHVCO0tBQVgsQ0FBdkIsQ0FKb0M7Q0FBaEI7Ozs7QUFXeEIsSUFBTSxnQkFBZ0IsU0FBaEIsYUFBZ0IsQ0FBUyxJQUFULEVBQWUsR0FBZixFQUFvQjtBQUN0QyxRQUFNLE9BQU8sSUFBUCxDQURnQztBQUV0QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGc0M7QUFHdEMsU0FBSyxHQUFMLEdBQVcsR0FBRyxVQUFILENBQWMsT0FBTyxHQUFQLENBQXpCLENBSHNDO0NBQXBCOzs7O0FBUWYsSUFBTSxvQ0FBYyxTQUFkLFdBQWMsQ0FBUyxFQUFULEVBQWEsSUFBYixFQUFtQixHQUFuQixFQUF3QixNQUF4QixFQUFnQyxPQUFoQyxFQUF5QyxJQUF6QyxFQUErQztBQUN0RSxRQUFJLE9BQU8sSUFBUCxDQURrRTtBQUV0RSxTQUFLLEVBQUwsR0FBVSxHQUFHLFVBQUgsQ0FBYyxFQUFkLENBQVYsQ0FGc0U7QUFHdEUsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsUUFBUSxFQUFSLENBQTFCLENBSHNFO0FBSXRFLFNBQUssR0FBTCxHQUFXLEdBQUcsVUFBSCxDQUFjLE9BQU8sRUFBUCxDQUF6QixDQUpzRTtBQUt0RSxTQUFLLE1BQUwsR0FBYyxHQUFHLFVBQUgsQ0FBYyxVQUFVLFlBQVksS0FBWixFQUFWLENBQTVCLENBTHNFO0FBTXRFLFNBQUssT0FBTCxHQUFlLEdBQUcsVUFBSCxDQUFjLE9BQWQsQ0FBZixDQU5zRTtBQU90RSxTQUFLLElBQUwsR0FBWSxHQUFHLGVBQUgsQ0FBbUIsUUFBUSxFQUFSLENBQS9CLENBUHNFOztBQVN0RSxTQUFLLEdBQUwsR0FBVyxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQzlCLGVBQU8sU0FBUyxXQUFULENBQXFCLE1BQXJCLENBQTRCLFNBQTVCLENBQXNDLEtBQUssR0FBTCxFQUF0QyxFQUFrRCxHQUFsRCxDQUR1QjtLQUFYLENBQXZCLENBVHNFOztBQWF0RSxTQUFLLEtBQUwsR0FBYSxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQ2hDLFlBQUksU0FBUyxLQUFLLE1BQUwsRUFBVCxDQUQ0QjtBQUVoQyxlQUFRLFNBQVMsT0FBTyxLQUFQLEVBQVQsR0FBMEIsYUFBMUIsQ0FGd0I7S0FBWCxDQUF6QixDQWJzRTs7QUFrQnRFLFNBQUssUUFBTCxHQUFnQixVQUFTLEtBQVQsRUFBZ0I7QUFDNUIsWUFBSSxTQUFTLEtBQUssTUFBTCxNQUFpQixZQUFZLEtBQVosRUFBakIsQ0FEZTtBQUU1QixlQUFPLEtBQVAsQ0FBYSxLQUFiLEVBRjRCO0FBRzVCLGFBQUssTUFBTCxDQUFZLE1BQVosRUFINEI7S0FBaEIsQ0FsQnNEOztBQXdCdEUsU0FBSyxjQUFMLEdBQXNCLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDekMsZUFBTyxjQUFjLEtBQUssT0FBTCxFQUFkLENBQVAsQ0FEeUM7S0FBWCxDQUFsQyxDQXhCc0U7O0FBNEJ0RSxTQUFLLE9BQUwsR0FBZSxVQUFTLElBQVQsRUFBZTtBQUMxQixZQUFJLFdBQVcsYUFBYSxLQUFLLFFBQUwsRUFBYixDQUFYLENBRHNCO0FBRTFCLGVBQVEsYUFBYSxLQUFLLEdBQUwsRUFBYixJQUEyQixLQUFLLEdBQUwsR0FBVyxPQUFYLENBQW1CLFdBQVcsR0FBWCxDQUFuQixLQUF1QyxDQUF2QyxDQUZUO0tBQWYsQ0E1QnVEOztBQWlDdEUsU0FBSyxjQUFMLEdBQXNCLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDekMsWUFBTSxRQUFRLEVBQVIsQ0FEbUM7QUFFekMsYUFBSyxHQUFMLEdBQVcsS0FBWCxDQUFpQixHQUFqQixFQUFzQixNQUF0QixDQUE2QixVQUFDLElBQUQsRUFBTyxDQUFQLEVBQWE7QUFDdEMsb0JBQVEsTUFBTSxDQUFOLENBRDhCO0FBRXRDLGtCQUFNLElBQU4sQ0FBVyxJQUFJLGFBQUosQ0FBa0IsQ0FBbEIsRUFBcUIsSUFBckIsQ0FBWCxFQUZzQztBQUd0QyxtQkFBTyxJQUFQLENBSHNDO1NBQWIsRUFJMUIsRUFKSCxFQUZ5QztBQU96QyxlQUFPLEtBQVAsQ0FQeUM7S0FBWCxDQUFsQyxDQWpDc0U7Q0FBL0M7O0FBNEMzQixZQUFZLFFBQVosR0FBdUIsVUFBUyxJQUFULEVBQWU7QUFDbEMsV0FBTyxJQUFJLFdBQUosQ0FDSCxRQUFRLEtBQUssRUFBTCxFQUNSLFFBQVEsS0FBSyxJQUFMLEVBQ1IsUUFBUSxLQUFLLEdBQUwsRUFDUixZQUFZLFFBQVosQ0FBcUIsUUFBUSxLQUFLLE1BQUwsQ0FKMUIsRUFLSCxJQUFJLElBQUosQ0FBUyxRQUFRLEtBQUssT0FBTCxDQUxkLEVBSzZCLENBQUMsUUFBUSxLQUFLLElBQUwsSUFBYSxFQUFyQixDQUFELENBQTBCLEdBQTFCLENBQThCLFVBQVMsQ0FBVCxFQUFZO0FBQ3RFLGVBQU8sSUFBSSxRQUFKLENBQWEsRUFBRSxHQUFGLENBQXBCLENBRHNFO0tBQVosQ0FMM0QsQ0FBUCxDQURrQztDQUFmOzs7O0FBYWhCLElBQU0sZ0NBQVksU0FBWixTQUFZLENBQVMsUUFBVCxFQUFtQixNQUFuQixFQUEyQixVQUEzQixFQUF1QztBQUM1RCxRQUFJLE9BQU8sSUFBUCxDQUR3RDtBQUU1RCxTQUFLLFFBQUwsR0FBZ0IsR0FBRyxVQUFILENBQWMsWUFBWSxFQUFaLENBQTlCLENBRjREO0FBRzVELFNBQUssTUFBTCxHQUFjLEdBQUcsVUFBSCxDQUFjLFVBQVUsWUFBWSxLQUFaLEVBQVYsQ0FBNUIsQ0FINEQ7QUFJNUQsU0FBSyxVQUFMLEdBQWtCLEdBQUcsVUFBSCxDQUFjLFVBQWQsQ0FBbEIsQ0FKNEQ7O0FBTTVELFNBQUssS0FBTCxHQUFhLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDaEMsWUFBSSxTQUFTLEtBQUssTUFBTCxFQUFULENBRDRCO0FBRWhDLGVBQVEsU0FBUyxPQUFPLEtBQVAsRUFBVCxHQUEwQixhQUExQixDQUZ3QjtLQUFYLENBQXpCLENBTjREO0NBQXZDOztBQVl6QixVQUFVLFFBQVYsR0FBcUIsVUFBUyxJQUFULEVBQWU7QUFDaEMsV0FBTyxJQUFJLFNBQUosQ0FDSCxRQUFRLEtBQUssUUFBTCxFQUNSLFlBQVksUUFBWixDQUFxQixRQUFRLEtBQUssTUFBTCxDQUYxQixFQUdILFFBQVEsS0FBSyxVQUFMLENBSFosQ0FEZ0M7Q0FBZjs7OztBQVNkLElBQU0sa0NBQWEsU0FBYixVQUFhLENBQVMsR0FBVCxFQUFjO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssR0FBTCxHQUFXLEdBQUcsVUFBSCxDQUFjLEdBQWQsQ0FBWCxDQUZvQztBQUdwQyxTQUFLLFFBQUwsR0FBZ0IsR0FBRyxlQUFILEVBQWhCLENBSG9DOztBQUtwQyxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxLQUFULEVBQWdCO0FBQzVCLGFBQUssUUFBTCxDQUFjLE1BQWQsQ0FBcUIsVUFBUyxDQUFULEVBQVk7QUFDN0IsbUJBQU8sRUFBRSxHQUFGLE9BQVksTUFBTSxHQUFOLEVBQVosQ0FEc0I7U0FBWixDQUFyQixDQUQ0QjtBQUk1QixhQUFLLFFBQUwsQ0FBYyxPQUFkLENBQXNCLEtBQXRCLEVBSjRCO0tBQWhCLENBTG9CO0NBQWQ7OztBQ3ZKMUI7Ozs7O0FBRU8sSUFBTSw4Q0FBbUIsU0FBbkIsZ0JBQW1CLENBQUMsV0FBRCxFQUFpQjtBQUM3QyxXQUFPLFlBQVksTUFBWixDQUFtQixDQUFuQixFQUFzQixLQUF0QixDQUE0QixHQUE1QixFQUNGLE1BREUsQ0FDSyxVQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3pCLFlBQUksS0FBSyxLQUFLLEtBQUwsQ0FBVyxHQUFYLENBQUwsQ0FEcUI7QUFFekIsWUFBSSxJQUFJLEdBQUcsQ0FBSCxDQUFKLENBRnFCO0FBR3pCLFlBQUksSUFBSSxtQkFBbUIsR0FBRyxDQUFILENBQW5CLENBQUosQ0FIcUI7QUFJekIsWUFBSSxLQUFLLElBQUwsRUFDQSxLQUFLLENBQUwsRUFBUSxJQUFSLENBQWEsQ0FBYixFQURKLEtBR0ksS0FBSyxDQUFMLElBQVUsQ0FBQyxDQUFELENBQVYsQ0FISjtBQUlBLGVBQU8sSUFBUCxDQVJ5QjtLQUFyQixFQVNMLEVBVkEsQ0FBUCxDQUQ2QztDQUFqQjs7QUFjekIsSUFBTSwwQ0FBaUIsU0FBakIsY0FBaUIsR0FBTTtBQUNoQyxXQUFPLGlCQUFpQixPQUFPLFFBQVAsQ0FBZ0IsTUFBaEIsQ0FBeEIsQ0FEZ0M7Q0FBTjs7QUFJdkIsSUFBTSxrQ0FBYSxTQUFiLFVBQWEsQ0FBQyxHQUFELEVBQVM7QUFDL0IsUUFDSyxJQURMLENBQ1UsVUFEVixFQUNzQixJQUR0QixFQUVLLFFBRkwsQ0FFYyxZQUZkLEVBR0ssUUFITCxDQUdjLDZDQUhkLEVBRCtCO0NBQVQ7O0FBT25CLElBQU0sc0NBQWUsU0FBZixZQUFlLENBQUMsR0FBRCxFQUFTO0FBQ2pDLFFBQ0ssSUFETCxDQUNVLFVBRFYsRUFDc0IsS0FEdEIsRUFFSyxRQUZMLENBRWMsWUFGZCxFQUdLLFdBSEwsQ0FHaUIsOENBSGpCLEVBRGlDO0NBQVQ7OztBQzNCNUI7Ozs7SUFDWTs7OztJQUNBOzs7O0lBQ0E7Ozs7SUFDQTs7OztBQUVaLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsTUFBZixFQUF1QjtBQUN0QyxRQUFJLE9BQU8sSUFBUCxDQURrQztBQUV0QyxzQkFBa0IsWUFBbEIsQ0FBK0IsSUFBL0IsQ0FBb0MsSUFBcEMsRUFBMEMsSUFBMUMsRUFGc0M7Q0FBdkI7O0FBS25CLElBQUksWUFBWSxTQUFaLFNBQVksR0FBVztBQUN2QixRQUFJLE9BQU8sbUJBQW1CLE9BQU8sUUFBUCxDQUFnQixRQUFoQixDQUFuQixDQUE2QyxLQUE3QyxDQUFtRCxTQUFuRCxDQUFQLENBRG1CO0FBRXZCLFdBQVEsSUFBQyxJQUFRLEtBQUssQ0FBTCxDQUFSLElBQW9CLEVBQXJCLENBRmU7Q0FBWDs7QUFLaEIsRUFBRSxZQUFXO0FBQ1QsUUFBSSxRQUFRLElBQUksWUFBSixDQUNSLGtCQUFrQixXQUFsQixFQURRLENBQVIsQ0FESzs7QUFJVCxNQUFFLHNCQUFGLEVBQTBCLEtBQTFCLENBQWdDLFVBQVMsQ0FBVCxFQUFZO0FBQ3hDLFlBQUksTUFBTSxFQUFFLElBQUYsQ0FBTixDQURvQztBQUV4QyxlQUFPLFVBQVAsQ0FBa0IsR0FBbEIsRUFGd0M7O0FBSXhDLFlBQUksU0FBUyxXQUFULENBSm9DO0FBS3hDLFlBQUksY0FBYyxPQUFPLFdBQVAsQ0FBbUIsR0FBbkIsQ0FBZCxDQUxvQztBQU14QyxZQUFJLFNBQVMsT0FBTyxLQUFQLENBQWEsQ0FBYixFQUFnQixXQUFoQixDQUFULENBTm9DO0FBT3hDLFlBQUksT0FBTyxPQUFPLEtBQVAsQ0FBYSxjQUFjLENBQWQsQ0FBYixDQUE4QixJQUE5QixFQUFQLENBUG9DO0FBUXhDLFlBQUksTUFBTSxTQUFTLEdBQVQsR0FBZSxJQUFmLENBUjhCO0FBU3hDLFVBQUUsSUFBRixDQUFPO0FBQ0Msa0JBQU0sS0FBTjtBQUNBLGlCQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsZUFBekMsR0FBMkQsR0FBM0Q7QUFDTCx5QkFBYSxrQkFBYjtBQUNBLGtCQUFNLEtBQUssU0FBTCxDQUFlO0FBQ2pCLHNCQUFNLElBQU47QUFDQSxxQkFBSyxHQUFMO2FBRkUsQ0FBTjtBQUlBLG1CQUFPLGVBQVMsQ0FBVCxFQUFZO0FBQ2YsdUJBQU8sWUFBUCxDQUFvQixHQUFwQixFQURlO2FBQVo7U0FSZixFQVlLLElBWkwsQ0FZVSxVQUFTLE1BQVQsRUFBaUI7QUFDbkIsZ0JBQUksVUFBVSxDQUFDLE9BQU8sS0FBUCxFQUFjO0FBQ3pCLHlCQUFTLFFBQVQsQ0FBa0IsSUFBbEIsR0FBeUIsU0FBUyxXQUFULENBQXFCLE1BQXJCLENBQTRCLFNBQTVCLENBQXNDLE9BQU8sR0FBUCxDQUF0QyxDQUFrRCxHQUFsRCxDQURBO2FBQTdCLE1BRU87QUFDSCx1QkFBTyxZQUFQLENBQW9CLEdBQXBCLEVBREc7YUFGUDtTQURFLENBWlYsQ0FUd0M7S0FBWixDQUFoQyxDQUpTOztBQWtDVCxPQUFHLGFBQUgsQ0FBaUIsS0FBakIsRUFsQ1M7Q0FBWCxDQUFGOzs7QUNoQkE7Ozs7Ozs7OztJQUNZOzs7O0FBRVosSUFBSSxhQUFhLFNBQWIsVUFBYSxHQUFXO0FBQ3hCLFFBQUksU0FBUyxPQUFPLFFBQVAsQ0FBZ0IsUUFBaEIsS0FBNkIsUUFBN0IsQ0FEVztBQUV4QixXQUFPLENBQUMsU0FBUyxLQUFULEdBQWlCLElBQWpCLENBQUQsR0FBMEIsS0FBMUIsR0FBa0MsT0FBTyxRQUFQLENBQWdCLElBQWhCLEdBQXVCLFFBQXpELENBRmlCO0NBQVg7Ozs7QUFPVixJQUFNLHdDQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssT0FBTCxHQUFlLEVBQWYsQ0FGb0M7QUFHcEMsU0FBSyxXQUFMLEdBQW1CLEVBQW5CLENBSG9DOztBQUtwQyxRQUFJLGlCQUFpQixTQUFqQixjQUFpQixDQUFTLEdBQVQsRUFBYztBQUMvQixZQUFJLENBQUMsR0FBRCxJQUFRLENBQUMsSUFBSSxJQUFKLEVBQ1QsT0FESjs7QUFHQSxZQUFJLE9BQU8sSUFBSSxJQUFKLENBSm9CO0FBSy9CLFlBQUksU0FBVSxJQUFJLE1BQUosR0FBYSxLQUFLLFdBQUwsQ0FBaUIsSUFBSSxNQUFKLENBQTlCLEdBQTRDLEtBQUssT0FBTCxDQUFhLElBQUksSUFBSixDQUF6RCxDQUxpQjtBQU0vQixTQUFDLFNBQVMsT0FBTyxTQUFQLEdBQW1CLEVBQTVCLENBQUQsQ0FBaUMsT0FBakMsQ0FBeUMsVUFBUyxDQUFULEVBQVk7QUFDakQsZ0JBQUksRUFBRSxJQUFGLENBQUosRUFDSSxFQUFFLElBQUYsRUFBUSxHQUFSLEVBREo7U0FEcUMsQ0FBekMsQ0FOK0I7S0FBZCxDQUxlOztBQWlCcEMsU0FBSyxLQUFMLEdBQWEsS0FBYixDQWpCb0M7O0FBbUJwQyxRQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLFlBQUksU0FBUyxJQUFJLFNBQUosQ0FBYyxZQUFkLENBQVQsQ0FEdUI7O0FBRzNCLGVBQU8sTUFBUCxHQUFnQixVQUFTLENBQVQsRUFBWTtBQUN4QixpQkFBSyxLQUFMLEdBQWEsSUFBYixDQUR3QjtBQUV4QixnQkFBSSxnQkFBZ0IsT0FBTyxJQUFQLENBQVksS0FBSyxPQUFMLENBQTVCLENBRm9CO0FBR3hCLGdCQUFJLGNBQWMsTUFBZCxFQUFzQjtBQUN0Qix1QkFBTyxJQUFQLENBQVksS0FBSyxTQUFMLENBQWU7QUFDdkIsNEJBQVEsV0FBUjtBQUNBLDBCQUFNLGFBQU47aUJBRlEsQ0FBWixFQURzQjthQUExQjs7QUFPQSxnQkFBSSxvQkFBb0IsT0FBTyxJQUFQLENBQVksS0FBSyxXQUFMLENBQWhDLENBVm9CO0FBV3hCLGdCQUFJLGtCQUFrQixNQUFsQixFQUEwQjtBQUMxQixrQ0FBa0IsT0FBbEIsQ0FBMEIsVUFBUyxDQUFULEVBQVk7QUFDbEMsMkJBQU8sSUFBUCxDQUFZLEtBQUssU0FBTCxDQUFlO0FBQ3ZCLGdDQUFRLHFCQUFSO0FBQ0EsOEJBQU0sQ0FBTjtxQkFGUSxDQUFaLEVBRGtDO2lCQUFaLENBQTFCLENBRDBCO2FBQTlCO1NBWFksQ0FIVzs7QUF3QjNCLGVBQU8sU0FBUCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsZ0JBQUksT0FBTyxLQUFLLEtBQUwsQ0FBVyxNQUFNLElBQU4sQ0FBbEIsQ0FEMkI7QUFFL0IsZ0JBQUksSUFBSixFQUNJLGVBQWUsSUFBZixFQURKO1NBRmUsQ0F4QlE7O0FBOEIzQixlQUFPLE9BQVAsR0FBaUIsWUFBVztBQUN4QixvQkFBUSxHQUFSLENBQVksUUFBWixFQUR3QjtBQUV4QixnQkFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLHFCQUFLLEtBQUwsR0FBYSxLQUFiLENBRFk7QUFFWixxQkFBSyxNQUFMLEdBQWMsZUFBZCxDQUZZO2FBQWhCO1NBRmEsQ0E5QlU7S0FBWCxDQW5CZ0I7O0FBMERwQyxTQUFLLE1BQUwsR0FBYyxlQUFkLENBMURvQztDQUFYOztBQTZEN0IsY0FBYyxTQUFkLENBQXdCLFNBQXhCLEdBQW9DLFVBQVMsSUFBVCxFQUFlLFFBQWYsRUFBeUI7QUFDekQsU0FBSyxZQUFMLENBQWtCLENBQUMsSUFBRCxDQUFsQixFQUEwQixRQUExQixFQUR5RDtDQUF6Qjs7QUFJcEMsY0FBYyxTQUFkLENBQXdCLFlBQXhCLEdBQXVDLFVBQVMsS0FBVCxFQUFnQixRQUFoQixFQUEwQjtBQUM3RCxRQUFJLE9BQU8sSUFBUCxDQUR5RDs7QUFHN0QsUUFBSSxtQkFBbUIsRUFBbkIsQ0FIeUQ7QUFJN0QsVUFBTSxHQUFOLENBQVUsT0FBTyxZQUFQLENBQVYsQ0FBK0IsT0FBL0IsQ0FBdUMsVUFBUyxJQUFULEVBQWU7QUFDbEQsWUFBSSxVQUFVLEtBQUssT0FBTCxDQUFhLElBQWIsQ0FBVixDQUQ4QztBQUVsRCxZQUFJLE9BQUosRUFBYTtBQUNULG9CQUFRLFNBQVIsQ0FBa0IsSUFBbEIsQ0FBdUIsUUFBdkIsRUFEUztTQUFiLE1BRU87QUFDSCxpQkFBSyxPQUFMLENBQWEsSUFBYixJQUFxQjtBQUNqQiwyQkFBVyxDQUFDLFFBQUQsQ0FBWDthQURKLENBREc7QUFJSCw2QkFBaUIsSUFBakIsQ0FBc0IsSUFBdEIsRUFKRztTQUZQO0tBRm1DLENBQXZDLENBSjZEOztBQWdCN0QsUUFBSSxpQkFBaUIsTUFBakIsRUFBeUI7QUFDekIsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLFdBQVI7QUFDQSxzQkFBTSxnQkFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FESjtDQWhCbUM7O0FBMEJ2QyxjQUFjLFNBQWQsQ0FBd0IsbUJBQXhCLEdBQThDLFVBQVMsSUFBVCxFQUFlLFFBQWYsRUFBeUI7QUFDbkUsUUFBSSxPQUFPLElBQVAsQ0FEK0Q7QUFFbkUsV0FBTyxPQUFPLFlBQVAsQ0FBb0IsSUFBcEIsQ0FBUCxDQUZtRTs7QUFJbkUsUUFBSSxVQUFVLEtBQUssV0FBTCxDQUFpQixJQUFqQixDQUFWLENBSitEO0FBS25FLFFBQUksT0FBSixFQUFhO0FBQ1QsZ0JBQVEsU0FBUixDQUFrQixJQUFsQixDQUF1QixRQUF2QixFQURTO0tBQWIsTUFFTztBQUNILGFBQUssV0FBTCxDQUFpQixJQUFqQixJQUF5QjtBQUNyQix1QkFBVyxDQUFDLFFBQUQsQ0FBWDtTQURKLENBREc7QUFJSCxZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEscUJBQVI7QUFDQSxzQkFBTSxJQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQU5KO0NBTDBDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCAqIGFzIHN0cmVhbV9tYW5hZ2VyIGZyb20gJy4vc3RyZWFtX21hbmFnZXInO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHBhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyID0ga28ub2JzZXJ2YWJsZSh1c2VyKTtcbiAgICBzZWxmLnBhZ2UgPSBrby5vYnNlcnZhYmxlKHBhZ2UpO1xuICAgIHNlbGYuZmF2b3JpdGVzID0ga28ub2JzZXJ2YWJsZShuZXcgbW9kZWxzLkNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpKSk7XG5cbiAgICBzZWxmLm1hbmFnZXIgPSBuZXcgc3RyZWFtX21hbmFnZXIuU3RyZWFtTWFuYWdlcigpO1xuXG4gICAgc2VsZi5hZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIHN0YXR1cyB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZSh1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYudXNlcigpLnN0YXR1cyhuZXcgbW9kZWxzLlN0YXR1c01vZGVsKG1zZy5zdGF0dXMuY29sb3IpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8ICF1c2VyLnJvb3RTdHJlYW0oKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKHVzZXIucm9vdFN0cmVhbSgpKS51cmwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIGNvbGxlY3Rpb24gdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBpbml0aWFsVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuVXNlck1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsVXNlckRhdGEpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SID0gXCIjNzc3Nzc3XCI7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplVXJpID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSSh1cmkpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgLnJlcGxhY2UoJyAnLCAnLycpO1xufTtcblxuLyoqXG4gICAgUHJldHR5IHByaW50cyBhIGRhdGEuXG4qL1xuZXhwb3J0IGNvbnN0IGRhdGVUb0Rpc3BsYXkgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuICAgIHZhciBwYWQgPSBmdW5jdGlvbihtaW4sIGlucHV0KSB7XG4gICAgICAgIGlucHV0ICs9ICcnO1xuICAgICAgICB3aGlsZSAoaW5wdXQubGVuZ3RoIDwgbWluKVxuICAgICAgICAgICAgaW5wdXQgPSAnMCcgKyBpbnB1dDtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZGF0ZSkge1xuICAgICAgICBpZiAoIWRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJy0nO1xuXG4gICAgICAgIHJldHVybiBtb250aHNbZGF0ZS5nZXRNb250aCgpXSArICcgJyArIHBhZCgyLCBkYXRlLmdldERhdGUoKSkgKyAnLCAnICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJyAnICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldEhvdXJzKCkpICsgJzonICsgcGFkKDIsIGRhdGUuZ2V0TWludXRlcygpKSArICcuJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRTZWNvbmRzKCkpICsgcGFkKDMsIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIH07XG59KCkpO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0YXR1c01vZGVsID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jb2xvciA9IGtvLm9ic2VydmFibGUoY29sb3IpO1xufTtcblxuU3RhdHVzTW9kZWwuZW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKERFRkFVTFRfQ09MT1IpO1xufTtcblxuU3RhdHVzTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChkYXRhICYmIGRhdGEuY29sb3IpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBUYWdNb2RlbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudmFsdWUgPSBrby5vYnNlcnZhYmxlKHZhbHVlKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0VGFnKHNlbGYudmFsdWUoKSkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKi9cbmNvbnN0IFBhdGhDb21wb25lbnQgPSBmdW5jdGlvbihuYW1lLCB1cmkpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSgnL3MnICsgdXJpKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RyZWFtTW9kZWwgPSBmdW5jdGlvbihpZCwgbmFtZSwgdXJpLCBzdGF0dXMsIHVwZGF0ZWQsIHRhZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5pZCA9IGtvLm9ic2VydmFibGUoaWQpO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSB8fCAnJyk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnVwZGF0ZWQgPSBrby5vYnNlcnZhYmxlKHVwZGF0ZWQpO1xuICAgIHNlbGYudGFncyA9IGtvLm9ic2VydmFibGVBcnJheSh0YWdzIHx8IFtdKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0U3RyZWFtKHNlbGYudXJpKCkpLnVybDtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKSB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpO1xuICAgICAgICBzdGF0dXMuY29sb3IoY29sb3IpO1xuICAgICAgICBzZWxmLnN0YXR1cyhzdGF0dXMpO1xuICAgIH07XG5cbiAgICBzZWxmLmRpc3BsYXlVcGRhdGVkID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRlVG9EaXNwbGF5KHNlbGYudXBkYXRlZCgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuaXNPd25lciA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgdmFyIG93bmVyVXJpID0gbm9ybWFsaXplVXJpKHVzZXIudXNlck5hbWUoKSk7XG4gICAgICAgIHJldHVybiAob3duZXJVcmkgPT09IHNlbGYudXJpKCkgfHwgc2VsZi51cmkoKS5pbmRleE9mKG93bmVyVXJpICsgJy8nKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIHNlbGYucGF0aENvbXBvbmVudHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgcGF0aHMgPSBbXTtcbiAgICAgICAgc2VsZi51cmkoKS5zcGxpdCgnLycpLnJlZHVjZSgocGF0aCwgYykgPT4ge1xuICAgICAgICAgICAgcGF0aCArPSAnLycgKyBjO1xuICAgICAgICAgICAgcGF0aHMucHVzaChuZXcgUGF0aENvbXBvbmVudChjLCBwYXRoKSk7XG4gICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgfSwgJycpO1xuICAgICAgICByZXR1cm4gcGF0aHM7XG4gICAgfSk7XG59O1xuXG5TdHJlYW1Nb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbU1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEuaWQsXG4gICAgICAgIGRhdGEgJiYgZGF0YS5uYW1lLFxuICAgICAgICBkYXRhICYmIGRhdGEudXJpLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgbmV3IERhdGUoZGF0YSAmJiBkYXRhLnVwZGF0ZWQpLCAoZGF0YSAmJiBkYXRhLnRhZ3MgfHwgW10pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRhZ01vZGVsKHgudGFnKTtcbiAgICAgICAgfSkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBVc2VyTW9kZWwgPSBmdW5jdGlvbih1c2VyTmFtZSwgc3RhdHVzLCByb290U3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlck5hbWUgPSBrby5vYnNlcnZhYmxlKHVzZXJOYW1lIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYucm9vdFN0cmVhbSA9IGtvLm9ic2VydmFibGUocm9vdFN0cmVhbSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG59O1xuXG5Vc2VyTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBVc2VyTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS51c2VyTmFtZSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIGRhdGEgJiYgZGF0YS5yb290U3RyZWFtKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkLnVyaSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi51bnNoaWZ0KGNoaWxkKTtcbiAgICB9O1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5leHBvcnQgY29uc3QgcGFyc2VRdWVyeVN0cmluZyA9IChxdWVyeVN0cmluZykgPT4ge1xuICAgIHJldHVybiBxdWVyeVN0cmluZy5zdWJzdHIoMSkuc3BsaXQoXCImXCIpXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24oZGljdCwgaXRlbSkge1xuICAgICAgICAgICAgdmFyIGt2ID0gaXRlbS5zcGxpdChcIj1cIik7XG4gICAgICAgICAgICB2YXIgayA9IGt2WzBdO1xuICAgICAgICAgICAgdmFyIHYgPSBkZWNvZGVVUklDb21wb25lbnQoa3ZbMV0pO1xuICAgICAgICAgICAgaWYgKGsgaW4gZGljdClcbiAgICAgICAgICAgICAgICBkaWN0W2tdLnB1c2godik7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgZGljdFtrXSA9IFt2XTtcbiAgICAgICAgICAgIHJldHVybiBkaWN0O1xuICAgICAgICB9LCB7fSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0UXVlcnlTdHJpbmcgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHBhcnNlUXVlcnlTdHJpbmcod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59O1xuXG5leHBvcnQgY29uc3QgbG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICBzZWxcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1bmxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpXG4gICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyBzdHJlYW1fbWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcbmltcG9ydCAqIGFzIGFwcGxpY2F0aW9uX21vZGVsIGZyb20gJy4vYXBwbGljYXRpb25fbW9kZWwnO1xuaW1wb3J0ICogYXMgc2hhcmVkIGZyb20gJy4vc2hhcmVkJztcblxudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcbn07XG5cbnZhciBnZXRUYXJnZXQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGF0aCA9IGRlY29kZVVSSUNvbXBvbmVudCh3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUpLm1hdGNoKCcvcy8oLispJyk7XG4gICAgcmV0dXJuICgocGF0aCAmJiBwYXRoWzFdKSB8fCAnJyk7XG59O1xuXG4kKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbCA9IG5ldyBBcHBWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCkpO1xuXG4gICAgJCgnLmNyZWF0ZS1jaGlsZC1idXR0b24nKS5jbGljayhmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBidG4gPSAkKHRoaXMpO1xuICAgICAgICBzaGFyZWQubG9ja0J1dHRvbihidG4pO1xuXG4gICAgICAgIHZhciByYXdVcmkgPSBnZXRUYXJnZXQoKTtcbiAgICAgICAgdmFyIHBhcmVudEluZGV4ID0gcmF3VXJpLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgICAgIHZhciBwYXJlbnQgPSByYXdVcmkuc2xpY2UoMCwgcGFyZW50SW5kZXgpO1xuICAgICAgICB2YXIgbmFtZSA9IHJhd1VyaS5zbGljZShwYXJlbnRJbmRleCArIDEpLnRyaW0oKTtcbiAgICAgICAgdmFyIHVyaSA9IHBhcmVudCArIFwiL1wiICsgbmFtZTtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVTdHJlYW0oKS51cmwsXG4gICAgICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHVyaTogdXJpXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hhcmVkLnVubG9ja0J1dHRvbihidG4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmICFyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0ocmVzdWx0LnVyaSkudXJsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNoYXJlZC51bmxvY2tCdXR0b24oYnRuKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGtvLmFwcGx5QmluZGluZ3MobW9kZWwpO1xufSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5cbnZhciBzb2NrZXRQYXRoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1NYW5hZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuc3RyZWFtcyA9IHt9O1xuICAgIHNlbGYuY29sbGVjdGlvbnMgPSB7fTtcblxuICAgIHZhciBwcm9jZXNzTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHR5cGUgPSBtc2cudHlwZTtcbiAgICAgICAgdmFyIHRhcmdldCA9IChtc2cuc291cmNlID8gc2VsZi5jb2xsZWN0aW9uc1ttc2cuc291cmNlXSA6IHNlbGYuc3RyZWFtc1ttc2cuZnJvbV0pO1xuICAgICAgICAodGFyZ2V0ID8gdGFyZ2V0Lmxpc3RlbmVycyA6IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIGlmICh4W3R5cGVdKVxuICAgICAgICAgICAgICAgIHhbdHlwZV0obXNnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgIHZhciBvcGVuV2Vic29ja2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHNvY2tldFBhdGgoKSk7XG5cbiAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldFN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB0YXJnZXRTdHJlYW1zXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0Q29sbGVjdGlvbnMgPSBPYmplY3Qua2V5cyhzZWxmLmNvbGxlY3Rpb25zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRDb2xsZWN0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB4XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGlmIChkYXRhKVxuICAgICAgICAgICAgICAgIHByb2Nlc3NNZXNzYWdlKGRhdGEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVvcGVuJyk7XG4gICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQWxsID0gZnVuY3Rpb24ocGF0aHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG5ld1N1YnNjcmlwdGlvbnMgPSBbXTtcbiAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5zdHJlYW1zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBbY2FsbGJhY2tdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHBhdGggPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhdGgpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnM6IFtjYWxsYmFja11cbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG4iXX0=
