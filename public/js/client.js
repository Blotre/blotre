(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var _models = require('./models');

var models = _interopRequireWildcard(_models);

var _stream_manager = require('./stream_manager');

var stream_manager = _interopRequireWildcard(_stream_manager);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvY2xpZW50LmpzIiwiY2xpZW50L2pzL21vZGVscy5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyIsImNsaWVudC9qcy91aS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7O0lBQ1k7Ozs7SUFDQTs7Ozs7O0FBSVosSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7QUFDcEMseUJB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LFlBQUksS0FBSyxLQUFMLEVBQVk7QUFDWixpQkFBSyxNQUFMLENBQVksSUFBWixDQUFpQixLQUFLLFNBQUwsQ0FBZTtBQUM1Qix3QkFBUSxxQkFBUjtBQUNBLHNCQUFNLElBQU47YUFGYSxDQUFqQixFQURZO1NBQWhCO0tBSko7Q0FMMEM7OztBQ25HOUM7Ozs7O0FBRU8sSUFBTSxnREFBb0IsU0FBcEIsaUJBQW9CLEdBQU07QUFDbkMsTUFBRSxrQkFBRixFQUFzQixXQUF0QixDQUFrQyxRQUFsQyxFQURtQztDQUFOOztBQUkxQixJQUFNLGdEQUFvQixTQUFwQixpQkFBb0IsR0FBTTtBQUNuQyxNQUFFLGtCQUFGLEVBQXNCLFFBQXRCLENBQStCLFFBQS9CLEVBRG1DO0NBQU47Ozs7O0FBTzFCLElBQU0sb0NBQWMsU0FBZCxXQUFjLEdBQU07QUFDN0IsTUFBRSxTQUFGLEVBQWEsS0FBYixHQUQ2QjtDQUFOOzs7OztBQU9wQixJQUFNLDhCQUFXLFNBQVgsUUFBVyxDQUFDLElBQUQsRUFBTyxPQUFQLEVBQW1CO0FBQ3ZDLE1BQUUsU0FBRixFQUFhLE1BQWIsQ0FDSSxFQUFFLGlDQUFGLEVBQ0ssUUFETCxDQUNjLElBRGQsRUFFSyxNQUZMLENBR1EsNklBSFIsRUFJUSxPQUpSLENBREosRUFEdUM7Q0FBbkI7Ozs7O0FBWWpCLElBQU0sOEJBQVcsU0FBWCxRQUFXLENBQUMsSUFBRCxFQUFPLE9BQVAsRUFBbUI7QUFDdkMsa0JBRHVDO0FBRXZDLGFBQVMsSUFBVCxFQUFlLE9BQWYsRUFGdUM7Q0FBbkIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0ICogYXMgc3RyZWFtX21hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5cbi8qKlxuKi9cbnZhciBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBwYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5wYWdlID0ga28ub2JzZXJ2YWJsZShwYWdlKTtcbiAgICBzZWxmLmZhdm9yaXRlcyA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSkpO1xuXG4gICAgc2VsZi5tYW5hZ2VyID0gbmV3IHN0cmVhbV9tYW5hZ2VyLlN0cmVhbU1hbmFnZXIoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIHN0YXR1cyB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZSh1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYudXNlcigpLnN0YXR1cyhuZXcgbW9kZWxzLlN0YXR1c01vZGVsKG1zZy5zdGF0dXMuY29sb3IpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8ICF1c2VyLnJvb3RTdHJlYW0oKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKHVzZXIucm9vdFN0cmVhbSgpKS51cmwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHsgY29uc29sZS5lcnJvcihlKTsgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xuXG4gICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIGNvbGxlY3Rpb24gdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbnZhciBpbml0aWFsVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuVXNlck1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsVXNlckRhdGEpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgQXBwVmlld01vZGVsOiBBcHBWaWV3TW9kZWwsXG4gICAgaW5pdGlhbFVzZXI6IGluaXRpYWxVc2VyXG59O1xuIiwiXCJ1c2Utc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0ICogYXMgdWkgZnJvbSAnLi91aSc7XG5pbXBvcnQgKiBhcyBhcHBsaWNhdGlvbl9tb2RlbCBmcm9tICcuL2FwcGxpY2F0aW9uX21vZGVsJztcblxuLyoqXG4qL1xudmFyIFN0cmVhbUluZGV4Vmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgY2xpZW50SWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG5cbiAgICBzZWxmLmNsaWVudElkID0ga28ub2JzZXJ2YWJsZShjbGllbnRJZCk7XG59O1xuXG5cbnZhciB1cGRhdGVSZWRpcmVjdHMgPSBmdW5jdGlvbihjbGllbnRJZCwgcmVkaWVjdEJsb2IpIHtcbiAgICB1aS5zaG93TG9hZGluZ1NjcmVlbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLkRldmVsb3BlckNvbnRyb2xsZXIuc2V0UmVkaXJlY3RzKGNsaWVudElkKS51cmwsXG4gICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHJlZGllY3RCbG9iLnNwbGl0KCdcXG4nKSksXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB1aS5zZXRBbGVydCgnYWxlcnQtZGFuZ2VyJywgZS5zdGF0dXMgPT0gNDIyID8gXCJTcGVjaWZpZWQgcmVkaXJlY3RzIGFyZSBpbnZhbGlkLiBNdXN0IGJlIGF0IG1vc3QgMTAgaHR0cChzKSB1cmxzLlwiIDogXCJBbiBlcnJvciBvY2N1cnJlZC5cIik7XG4gICAgICAgICAgICB1aS5oaWRlTG9hZGluZ1NjcmVlbigpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgdWkuY2xlYXJBbGVydHMoKTtcbiAgICAgICAgdWkuaGlkZUxvYWRpbmdTY3JlZW4oKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIEFjdHVhbGx5IGRlbGV0ZSB0aGUgY2xpZW50LlxuXG4gICAgUmVkaXJlY3RzIHRvIHRoZSBkZXZlbG9wZXIgaG9tZSBwYWdlIG9uIHN1Y2Nlc3MuXG4qL1xudmFyIGRlbGV0ZUNsaWVudCA9IGZ1bmN0aW9uKGNsaWVudElkKSB7XG4gICAgdWkuc2hvd0xvYWRpbmdTY3JlZW4oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLkRldmVsb3BlckNvbnRyb2xsZXIuZGVsZXRlQ2xpZW50KGNsaWVudElkKS51cmwsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHVpLnNldEFsZXJ0KCdhbGVydC1kYW5nZXInLCBcIkNvdWxkIG5vdCBkZWxldGUgY2xpZW50LCBwbGVhc2UgdHJ5IGFnYWluLlwiKTtcbiAgICAgICAgICAgIHVpLmhpZGVMb2FkaW5nU2NyZWVuKCk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24gPSBqc1JvdXRlcy5jb250cm9sbGVycy5EZXZlbG9wZXJDb250cm9sbGVyLmluZGV4KCkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgUHJvbXB0IHRoZSB1c2VyIHRvIGVuc3VyZSB0aGV5IHJlYWxseSB3YW50IHRvIGRlbGV0ZSB0aGUgY2xpZW50LlxuKi9cbnZhciBhc2tEZWxldGVDbGllbnQgPSBmdW5jdGlvbihjbGllbnRJZCkge1xuICAgIGJvb3Rib3guY29uZmlybSh7XG4gICAgICAgIHRpdGxlOiBcIkFyZSB5b3Ugc3VyZT9cIixcbiAgICAgICAgYW5pbWF0ZTogZmFsc2UsXG4gICAgICAgIGNsb3NlQnV0dG9uOiBmYWxzZSxcbiAgICAgICAgbWVzc2FnZTogXCJUaGlzIHdpbGwgcGVybWFuZW50bHkgZGVsZXRlIHRoaXMgY2xpZW50IGFuZCBpbnZhbGlkYXRlIGFsbCB0b2tlbiBmb3IgaXQuXCIsXG4gICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBkZWxldGVDbGllbnQoY2xpZW50SWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiovXG4kKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbCA9IG5ldyBTdHJlYW1JbmRleFZpZXdNb2RlbChcbiAgICAgICAgYXBwbGljYXRpb25fbW9kZWwuaW5pdGlhbFVzZXIoKSxcbiAgICAgICAgd2luZG93LmNsaWVudElkKTtcblxuICAgIHZhciBjdXJyZW50UmVkaXJlY3RzID0gICQoJyNyZWRpcmVjdHMtdGV4dGJveCcpLnZhbCgpO1xuXG4gICAgJCgnI2NhbmNlbC1yZWRpcmVjdHMtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAkKCcjcmVkaXJlY3RzLXRleHRib3gnKS52YWwoY3VycmVudFJlZGlyZWN0cyk7XG4gICAgICAgICQoJyNzYXZlLXJlZGlyZWN0cy1idXR0b24sICNjYW5jZWwtcmVkaXJlY3RzLWJ1dHRvbicpXG4gICAgICAgICAgICAuYXR0cihcImRpc2FibGVkXCIsIHRydWUpO1xuICAgIH0pO1xuXG4gICAgJCgnI3JlZGlyZWN0cy10ZXh0Ym94Jykub24oJ2lucHV0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAkKCcjc2F2ZS1yZWRpcmVjdHMtYnV0dG9uLCAjY2FuY2VsLXJlZGlyZWN0cy1idXR0b24nKVxuICAgICAgICAgICAgLmF0dHIoXCJkaXNhYmxlZFwiLCBmYWxzZSk7XG4gICAgfSk7XG5cbiAgICAkKCcjc2F2ZS1yZWRpcmVjdHMtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHVwZGF0ZVJlZGlyZWN0cyhtb2RlbC5jbGllbnRJZCgpLCAkKCcjcmVkaXJlY3RzLXRleHRib3gnKS52YWwoKSk7XG4gICAgfSk7XG5cbiAgICAkKCcjZGVsZXRlLWNsaWVudC1idXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGFza0RlbGV0ZUNsaWVudChtb2RlbC5jbGllbnRJZCgpKTtcbiAgICB9KTtcbn0pO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBzbGljZSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiM3Nzc3NzdcIjtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBub3JtYWxpemVVcmkgPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHVyaSlcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgnICcsICcvJyk7XG59O1xuXG4vKipcbiAgICBQcmV0dHkgcHJpbnRzIGEgZGF0YS5cbiovXG5leHBvcnQgY29uc3QgZGF0ZVRvRGlzcGxheSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4gICAgdmFyIHBhZCA9IGZ1bmN0aW9uKG1pbiwgaW5wdXQpIHtcbiAgICAgICAgaW5wdXQgKz0gJyc7XG4gICAgICAgIHdoaWxlIChpbnB1dC5sZW5ndGggPCBtaW4pXG4gICAgICAgICAgICBpbnB1dCA9ICcwJyArIGlucHV0O1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihkYXRlKSB7XG4gICAgICAgIGlmICghZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnLSc7XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoc1tkYXRlLmdldE1vbnRoKCldICsgJyAnICsgcGFkKDIsIGRhdGUuZ2V0RGF0ZSgpKSArICcsICcgKyBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnICcgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0SG91cnMoKSkgKyAnOicgKyBwYWQoMiwgZGF0ZS5nZXRNaW51dGVzKCkpICsgJy4nICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldFNlY29uZHMoKSkgKyBwYWQoMywgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgfTtcbn0oKSk7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RhdHVzTW9kZWwgPSBmdW5jdGlvbihjb2xvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmNvbG9yID0ga28ub2JzZXJ2YWJsZShjb2xvcik7XG59O1xuXG5TdGF0dXNNb2RlbC5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoREVGQVVMVF9DT0xPUik7XG59O1xuXG5TdGF0dXNNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKGRhdGEgJiYgZGF0YS5jb2xvcik7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFRhZ01vZGVsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi52YWx1ZSA9IGtvLm9ic2VydmFibGUodmFsdWUpO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRUYWcoc2VsZi52YWx1ZSgpKS51cmw7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xuY29uc3QgUGF0aENvbXBvbmVudCA9IGZ1bmN0aW9uKG5hbWUsIHVyaSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKCcvcycgKyB1cmkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1Nb2RlbCA9IGZ1bmN0aW9uKGlkLCBuYW1lLCB1cmksIHN0YXR1cywgdXBkYXRlZCwgdGFncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmlkID0ga28ub2JzZXJ2YWJsZShpZCk7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lIHx8ICcnKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYudXBkYXRlZCA9IGtvLm9ic2VydmFibGUodXBkYXRlZCk7XG4gICAgc2VsZi50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KHRhZ3MgfHwgW10pO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0oc2VsZi51cmkoKSkudXJsO1xuICAgIH0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpIHx8IFN0YXR1c01vZGVsLmVtcHR5KCk7XG4gICAgICAgIHN0YXR1cy5jb2xvcihjb2xvcik7XG4gICAgICAgIHNlbGYuc3RhdHVzKHN0YXR1cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZGlzcGxheVVwZGF0ZWQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRhdGVUb0Rpc3BsYXkoc2VsZi51cGRhdGVkKCkpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5pc093bmVyID0gZnVuY3Rpb24odXNlcikge1xuICAgICAgICB2YXIgb3duZXJVcmkgPSBub3JtYWxpemVVcmkodXNlci51c2VyTmFtZSgpKTtcbiAgICAgICAgcmV0dXJuIChvd25lclVyaSA9PT0gc2VsZi51cmkoKSB8fCBzZWxmLnVyaSgpLmluZGV4T2Yob3duZXJVcmkgKyAnLycpID09PSAwKTtcbiAgICB9O1xuXG4gICAgc2VsZi5wYXRoQ29tcG9uZW50cyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBwYXRocyA9IFtdO1xuICAgICAgICBzZWxmLnVyaSgpLnNwbGl0KCcvJykucmVkdWNlKChwYXRoLCBjKSA9PiB7XG4gICAgICAgICAgICBwYXRoICs9ICcvJyArIGM7XG4gICAgICAgICAgICBwYXRocy5wdXNoKG5ldyBQYXRoQ29tcG9uZW50KGMsIHBhdGgpKTtcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICB9LCAnJyk7XG4gICAgICAgIHJldHVybiBwYXRocztcbiAgICB9KTtcbn07XG5cblN0cmVhbU1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS5pZCxcbiAgICAgICAgZGF0YSAmJiBkYXRhLm5hbWUsXG4gICAgICAgIGRhdGEgJiYgZGF0YS51cmksXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBuZXcgRGF0ZShkYXRhICYmIGRhdGEudXBkYXRlZCksIChkYXRhICYmIGRhdGEudGFncyB8fCBbXSkubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGFnTW9kZWwoeC50YWcpO1xuICAgICAgICB9KSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFVzZXJNb2RlbCA9IGZ1bmN0aW9uKHVzZXJOYW1lLCBzdGF0dXMsIHJvb3RTdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyTmFtZSA9IGtvLm9ic2VydmFibGUodXNlck5hbWUgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi5yb290U3RyZWFtID0ga28ub2JzZXJ2YWJsZShyb290U3RyZWFtKTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcbn07XG5cblVzZXJNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFVzZXJNb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVzZXJOYW1lLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnJvb3RTdHJlYW0pO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBDb2xsZWN0aW9uID0gZnVuY3Rpb24odXJpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGQudXJpKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpO1xuICAgIH07XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuXG52YXIgc29ja2V0UGF0aCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWN1cmUgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwczonO1xuICAgIHJldHVybiAoc2VjdXJlID8gJ3dzcycgOiAnd3MnKSArICc6Ly8nICsgd2luZG93LmxvY2F0aW9uLmhvc3QgKyAnL3YwL3dzJztcbn07XG5cbi8qKlxuKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1NYW5hZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuc3RyZWFtcyA9IHsgfTtcbiAgICBzZWxmLmNvbGxlY3Rpb25zID0geyB9O1xuXG4gICAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgdHlwZSA9IG1zZy50eXBlO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gKG1zZy5zb3VyY2UgPyBzZWxmLmNvbGxlY3Rpb25zW21zZy5zb3VyY2VdIDogc2VsZi5zdHJlYW1zW21zZy5mcm9tXSk7XG4gICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgaWYgKHhbdHlwZV0pXG4gICAgICAgICAgICAgICAgeFt0eXBlXShtc2cpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgdmFyIG9wZW5XZWJzb2NrZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc29ja2V0UGF0aCgpKTtcblxuICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0U3RyZWFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHRhcmdldFN0cmVhbXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0YXJnZXRDb2xsZWN0aW9ucyA9IE9iamVjdC5rZXlzKHNlbGYuY29sbGVjdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGRhdGEpXG4gICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVBbGwgPSBmdW5jdGlvbihwYXRocywgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHsgbGlzdGVuZXJzOiBbY2FsbGJhY2tdIH07XG4gICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBuZXdTdWJzY3JpcHRpb25zXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVDb2xsZWN0aW9uID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uc1twYXRoXSA9IHsgbGlzdGVuZXJzOiBbY2FsbGJhY2tdIH07XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBwYXRoXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBzaG93TG9hZGluZ1NjcmVlbiA9ICgpID0+IHtcbiAgICAkKCcjbG9hZGluZy1vdmVybGF5JykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xufTtcblxuZXhwb3J0IGNvbnN0IGhpZGVMb2FkaW5nU2NyZWVuID0gKCkgPT4ge1xuICAgICQoJyNsb2FkaW5nLW92ZXJsYXknKS5hZGRDbGFzcygnaGlkZGVuJyk7XG59O1xuXG4vKipcbiAgICBSZW1vdmUgYWxsIGFsZXJ0cy5cbiovXG5leHBvcnQgY29uc3QgY2xlYXJBbGVydHMgPSAoKSA9PiB7XG4gICAgJCgnI2FsZXJ0cycpLmVtcHR5KCk7XG59O1xuXG4vKipcbiAgICBBcHBlbmQgYSBuZXcgYWxlcnRcbiovXG5leHBvcnQgY29uc3QgYWRkQWxlcnQgPSAodHlwZSwgY29udGVudCkgPT4ge1xuICAgICQoJyNhbGVydHMnKS5hcHBlbmQoXG4gICAgICAgICQoJzxsaSBjbGFzcz1cImFsZXJ0XCIgcm9sZT1cImFsZXJ0XCI+JylcbiAgICAgICAgICAgIC5hZGRDbGFzcyh0eXBlKVxuICAgICAgICAgICAgLmFwcGVuZChcbiAgICAgICAgICAgICAgICAnPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjbG9zZVwiIGRhdGEtZGlzbWlzcz1cImFsZXJ0XCI+PHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+JnRpbWVzOzwvc3Bhbj48c3BhbiBjbGFzcz1cInNyLW9ubHlcIj5DbG9zZTwvc3Bhbj48L2J1dHRvbj4nLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQpKTtcbn07XG5cbi8qKlxuICAgIFNldCB0aGUgY3VycmVudCBhbGVydCwgcmVtb3ZpbmcgYWxsIGV4aXN0aW5nIG9uZXMuXG4qL1xuZXhwb3J0IGNvbnN0IHNldEFsZXJ0ID0gKHR5cGUsIGNvbnRlbnQpID0+IHtcbiAgICBjbGVhckFsZXJ0cygpO1xuICAgIGFkZEFsZXJ0KHR5cGUsIGNvbnRlbnQpO1xufTtcbiJdfQ==
