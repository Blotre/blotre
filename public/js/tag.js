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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyIsImNsaWVudC9qcy90YWcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7Ozs7Ozs7O0lBQ1k7Ozs7Ozs7Ozs7OztBQUtMLElBQU0sc0NBQWUsU0FBZixZQUFlLENBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUI7QUFDN0MsUUFBSSxPQUFPLElBQVAsQ0FEeUM7QUFFN0MsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBRjZDO0FBRzdDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUg2QztBQUk3QyxTQUFLLFNBQUwsR0FBaUIsR0FBRyxVQUFILENBQWMsSUFBSSxPQUFPLFVBQVAsQ0FBa0IsS0FBSyxRQUFMLEVBQXRCLENBQWQsQ0FBakIsQ0FKNkM7O0FBTTdDLFNBQUssT0FBTCxHQUFlLHlCQUFjLFdBQWQsRUFBZixDQU42Qzs7QUFRN0MsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSMEI7O0FBWTdDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDaEQsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR5QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFadUIsUUFtQjdDLENBQUssT0FBTCxDQUFhLFNBQWIsQ0FBdUIsS0FBSyxRQUFMLEVBQXZCLEVBQXdDO0FBQ3BDLHlC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QUFsQyxDQUR1QjtBQUUzQixnQkFBSSxjQUFjLE1BQWQsRUFBc0I7QUFDdEIsOEJBQWMsQ0FBZCxFQUFpQixNQUFqQixDQUF3QixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBSSxNQUFKLENBQXBELEVBRHNCO0FBRXRCLHNCQUFNLFFBQU4sQ0FBZSxjQUFjLENBQWQsQ0FBZixFQUZzQjthQUExQjtTQUZhO0FBT2pCLHNCQUFjLG9CQUFTLEdBQVQsRUFBYztBQUN4QixrQkFBTSxRQUFOLENBQWUsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksS0FBSixDQUEzQyxFQUR3QjtTQUFkO0FBR2Qsd0JBQWdCLHNCQUFTLEdBQVQsRUFBYztBQUMxQixrQkFBTSxXQUFOLENBQWtCLElBQUksS0FBSixDQUFsQixDQUQwQjtTQUFkO0tBWHBCLEVBbkNTOztBQW1EVCxXQUFPLFVBQVAsR0FBb0IsVUFBUyxDQUFULEVBQVk7QUFDNUIsOEJBQXNCLEtBQXRCLEVBRDRCO0tBQVosQ0FuRFg7O0FBdURULFdBQU8sT0FBUCxDQUFlLFlBQWYsQ0FBNEI7QUFDeEIsZUFBTyx5QkFBUDtLQURKLEVBRUcsRUFGSCxFQUVPLE9BQU8sUUFBUCxDQUFnQixJQUFoQixDQUZQLENBdkRTOztBQTJEVCwwQkFBc0IsS0FBdEIsRUEzRFM7O0FBNkRULE9BQUcsYUFBSCxDQUFpQixLQUFqQixFQTdEUztDQUFYLENBQUYiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0IFN0cmVhbU1hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IFN0cmVhbU1hbmFnZXIuZ2V0SW5zdGFuY2UoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IHNsaWNlID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xPUiA9IFwiIzc3Nzc3N1wiO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG5jb25zdCBQYXRoQ29tcG9uZW50ID0gZnVuY3Rpb24obmFtZSwgdXJpKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUoJy9zJyArIHVyaSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG5cbiAgICBzZWxmLnBhdGhDb21wb25lbnRzID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gW107XG4gICAgICAgIHNlbGYudXJpKCkuc3BsaXQoJy8nKS5yZWR1Y2UoKHBhdGgsIGMpID0+IHtcbiAgICAgICAgICAgIHBhdGggKz0gJy8nICsgYztcbiAgICAgICAgICAgIHBhdGhzLnB1c2gobmV3IFBhdGhDb21wb25lbnQoYywgcGF0aCkpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sICcnKTtcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xuICAgIH0pO1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSwgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7XG4gICAgICAgIH0pKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0IGNvbnN0IHBhcnNlUXVlcnlTdHJpbmcgPSAocXVlcnlTdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcXVlcnlTdHJpbmcuc3Vic3RyKDEpLnNwbGl0KFwiJlwiKVxuICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGRpY3QsIGl0ZW0pIHtcbiAgICAgICAgICAgIHZhciBrdiA9IGl0ZW0uc3BsaXQoXCI9XCIpO1xuICAgICAgICAgICAgdmFyIGsgPSBrdlswXTtcbiAgICAgICAgICAgIHZhciB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KGt2WzFdKTtcbiAgICAgICAgICAgIGlmIChrIGluIGRpY3QpXG4gICAgICAgICAgICAgICAgZGljdFtrXS5wdXNoKHYpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGRpY3Rba10gPSBbdl07XG4gICAgICAgICAgICByZXR1cm4gZGljdDtcbiAgICAgICAgfSwge30pO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFF1ZXJ5U3RyaW5nID0gKCkgPT4ge1xuICAgIHJldHVybiBwYXJzZVF1ZXJ5U3RyaW5nKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xufTtcblxuZXhwb3J0IGNvbnN0IGxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG5leHBvcnQgY29uc3QgdW5sb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoICBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuXG5jb25zdCBzb2NrZXRQYXRoID0gKCkgPT4ge1xuICAgIGNvbnN0IHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4gICAgTWFuYWdlcyBhIHdlYnNvY2tldCBjb25uZWN0aW9uXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN0cmVhbU1hbmFnZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHNlbGYuc3RyZWFtcyA9IHt9O1xuICAgICAgICBzZWxmLmNvbGxlY3Rpb25zID0ge307XG4gICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBwcm9jZXNzTWVzc2FnZSA9IG1zZyA9PiB7XG4gICAgICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goeCA9PlxuICAgICAgICAgICAgICAgIHhbdHlwZV0gJiYgeFt0eXBlXShtc2cpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBvcGVuV2Vic29ja2V0ID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgICAgICBzb2NrZXQub25vcGVuID0gZSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKHggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGV2ZW50ID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHN1YnNjcmliZUFsbChwYXRocywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgY29uc3QgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgICAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IG5ld1N1YnNjcmlwdGlvbnNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdWJzY3JpYmVDb2xsZWN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdID0ge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiBwYXRoXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAgICBHZXQgdGhlIHN0cmVhbV9tYW5hZ2VyIHNpbmdsZXRvbi5cbiovXG5TdHJlYW1NYW5hZ2VyLmdldEluc3RhbmNlID0gKCgpID0+IHtcbiAgICBsZXQgaW5zdGFuY2U7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoIWluc3RhbmNlKVxuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgU3RyZWFtTWFuYWdlcigpO1xuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfTtcbn0pKCk7XG4iLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyBzdHJlYW1fbWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcbmltcG9ydCAqIGFzIGFwcGxpY2F0aW9uX21vZGVsIGZyb20gJy4vYXBwbGljYXRpb25fbW9kZWwnO1xuaW1wb3J0ICogYXMgc2hhcmVkIGZyb20gJy4vc2hhcmVkJztcblxuLyoqXG4gKi9cbnZhciBUYWdWaWV3TW9kZWwgPSBmdW5jdGlvbih0YWcsIHVzZXIsIHJlc3VsdHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG5cbiAgICBzZWxmLnRhZyA9IGtvLm9ic2VydmFibGUodGFnKTtcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih0YWcpKTtcbiAgICBzZWxmLnF1ZXJ5ID0ga28ub2JzZXJ2YWJsZSh1bmRlZmluZWQpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4oKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlQ2hpbGQgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5jaGlsZHJlbigpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgIH0pO1xuICAgIH07XG59O1xuXG52YXIgbm9ybWFsaXplUXVlcnkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkocXVlcnkpLnJlcGxhY2UoL1xcKy9nLCAnICcpLnRyaW0oKTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkgPSBmdW5jdGlvbihtb2RlbCwgcXVlcnkpIHtcbiAgICBxdWVyeSA9IG5vcm1hbGl6ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAkKCcubGlzdC1sb2FkaW5nJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5nZXRUYWdDaGlsZHJlbihtb2RlbC50YWcoKSkudXJsLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAncXVlcnknOiBxdWVyeVxuICAgICAgICB9LFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAvLyB0b2RvOiBkaXNwbGF5IGVycm9yIG1zZ1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgbW9kZWwucXVlcnkocXVlcnkpO1xuICAgICAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICByZXR1cm4gdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KFxuICAgICAgICBtb2RlbCxcbiAgICAgICAgbm9ybWFsaXplUXVlcnkoJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLnZhbCgpKSk7XG59O1xuXG52YXIgZ2V0UXVlcnlGcm9tUXVlcnlTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcXMgPSBzaGFyZWQuZ2V0UXVlcnlTdHJpbmcoKS5xdWVyeTtcbiAgICByZXR1cm4gKHFzID8gbm9ybWFsaXplUXVlcnkocXNbMF0pIDogJycpO1xufTtcblxudmFyIHVwZGF0ZUZyb21RdWVyeVN0cmluZyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgdmFyIHF1ZXJ5ID0gZ2V0UXVlcnlGcm9tUXVlcnlTdHJpbmcoKTtcbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGlucHV0JykudmFsKHF1ZXJ5KTtcbiAgICB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkobW9kZWwsIHF1ZXJ5KTtcbn07XG5cbiQoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsID0gbmV3IFRhZ1ZpZXdNb2RlbChcbiAgICAgICAgd2luZG93LmluaXRpYWxUYWcudGFnLFxuICAgICAgICBhcHBsaWNhdGlvbl9tb2RlbC5pbml0aWFsVXNlcigpLCBbXSk7XG5cbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGJ1dHRvbicpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzKSB7XG4gICAgICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwuY2hpbGRyZW4oKS5jaGlsZHJlbi5zdWJzY3JpYmUoZnVuY3Rpb24ocmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGgpXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgfSk7XG5cbiAgICBtb2RlbC5xdWVyeS5zdWJzY3JpYmUoZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRRdWVyeSA9ICh3aW5kb3cuaGlzdG9yeS5zdGF0ZSA/IHdpbmRvdy5oaXN0b3J5LnN0YXRlLnF1ZXJ5IDogdW5kZWZpbmVkKTtcbiAgICAgICAgaWYgKHF1ZXJ5ID09PSBjdXJyZW50UXVlcnkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHZhciBwYXRoID0gd2luZG93LmxvY2F0aW9uLm9yaWdpbiArIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZTtcbiAgICAgICAgdmFyIHVybCA9IChxdWVyeSA/IHBhdGggKyBcIj9xdWVyeT1cIiArIGVuY29kZVVSSUNvbXBvbmVudChxdWVyeSkgOiBwYXRoKTtcbiAgICAgICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHtcbiAgICAgICAgICAgIHF1ZXJ5OiBxdWVyeVxuICAgICAgICB9LCAnJywgdXJsKTtcbiAgICB9KTtcblxuICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbignIycgKyBtb2RlbC50YWcoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBtb2RlbC5yZW1vdmVDaGlsZChtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIG1vZGVsLmFkZENoaWxkKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5yZW1vdmVDaGlsZChtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB3aW5kb3cub25wb3BzdGF0ZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdXBkYXRlRnJvbVF1ZXJ5U3RyaW5nKG1vZGVsKTtcbiAgICB9O1xuXG4gICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHtcbiAgICAgICAgcXVlcnk6IGdldFF1ZXJ5RnJvbVF1ZXJ5U3RyaW5nKClcbiAgICB9LCAnJywgd2luZG93LmxvY2F0aW9uLmhyZWYpO1xuXG4gICAgdXBkYXRlRnJvbVF1ZXJ5U3RyaW5nKG1vZGVsKTtcblxuICAgIGtvLmFwcGx5QmluZGluZ3MobW9kZWwpO1xufSk7XG4iXX0=
