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
'use strict';

var slice = Function.prototype.call.bind(Array.prototype.slice);

var DEFAULT_COLOR = '#777777';

/**
*/
var normalizeUri = function normalizeUri(uri) {
    return decodeURI(uri).trim().toLowerCase().replace(' ', '/');
};

/**
    Pretty prints a data.
*/
var dateToDisplay = function () {
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
var StatusModel = function StatusModel(color) {
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
var TagModel = function TagModel(value) {
    var self = this;
    self.value = ko.observable(value);

    self.url = ko.computed(function () {
        return jsRoutes.controllers.Stream.getTag(self.value()).url;
    });
};

/**
*/
var StreamModel = function StreamModel(id, name, uri, status, updated, tags) {
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
};

StreamModel.fromJson = function (data) {
    return new StreamModel(data && data.id, data && data.name, data && data.uri, StatusModel.fromJson(data && data.status), new Date(data && data.updated), (data && data.tags || []).map(function (x) {
        return new TagModel(x.tag);
    }));
};

/**
*/
var UserModel = function UserModel(userName, status, rootStream) {
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
var Collection = function Collection(uri) {
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

module.exports = {
    DEFAULT_COLOR: DEFAULT_COLOR,

    normalizeUri: normalizeUri,

    StatusModel: StatusModel,
    StreamModel: StreamModel,
    TagModel: TagModel,

    UserModel: UserModel,
    Collection: Collection
};

},{}],3:[function(require,module,exports){
"use strict";
"use-strict";

var parseQueryString = function parseQueryString(queryString) {
    return queryString.substr(1).split("&").reduce(function (dict, item) {
        var kv = item.split("=");
        var k = kv[0];
        var v = decodeURIComponent(kv[1]);
        if (k in dict) dict[k].push(v);else dict[k] = [v];
        return dict;
    }, {});
};

var getQueryString = function getQueryString() {
    return parseQueryString(window.location.search);
};

var lockButton = function lockButton(sel) {
    sel.prop("disabled", true).children('.glyphicon').addClass('glyphicon-refresh glyphicon-refresh-animate');
};

var unlockButton = function unlockButton(sel) {
    sel.prop("disabled", false).children('.glyphicon').removeClass('glyphicon-refresh  glyphicon-refresh-animate');
};

module.exports = {
    'getQueryString': getQueryString,
    'parseQueryString': parseQueryString,

    'lockButton': lockButton,
    'unlockButton': unlockButton
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fY3JlYXRlX2NoaWxkLmpzIiwiY2xpZW50L2pzL3N0cmVhbV9tYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBOztBQUNBLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDtBQUNOLElBQU0saUJBQWlCLFFBQVEsa0JBQVIsQ0FBakI7Ozs7QUFJTixJQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUI7QUFDcEMsUUFBSSxPQUFPLElBQVAsQ0FEZ0M7QUFFcEMsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBRm9DO0FBR3BDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUhvQztBQUlwQyxTQUFLLFNBQUwsR0FBaUIsR0FBRyxVQUFILENBQWMsSUFBSSxPQUFPLFVBQVAsQ0FBa0IsS0FBSyxRQUFMLEVBQXRCLENBQWQsQ0FBakIsQ0FKb0M7O0FBTXBDLFNBQUssT0FBTCxHQUFlLElBQUksZUFBZSxhQUFmLEVBQW5CLENBTm9DOztBQVFwQyxTQUFLLFdBQUwsR0FBbUIsVUFBUyxLQUFULEVBQWdCO0FBQy9CLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixLQUExQixFQUQrQjtLQUFoQixDQVJpQjs7QUFZcEMsU0FBSyxjQUFMLEdBQXNCLFVBQVMsUUFBVCxFQUFtQjtBQUNyQyxlQUFPLEtBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixNQUExQixDQUFpQyxVQUFTLENBQVQsRUFBWTtBQUMvQyxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHdDO1NBQVosQ0FBeEMsQ0FEcUM7S0FBbkI7OztBQVpj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NUIsd0JBQVEscUJBQVI7QUFDQSxzQkFBTSxJQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQUpKO0NBTDBDOztBQW1COUMsT0FBTyxPQUFQLEdBQWlCO0FBQ2IsbUJBQWUsYUFBZjtDQURKIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IG5ldyBzdHJlYW1fbWFuYWdlci5TdHJlYW1NYW5hZ2VyKCk7XG5cbiAgICBzZWxmLmFkZEZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG52YXIgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFwcFZpZXdNb2RlbDogQXBwVmlld01vZGVsLFxuICAgIGluaXRpYWxVc2VyOiBpbml0aWFsVXNlclxufTtcbiIsInZhciBzbGljZSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxudmFyIERFRkFVTFRfQ09MT1IgPSAnIzc3Nzc3Nyc7XG5cbi8qKlxuKi9cbnZhciBub3JtYWxpemVVcmkgPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHVyaSlcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgnICcsICcvJyk7XG59O1xuXG4vKipcbiAgICBQcmV0dHkgcHJpbnRzIGEgZGF0YS5cbiovXG52YXIgZGF0ZVRvRGlzcGxheSA9IChmdW5jdGlvbigpe1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4qL1xudmFyIFN0YXR1c01vZGVsID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgIHZhciBzZWxmID0gdGhpcztcbiAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuKi9cbnZhciBUYWdNb2RlbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICB2YXIgc2VsZiA9IHRoaXM7XG4gICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0VGFnKHNlbGYudmFsdWUoKSkudXJsO1xuICAgfSk7XG59O1xuXG4vKipcbiovXG52YXIgU3RyZWFtTW9kZWwgPSBmdW5jdGlvbihpZCwgbmFtZSwgdXJpLCBzdGF0dXMsIHVwZGF0ZWQsIHRhZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5pZCA9IGtvLm9ic2VydmFibGUoaWQpO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSB8fCAnJyk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnVwZGF0ZWQgPSBrby5vYnNlcnZhYmxlKHVwZGF0ZWQpO1xuICAgIHNlbGYudGFncyA9IGtvLm9ic2VydmFibGVBcnJheSh0YWdzIHx8IFtdKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0U3RyZWFtKHNlbGYudXJpKCkpLnVybDtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKSB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpO1xuICAgICAgICBzdGF0dXMuY29sb3IoY29sb3IpO1xuICAgICAgICBzZWxmLnN0YXR1cyhzdGF0dXMpO1xuICAgIH07XG5cbiAgICBzZWxmLmRpc3BsYXlVcGRhdGVkID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRlVG9EaXNwbGF5KHNlbGYudXBkYXRlZCgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuaXNPd25lciA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgdmFyIG93bmVyVXJpID0gbm9ybWFsaXplVXJpKHVzZXIudXNlck5hbWUoKSk7XG4gICAgICAgIHJldHVybiAob3duZXJVcmkgPT09IHNlbGYudXJpKCkgfHwgc2VsZi51cmkoKS5pbmRleE9mKG93bmVyVXJpICsgJy8nKSA9PT0gMCk7XG4gICAgfTtcbn07XG5cblN0cmVhbU1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS5pZCxcbiAgICAgICAgZGF0YSAmJiBkYXRhLm5hbWUsXG4gICAgICAgIGRhdGEgJiYgZGF0YS51cmksXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBuZXcgRGF0ZShkYXRhICYmIGRhdGEudXBkYXRlZCksXG4gICAgICAgIChkYXRhICYmIGRhdGEudGFncyB8fCBbXSkubWFwKGZ1bmN0aW9uKHgpeyByZXR1cm4gbmV3IFRhZ01vZGVsKHgudGFnKTsgfSkpO1xufTtcblxuLyoqXG4qL1xudmFyIFVzZXJNb2RlbCA9IGZ1bmN0aW9uKHVzZXJOYW1lLCBzdGF0dXMsIHJvb3RTdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyTmFtZSA9IGtvLm9ic2VydmFibGUodXNlck5hbWUgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi5yb290U3RyZWFtID0ga28ub2JzZXJ2YWJsZShyb290U3RyZWFtKTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcbn07XG5cblVzZXJNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFVzZXJNb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVzZXJOYW1lLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnJvb3RTdHJlYW0pO1xufTtcblxuLyoqXG4qL1xudmFyIENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIERFRkFVTFRfQ09MT1I6IERFRkFVTFRfQ09MT1IsXG5cbiAgICBub3JtYWxpemVVcmk6IG5vcm1hbGl6ZVVyaSxcblxuICAgIFN0YXR1c01vZGVsOiBTdGF0dXNNb2RlbCxcbiAgICBTdHJlYW1Nb2RlbDogU3RyZWFtTW9kZWwsXG4gICAgVGFnTW9kZWw6IFRhZ01vZGVsLFxuXG4gICAgVXNlck1vZGVsOiBVc2VyTW9kZWwsXG4gICAgQ29sbGVjdGlvbjogQ29sbGVjdGlvblxufTsiLCJcInVzZS1zdHJpY3RcIjtcblxudmFyIHBhcnNlUXVlcnlTdHJpbmcgPSBmdW5jdGlvbihxdWVyeVN0cmluZykge1xuICAgIHJldHVybiBxdWVyeVN0cmluZy5zdWJzdHIoMSkuc3BsaXQoXCImXCIpXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24oZGljdCwgaXRlbSkge1xuICAgICAgICAgICAgdmFyIGt2ID0gaXRlbS5zcGxpdChcIj1cIik7XG4gICAgICAgICAgICB2YXIgayA9IGt2WzBdO1xuICAgICAgICAgICAgdmFyIHYgPSBkZWNvZGVVUklDb21wb25lbnQoa3ZbMV0pO1xuICAgICAgICAgICAgaWYgKGsgaW4gZGljdCkgZGljdFtrXS5wdXNoKHYpOyBlbHNlIGRpY3Rba10gPSBbdl07XG4gICAgICAgICAgICByZXR1cm4gZGljdDtcbiAgICAgICAgfSwge30pO1xufTtcblxudmFyIGdldFF1ZXJ5U3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHBhcnNlUXVlcnlTdHJpbmcod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59O1xuXG52YXIgbG9ja0J1dHRvbiA9IGZ1bmN0aW9uKHNlbCkge1xuICAgICBzZWxcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG52YXIgdW5sb2NrQnV0dG9uID0gZnVuY3Rpb24oc2VsKSB7XG4gICAgc2VsXG4gICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSlcbiAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoICBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAnZ2V0UXVlcnlTdHJpbmcnOiBnZXRRdWVyeVN0cmluZyxcbiAgICAncGFyc2VRdWVyeVN0cmluZyc6IHBhcnNlUXVlcnlTdHJpbmcsXG5cbiAgICAnbG9ja0J1dHRvbic6IGxvY2tCdXR0b24sXG4gICAgJ3VubG9ja0J1dHRvbic6IHVubG9ja0J1dHRvblxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuY29uc3QgYXBwbGljYXRpb25fbW9kZWwgPSByZXF1aXJlKCcuL2FwcGxpY2F0aW9uX21vZGVsJylcbmNvbnN0IHNoYXJlZCA9IHJlcXVpcmUoJy4vc2hhcmVkJyk7XG5cbnZhciBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBzdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG59O1xuXG52YXIgZ2V0VGFyZ2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggPSBkZWNvZGVVUklDb21wb25lbnQod2luZG93LmxvY2F0aW9uLnBhdGhuYW1lKS5tYXRjaCgnL3MvKC4rKScpO1xuICAgIHJldHVybiAoKHBhdGggJiYgcGF0aFsxXSkgfHwgJycpO1xufTtcblxuJChmdW5jdGlvbigpe1xuICAgIHZhciBtb2RlbCA9IG5ldyBBcHBWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCkpO1xuXG4gICAgJCgnLmNyZWF0ZS1jaGlsZC1idXR0b24nKS5jbGljayhmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBidG4gPSAkKHRoaXMpO1xuICAgICAgICBzaGFyZWQubG9ja0J1dHRvbihidG4pO1xuXG4gICAgICAgIHZhciByYXdVcmkgPSBnZXRUYXJnZXQoKTtcbiAgICAgICAgdmFyIHBhcmVudEluZGV4ID0gcmF3VXJpLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgICAgIHZhciBwYXJlbnQgPSByYXdVcmkuc2xpY2UoMCwgcGFyZW50SW5kZXgpO1xuICAgICAgICB2YXIgbmFtZSA9IHJhd1VyaS5zbGljZShwYXJlbnRJbmRleCArIDEpLnRyaW0oKTtcbiAgICAgICAgdmFyIHVyaSA9IHBhcmVudCArIFwiL1wiICsgbmFtZTtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlU3RyZWFtKCkudXJsLFxuICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgdXJpOiB1cmlcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBzaGFyZWQudW5sb2NrQnV0dG9uKGJ0bik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiAhcmVzdWx0LmVycm9yKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0ocmVzdWx0LnVyaSkudXJsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzaGFyZWQudW5sb2NrQnV0dG9uKGJ0bik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTsiLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5cblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiovXG52YXIgU3RyZWFtTWFuYWdlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnN0cmVhbXMgPSB7IH07XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHsgfTtcblxuICAgIHZhciBwcm9jZXNzTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHR5cGUgPSBtc2cudHlwZTtcbiAgICAgICAgdmFyIHRhcmdldCA9IChtc2cuc291cmNlID8gc2VsZi5jb2xsZWN0aW9uc1ttc2cuc291cmNlXSA6IHNlbGYuc3RyZWFtc1ttc2cuZnJvbV0pO1xuICAgICAgICAodGFyZ2V0ID8gdGFyZ2V0Lmxpc3RlbmVycyA6IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIGlmICh4W3R5cGVdKVxuICAgICAgICAgICAgICAgIHhbdHlwZV0obXNnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgIHZhciBvcGVuV2Vic29ja2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHNvY2tldFBhdGgoKSk7XG5cbiAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldFN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB0YXJnZXRTdHJlYW1zXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0Q29sbGVjdGlvbnMgPSBPYmplY3Qua2V5cyhzZWxmLmNvbGxlY3Rpb25zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRDb2xsZWN0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB4XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGlmIChkYXRhKVxuICAgICAgICAgICAgICAgIHByb2Nlc3NNZXNzYWdlKGRhdGEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVvcGVuJyk7XG4gICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQWxsID0gZnVuY3Rpb24ocGF0aHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG5ld1N1YnNjcmlwdGlvbnMgPSBbXTtcbiAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5zdHJlYW1zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHBhdGggPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhdGgpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTdHJlYW1NYW5hZ2VyOiBTdHJlYW1NYW5hZ2VyXG59O1xuIl19
