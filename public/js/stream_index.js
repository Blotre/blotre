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

/**
*/
var StreamIndexViewModel = function StreamIndexViewModel(user, results) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.user = ko.observable(user);
    self.results = ko.observableArray(results);
    self.query = ko.observable(undefined);
};

var normalizeQuery = function normalizeQuery(query) {
    return decodeURI(query).replace(/\+/g, ' ').trim();
};

var updateSearchResultsForQuery = function updateSearchResultsForQuery(model, query) {
    query = normalizeQuery(query);
    $('.list-loading').removeClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.apiGetStreams().url,
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
        model.results((result || []).map(models.StreamModel.fromJson));
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
    var model = new StreamIndexViewModel(application_model.initialUser(), []);

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

    model.results.subscribe(function (results) {
        if (results.length) $('.no-results').addClass('hidden');else $('.no-results').removeClass('hidden');
    });

    model.query.subscribe(function (query) {
        var currentQuery = window.history.state ? window.history.state.query : undefined;
        if (query === currentQuery) return;
        var path = window.location.origin + window.location.pathname;
        var url = query ? path + "?query=" + encodeURIComponent(query) : path;
        window.history.pushState({ query: query }, '', url);
    });

    window.onpopstate = function (e) {
        updateFromQueryString(model);
    };

    window.history.replaceState({ query: getQueryFromQueryString() }, '', window.location.href);

    updateFromQueryString(model);

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

},{"./models":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1faW5kZXguanMiLCJjbGllbnQvanMvc3RyZWFtX21hbmFnZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7OztJQUNZOzs7O0lBQ0E7Ozs7OztBQUlaLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsSUFBZixFQUFxQjtBQUNwQyxRQUFJLE9BQU8sSUFBUCxDQURnQztBQUVwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGb0M7QUFHcEMsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBSG9DO0FBSXBDLFNBQUssU0FBTCxHQUFpQixHQUFHLFVBQUgsQ0FBYyxJQUFJLE9BQU8sVUFBUCxDQUFrQixLQUFLLFFBQUwsRUFBdEIsQ0FBZCxDQUFqQixDQUpvQzs7QUFNcEMsU0FBSyxPQUFMLEdBQWUsSUFBSSxlQUFlLGFBQWYsRUFBbkIsQ0FOb0M7O0FBUXBDLFNBQUssV0FBTCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsYUFBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLEtBQTFCLEVBRCtCO0tBQWhCLENBUmlCOztBQVlwQyxTQUFLLGNBQUwsR0FBc0IsVUFBUyxRQUFULEVBQW1CO0FBQ3JDLGVBQU8sS0FBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLE1BQTFCLENBQWlDLFVBQVMsQ0FBVCxFQUFZO0FBQy9DLG1CQUFPLEVBQUUsR0FBRixPQUFZLFFBQVosQ0FEd0M7U0FBWixDQUF4QyxDQURxQztLQUFuQjs7O0FBWmMsUUFtQnBDLENBQUssT0FBTCxDQUFhLFNBQWIsQ0FBdUIsS0FBSyxRQUFMLEVBQXZCLEVBQXdD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SUFBdEIsRUFGRztTQUZQO0tBRm1DLENBQXZDLENBSjZEOztBQWM3RCxRQUFJLGlCQUFpQixNQUFqQixFQUF5QjtBQUN6QixZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEsV0FBUjtBQUNBLHNCQUFNLGdCQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQURKO0NBZG1DOztBQXdCdkMsY0FBYyxTQUFkLENBQXdCLG1CQUF4QixHQUE4QyxVQUFTLElBQVQsRUFBZSxRQUFmLEVBQXlCO0FBQ25FLFFBQUksT0FBTyxJQUFQLENBRCtEO0FBRW5FLFdBQU8sT0FBTyxZQUFQLENBQW9CLElBQXBCLENBQVAsQ0FGbUU7O0FBSW5FLFFBQUksVUFBVSxLQUFLLFdBQUwsQ0FBaUIsSUFBakIsQ0FBVixDQUorRDtBQUtuRSxRQUFJLE9BQUosRUFBYTtBQUNULGdCQUFRLFNBQVIsQ0FBa0IsSUFBbEIsQ0FBdUIsUUFBdkIsRUFEUztLQUFiLE1BRU87QUFDSCxhQUFLLFdBQUwsQ0FBaUIsSUFBakIsSUFBeUIsRUFBRSxXQUFXLENBQUMsUUFBRCxDQUFYLEVBQTNCLENBREc7QUFFSCxZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEscUJBQVI7QUFDQSxzQkFBTSxJQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQUpKO0NBTDBDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCAqIGFzIHN0cmVhbV9tYW5hZ2VyIGZyb20gJy4vc3RyZWFtX21hbmFnZXInO1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IG5ldyBzdHJlYW1fbWFuYWdlci5TdHJlYW1NYW5hZ2VyKCk7XG5cbiAgICBzZWxmLmFkZEZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG52YXIgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFwcFZpZXdNb2RlbDogQXBwVmlld01vZGVsLFxuICAgIGluaXRpYWxVc2VyOiBpbml0aWFsVXNlclxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SID0gXCIjNzc3Nzc3XCI7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplVXJpID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSSh1cmkpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgLnJlcGxhY2UoJyAnLCAnLycpO1xufTtcblxuLyoqXG4gICAgUHJldHR5IHByaW50cyBhIGRhdGEuXG4qL1xuZXhwb3J0IGNvbnN0IGRhdGVUb0Rpc3BsYXkgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuICAgIHZhciBwYWQgPSBmdW5jdGlvbihtaW4sIGlucHV0KSB7XG4gICAgICAgIGlucHV0ICs9ICcnO1xuICAgICAgICB3aGlsZSAoaW5wdXQubGVuZ3RoIDwgbWluKVxuICAgICAgICAgICAgaW5wdXQgPSAnMCcgKyBpbnB1dDtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZGF0ZSkge1xuICAgICAgICBpZiAoIWRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJy0nO1xuXG4gICAgICAgIHJldHVybiBtb250aHNbZGF0ZS5nZXRNb250aCgpXSArICcgJyArIHBhZCgyLCBkYXRlLmdldERhdGUoKSkgKyAnLCAnICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJyAnICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldEhvdXJzKCkpICsgJzonICsgcGFkKDIsIGRhdGUuZ2V0TWludXRlcygpKSArICcuJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRTZWNvbmRzKCkpICsgcGFkKDMsIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIH07XG59KCkpO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0YXR1c01vZGVsID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jb2xvciA9IGtvLm9ic2VydmFibGUoY29sb3IpO1xufTtcblxuU3RhdHVzTW9kZWwuZW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKERFRkFVTFRfQ09MT1IpO1xufTtcblxuU3RhdHVzTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChkYXRhICYmIGRhdGEuY29sb3IpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBUYWdNb2RlbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudmFsdWUgPSBrby5vYnNlcnZhYmxlKHZhbHVlKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0VGFnKHNlbGYudmFsdWUoKSkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKi9cbmNvbnN0IFBhdGhDb21wb25lbnQgPSBmdW5jdGlvbihuYW1lLCB1cmkpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSgnL3MnICsgdXJpKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RyZWFtTW9kZWwgPSBmdW5jdGlvbihpZCwgbmFtZSwgdXJpLCBzdGF0dXMsIHVwZGF0ZWQsIHRhZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5pZCA9IGtvLm9ic2VydmFibGUoaWQpO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSB8fCAnJyk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnVwZGF0ZWQgPSBrby5vYnNlcnZhYmxlKHVwZGF0ZWQpO1xuICAgIHNlbGYudGFncyA9IGtvLm9ic2VydmFibGVBcnJheSh0YWdzIHx8IFtdKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0U3RyZWFtKHNlbGYudXJpKCkpLnVybDtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKSB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpO1xuICAgICAgICBzdGF0dXMuY29sb3IoY29sb3IpO1xuICAgICAgICBzZWxmLnN0YXR1cyhzdGF0dXMpO1xuICAgIH07XG5cbiAgICBzZWxmLmRpc3BsYXlVcGRhdGVkID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRlVG9EaXNwbGF5KHNlbGYudXBkYXRlZCgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuaXNPd25lciA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgdmFyIG93bmVyVXJpID0gbm9ybWFsaXplVXJpKHVzZXIudXNlck5hbWUoKSk7XG4gICAgICAgIHJldHVybiAob3duZXJVcmkgPT09IHNlbGYudXJpKCkgfHwgc2VsZi51cmkoKS5pbmRleE9mKG93bmVyVXJpICsgJy8nKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIHNlbGYucGF0aENvbXBvbmVudHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgcGF0aHMgPSBbXTtcbiAgICAgICAgc2VsZi51cmkoKS5zcGxpdCgnLycpLnJlZHVjZSgocGF0aCwgYykgPT4ge1xuICAgICAgICAgICAgcGF0aCArPSAnLycgKyBjO1xuICAgICAgICAgICAgcGF0aHMucHVzaChuZXcgUGF0aENvbXBvbmVudChjLCBwYXRoKSk7XG4gICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgfSwgJycpO1xuICAgICAgICByZXR1cm4gcGF0aHM7XG4gICAgfSk7XG59O1xuXG5TdHJlYW1Nb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbU1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEuaWQsXG4gICAgICAgIGRhdGEgJiYgZGF0YS5uYW1lLFxuICAgICAgICBkYXRhICYmIGRhdGEudXJpLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgbmV3IERhdGUoZGF0YSAmJiBkYXRhLnVwZGF0ZWQpLCAoZGF0YSAmJiBkYXRhLnRhZ3MgfHwgW10pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRhZ01vZGVsKHgudGFnKTtcbiAgICAgICAgfSkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBVc2VyTW9kZWwgPSBmdW5jdGlvbih1c2VyTmFtZSwgc3RhdHVzLCByb290U3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlck5hbWUgPSBrby5vYnNlcnZhYmxlKHVzZXJOYW1lIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYucm9vdFN0cmVhbSA9IGtvLm9ic2VydmFibGUocm9vdFN0cmVhbSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG59O1xuXG5Vc2VyTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBVc2VyTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS51c2VyTmFtZSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIGRhdGEgJiYgZGF0YS5yb290U3RyZWFtKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkLnVyaSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi51bnNoaWZ0KGNoaWxkKTtcbiAgICB9O1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5leHBvcnQgY29uc3QgcGFyc2VRdWVyeVN0cmluZyA9IChxdWVyeVN0cmluZykgPT4ge1xuICAgIHJldHVybiBxdWVyeVN0cmluZy5zdWJzdHIoMSkuc3BsaXQoXCImXCIpXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24oZGljdCwgaXRlbSkge1xuICAgICAgICAgICAgdmFyIGt2ID0gaXRlbS5zcGxpdChcIj1cIik7XG4gICAgICAgICAgICB2YXIgayA9IGt2WzBdO1xuICAgICAgICAgICAgdmFyIHYgPSBkZWNvZGVVUklDb21wb25lbnQoa3ZbMV0pO1xuICAgICAgICAgICAgaWYgKGsgaW4gZGljdCkgZGljdFtrXS5wdXNoKHYpOyBlbHNlIGRpY3Rba10gPSBbdl07XG4gICAgICAgICAgICByZXR1cm4gZGljdDtcbiAgICAgICAgfSwge30pO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFF1ZXJ5U3RyaW5nID0gKCkgPT4ge1xuICAgIHJldHVybiBwYXJzZVF1ZXJ5U3RyaW5nKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xufTtcblxuZXhwb3J0IGNvbnN0IGxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIHRydWUpXG4gICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1bmxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSlcbiAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoICBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0ICogYXMgc3RyZWFtX21hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBhcHBsaWNhdGlvbl9tb2RlbCBmcm9tICcuL2FwcGxpY2F0aW9uX21vZGVsJztcbmltcG9ydCAqIGFzIHNoYXJlZCBmcm9tICcuL3NoYXJlZCc7XG5cbi8qKlxuKi9cbnZhciBTdHJlYW1JbmRleFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHJlc3VsdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG5cbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucmVzdWx0cyA9IGtvLm9ic2VydmFibGVBcnJheShyZXN1bHRzKTtcbiAgICBzZWxmLnF1ZXJ5ID0ga28ub2JzZXJ2YWJsZSh1bmRlZmluZWQpO1xufTtcblxudmFyIG5vcm1hbGl6ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHF1ZXJ5KS5yZXBsYWNlKC9cXCsvZywgJyAnKS50cmltKCk7XG59O1xuXG52YXIgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5ID0gZnVuY3Rpb24obW9kZWwsIHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBub3JtYWxpemVRdWVyeShxdWVyeSk7XG4gICAgJCgnLmxpc3QtbG9hZGluZycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0U3RyZWFtcygpLnVybCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgJ3F1ZXJ5JzogcXVlcnlcbiAgICAgICAgfSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgLy8gdG9kbzogZGlzcGxheSBlcnJvciBtc2dcbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIG1vZGVsLnF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgbW9kZWwucmVzdWx0cygocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG59O1xuXG52YXIgdXBkYXRlU2VhcmNoUmVzdWx0cyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgcmV0dXJuIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeShcbiAgICAgICAgbW9kZWwsXG4gICAgICAgIG5vcm1hbGl6ZVF1ZXJ5KCQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwoKSkpO1xufTtcblxudmFyIGdldFF1ZXJ5RnJvbVF1ZXJ5U3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHFzID0gc2hhcmVkLmdldFF1ZXJ5U3RyaW5nKCkucXVlcnk7XG4gICAgcmV0dXJuIChxcyA/IG5vcm1hbGl6ZVF1ZXJ5KHFzWzBdKSA6ICcnKTtcbn07XG5cbnZhciB1cGRhdGVGcm9tUXVlcnlTdHJpbmcgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBxdWVyeSA9IGdldFF1ZXJ5RnJvbVF1ZXJ5U3RyaW5nKCk7XG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLnZhbChxdWVyeSk7XG4gICAgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCBxdWVyeSk7XG59O1xuXG4kKGZ1bmN0aW9uKCl7XG4gICAgdmFyIG1vZGVsID0gbmV3IFN0cmVhbUluZGV4Vmlld01vZGVsKFxuICAgICAgICBhcHBsaWNhdGlvbl9tb2RlbC5pbml0aWFsVXNlcigpLFxuICAgICAgICBbXSk7XG5cbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGJ1dHRvbicpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzKSB7XG4gICAgICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwucmVzdWx0cy5zdWJzY3JpYmUoZnVuY3Rpb24ocmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGgpXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgfSk7XG5cbiAgICBtb2RlbC5xdWVyeS5zdWJzY3JpYmUoZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRRdWVyeSA9ICh3aW5kb3cuaGlzdG9yeS5zdGF0ZSA/IHdpbmRvdy5oaXN0b3J5LnN0YXRlLnF1ZXJ5IDogdW5kZWZpbmVkKTtcbiAgICAgICAgaWYgKHF1ZXJ5ID09PSBjdXJyZW50UXVlcnkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHZhciBwYXRoID0gd2luZG93LmxvY2F0aW9uLm9yaWdpbiArIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZTtcbiAgICAgICAgdmFyIHVybCA9IChxdWVyeSA/IHBhdGggKyBcIj9xdWVyeT1cIiArIGVuY29kZVVSSUNvbXBvbmVudChxdWVyeSkgOiBwYXRoKTtcbiAgICAgICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHsgcXVlcnk6IHF1ZXJ5IH0sICcnLCB1cmwpO1xuICAgIH0pO1xuXG4gICAgd2luZG93Lm9ucG9wc3RhdGUgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIHVwZGF0ZUZyb21RdWVyeVN0cmluZyhtb2RlbCk7XG4gICAgfTtcblxuICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7IHF1ZXJ5OiBnZXRRdWVyeUZyb21RdWVyeVN0cmluZygpIH0sICcnLCB3aW5kb3cubG9jYXRpb24uaHJlZik7XG5cbiAgICB1cGRhdGVGcm9tUXVlcnlTdHJpbmcobW9kZWwpO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiovXG5leHBvcnQgY29uc3QgU3RyZWFtTWFuYWdlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnN0cmVhbXMgPSB7IH07XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHsgfTtcblxuICAgIHZhciBwcm9jZXNzTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHR5cGUgPSBtc2cudHlwZTtcbiAgICAgICAgdmFyIHRhcmdldCA9IChtc2cuc291cmNlID8gc2VsZi5jb2xsZWN0aW9uc1ttc2cuc291cmNlXSA6IHNlbGYuc3RyZWFtc1ttc2cuZnJvbV0pO1xuICAgICAgICAodGFyZ2V0ID8gdGFyZ2V0Lmxpc3RlbmVycyA6IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIGlmICh4W3R5cGVdKVxuICAgICAgICAgICAgICAgIHhbdHlwZV0obXNnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgIHZhciBvcGVuV2Vic29ja2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHNvY2tldFBhdGgoKSk7XG5cbiAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldFN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB0YXJnZXRTdHJlYW1zXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0Q29sbGVjdGlvbnMgPSBPYmplY3Qua2V5cyhzZWxmLmNvbGxlY3Rpb25zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRDb2xsZWN0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB4XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGlmIChkYXRhKVxuICAgICAgICAgICAgICAgIHByb2Nlc3NNZXNzYWdlKGRhdGEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVvcGVuJyk7XG4gICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQWxsID0gZnVuY3Rpb24ocGF0aHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG5ld1N1YnNjcmlwdGlvbnMgPSBbXTtcbiAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5zdHJlYW1zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHBhdGggPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhdGgpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcbiJdfQ==
