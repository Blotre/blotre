(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var _models = require('./models');

var models = _interopRequireWildcard(_models);

var _stream_manager = require('./stream_manager');

var stream_manager = _interopRequireWildcard(_stream_manager);

var _application_model = require('./application_model');

var application_model = _interopRequireWildcard(_application_model);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var AppViewModel = function AppViewModel(user) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.authorizations = ko.observableArray();

    self.removeAuthorization = function (clientId) {
        return self.authorizations.remove(function (x) {
            return x.clientId() === clientId;
        });
    };

    self.revokeAuthorization = function (authorization, event) {
        $.ajax({
            type: "DELETE",
            url: jsRoutes.controllers.Account.revokeAuthorization(authorization.clientId()).url
        }).then(function () {
            self.removeAuthorization(authorization.clientId());
        });
    };
};

var Authorization = function Authorization(clientId, clientName, issued) {
    var self = this;

    self.clientId = ko.observable(clientId);
    self.clientName = ko.observable(clientName);
    self.issued = ko.observable(issued);
};

$(function () {
    var model = new AppViewModel(application_model.initialUser());

    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.Account.authorizations().url,
        headers: {
            Accept: "application/json"
        }
    }).then(function (result) {
        model.authorizations(result.map(function (x) {
            return new Authorization(x.clientId, x.clientName, x.issued);
        }));
    });

    ko.applyBindings(model);
});

},{"./application_model":2,"./models":3,"./stream_manager":4}],2:[function(require,module,exports){
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

},{"./models":3,"./stream_manager":4}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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

},{"./models":3}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYWNjb3VudF9hdXRob3JpemF0aW9ucy5qcyIsImNsaWVudC9qcy9hcHBsaWNhdGlvbl9tb2RlbC5qcyIsImNsaWVudC9qcy9tb2RlbHMuanMiLCJjbGllbnQvanMvc3RyZWFtX21hbmFnZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7OztJQUNZOzs7O0lBQ0E7Ozs7SUFDQTs7OztBQUVaLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWU7QUFDOUIsUUFBSSxPQUFPLElBQVAsQ0FEMEI7QUFFOUIsc0JBQWtCLFlBQWxCLENBQStCLElBQS9CLENBQW9DLElBQXBDLEVBQTBDLElBQTFDLEVBRjhCOztBQUk5QixTQUFLLGNBQUwsR0FBc0IsR0FBRyxlQUFILEVBQXRCLENBSjhCOztBQU05QixTQUFLLG1CQUFMLEdBQTJCLFVBQVMsUUFBVCxFQUFtQjtBQUMxQyxlQUFPLEtBQUssY0FBTCxDQUFvQixNQUFwQixDQUEyQixVQUFTLENBQVQsRUFBWTtBQUMxQyxtQkFBTyxFQUFFLFFBQUYsT0FBaUIsUUFBakIsQ0FEbUM7U0FBWixDQUFsQyxDQUQwQztLQUFuQixDQU5HOztBQVk5QixTQUFLLG1CQUFMLEdBQTJCLFVBQVMsYUFBVCxFQUF3QixLQUF4QixFQUErQjtBQUN0RCxVQUFFLElBQUYsQ0FBTztBQUNILGtCQUFNLFFBQU47QUFDQSxpQkFBSyxTQUFTLFdBQVQsQ0FBcUIsT0FBckIsQ0FBNkIsbUJBQTdCLENBQWlELGNBQWMsUUFBZCxFQUFqRCxFQUEyRSxHQUEzRTtTQUZULEVBR0csSUFISCxDQUdRLFlBQVc7QUFDZixpQkFBSyxtQkFBTCxDQUF5QixjQUFjLFFBQWQsRUFBekIsRUFEZTtTQUFYLENBSFIsQ0FEc0Q7S0FBL0IsQ0FaRztDQUFmOztBQXNCbkIsSUFBSSxnQkFBZ0IsU0FBaEIsYUFBZ0IsQ0FBUyxRQUFULEVBQW1C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Q0FBdUIsUUFBdkIsRUFEUztLQUFiLE1BRU87QUFDSCxhQUFLLFdBQUwsQ0FBaUIsSUFBakIsSUFBeUI7QUFDckIsdUJBQVcsQ0FBQyxRQUFELENBQVg7U0FESixDQURHO0FBSUgsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLHFCQUFSO0FBQ0Esc0JBQU0sSUFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FOSjtDQUwwQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyBzdHJlYW1fbWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcbmltcG9ydCAqIGFzIGFwcGxpY2F0aW9uX21vZGVsIGZyb20gJy4vYXBwbGljYXRpb25fbW9kZWwnO1xuXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcblxuICAgIHNlbGYuYXV0aG9yaXphdGlvbnMgPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgIHNlbGYucmVtb3ZlQXV0aG9yaXphdGlvbiA9IGZ1bmN0aW9uKGNsaWVudElkKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmF1dGhvcml6YXRpb25zLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC5jbGllbnRJZCgpID09PSBjbGllbnRJZDtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYucmV2b2tlQXV0aG9yaXphdGlvbiA9IGZ1bmN0aW9uKGF1dGhvcml6YXRpb24sIGV2ZW50KSB7XG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5BY2NvdW50LnJldm9rZUF1dGhvcml6YXRpb24oYXV0aG9yaXphdGlvbi5jbGllbnRJZCgpKS51cmwsXG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUF1dGhvcml6YXRpb24oYXV0aG9yaXphdGlvbi5jbGllbnRJZCgpKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbn07XG5cbnZhciBBdXRob3JpemF0aW9uID0gZnVuY3Rpb24oY2xpZW50SWQsIGNsaWVudE5hbWUsIGlzc3VlZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHNlbGYuY2xpZW50SWQgPSBrby5vYnNlcnZhYmxlKGNsaWVudElkKTtcbiAgICBzZWxmLmNsaWVudE5hbWUgPSBrby5vYnNlcnZhYmxlKGNsaWVudE5hbWUpO1xuICAgIHNlbGYuaXNzdWVkID0ga28ub2JzZXJ2YWJsZShpc3N1ZWQpO1xufTtcblxuJChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSBuZXcgQXBwVmlld01vZGVsKFxuICAgICAgICBhcHBsaWNhdGlvbl9tb2RlbC5pbml0aWFsVXNlcigpKTtcblxuICAgICQuYWpheCh7XG4gICAgICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5BY2NvdW50LmF1dGhvcml6YXRpb25zKCkudXJsLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgIEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICBtb2RlbC5hdXRob3JpemF0aW9ucyhyZXN1bHQubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEF1dGhvcml6YXRpb24oeC5jbGllbnRJZCwgeC5jbGllbnROYW1lLCB4Lmlzc3VlZCk7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH0pO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCAqIGFzIHN0cmVhbV9tYW5hZ2VyIGZyb20gJy4vc3RyZWFtX21hbmFnZXInO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHBhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyID0ga28ub2JzZXJ2YWJsZSh1c2VyKTtcbiAgICBzZWxmLnBhZ2UgPSBrby5vYnNlcnZhYmxlKHBhZ2UpO1xuICAgIHNlbGYuZmF2b3JpdGVzID0ga28ub2JzZXJ2YWJsZShuZXcgbW9kZWxzLkNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpKSk7XG5cbiAgICBzZWxmLm1hbmFnZXIgPSBuZXcgc3RyZWFtX21hbmFnZXIuU3RyZWFtTWFuYWdlcigpO1xuXG4gICAgc2VsZi5hZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIHN0YXR1cyB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZSh1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYudXNlcigpLnN0YXR1cyhuZXcgbW9kZWxzLlN0YXR1c01vZGVsKG1zZy5zdGF0dXMuY29sb3IpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8ICF1c2VyLnJvb3RTdHJlYW0oKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKHVzZXIucm9vdFN0cmVhbSgpKS51cmwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIGNvbGxlY3Rpb24gdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBpbml0aWFsVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuVXNlck1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsVXNlckRhdGEpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SID0gXCIjNzc3Nzc3XCI7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplVXJpID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSSh1cmkpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgLnJlcGxhY2UoJyAnLCAnLycpO1xufTtcblxuLyoqXG4gICAgUHJldHR5IHByaW50cyBhIGRhdGEuXG4qL1xuZXhwb3J0IGNvbnN0IGRhdGVUb0Rpc3BsYXkgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuICAgIHZhciBwYWQgPSBmdW5jdGlvbihtaW4sIGlucHV0KSB7XG4gICAgICAgIGlucHV0ICs9ICcnO1xuICAgICAgICB3aGlsZSAoaW5wdXQubGVuZ3RoIDwgbWluKVxuICAgICAgICAgICAgaW5wdXQgPSAnMCcgKyBpbnB1dDtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZGF0ZSkge1xuICAgICAgICBpZiAoIWRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJy0nO1xuXG4gICAgICAgIHJldHVybiBtb250aHNbZGF0ZS5nZXRNb250aCgpXSArICcgJyArIHBhZCgyLCBkYXRlLmdldERhdGUoKSkgKyAnLCAnICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJyAnICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldEhvdXJzKCkpICsgJzonICsgcGFkKDIsIGRhdGUuZ2V0TWludXRlcygpKSArICcuJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRTZWNvbmRzKCkpICsgcGFkKDMsIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIH07XG59KCkpO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0YXR1c01vZGVsID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jb2xvciA9IGtvLm9ic2VydmFibGUoY29sb3IpO1xufTtcblxuU3RhdHVzTW9kZWwuZW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKERFRkFVTFRfQ09MT1IpO1xufTtcblxuU3RhdHVzTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChkYXRhICYmIGRhdGEuY29sb3IpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBUYWdNb2RlbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudmFsdWUgPSBrby5vYnNlcnZhYmxlKHZhbHVlKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0VGFnKHNlbGYudmFsdWUoKSkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKi9cbmNvbnN0IFBhdGhDb21wb25lbnQgPSBmdW5jdGlvbihuYW1lLCB1cmkpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSgnL3MnICsgdXJpKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RyZWFtTW9kZWwgPSBmdW5jdGlvbihpZCwgbmFtZSwgdXJpLCBzdGF0dXMsIHVwZGF0ZWQsIHRhZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5pZCA9IGtvLm9ic2VydmFibGUoaWQpO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSB8fCAnJyk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnVwZGF0ZWQgPSBrby5vYnNlcnZhYmxlKHVwZGF0ZWQpO1xuICAgIHNlbGYudGFncyA9IGtvLm9ic2VydmFibGVBcnJheSh0YWdzIHx8IFtdKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0U3RyZWFtKHNlbGYudXJpKCkpLnVybDtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKSB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpO1xuICAgICAgICBzdGF0dXMuY29sb3IoY29sb3IpO1xuICAgICAgICBzZWxmLnN0YXR1cyhzdGF0dXMpO1xuICAgIH07XG5cbiAgICBzZWxmLmRpc3BsYXlVcGRhdGVkID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRlVG9EaXNwbGF5KHNlbGYudXBkYXRlZCgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuaXNPd25lciA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgdmFyIG93bmVyVXJpID0gbm9ybWFsaXplVXJpKHVzZXIudXNlck5hbWUoKSk7XG4gICAgICAgIHJldHVybiAob3duZXJVcmkgPT09IHNlbGYudXJpKCkgfHwgc2VsZi51cmkoKS5pbmRleE9mKG93bmVyVXJpICsgJy8nKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIHNlbGYucGF0aENvbXBvbmVudHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgcGF0aHMgPSBbXTtcbiAgICAgICAgc2VsZi51cmkoKS5zcGxpdCgnLycpLnJlZHVjZSgocGF0aCwgYykgPT4ge1xuICAgICAgICAgICAgcGF0aCArPSAnLycgKyBjO1xuICAgICAgICAgICAgcGF0aHMucHVzaChuZXcgUGF0aENvbXBvbmVudChjLCBwYXRoKSk7XG4gICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgfSwgJycpO1xuICAgICAgICByZXR1cm4gcGF0aHM7XG4gICAgfSk7XG59O1xuXG5TdHJlYW1Nb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbU1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEuaWQsXG4gICAgICAgIGRhdGEgJiYgZGF0YS5uYW1lLFxuICAgICAgICBkYXRhICYmIGRhdGEudXJpLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgbmV3IERhdGUoZGF0YSAmJiBkYXRhLnVwZGF0ZWQpLCAoZGF0YSAmJiBkYXRhLnRhZ3MgfHwgW10pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRhZ01vZGVsKHgudGFnKTtcbiAgICAgICAgfSkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBVc2VyTW9kZWwgPSBmdW5jdGlvbih1c2VyTmFtZSwgc3RhdHVzLCByb290U3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlck5hbWUgPSBrby5vYnNlcnZhYmxlKHVzZXJOYW1lIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYucm9vdFN0cmVhbSA9IGtvLm9ic2VydmFibGUocm9vdFN0cmVhbSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG59O1xuXG5Vc2VyTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBVc2VyTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS51c2VyTmFtZSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIGRhdGEgJiYgZGF0YS5yb290U3RyZWFtKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkLnVyaSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi51bnNoaWZ0KGNoaWxkKTtcbiAgICB9O1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0ge307XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHt9O1xuXG4gICAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgdHlwZSA9IG1zZy50eXBlO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gKG1zZy5zb3VyY2UgPyBzZWxmLmNvbGxlY3Rpb25zW21zZy5zb3VyY2VdIDogc2VsZi5zdHJlYW1zW21zZy5mcm9tXSk7XG4gICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgaWYgKHhbdHlwZV0pXG4gICAgICAgICAgICAgICAgeFt0eXBlXShtc2cpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgdmFyIG9wZW5XZWJzb2NrZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc29ja2V0UGF0aCgpKTtcblxuICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0U3RyZWFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHRhcmdldFN0cmVhbXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0YXJnZXRDb2xsZWN0aW9ucyA9IE9iamVjdC5rZXlzKHNlbGYuY29sbGVjdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGRhdGEpXG4gICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVBbGwgPSBmdW5jdGlvbihwYXRocywgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IFtjYWxsYmFja11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBuZXdTdWJzY3JpcHRpb25zXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVDb2xsZWN0aW9uID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uc1twYXRoXSA9IHtcbiAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcbiJdfQ==
