(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.initialUser = exports.AppViewModel = undefined;

var _models = require('./models');

var models = _interopRequireWildcard(_models);

var _stream_manager = require('./stream_manager');

var _stream_manager2 = _interopRequireDefault(_stream_manager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 */
var AppViewModel = exports.AppViewModel = function AppViewModel(user, page) {
    var self = this;
    self.user = ko.observable(user);
    self.page = ko.observable(page);
    self.favorites = ko.observable(new models.Collection(user.userName()));

    self.manager = _stream_manager2.default.getInstance();

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

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _models = require('./models');

var models = _interopRequireWildcard(_models);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var socketPath = function socketPath() {
    var secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws';
};

/**
    Manages a websocket connection
 */

var StreamManager = function () {
    function StreamManager() {
        _classCallCheck(this, StreamManager);

        var self = this;
        self.streams = {};
        self.collections = {};
        self.ready = false;

        var processMessage = function processMessage(msg) {
            if (!msg || !msg.type) return;

            var type = msg.type;
            var target = msg.source ? self.collections[msg.source] : self.streams[msg.from];
            (target ? target.listeners : []).forEach(function (x) {
                return x[type] && x[type](msg);
            });
        };

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
    }

    _createClass(StreamManager, [{
        key: 'subscribe',
        value: function subscribe(path, callback) {
            this.subscribeAll([path], callback);
        }
    }, {
        key: 'subscribeAll',
        value: function subscribeAll(paths, callback) {
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
        }
    }, {
        key: 'subscribeCollection',
        value: function subscribeCollection(path, callback) {
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
    }]);

    return StreamManager;
}();

/**
    Get the stream_manager singleton.
*/

exports.default = StreamManager;
StreamManager.getInstance = function () {
    var instance = undefined;
    return function () {
        if (!instance) instance = new StreamManager();
        return instance;
    };
}();

},{"./models":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fY3JlYXRlX2NoaWxkLmpzIiwiY2xpZW50L2pzL3N0cmVhbV9tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7Ozs7Ozs7OztJQUNZOzs7Ozs7Ozs7Ozs7QUFLTCxJQUFNLHNDQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQzdDLFFBQUksT0FBTyxJQUFQLENBRHlDO0FBRTdDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUY2QztBQUc3QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FINkM7QUFJN0MsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSjZDOztBQU03QyxTQUFLLE9BQUwsR0FBZSx5QkFBYyxXQUFkLEVBQWYsQ0FONkM7O0FBUTdDLFNBQUssV0FBTCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsYUFBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLEtBQTFCLEVBRCtCO0tBQWhCLENBUjBCOztBQVk3QyxTQUFLLGNBQUwsR0FBc0IsVUFBUyxRQUFULEVBQW1CO0FBQ3JDLGVBQU8sS0FBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLE1BQTFCLENBQWlDLFVBQVMsQ0FBVCxFQUFZO0FBQ2hELG1CQUFPLEVBQUUsR0FBRixPQUFZLFFBQVosQ0FEeUM7U0FBWixDQUF4QyxDQURxQztLQUFuQjs7O0FBWnVCLFFBbUI3QyxDQUFLLE9BQUwsQ0FBYSxTQUFiLENBQXVCLEtBQUssUUFBTCxFQUF2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LEdBQTRCLFlBQU87QUFDL0IsUUFBSSxvQkFBSixDQUQrQjtBQUUvQixXQUFPLFlBQVc7QUFDZCxZQUFJLENBQUMsUUFBRCxFQUNBLFdBQVcsSUFBSSxhQUFKLEVBQVgsQ0FESjtBQUVBLGVBQU8sUUFBUCxDQUhjO0tBQVgsQ0FGd0I7Q0FBTixFQUE3QiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgU3RyZWFtTWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBwYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5wYWdlID0ga28ub2JzZXJ2YWJsZShwYWdlKTtcbiAgICBzZWxmLmZhdm9yaXRlcyA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSkpO1xuXG4gICAgc2VsZi5tYW5hZ2VyID0gU3RyZWFtTWFuYWdlci5nZXRJbnN0YW5jZSgpO1xuXG4gICAgc2VsZi5hZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIHN0YXR1cyB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZSh1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYudXNlcigpLnN0YXR1cyhuZXcgbW9kZWxzLlN0YXR1c01vZGVsKG1zZy5zdGF0dXMuY29sb3IpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8ICF1c2VyLnJvb3RTdHJlYW0oKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKHVzZXIucm9vdFN0cmVhbSgpKS51cmwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIGNvbGxlY3Rpb24gdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBpbml0aWFsVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuVXNlck1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsVXNlckRhdGEpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SID0gXCIjNzc3Nzc3XCI7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplVXJpID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSSh1cmkpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgLnJlcGxhY2UoJyAnLCAnLycpO1xufTtcblxuLyoqXG4gICAgUHJldHR5IHByaW50cyBhIGRhdGEuXG4qL1xuZXhwb3J0IGNvbnN0IGRhdGVUb0Rpc3BsYXkgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuICAgIHZhciBwYWQgPSBmdW5jdGlvbihtaW4sIGlucHV0KSB7XG4gICAgICAgIGlucHV0ICs9ICcnO1xuICAgICAgICB3aGlsZSAoaW5wdXQubGVuZ3RoIDwgbWluKVxuICAgICAgICAgICAgaW5wdXQgPSAnMCcgKyBpbnB1dDtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZGF0ZSkge1xuICAgICAgICBpZiAoIWRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJy0nO1xuXG4gICAgICAgIHJldHVybiBtb250aHNbZGF0ZS5nZXRNb250aCgpXSArICcgJyArIHBhZCgyLCBkYXRlLmdldERhdGUoKSkgKyAnLCAnICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJyAnICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldEhvdXJzKCkpICsgJzonICsgcGFkKDIsIGRhdGUuZ2V0TWludXRlcygpKSArICcuJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRTZWNvbmRzKCkpICsgcGFkKDMsIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIH07XG59KCkpO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0YXR1c01vZGVsID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jb2xvciA9IGtvLm9ic2VydmFibGUoY29sb3IpO1xufTtcblxuU3RhdHVzTW9kZWwuZW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKERFRkFVTFRfQ09MT1IpO1xufTtcblxuU3RhdHVzTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChkYXRhICYmIGRhdGEuY29sb3IpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBUYWdNb2RlbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudmFsdWUgPSBrby5vYnNlcnZhYmxlKHZhbHVlKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0VGFnKHNlbGYudmFsdWUoKSkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKi9cbmNvbnN0IFBhdGhDb21wb25lbnQgPSBmdW5jdGlvbihuYW1lLCB1cmkpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSgnL3MnICsgdXJpKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RyZWFtTW9kZWwgPSBmdW5jdGlvbihpZCwgbmFtZSwgdXJpLCBzdGF0dXMsIHVwZGF0ZWQsIHRhZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5pZCA9IGtvLm9ic2VydmFibGUoaWQpO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSB8fCAnJyk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnVwZGF0ZWQgPSBrby5vYnNlcnZhYmxlKHVwZGF0ZWQpO1xuICAgIHNlbGYudGFncyA9IGtvLm9ic2VydmFibGVBcnJheSh0YWdzIHx8IFtdKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0U3RyZWFtKHNlbGYudXJpKCkpLnVybDtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKSB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpO1xuICAgICAgICBzdGF0dXMuY29sb3IoY29sb3IpO1xuICAgICAgICBzZWxmLnN0YXR1cyhzdGF0dXMpO1xuICAgIH07XG5cbiAgICBzZWxmLmRpc3BsYXlVcGRhdGVkID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRlVG9EaXNwbGF5KHNlbGYudXBkYXRlZCgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuaXNPd25lciA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgdmFyIG93bmVyVXJpID0gbm9ybWFsaXplVXJpKHVzZXIudXNlck5hbWUoKSk7XG4gICAgICAgIHJldHVybiAob3duZXJVcmkgPT09IHNlbGYudXJpKCkgfHwgc2VsZi51cmkoKS5pbmRleE9mKG93bmVyVXJpICsgJy8nKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIHNlbGYucGF0aENvbXBvbmVudHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgcGF0aHMgPSBbXTtcbiAgICAgICAgc2VsZi51cmkoKS5zcGxpdCgnLycpLnJlZHVjZSgocGF0aCwgYykgPT4ge1xuICAgICAgICAgICAgcGF0aCArPSAnLycgKyBjO1xuICAgICAgICAgICAgcGF0aHMucHVzaChuZXcgUGF0aENvbXBvbmVudChjLCBwYXRoKSk7XG4gICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgfSwgJycpO1xuICAgICAgICByZXR1cm4gcGF0aHM7XG4gICAgfSk7XG59O1xuXG5TdHJlYW1Nb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbU1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEuaWQsXG4gICAgICAgIGRhdGEgJiYgZGF0YS5uYW1lLFxuICAgICAgICBkYXRhICYmIGRhdGEudXJpLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgbmV3IERhdGUoZGF0YSAmJiBkYXRhLnVwZGF0ZWQpLCAoZGF0YSAmJiBkYXRhLnRhZ3MgfHwgW10pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRhZ01vZGVsKHgudGFnKTtcbiAgICAgICAgfSkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBVc2VyTW9kZWwgPSBmdW5jdGlvbih1c2VyTmFtZSwgc3RhdHVzLCByb290U3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlck5hbWUgPSBrby5vYnNlcnZhYmxlKHVzZXJOYW1lIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYucm9vdFN0cmVhbSA9IGtvLm9ic2VydmFibGUocm9vdFN0cmVhbSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG59O1xuXG5Vc2VyTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBVc2VyTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS51c2VyTmFtZSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIGRhdGEgJiYgZGF0YS5yb290U3RyZWFtKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkLnVyaSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi51bnNoaWZ0KGNoaWxkKTtcbiAgICB9O1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5leHBvcnQgY29uc3QgcGFyc2VRdWVyeVN0cmluZyA9IChxdWVyeVN0cmluZykgPT4ge1xuICAgIHJldHVybiBxdWVyeVN0cmluZy5zdWJzdHIoMSkuc3BsaXQoXCImXCIpXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24oZGljdCwgaXRlbSkge1xuICAgICAgICAgICAgdmFyIGt2ID0gaXRlbS5zcGxpdChcIj1cIik7XG4gICAgICAgICAgICB2YXIgayA9IGt2WzBdO1xuICAgICAgICAgICAgdmFyIHYgPSBkZWNvZGVVUklDb21wb25lbnQoa3ZbMV0pO1xuICAgICAgICAgICAgaWYgKGsgaW4gZGljdClcbiAgICAgICAgICAgICAgICBkaWN0W2tdLnB1c2godik7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgZGljdFtrXSA9IFt2XTtcbiAgICAgICAgICAgIHJldHVybiBkaWN0O1xuICAgICAgICB9LCB7fSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0UXVlcnlTdHJpbmcgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHBhcnNlUXVlcnlTdHJpbmcod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59O1xuXG5leHBvcnQgY29uc3QgbG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICBzZWxcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1bmxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpXG4gICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyBzdHJlYW1fbWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcbmltcG9ydCAqIGFzIGFwcGxpY2F0aW9uX21vZGVsIGZyb20gJy4vYXBwbGljYXRpb25fbW9kZWwnO1xuaW1wb3J0ICogYXMgc2hhcmVkIGZyb20gJy4vc2hhcmVkJztcblxudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcbn07XG5cbnZhciBnZXRUYXJnZXQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGF0aCA9IGRlY29kZVVSSUNvbXBvbmVudCh3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUpLm1hdGNoKCcvcy8oLispJyk7XG4gICAgcmV0dXJuICgocGF0aCAmJiBwYXRoWzFdKSB8fCAnJyk7XG59O1xuXG4kKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbCA9IG5ldyBBcHBWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCkpO1xuXG4gICAgJCgnLmNyZWF0ZS1jaGlsZC1idXR0b24nKS5jbGljayhmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBidG4gPSAkKHRoaXMpO1xuICAgICAgICBzaGFyZWQubG9ja0J1dHRvbihidG4pO1xuXG4gICAgICAgIHZhciByYXdVcmkgPSBnZXRUYXJnZXQoKTtcbiAgICAgICAgdmFyIHBhcmVudEluZGV4ID0gcmF3VXJpLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgICAgIHZhciBwYXJlbnQgPSByYXdVcmkuc2xpY2UoMCwgcGFyZW50SW5kZXgpO1xuICAgICAgICB2YXIgbmFtZSA9IHJhd1VyaS5zbGljZShwYXJlbnRJbmRleCArIDEpLnRyaW0oKTtcbiAgICAgICAgdmFyIHVyaSA9IHBhcmVudCArIFwiL1wiICsgbmFtZTtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVTdHJlYW0oKS51cmwsXG4gICAgICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHVyaTogdXJpXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hhcmVkLnVubG9ja0J1dHRvbihidG4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmICFyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0ocmVzdWx0LnVyaSkudXJsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNoYXJlZC51bmxvY2tCdXR0b24oYnRuKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIGtvLmFwcGx5QmluZGluZ3MobW9kZWwpO1xufSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5cbmNvbnN0IHNvY2tldFBhdGggPSAoKSA9PiB7XG4gICAgY29uc3Qgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiAgICBNYW5hZ2VzIGEgd2Vic29ja2V0IGNvbm5lY3Rpb25cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3RyZWFtTWFuYWdlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgc2VsZi5zdHJlYW1zID0ge307XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnMgPSB7fTtcbiAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHByb2Nlc3NNZXNzYWdlID0gbXNnID0+IHtcbiAgICAgICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBtc2cudHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IChtc2cuc291cmNlID8gc2VsZi5jb2xsZWN0aW9uc1ttc2cuc291cmNlXSA6IHNlbGYuc3RyZWFtc1ttc2cuZnJvbV0pO1xuICAgICAgICAgICAgKHRhcmdldCA/IHRhcmdldC5saXN0ZW5lcnMgOiBbXSkuZm9yRWFjaCh4ID0+XG4gICAgICAgICAgICAgICAgeFt0eXBlXSAmJiB4W3R5cGVdKG1zZykpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9wZW5XZWJzb2NrZXQgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHNvY2tldFBhdGgoKSk7XG5cbiAgICAgICAgICAgIHNvY2tldC5vbm9wZW4gPSBlID0+IHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB0YXJnZXRTdHJlYW1zXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0Q29sbGVjdGlvbnMgPSBPYmplY3Qua2V5cyhzZWxmLmNvbGxlY3Rpb25zKTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goeCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogeFxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZXZlbnQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhKVxuICAgICAgICAgICAgICAgICAgICBwcm9jZXNzTWVzc2FnZShkYXRhKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlb3BlbicpO1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbiAgICB9XG5cbiAgICBzdWJzY3JpYmUocGF0aCwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlQWxsKHBhdGhzLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBjb25zdCBuZXdTdWJzY3JpcHRpb25zID0gW107XG4gICAgICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKHBhdGggPT4ge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IHNlbGYuc3RyZWFtc1twYXRoXTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBbY2FsbGJhY2tdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN1YnNjcmliZUNvbGxlY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBwYXRoID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXRoKTtcblxuICAgICAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBbY2FsbGJhY2tdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICAgIEdldCB0aGUgc3RyZWFtX21hbmFnZXIgc2luZ2xldG9uLlxuKi9cblN0cmVhbU1hbmFnZXIuZ2V0SW5zdGFuY2UgPSAoKCkgPT4ge1xuICAgIGxldCBpbnN0YW5jZTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghaW5zdGFuY2UpXG4gICAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBTdHJlYW1NYW5hZ2VyKCk7XG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9O1xufSkoKTtcbiJdfQ==
