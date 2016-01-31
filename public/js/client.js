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

},{"./models":3,"./stream_manager":4}],2:[function(require,module,exports){
'use strict';
"use-strict";

var _models = require('./models');

var models = _interopRequireWildcard(_models);

var _ui = require('./ui');

var ui = _interopRequireWildcard(_ui);

var _application_model = require('./application_model');

var application_model = _interopRequireWildcard(_application_model);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 */
var StreamIndexViewModel = function StreamIndexViewModel(user, clientId) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.clientId = ko.observable(clientId);
};

var updateRedirects = function updateRedirects(clientId, rediectBlob) {
    ui.showLoadingScreen();
    $.ajax({
        type: "POST",
        url: jsRoutes.controllers.DeveloperController.setRedirects(clientId).url,
        data: JSON.stringify(rediectBlob.split('\n')),
        contentType: 'application/json',
        error: function error(e) {
            ui.setAlert('alert-danger', e.status == 422 ? "Specified redirects are invalid. Must be at most 10 http(s) urls." : "An error occurred.");
            ui.hideLoadingScreen();
        }
    }).done(function (result) {
        ui.clearAlerts();
        ui.hideLoadingScreen();
    });
};

/**
    Actually delete the client.

    Redirects to the developer home page on success.
*/
var deleteClient = function deleteClient(clientId) {
    ui.showLoadingScreen();
    $.ajax({
        type: "DELETE",
        url: jsRoutes.controllers.DeveloperController.deleteClient(clientId).url,
        error: function error() {
            ui.setAlert('alert-danger', "Could not delete client, please try again.");
            ui.hideLoadingScreen();
        }
    }).done(function (result) {
        window.location = jsRoutes.controllers.DeveloperController.index().url;
    });
};

/**
    Prompt the user to ensure they really want to delete the client.
*/
var askDeleteClient = function askDeleteClient(clientId) {
    bootbox.confirm({
        title: "Are you sure?",
        animate: false,
        closeButton: false,
        message: "This will permanently delete this client and invalidate all token for it.",
        callback: function callback(result) {
            if (result) {
                deleteClient(clientId);
            }
        }
    });
};

/**
 */
$(function () {
    var model = new StreamIndexViewModel(application_model.initialUser(), window.clientId);

    var currentRedirects = $('#redirects-textbox').val();

    $('#cancel-redirects-button').on('click', function (e) {
        $('#redirects-textbox').val(currentRedirects);
        $('#save-redirects-button, #cancel-redirects-button').attr("disabled", true);
    });

    $('#redirects-textbox').on('input', function (e) {
        $('#save-redirects-button, #cancel-redirects-button').attr("disabled", false);
    });

    $('#save-redirects-button').on('click', function () {
        updateRedirects(model.clientId(), $('#redirects-textbox').val());
    });

    $('#delete-client-button').on('click', function (e) {
        askDeleteClient(model.clientId());
    });
});

},{"./application_model":1,"./models":3,"./ui":5}],3:[function(require,module,exports){
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

},{"./models":3}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var showLoadingScreen = exports.showLoadingScreen = function showLoadingScreen() {
    $('#loading-overlay').removeClass('hidden');
};

var hideLoadingScreen = exports.hideLoadingScreen = function hideLoadingScreen() {
    $('#loading-overlay').addClass('hidden');
};

/**
    Remove all alerts.
*/
var clearAlerts = exports.clearAlerts = function clearAlerts() {
    $('#alerts').empty();
};

/**
    Append a new alert
*/
var addAlert = exports.addAlert = function addAlert(type, content) {
    $('#alerts').append($('<li class="alert" role="alert">').addClass(type).append('<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>', content));
};

/**
    Set the current alert, removing all existing ones.
*/
var setAlert = exports.setAlert = function setAlert(type, content) {
    clearAlerts();
    addAlert(type, content);
};

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvY2xpZW50LmpzIiwiY2xpZW50L2pzL21vZGVscy5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyIsImNsaWVudC9qcy91aS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7Ozs7Ozs7SUFDWTs7Ozs7Ozs7Ozs7O0FBS0wsSUFBTSxzQ0FBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsSUFBZixFQUFxQjtBQUM3QyxRQUFJLE9BQU8sSUFBUCxDQUR5QztBQUU3QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGNkM7QUFHN0MsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBSDZDO0FBSTdDLFNBQUssU0FBTCxHQUFpQixHQUFHLFVBQUgsQ0FBYyxJQUFJLE9BQU8sVUFBUCxDQUFrQixLQUFLLFFBQUwsRUFBdEIsQ0FBZCxDQUFqQixDQUo2Qzs7QUFNN0MsU0FBSyxPQUFMLEdBQWUseUJBQWMsV0FBZCxFQUFmLENBTjZDOztBQVE3QyxTQUFLLFdBQUwsR0FBbUIsVUFBUyxLQUFULEVBQWdCO0FBQy9CLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixLQUExQixFQUQrQjtLQUFoQixDQVIwQjs7QUFZN0MsU0FBSyxjQUFMLEdBQXNCLFVBQVMsUUFBVCxFQUFtQjtBQUNyQyxlQUFPLEtBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixNQUExQixDQUFpQyxVQUFTLENBQVQsRUFBWTtBQUNoRCxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHlDO1NBQVosQ0FBeEMsQ0FEcUM7S0FBbkI7OztBQVp1QixRQW1CN0MsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7QUFDcEMseUJB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SUFBSSxhQUFKLEVBQVgsQ0FESjtBQUVBLGVBQU8sUUFBUCxDQUhjO0tBQVgsQ0FGd0I7Q0FBTixFQUE3Qjs7O0FDNUhBOzs7OztBQUVPLElBQU0sZ0RBQW9CLFNBQXBCLGlCQUFvQixHQUFNO0FBQ25DLE1BQUUsa0JBQUYsRUFBc0IsV0FBdEIsQ0FBa0MsUUFBbEMsRUFEbUM7Q0FBTjs7QUFJMUIsSUFBTSxnREFBb0IsU0FBcEIsaUJBQW9CLEdBQU07QUFDbkMsTUFBRSxrQkFBRixFQUFzQixRQUF0QixDQUErQixRQUEvQixFQURtQztDQUFOOzs7OztBQU8xQixJQUFNLG9DQUFjLFNBQWQsV0FBYyxHQUFNO0FBQzdCLE1BQUUsU0FBRixFQUFhLEtBQWIsR0FENkI7Q0FBTjs7Ozs7QUFPcEIsSUFBTSw4QkFBVyxTQUFYLFFBQVcsQ0FBQyxJQUFELEVBQU8sT0FBUCxFQUFtQjtBQUN2QyxNQUFFLFNBQUYsRUFBYSxNQUFiLENBQW9CLEVBQUUsaUNBQUYsRUFDZixRQURlLENBQ04sSUFETSxFQUVmLE1BRmUsQ0FHWiw2SUFIWSxFQUlaLE9BSlksQ0FBcEIsRUFEdUM7Q0FBbkI7Ozs7O0FBV2pCLElBQU0sOEJBQVcsU0FBWCxRQUFXLENBQUMsSUFBRCxFQUFPLE9BQVAsRUFBbUI7QUFDdkMsa0JBRHVDO0FBRXZDLGFBQVMsSUFBVCxFQUFlLE9BQWYsRUFGdUM7Q0FBbkIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0IFN0cmVhbU1hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IFN0cmVhbU1hbmFnZXIuZ2V0SW5zdGFuY2UoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG4iLCJcInVzZS1zdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyB1aSBmcm9tICcuL3VpJztcbmltcG9ydCAqIGFzIGFwcGxpY2F0aW9uX21vZGVsIGZyb20gJy4vYXBwbGljYXRpb25fbW9kZWwnO1xuXG4vKipcbiAqL1xudmFyIFN0cmVhbUluZGV4Vmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgY2xpZW50SWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG5cbiAgICBzZWxmLmNsaWVudElkID0ga28ub2JzZXJ2YWJsZShjbGllbnRJZCk7XG59O1xuXG5cbnZhciB1cGRhdGVSZWRpcmVjdHMgPSBmdW5jdGlvbihjbGllbnRJZCwgcmVkaWVjdEJsb2IpIHtcbiAgICB1aS5zaG93TG9hZGluZ1NjcmVlbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLkRldmVsb3BlckNvbnRyb2xsZXIuc2V0UmVkaXJlY3RzKGNsaWVudElkKS51cmwsXG4gICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHJlZGllY3RCbG9iLnNwbGl0KCdcXG4nKSksXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB1aS5zZXRBbGVydCgnYWxlcnQtZGFuZ2VyJywgZS5zdGF0dXMgPT0gNDIyID8gXCJTcGVjaWZpZWQgcmVkaXJlY3RzIGFyZSBpbnZhbGlkLiBNdXN0IGJlIGF0IG1vc3QgMTAgaHR0cChzKSB1cmxzLlwiIDogXCJBbiBlcnJvciBvY2N1cnJlZC5cIik7XG4gICAgICAgICAgICB1aS5oaWRlTG9hZGluZ1NjcmVlbigpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgdWkuY2xlYXJBbGVydHMoKTtcbiAgICAgICAgdWkuaGlkZUxvYWRpbmdTY3JlZW4oKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIEFjdHVhbGx5IGRlbGV0ZSB0aGUgY2xpZW50LlxuXG4gICAgUmVkaXJlY3RzIHRvIHRoZSBkZXZlbG9wZXIgaG9tZSBwYWdlIG9uIHN1Y2Nlc3MuXG4qL1xudmFyIGRlbGV0ZUNsaWVudCA9IGZ1bmN0aW9uKGNsaWVudElkKSB7XG4gICAgdWkuc2hvd0xvYWRpbmdTY3JlZW4oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLkRldmVsb3BlckNvbnRyb2xsZXIuZGVsZXRlQ2xpZW50KGNsaWVudElkKS51cmwsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHVpLnNldEFsZXJ0KCdhbGVydC1kYW5nZXInLCBcIkNvdWxkIG5vdCBkZWxldGUgY2xpZW50LCBwbGVhc2UgdHJ5IGFnYWluLlwiKTtcbiAgICAgICAgICAgIHVpLmhpZGVMb2FkaW5nU2NyZWVuKCk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24gPSBqc1JvdXRlcy5jb250cm9sbGVycy5EZXZlbG9wZXJDb250cm9sbGVyLmluZGV4KCkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgUHJvbXB0IHRoZSB1c2VyIHRvIGVuc3VyZSB0aGV5IHJlYWxseSB3YW50IHRvIGRlbGV0ZSB0aGUgY2xpZW50LlxuKi9cbnZhciBhc2tEZWxldGVDbGllbnQgPSBmdW5jdGlvbihjbGllbnRJZCkge1xuICAgIGJvb3Rib3guY29uZmlybSh7XG4gICAgICAgIHRpdGxlOiBcIkFyZSB5b3Ugc3VyZT9cIixcbiAgICAgICAgYW5pbWF0ZTogZmFsc2UsXG4gICAgICAgIGNsb3NlQnV0dG9uOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTogXCJUaGlzIHdpbGwgcGVybWFuZW50bHkgZGVsZXRlIHRoaXMgY2xpZW50IGFuZCBpbnZhbGlkYXRlIGFsbCB0b2tlbiBmb3IgaXQuXCIsXG4gICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBkZWxldGVDbGllbnQoY2xpZW50SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xuJChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSBuZXcgU3RyZWFtSW5kZXhWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCksXG4gICAgICAgIHdpbmRvdy5jbGllbnRJZCk7XG5cbiAgICB2YXIgY3VycmVudFJlZGlyZWN0cyA9ICQoJyNyZWRpcmVjdHMtdGV4dGJveCcpLnZhbCgpO1xuXG4gICAgJCgnI2NhbmNlbC1yZWRpcmVjdHMtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAkKCcjcmVkaXJlY3RzLXRleHRib3gnKS52YWwoY3VycmVudFJlZGlyZWN0cyk7XG4gICAgICAgICQoJyNzYXZlLXJlZGlyZWN0cy1idXR0b24sICNjYW5jZWwtcmVkaXJlY3RzLWJ1dHRvbicpXG4gICAgICAgICAgICAuYXR0cihcImRpc2FibGVkXCIsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgJCgnI3JlZGlyZWN0cy10ZXh0Ym94Jykub24oJ2lucHV0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAkKCcjc2F2ZS1yZWRpcmVjdHMtYnV0dG9uLCAjY2FuY2VsLXJlZGlyZWN0cy1idXR0b24nKVxuICAgICAgICAgICAgLmF0dHIoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XG4gICAgfSk7XG5cbiAgICAkKCcjc2F2ZS1yZWRpcmVjdHMtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHVwZGF0ZVJlZGlyZWN0cyhtb2RlbC5jbGllbnRJZCgpLCAkKCcjcmVkaXJlY3RzLXRleHRib3gnKS52YWwoKSk7XG4gICAgfSk7XG5cbiAgICAkKCcjZGVsZXRlLWNsaWVudC1idXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGFza0RlbGV0ZUNsaWVudChtb2RlbC5jbGllbnRJZCgpKTtcbiAgICB9KTtcbn0pO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBzbGljZSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiM3Nzc3NzdcIjtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBub3JtYWxpemVVcmkgPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHVyaSlcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgnICcsICcvJyk7XG59O1xuXG4vKipcbiAgICBQcmV0dHkgcHJpbnRzIGEgZGF0YS5cbiovXG5leHBvcnQgY29uc3QgZGF0ZVRvRGlzcGxheSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4gICAgdmFyIHBhZCA9IGZ1bmN0aW9uKG1pbiwgaW5wdXQpIHtcbiAgICAgICAgaW5wdXQgKz0gJyc7XG4gICAgICAgIHdoaWxlIChpbnB1dC5sZW5ndGggPCBtaW4pXG4gICAgICAgICAgICBpbnB1dCA9ICcwJyArIGlucHV0O1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihkYXRlKSB7XG4gICAgICAgIGlmICghZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnLSc7XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoc1tkYXRlLmdldE1vbnRoKCldICsgJyAnICsgcGFkKDIsIGRhdGUuZ2V0RGF0ZSgpKSArICcsICcgKyBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnICcgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0SG91cnMoKSkgKyAnOicgKyBwYWQoMiwgZGF0ZS5nZXRNaW51dGVzKCkpICsgJy4nICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldFNlY29uZHMoKSkgKyBwYWQoMywgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgfTtcbn0oKSk7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RhdHVzTW9kZWwgPSBmdW5jdGlvbihjb2xvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmNvbG9yID0ga28ub2JzZXJ2YWJsZShjb2xvcik7XG59O1xuXG5TdGF0dXNNb2RlbC5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoREVGQVVMVF9DT0xPUik7XG59O1xuXG5TdGF0dXNNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKGRhdGEgJiYgZGF0YS5jb2xvcik7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFRhZ01vZGVsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi52YWx1ZSA9IGtvLm9ic2VydmFibGUodmFsdWUpO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRUYWcoc2VsZi52YWx1ZSgpKS51cmw7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xuY29uc3QgUGF0aENvbXBvbmVudCA9IGZ1bmN0aW9uKG5hbWUsIHVyaSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKCcvcycgKyB1cmkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1Nb2RlbCA9IGZ1bmN0aW9uKGlkLCBuYW1lLCB1cmksIHN0YXR1cywgdXBkYXRlZCwgdGFncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmlkID0ga28ub2JzZXJ2YWJsZShpZCk7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lIHx8ICcnKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYudXBkYXRlZCA9IGtvLm9ic2VydmFibGUodXBkYXRlZCk7XG4gICAgc2VsZi50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KHRhZ3MgfHwgW10pO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0oc2VsZi51cmkoKSkudXJsO1xuICAgIH0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpIHx8IFN0YXR1c01vZGVsLmVtcHR5KCk7XG4gICAgICAgIHN0YXR1cy5jb2xvcihjb2xvcik7XG4gICAgICAgIHNlbGYuc3RhdHVzKHN0YXR1cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZGlzcGxheVVwZGF0ZWQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRhdGVUb0Rpc3BsYXkoc2VsZi51cGRhdGVkKCkpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5pc093bmVyID0gZnVuY3Rpb24odXNlcikge1xuICAgICAgICB2YXIgb3duZXJVcmkgPSBub3JtYWxpemVVcmkodXNlci51c2VyTmFtZSgpKTtcbiAgICAgICAgcmV0dXJuIChvd25lclVyaSA9PT0gc2VsZi51cmkoKSB8fCBzZWxmLnVyaSgpLmluZGV4T2Yob3duZXJVcmkgKyAnLycpID09PSAwKTtcbiAgICB9O1xuXG4gICAgc2VsZi5wYXRoQ29tcG9uZW50cyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBwYXRocyA9IFtdO1xuICAgICAgICBzZWxmLnVyaSgpLnNwbGl0KCcvJykucmVkdWNlKChwYXRoLCBjKSA9PiB7XG4gICAgICAgICAgICBwYXRoICs9ICcvJyArIGM7XG4gICAgICAgICAgICBwYXRocy5wdXNoKG5ldyBQYXRoQ29tcG9uZW50KGMsIHBhdGgpKTtcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICB9LCAnJyk7XG4gICAgICAgIHJldHVybiBwYXRocztcbiAgICB9KTtcbn07XG5cblN0cmVhbU1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS5pZCxcbiAgICAgICAgZGF0YSAmJiBkYXRhLm5hbWUsXG4gICAgICAgIGRhdGEgJiYgZGF0YS51cmksXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBuZXcgRGF0ZShkYXRhICYmIGRhdGEudXBkYXRlZCksIChkYXRhICYmIGRhdGEudGFncyB8fCBbXSkubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGFnTW9kZWwoeC50YWcpO1xuICAgICAgICB9KSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFVzZXJNb2RlbCA9IGZ1bmN0aW9uKHVzZXJOYW1lLCBzdGF0dXMsIHJvb3RTdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyTmFtZSA9IGtvLm9ic2VydmFibGUodXNlck5hbWUgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi5yb290U3RyZWFtID0ga28ub2JzZXJ2YWJsZShyb290U3RyZWFtKTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcbn07XG5cblVzZXJNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFVzZXJNb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVzZXJOYW1lLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnJvb3RTdHJlYW0pO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBDb2xsZWN0aW9uID0gZnVuY3Rpb24odXJpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGQudXJpKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpO1xuICAgIH07XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuXG5jb25zdCBzb2NrZXRQYXRoID0gKCkgPT4ge1xuICAgIGNvbnN0IHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4gICAgTWFuYWdlcyBhIHdlYnNvY2tldCBjb25uZWN0aW9uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN0cmVhbU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHNlbGYuc3RyZWFtcyA9IHt9O1xuICAgICAgICBzZWxmLmNvbGxlY3Rpb25zID0ge307XG4gICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBwcm9jZXNzTWVzc2FnZSA9IG1zZyA9PiB7XG4gICAgICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goeCA9PlxuICAgICAgICAgICAgICAgIHhbdHlwZV0gJiYgeFt0eXBlXShtc2cpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBvcGVuV2Vic29ja2V0ID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgICAgICBzb2NrZXQub25vcGVuID0gZSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKHggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGV2ZW50ID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHN1YnNjcmliZUFsbChwYXRocywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgY29uc3QgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgICAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IG5ld1N1YnNjcmlwdGlvbnNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdWJzY3JpYmVDb2xsZWN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdID0ge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiBwYXRoXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAgICBHZXQgdGhlIHN0cmVhbV9tYW5hZ2VyIHNpbmdsZXRvbi5cbiovXG5TdHJlYW1NYW5hZ2VyLmdldEluc3RhbmNlID0gKCgpID0+IHtcbiAgICBsZXQgaW5zdGFuY2U7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIWluc3RhbmNlKVxuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgU3RyZWFtTWFuYWdlcigpO1xuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfTtcbn0pKCk7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0IGNvbnN0IHNob3dMb2FkaW5nU2NyZWVuID0gKCkgPT4ge1xuICAgICQoJyNsb2FkaW5nLW92ZXJsYXknKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG59O1xuXG5leHBvcnQgY29uc3QgaGlkZUxvYWRpbmdTY3JlZW4gPSAoKSA9PiB7XG4gICAgJCgnI2xvYWRpbmctb3ZlcmxheScpLmFkZENsYXNzKCdoaWRkZW4nKTtcbn07XG5cbi8qKlxuICAgIFJlbW92ZSBhbGwgYWxlcnRzLlxuKi9cbmV4cG9ydCBjb25zdCBjbGVhckFsZXJ0cyA9ICgpID0+IHtcbiAgICAkKCcjYWxlcnRzJykuZW1wdHkoKTtcbn07XG5cbi8qKlxuICAgIEFwcGVuZCBhIG5ldyBhbGVydFxuKi9cbmV4cG9ydCBjb25zdCBhZGRBbGVydCA9ICh0eXBlLCBjb250ZW50KSA9PiB7XG4gICAgJCgnI2FsZXJ0cycpLmFwcGVuZCgkKCc8bGkgY2xhc3M9XCJhbGVydFwiIHJvbGU9XCJhbGVydFwiPicpXG4gICAgICAgIC5hZGRDbGFzcyh0eXBlKVxuICAgICAgICAuYXBwZW5kKFxuICAgICAgICAgICAgJzxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY2xvc2VcIiBkYXRhLWRpc21pc3M9XCJhbGVydFwiPjxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiZ0aW1lczs8L3NwYW4+PHNwYW4gY2xhc3M9XCJzci1vbmx5XCI+Q2xvc2U8L3NwYW4+PC9idXR0b24+JyxcbiAgICAgICAgICAgIGNvbnRlbnQpKTtcbn07XG5cbi8qKlxuICAgIFNldCB0aGUgY3VycmVudCBhbGVydCwgcmVtb3ZpbmcgYWxsIGV4aXN0aW5nIG9uZXMuXG4qL1xuZXhwb3J0IGNvbnN0IHNldEFsZXJ0ID0gKHR5cGUsIGNvbnRlbnQpID0+IHtcbiAgICBjbGVhckFsZXJ0cygpO1xuICAgIGFkZEFsZXJ0KHR5cGUsIGNvbnRlbnQpO1xufTtcbiJdfQ==
