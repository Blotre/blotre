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

},{"./models":3,"./stream_manager":4}],2:[function(require,module,exports){
'use strict';
"use-strict";

var models = require('./models');
var ui = require('./ui');
var application_model = require('./application_model');

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

},{}],4:[function(require,module,exports){
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

},{"./models":3}],5:[function(require,module,exports){
'use strict';
"use-strict";

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvY2xpZW50LmpzIiwiY2xpZW50L2pzL21vZGVscy5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyIsImNsaWVudC9qcy91aS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCOzs7O0FBSU4sSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMsQ0FBSyxPQUFM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dGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IG5ldyBzdHJlYW1fbWFuYWdlci5TdHJlYW1NYW5hZ2VyKCk7XG5cbiAgICBzZWxmLmFkZEZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG52YXIgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFwcFZpZXdNb2RlbDogQXBwVmlld01vZGVsLFxuICAgIGluaXRpYWxVc2VyOiBpbml0aWFsVXNlclxufTtcbiIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHVpID0gcmVxdWlyZSgnLi91aScpO1xuY29uc3QgYXBwbGljYXRpb25fbW9kZWwgPSByZXF1aXJlKCcuL2FwcGxpY2F0aW9uX21vZGVsJyk7XG5cbi8qKlxuKi9cbnZhciBTdHJlYW1JbmRleFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIGNsaWVudElkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFwcGxpY2F0aW9uX21vZGVsLkFwcFZpZXdNb2RlbC5jYWxsKHRoaXMsIHVzZXIpO1xuXG4gICAgc2VsZi5jbGllbnRJZCA9IGtvLm9ic2VydmFibGUoY2xpZW50SWQpO1xufTtcblxuXG52YXIgdXBkYXRlUmVkaXJlY3RzID0gZnVuY3Rpb24oY2xpZW50SWQsIHJlZGllY3RCbG9iKSB7XG4gICAgdWkuc2hvd0xvYWRpbmdTY3JlZW4oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBPU1RcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5EZXZlbG9wZXJDb250cm9sbGVyLnNldFJlZGlyZWN0cyhjbGllbnRJZCkudXJsLFxuICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeShyZWRpZWN0QmxvYi5zcGxpdCgnXFxuJykpLFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdWkuc2V0QWxlcnQoJ2FsZXJ0LWRhbmdlcicsIGUuc3RhdHVzID09IDQyMiA/IFwiU3BlY2lmaWVkIHJlZGlyZWN0cyBhcmUgaW52YWxpZC4gTXVzdCBiZSBhdCBtb3N0IDEwIGh0dHAocykgdXJscy5cIiA6IFwiQW4gZXJyb3Igb2NjdXJyZWQuXCIpO1xuICAgICAgICAgICAgdWkuaGlkZUxvYWRpbmdTY3JlZW4oKTtcbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHVpLmNsZWFyQWxlcnRzKCk7XG4gICAgICAgIHVpLmhpZGVMb2FkaW5nU2NyZWVuKCk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAgICBBY3R1YWxseSBkZWxldGUgdGhlIGNsaWVudC5cblxuICAgIFJlZGlyZWN0cyB0byB0aGUgZGV2ZWxvcGVyIGhvbWUgcGFnZSBvbiBzdWNjZXNzLlxuKi9cbnZhciBkZWxldGVDbGllbnQgPSBmdW5jdGlvbihjbGllbnRJZCkge1xuICAgIHVpLnNob3dMb2FkaW5nU2NyZWVuKCk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5EZXZlbG9wZXJDb250cm9sbGVyLmRlbGV0ZUNsaWVudChjbGllbnRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB1aS5zZXRBbGVydCgnYWxlcnQtZGFuZ2VyJywgXCJDb3VsZCBub3QgZGVsZXRlIGNsaWVudCwgcGxlYXNlIHRyeSBhZ2Fpbi5cIik7XG4gICAgICAgICAgICB1aS5oaWRlTG9hZGluZ1NjcmVlbigpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uID0ganNSb3V0ZXMuY29udHJvbGxlcnMuRGV2ZWxvcGVyQ29udHJvbGxlci5pbmRleCgpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIFByb21wdCB0aGUgdXNlciB0byBlbnN1cmUgdGhleSByZWFsbHkgd2FudCB0byBkZWxldGUgdGhlIGNsaWVudC5cbiovXG52YXIgYXNrRGVsZXRlQ2xpZW50ID0gZnVuY3Rpb24oY2xpZW50SWQpIHtcbiAgICBib290Ym94LmNvbmZpcm0oe1xuICAgICAgICB0aXRsZTogXCJBcmUgeW91IHN1cmU/XCIsXG4gICAgICAgIGFuaW1hdGU6IGZhbHNlLFxuICAgICAgICBjbG9zZUJ1dHRvbjogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6IFwiVGhpcyB3aWxsIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGlzIGNsaWVudCBhbmQgaW52YWxpZGF0ZSBhbGwgdG9rZW4gZm9yIGl0LlwiLFxuICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlQ2xpZW50KGNsaWVudElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4qL1xuJChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSBuZXcgU3RyZWFtSW5kZXhWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCksXG4gICAgICAgIHdpbmRvdy5jbGllbnRJZCk7XG5cbiAgICB2YXIgY3VycmVudFJlZGlyZWN0cyA9ICAkKCcjcmVkaXJlY3RzLXRleHRib3gnKS52YWwoKTtcblxuICAgICQoJyNjYW5jZWwtcmVkaXJlY3RzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJCgnI3JlZGlyZWN0cy10ZXh0Ym94JykudmFsKGN1cnJlbnRSZWRpcmVjdHMpO1xuICAgICAgICAkKCcjc2F2ZS1yZWRpcmVjdHMtYnV0dG9uLCAjY2FuY2VsLXJlZGlyZWN0cy1idXR0b24nKVxuICAgICAgICAgICAgLmF0dHIoXCJkaXNhYmxlZFwiLCB0cnVlKTtcbiAgICB9KTtcblxuICAgICQoJyNyZWRpcmVjdHMtdGV4dGJveCcpLm9uKCdpbnB1dCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgJCgnI3NhdmUtcmVkaXJlY3RzLWJ1dHRvbiwgI2NhbmNlbC1yZWRpcmVjdHMtYnV0dG9uJylcbiAgICAgICAgICAgIC5hdHRyKFwiZGlzYWJsZWRcIiwgZmFsc2UpO1xuICAgIH0pO1xuXG4gICAgJCgnI3NhdmUtcmVkaXJlY3RzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICB1cGRhdGVSZWRpcmVjdHMobW9kZWwuY2xpZW50SWQoKSwgJCgnI3JlZGlyZWN0cy10ZXh0Ym94JykudmFsKCkpO1xuICAgIH0pO1xuXG4gICAgJCgnI2RlbGV0ZS1jbGllbnQtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBhc2tEZWxldGVDbGllbnQobW9kZWwuY2xpZW50SWQoKSk7XG4gICAgfSk7XG59KTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SID0gJyM3Nzc3NzcnO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG5jb25zdCBQYXRoQ29tcG9uZW50ID0gZnVuY3Rpb24obmFtZSwgdXJpKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUoJy9zJyArIHVyaSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG5cbiAgICBzZWxmLnBhdGhDb21wb25lbnRzID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gW107XG4gICAgICAgIHNlbGYudXJpKCkuc3BsaXQoJy8nKS5yZWR1Y2UoKHBhdGgsIGMpID0+IHtcbiAgICAgICAgICAgIHBhdGggKz0gJy8nICsgYztcbiAgICAgICAgICAgIHBhdGhzLnB1c2gobmV3IFBhdGhDb21wb25lbnQoYywgcGF0aCkpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sICcnKTtcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xuICAgIH0pO1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSwgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7XG4gICAgICAgIH0pKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5cblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiovXG52YXIgU3RyZWFtTWFuYWdlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnN0cmVhbXMgPSB7IH07XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHsgfTtcblxuICAgIHZhciBwcm9jZXNzTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHR5cGUgPSBtc2cudHlwZTtcbiAgICAgICAgdmFyIHRhcmdldCA9IChtc2cuc291cmNlID8gc2VsZi5jb2xsZWN0aW9uc1ttc2cuc291cmNlXSA6IHNlbGYuc3RyZWFtc1ttc2cuZnJvbV0pO1xuICAgICAgICAodGFyZ2V0ID8gdGFyZ2V0Lmxpc3RlbmVycyA6IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIGlmICh4W3R5cGVdKVxuICAgICAgICAgICAgICAgIHhbdHlwZV0obXNnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgIHZhciBvcGVuV2Vic29ja2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHNvY2tldFBhdGgoKSk7XG5cbiAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldFN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB0YXJnZXRTdHJlYW1zXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0Q29sbGVjdGlvbnMgPSBPYmplY3Qua2V5cyhzZWxmLmNvbGxlY3Rpb25zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRDb2xsZWN0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB4XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGlmIChkYXRhKVxuICAgICAgICAgICAgICAgIHByb2Nlc3NNZXNzYWdlKGRhdGEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVvcGVuJyk7XG4gICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQWxsID0gZnVuY3Rpb24ocGF0aHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG5ld1N1YnNjcmlwdGlvbnMgPSBbXTtcbiAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5zdHJlYW1zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHBhdGggPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhdGgpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTdHJlYW1NYW5hZ2VyOiBTdHJlYW1NYW5hZ2VyXG59O1xuIiwiXCJ1c2Utc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBzaG93TG9hZGluZ1NjcmVlbiA9ICgpID0+IHtcbiAgICAkKCcjbG9hZGluZy1vdmVybGF5JykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xufTtcblxuZXhwb3J0IGNvbnN0IGhpZGVMb2FkaW5nU2NyZWVuID0gKCkgPT4ge1xuICAgICQoJyNsb2FkaW5nLW92ZXJsYXknKS5hZGRDbGFzcygnaGlkZGVuJyk7XG59O1xuXG4vKipcbiAgICBSZW1vdmUgYWxsIGFsZXJ0cy5cbiovXG5leHBvcnQgY29uc3QgY2xlYXJBbGVydHMgPSAoKSA9PiB7XG4gICAgJCgnI2FsZXJ0cycpLmVtcHR5KCk7XG59O1xuXG4vKipcbiAgICBBcHBlbmQgYSBuZXcgYWxlcnRcbiovXG5leHBvcnQgY29uc3QgYWRkQWxlcnQgPSAodHlwZSwgY29udGVudCkgPT4ge1xuICAgICQoJyNhbGVydHMnKS5hcHBlbmQoXG4gICAgICAgICQoJzxsaSBjbGFzcz1cImFsZXJ0XCIgcm9sZT1cImFsZXJ0XCI+JylcbiAgICAgICAgICAgIC5hZGRDbGFzcyh0eXBlKVxuICAgICAgICAgICAgLmFwcGVuZChcbiAgICAgICAgICAgICAgICAnPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjbG9zZVwiIGRhdGEtZGlzbWlzcz1cImFsZXJ0XCI+PHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+JnRpbWVzOzwvc3Bhbj48c3BhbiBjbGFzcz1cInNyLW9ubHlcIj5DbG9zZTwvc3Bhbj48L2J1dHRvbj4nLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQpKTtcbn07XG5cbi8qKlxuICAgIFNldCB0aGUgY3VycmVudCBhbGVydCwgcmVtb3ZpbmcgYWxsIGV4aXN0aW5nIG9uZXMuXG4qL1xuZXhwb3J0IGNvbnN0IHNldEFsZXJ0ID0gKHR5cGUsIGNvbnRlbnQpID0+IHtcbiAgICBjbGVhckFsZXJ0cygpO1xuICAgIGFkZEFsZXJ0KHR5cGUsIGNvbnRlbnQpO1xufTtcbiJdfQ==
