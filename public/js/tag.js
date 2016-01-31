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

},{"./models":2,"./stream_manager":4}],2:[function(require,module,exports){
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

},{"./models":2}],5:[function(require,module,exports){
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

/**
 */
var TagViewModel = function TagViewModel(tag, user, results) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.tag = ko.observable(tag);
    self.user = ko.observable(user);
    self.children = ko.observable(new models.Collection(tag));
    self.query = ko.observable(undefined);

    self.addChild = function (child) {
        self.children().addChild(child);
    };

    self.removeChild = function (childUri) {
        return self.children().children.remove(function (x) {
            return x.uri() === childUri;
        });
    };
};

var normalizeQuery = function normalizeQuery(query) {
    return decodeURI(query).replace(/\+/g, ' ').trim();
};

var updateSearchResultsForQuery = function updateSearchResultsForQuery(model, query) {
    query = normalizeQuery(query);
    $('.list-loading').removeClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.getTagChildren(model.tag()).url,
        data: {
            'query': query
        },
        headers: {
            accept: "application/json"
        },
        error: function error() {
            $('.list-loading').addClass('hidden');
            // todo: display error msg
        }
    }).done(function (result) {
        $('.list-loading').addClass('hidden');
        model.query(query);
        model.children().children((result || []).map(models.StreamModel.fromJson));
    });
};

var updateSearchResults = function updateSearchResults(model) {
    return updateSearchResultsForQuery(model, normalizeQuery($('#stream-search-form input').val()));
};

var getQueryFromQueryString = function getQueryFromQueryString() {
    var qs = shared.getQueryString().query;
    return qs ? normalizeQuery(qs[0]) : '';
};

var updateFromQueryString = function updateFromQueryString(model) {
    var query = getQueryFromQueryString();
    $('#stream-search-form input').val(query);
    updateSearchResultsForQuery(model, query);
};

$(function () {
    var model = new TagViewModel(window.initialTag.tag, application_model.initialUser(), []);

    $('#stream-search-form button').click(function (e) {
        e.preventDefault();
        updateSearchResults(model);
    });

    $('#stream-search-form input').keypress(function (e) {
        if (e.keyCode === 13) {
            updateSearchResults(model);
            e.preventDefault();
        }
    });

    model.children().children.subscribe(function (results) {
        if (results.length) $('.no-results').addClass('hidden');else $('.no-results').removeClass('hidden');
    });

    model.query.subscribe(function (query) {
        var currentQuery = window.history.state ? window.history.state.query : undefined;
        if (query === currentQuery) return;
        var path = window.location.origin + window.location.pathname;
        var url = query ? path + "?query=" + encodeURIComponent(query) : path;
        window.history.pushState({
            query: query
        }, '', url);
    });

    model.manager.subscribeCollection('#' + model.tag(), {
        'StatusUpdated': function StatusUpdated(msg) {
            var existingChild = model.removeChild(msg.from);
            if (existingChild.length) {
                existingChild[0].status(models.StatusModel.fromJson(msg.status));
                model.addChild(existingChild[0]);
            }
        },
        'ChildAdded': function ChildAdded(msg) {
            model.addChild(models.StreamModel.fromJson(msg.child));
        },
        'ChildRemoved': function ChildRemoved(msg) {
            model.removeChild(msg.child);
        }
    });

    window.onpopstate = function (e) {
        updateFromQueryString(model);
    };

    window.history.replaceState({
        query: getQueryFromQueryString()
    }, '', window.location.href);

    updateFromQueryString(model);

    ko.applyBindings(model);
});

},{"./application_model":1,"./models":2,"./shared":3,"./stream_manager":4}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyIsImNsaWVudC9qcy90YWcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7Ozs7Ozs7O0lBQ1k7Ozs7SUFDQTs7Ozs7O0FBSUwsSUFBTSxzQ0FBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsSUFBZixFQUFxQjtBQUM3QyxRQUFJLE9BQU8sSUFBUCxDQUR5QztBQUU3QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGNkM7QUFHN0MsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBSDZDO0FBSTdDLFNBQUssU0FBTCxHQUFpQixHQUFHLFVBQUgsQ0FBYyxJQUFJLE9BQU8sVUFBUCxDQUFrQixLQUFLLFFBQUwsRUFBdEIsQ0FBZCxDQUFqQixDQUo2Qzs7QUFNN0MsU0FBSyxPQUFMLEdBQWUsSUFBSSxlQUFlLGFBQWYsRUFBbkIsQ0FONkM7O0FBUTdDLFNBQUssV0FBTCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsYUFBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLEtBQTFCLEVBRCtCO0tBQWhCLENBUjBCOztBQVk3QyxTQUFLLGNBQUwsR0FBc0IsVUFBUyxRQUFULEVBQW1CO0FBQ3JDLGVBQU8sS0FBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLE1BQTFCLENBQWlDLFVBQVMsQ0FBVCxFQUFZO0FBQ2hELG1CQUFPLEVBQUUsR0FBRixPQUFZLFFBQVosQ0FEeUM7U0FBWixDQUF4QyxDQURxQztLQUFuQjs7O0FBWnVCLFFBbUI3QyxDQUFLLE9BQUwsQ0FBYSxTQUFiLENBQXVCLEtBQUssUUFBTCxFQUF2QixFQUF3QztB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TUFBTSxXQUFOLENBQWtCLElBQUksSUFBSixDQUFsQyxDQUR1QjtBQUUzQixnQkFBSSxjQUFjLE1BQWQsRUFBc0I7QUFDdEIsOEJBQWMsQ0FBZCxFQUFpQixNQUFqQixDQUF3QixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBSSxNQUFKLENBQXBELEVBRHNCO0FBRXRCLHNCQUFNLFFBQU4sQ0FBZSxjQUFjLENBQWQsQ0FBZixFQUZzQjthQUExQjtTQUZhO0FBT2pCLHNCQUFjLG9CQUFTLEdBQVQsRUFBYztBQUN4QixrQkFBTSxRQUFOLENBQWUsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksS0FBSixDQUEzQyxFQUR3QjtTQUFkO0FBR2Qsd0JBQWdCLHNCQUFTLEdBQVQsRUFBYztBQUMxQixrQkFBTSxXQUFOLENBQWtCLElBQUksS0FBSixDQUFsQixDQUQwQjtTQUFkO0tBWHBCLEVBbkNTOztBQW1EVCxXQUFPLFVBQVAsR0FBb0IsVUFBUyxDQUFULEVBQVk7QUFDNUIsOEJBQXNCLEtBQXRCLEVBRDRCO0tBQVosQ0FuRFg7O0FBdURULFdBQU8sT0FBUCxDQUFlLFlBQWYsQ0FBNEI7QUFDeEIsZUFBTyx5QkFBUDtLQURKLEVBRUcsRUFGSCxFQUVPLE9BQU8sUUFBUCxDQUFnQixJQUFoQixDQUZQLENBdkRTOztBQTJEVCwwQkFBc0IsS0FBdEIsRUEzRFM7O0FBNkRULE9BQUcsYUFBSCxDQUFpQixLQUFqQixFQTdEUztDQUFYLENBQUYiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0ICogYXMgc3RyZWFtX21hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IG5ldyBzdHJlYW1fbWFuYWdlci5TdHJlYW1NYW5hZ2VyKCk7XG5cbiAgICBzZWxmLmFkZEZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgc3RhdHVzIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi51c2VyKCkuc3RhdHVzKG5ldyBtb2RlbHMuU3RhdHVzTW9kZWwobXNnLnN0YXR1cy5jb2xvcikpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgIXVzZXIucm9vdFN0cmVhbSgpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGRyZW4odXNlci5yb290U3RyZWFtKCkpLnVybCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xuXG4gICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgY29sbGVjdGlvbiB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZUNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmZyb20pO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ2hpbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZXhpc3RpbmdDaGlsZFswXS5zdGF0dXMobW9kZWxzLlN0YXR1c01vZGVsLmZyb21Kc29uKG1zZy5zdGF0dXMpKTtcbiAgICAgICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmNoaWxkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IGluaXRpYWxVc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5Vc2VyTW9kZWwuZnJvbUpzb24od2luZG93LmluaXRpYWxVc2VyRGF0YSk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBzbGljZSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09MT1IgPSBcIiM3Nzc3NzdcIjtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBub3JtYWxpemVVcmkgPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHVyaSlcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgnICcsICcvJyk7XG59O1xuXG4vKipcbiAgICBQcmV0dHkgcHJpbnRzIGEgZGF0YS5cbiovXG5leHBvcnQgY29uc3QgZGF0ZVRvRGlzcGxheSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4gICAgdmFyIHBhZCA9IGZ1bmN0aW9uKG1pbiwgaW5wdXQpIHtcbiAgICAgICAgaW5wdXQgKz0gJyc7XG4gICAgICAgIHdoaWxlIChpbnB1dC5sZW5ndGggPCBtaW4pXG4gICAgICAgICAgICBpbnB1dCA9ICcwJyArIGlucHV0O1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihkYXRlKSB7XG4gICAgICAgIGlmICghZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnLSc7XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoc1tkYXRlLmdldE1vbnRoKCldICsgJyAnICsgcGFkKDIsIGRhdGUuZ2V0RGF0ZSgpKSArICcsICcgKyBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnICcgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0SG91cnMoKSkgKyAnOicgKyBwYWQoMiwgZGF0ZS5nZXRNaW51dGVzKCkpICsgJy4nICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldFNlY29uZHMoKSkgKyBwYWQoMywgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgfTtcbn0oKSk7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RhdHVzTW9kZWwgPSBmdW5jdGlvbihjb2xvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmNvbG9yID0ga28ub2JzZXJ2YWJsZShjb2xvcik7XG59O1xuXG5TdGF0dXNNb2RlbC5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoREVGQVVMVF9DT0xPUik7XG59O1xuXG5TdGF0dXNNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKGRhdGEgJiYgZGF0YS5jb2xvcik7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFRhZ01vZGVsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi52YWx1ZSA9IGtvLm9ic2VydmFibGUodmFsdWUpO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRUYWcoc2VsZi52YWx1ZSgpKS51cmw7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xuY29uc3QgUGF0aENvbXBvbmVudCA9IGZ1bmN0aW9uKG5hbWUsIHVyaSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKCcvcycgKyB1cmkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1Nb2RlbCA9IGZ1bmN0aW9uKGlkLCBuYW1lLCB1cmksIHN0YXR1cywgdXBkYXRlZCwgdGFncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmlkID0ga28ub2JzZXJ2YWJsZShpZCk7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lIHx8ICcnKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYudXBkYXRlZCA9IGtvLm9ic2VydmFibGUodXBkYXRlZCk7XG4gICAgc2VsZi50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KHRhZ3MgfHwgW10pO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0oc2VsZi51cmkoKSkudXJsO1xuICAgIH0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpIHx8IFN0YXR1c01vZGVsLmVtcHR5KCk7XG4gICAgICAgIHN0YXR1cy5jb2xvcihjb2xvcik7XG4gICAgICAgIHNlbGYuc3RhdHVzKHN0YXR1cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZGlzcGxheVVwZGF0ZWQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRhdGVUb0Rpc3BsYXkoc2VsZi51cGRhdGVkKCkpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5pc093bmVyID0gZnVuY3Rpb24odXNlcikge1xuICAgICAgICB2YXIgb3duZXJVcmkgPSBub3JtYWxpemVVcmkodXNlci51c2VyTmFtZSgpKTtcbiAgICAgICAgcmV0dXJuIChvd25lclVyaSA9PT0gc2VsZi51cmkoKSB8fCBzZWxmLnVyaSgpLmluZGV4T2Yob3duZXJVcmkgKyAnLycpID09PSAwKTtcbiAgICB9O1xuXG4gICAgc2VsZi5wYXRoQ29tcG9uZW50cyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBwYXRocyA9IFtdO1xuICAgICAgICBzZWxmLnVyaSgpLnNwbGl0KCcvJykucmVkdWNlKChwYXRoLCBjKSA9PiB7XG4gICAgICAgICAgICBwYXRoICs9ICcvJyArIGM7XG4gICAgICAgICAgICBwYXRocy5wdXNoKG5ldyBQYXRoQ29tcG9uZW50KGMsIHBhdGgpKTtcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICB9LCAnJyk7XG4gICAgICAgIHJldHVybiBwYXRocztcbiAgICB9KTtcbn07XG5cblN0cmVhbU1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS5pZCxcbiAgICAgICAgZGF0YSAmJiBkYXRhLm5hbWUsXG4gICAgICAgIGRhdGEgJiYgZGF0YS51cmksXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBuZXcgRGF0ZShkYXRhICYmIGRhdGEudXBkYXRlZCksIChkYXRhICYmIGRhdGEudGFncyB8fCBbXSkubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGFnTW9kZWwoeC50YWcpO1xuICAgICAgICB9KSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFVzZXJNb2RlbCA9IGZ1bmN0aW9uKHVzZXJOYW1lLCBzdGF0dXMsIHJvb3RTdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyTmFtZSA9IGtvLm9ic2VydmFibGUodXNlck5hbWUgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi5yb290U3RyZWFtID0ga28ub2JzZXJ2YWJsZShyb290U3RyZWFtKTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcbn07XG5cblVzZXJNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFVzZXJNb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVzZXJOYW1lLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnJvb3RTdHJlYW0pO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBDb2xsZWN0aW9uID0gZnVuY3Rpb24odXJpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGQudXJpKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpO1xuICAgIH07XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBwYXJzZVF1ZXJ5U3RyaW5nID0gKHF1ZXJ5U3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHF1ZXJ5U3RyaW5nLnN1YnN0cigxKS5zcGxpdChcIiZcIilcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihkaWN0LCBpdGVtKSB7XG4gICAgICAgICAgICB2YXIga3YgPSBpdGVtLnNwbGl0KFwiPVwiKTtcbiAgICAgICAgICAgIHZhciBrID0ga3ZbMF07XG4gICAgICAgICAgICB2YXIgdiA9IGRlY29kZVVSSUNvbXBvbmVudChrdlsxXSk7XG4gICAgICAgICAgICBpZiAoayBpbiBkaWN0KVxuICAgICAgICAgICAgICAgIGRpY3Rba10ucHVzaCh2KTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBkaWN0W2tdID0gW3ZdO1xuICAgICAgICAgICAgcmV0dXJuIGRpY3Q7XG4gICAgICAgIH0sIHt9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRRdWVyeVN0cmluZyA9ICgpID0+IHtcbiAgICByZXR1cm4gcGFyc2VRdWVyeVN0cmluZyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbn07XG5cbmV4cG9ydCBjb25zdCBsb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIHRydWUpXG4gICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgIC5hZGRDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcblxuZXhwb3J0IGNvbnN0IHVubG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICBzZWxcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgLnJlbW92ZUNsYXNzKCdnbHlwaGljb24tcmVmcmVzaCAgZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0ge307XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHt9O1xuXG4gICAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgdHlwZSA9IG1zZy50eXBlO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gKG1zZy5zb3VyY2UgPyBzZWxmLmNvbGxlY3Rpb25zW21zZy5zb3VyY2VdIDogc2VsZi5zdHJlYW1zW21zZy5mcm9tXSk7XG4gICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgaWYgKHhbdHlwZV0pXG4gICAgICAgICAgICAgICAgeFt0eXBlXShtc2cpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgdmFyIG9wZW5XZWJzb2NrZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc29ja2V0UGF0aCgpKTtcblxuICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0U3RyZWFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHRhcmdldFN0cmVhbXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0YXJnZXRDb2xsZWN0aW9ucyA9IE9iamVjdC5rZXlzKHNlbGYuY29sbGVjdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGRhdGEpXG4gICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVBbGwgPSBmdW5jdGlvbihwYXRocywgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IFtjYWxsYmFja11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBuZXdTdWJzY3JpcHRpb25zXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVDb2xsZWN0aW9uID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uc1twYXRoXSA9IHtcbiAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCAqIGFzIHN0cmVhbV9tYW5hZ2VyIGZyb20gJy4vc3RyZWFtX21hbmFnZXInO1xuaW1wb3J0ICogYXMgYXBwbGljYXRpb25fbW9kZWwgZnJvbSAnLi9hcHBsaWNhdGlvbl9tb2RlbCc7XG5pbXBvcnQgKiBhcyBzaGFyZWQgZnJvbSAnLi9zaGFyZWQnO1xuXG4vKipcbiAqL1xudmFyIFRhZ1ZpZXdNb2RlbCA9IGZ1bmN0aW9uKHRhZywgdXNlciwgcmVzdWx0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcblxuICAgIHNlbGYudGFnID0ga28ub2JzZXJ2YWJsZSh0YWcpO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHRhZykpO1xuICAgIHNlbGYucXVlcnkgPSBrby5vYnNlcnZhYmxlKHVuZGVmaW5lZCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbigpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNoaWxkcmVuKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgfSk7XG4gICAgfTtcbn07XG5cbnZhciBub3JtYWxpemVRdWVyeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSShxdWVyeSkucmVwbGFjZSgvXFwrL2csICcgJykudHJpbSgpO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeSA9IGZ1bmN0aW9uKG1vZGVsLCBxdWVyeSkge1xuICAgIHF1ZXJ5ID0gbm9ybWFsaXplUXVlcnkocXVlcnkpO1xuICAgICQoJy5saXN0LWxvYWRpbmcnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmdldFRhZ0NoaWxkcmVuKG1vZGVsLnRhZygpKS51cmwsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICdxdWVyeSc6IHF1ZXJ5XG4gICAgICAgIH0sXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIC8vIHRvZG86IGRpc3BsYXkgZXJyb3IgbXNnXG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBtb2RlbC5xdWVyeShxdWVyeSk7XG4gICAgICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHMgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgIHJldHVybiB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkoXG4gICAgICAgIG1vZGVsLFxuICAgICAgICBub3JtYWxpemVRdWVyeSgkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGlucHV0JykudmFsKCkpKTtcbn07XG5cbnZhciBnZXRRdWVyeUZyb21RdWVyeVN0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBxcyA9IHNoYXJlZC5nZXRRdWVyeVN0cmluZygpLnF1ZXJ5O1xuICAgIHJldHVybiAocXMgPyBub3JtYWxpemVRdWVyeShxc1swXSkgOiAnJyk7XG59O1xuXG52YXIgdXBkYXRlRnJvbVF1ZXJ5U3RyaW5nID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICB2YXIgcXVlcnkgPSBnZXRRdWVyeUZyb21RdWVyeVN0cmluZygpO1xuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwocXVlcnkpO1xuICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeShtb2RlbCwgcXVlcnkpO1xufTtcblxuJChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSBuZXcgVGFnVmlld01vZGVsKFxuICAgICAgICB3aW5kb3cuaW5pdGlhbFRhZy50YWcsXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCksIFtdKTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gYnV0dG9uJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuLnN1YnNjcmliZShmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHRzLmxlbmd0aClcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICB9KTtcblxuICAgIG1vZGVsLnF1ZXJ5LnN1YnNjcmliZShmdW5jdGlvbihxdWVyeSkge1xuICAgICAgICB2YXIgY3VycmVudFF1ZXJ5ID0gKHdpbmRvdy5oaXN0b3J5LnN0YXRlID8gd2luZG93Lmhpc3Rvcnkuc3RhdGUucXVlcnkgOiB1bmRlZmluZWQpO1xuICAgICAgICBpZiAocXVlcnkgPT09IGN1cnJlbnRRdWVyeSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdmFyIHBhdGggPSB3aW5kb3cubG9jYXRpb24ub3JpZ2luICsgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xuICAgICAgICB2YXIgdXJsID0gKHF1ZXJ5ID8gcGF0aCArIFwiP3F1ZXJ5PVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5KSA6IHBhdGgpO1xuICAgICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoe1xuICAgICAgICAgICAgcXVlcnk6IHF1ZXJ5XG4gICAgICAgIH0sICcnLCB1cmwpO1xuICAgIH0pO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKCcjJyArIG1vZGVsLnRhZygpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5hZGRDaGlsZChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHdpbmRvdy5vbnBvcHN0YXRlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICB1cGRhdGVGcm9tUXVlcnlTdHJpbmcobW9kZWwpO1xuICAgIH07XG5cbiAgICB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoe1xuICAgICAgICBxdWVyeTogZ2V0UXVlcnlGcm9tUXVlcnlTdHJpbmcoKVxuICAgIH0sICcnLCB3aW5kb3cubG9jYXRpb24uaHJlZik7XG5cbiAgICB1cGRhdGVGcm9tUXVlcnlTdHJpbmcobW9kZWwpO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTtcbiJdfQ==
