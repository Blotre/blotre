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

},{"./models":2,"./stream_manager":4}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
"use strict";
"use-strict";

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

},{"./models":2}],5:[function(require,module,exports){
'use strict';
"use-strict";

var models = require('./models');
var stream_manager = require('./stream_manager');
var application_model = require('./application_model');
var shared = require('./shared');

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
        window.history.pushState({ query: query }, '', url);
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

    window.history.replaceState({ query: getQueryFromQueryString() }, '', window.location.href);

    updateFromQueryString(model);

    ko.applyBindings(model);
});

},{"./application_model":1,"./models":2,"./shared":3,"./stream_manager":4}]},{},[5])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyIsImNsaWVudC9qcy90YWcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7O0FBQ0EsSUFBTSxTQUFTLFFBQVEsVUFBUixDQUFUO0FBQ04sSUFBTSxpQkFBaUIsUUFBUSxrQkFBUixDQUFqQjs7OztBQUlOLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsSUFBZixFQUFxQjtBQUNwQyxRQUFJLE9BQU8sSUFBUCxDQURnQztBQUVwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGb0M7QUFHcEMsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBSG9DO0FBSXBDLFNBQUssU0FBTCxHQUFpQixHQUFHLFVBQUgsQ0FBYyxJQUFJLE9BQU8sVUFBUCxDQUFrQixLQUFLLFFBQUwsRUFBdEIsQ0FBZCxDQUFqQixDQUpvQzs7QUFNcEMsU0FBSyxPQUFMLEdBQWUsSUFBSSxlQUFlLGFBQWYsRUFBbkIsQ0FOb0M7O0FBUXBDLFNBQUssV0FBTCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsYUFBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLEtBQTFCLEVBRCtCO0tBQWhCLENBUmlCOztBQVlwQyxTQUFLLGNBQUwsR0FBc0IsVUFBUyxRQUFULEVBQW1CO0FBQ3JDLGVBQU8sS0FBSyxTQUFMLEdBQWlCLFFBQWpCLENBQTBCLE1BQTFCLENBQWlDLFVBQVMsQ0FBVCxFQUFZO0FBQy9DLG1CQUFPLEVBQUUsR0FBRixPQUFZLFFBQVosQ0FEd0M7U0FBWixDQUF4QyxDQURxQztLQUFuQjs7O0FBWmMsUUFtQnBDLENBQUssT0FBTCxDQUFhLFNBQWIsQ0FBdUIsS0FBSyxRQUFMLEVBQXZCLEVBQXdDO0FBQ3BDLHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsaUJBQUssSUFBTCxHQUFZLE1BQVosQ0FBbUIsSUFBSSxPQUFPLFdBQVAsQ0FBbUIsSUFBSSxNQUFKLENBQVcsS0FBWCxDQUExQyxFQUQyQjtTQUFkO0tBRHJCLEVBbkJvQzs7QUF5QnBDLFFBQUksQ0FBQyxJQUFELElBQVMsQ0FBQyxLQUFLLFVBQUwsRUFBRCxFQUNULE9BREo7O0FBR0EsTUFBRSxJQUFGLENBQU87QUFDSCxjQUFNLEtBQU47QUFDQSxhQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsY0FBekMsQ0FBd0QsS0FBSyxVQUFMLEVBQXhELEVBQTJFLEdBQTNFO0FBQ0wsaUJBQVM7QUFDTCxvQkFBUSxrQkFBUjtTQURKO0FBR0EsZUFBTyxlQUFTLENBQVQsRUFBWTtBQUFFLG9CQUFRLEtBQVIsQ0FBYyxDQUFkLEVBQUY7U0FBWjtLQU5YLEVBT0csSUFQSCxDQU9RLFVBQVMsTUFBVCxFQUFpQjtBQUNyQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsQ0FBQyxVQUFVLEVBQVYsQ0FBRCxDQUFlLEdBQWYsQ0FBbUIsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTdDLEVBRHFCO0tBQWpCLENBUFI7OztBQTVCb0MsUUF3Q3BDLENBQUssT0FBTCxDQUFhLG1CQUFiLENBQWlDLEtBQUssUUFBTCxFQUFqQyxFQUFrRDtBQUM5Qyx5QkFBaUIsdUJBQVMsR0FBVCxFQUFjO0FBQzNCLGdCQUFJLGdCQUFnQixLQUFLLGNBQUwsQ0FBb0IsSUFBSSxJQUFKLENBQXBDLENBRHVCO0FBRTNCLGdCQUFJLGNBQWMsTUFBZCxFQUFzQjtBQUN0Qiw4QkFBYyxDQUFkLEVBQWlCLE1BQWpCLENBQXdCLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE0QixJQUFJLE1BQUosQ0FBcEQsRUFEc0I7QUFFdEIscUJBQUssV0FBTCxDQUFpQixjQUFjLENBQWQsQ0FBakIsRUFGc0I7YUFBMUI7U0FGYTtBQU9qQixzQkFBYyxvQkFBUyxHQUFULEVBQWM7QUFDeEIsaUJBQUssV0FBTCxDQUFpQixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBSSxLQUFKLENBQTdDLEVBRHdCO1NBQWQ7QUFHZCx3QkFBZ0Isc0JBQVMsR0FBVCxFQUFjO0FBQzFCLGlCQUFLLGNBQUwsQ0FBb0IsSUFBSSxLQUFKLENBQXBCLENBRDBCO1NBQWQ7S0FYcEIsRUF4Q29DO0NBQXJCOztBQXlEbkIsSUFBSSxjQUFjLFNBQWQsV0FBYyxHQUFXO0FBQ3pCLFdBQU8sT0FBTyxTQUFQLENBQWlCLFFBQWpCLENBQTBCLE9BQU8sZUFBUCxDQUFqQyxDQUR5QjtDQUFYOztBQUlsQixPQUFPLE9BQVAsR0FBaUI7QUFDYixrQkFBYyxZQUFkO0FBQ0EsaUJBQWEsV0FBYjtDQUZKOzs7QUNuRUE7Ozs7O0FBQ0EsSUFBTSxRQUFRLFNBQVMsU0FBVCxDQUFtQixJQUFuQixDQUF3QixJQUF4QixDQUE2QixNQUFNLFNBQU4sQ0FBZ0IsS0FBaEIsQ0FBckM7O0FBRUMsSUFBTSx3Q0FBZ0IsU0FBaEI7Ozs7QUFJTixJQUFNLHNDQUFlLFNBQWYsWUFBZSxDQUFTLEdBQVQsRUFBYztBQUN0QyxXQUFPLFVBQVUsR0FBVixFQUNGLElBREUsR0FFRixXQUZFLEdBR0YsT0FIRSxDQUdNLEdBSE4sRUFHVyxHQUhYLENBQVAsQ0FEc0M7Q0FBZDs7Ozs7QUFVckIsSUFBTSx3Q0FBaUIsWUFBVztBQUNyQyxRQUFJLFNBQVMsQ0FBQyxLQUFELEVBQVEsS0FBUixFQUFlLEtBQWYsRUFBc0IsS0FBdEIsRUFBNkIsS0FBN0IsRUFBb0MsS0FBcEMsRUFBMkMsS0FBM0MsRUFBa0QsS0FBbEQsRUFBeUQsS0FBekQsRUFBZ0UsS0FBaEUsRUFBdUUsS0FBdkUsRUFBOEUsS0FBOUUsQ0FBVCxDQURpQzs7QUFHckMsUUFBSSxNQUFNLFNBQU4sR0FBTSxDQUFTLEdBQVQsRUFBYyxLQUFkLEVBQXFCO0FBQzNCLGlCQUFTLEVBQVQsQ0FEMkI7QUFFM0IsZUFBTyxNQUFNLE1BQU4sR0FBZSxHQUFmO0FBQ0gsb0JBQVEsTUFBTSxLQUFOO1NBRFosT0FFTyxLQUFQLENBSjJCO0tBQXJCLENBSDJCOztBQVVyQyxXQUFPLFVBQVMsSUFBVCxFQUFlO0FBQ2xCLFlBQUksQ0FBQyxJQUFELEVBQ0EsT0FBTyxHQUFQLENBREo7O0FBR0EsZUFBTyxPQUFPLEtBQUssUUFBTCxFQUFQLElBQTBCLEdBQTFCLEdBQWdDLElBQUksQ0FBSixFQUFPLEtBQUssT0FBTCxFQUFQLENBQWhDLEdBQXlELElBQXpELEdBQWdFLEtBQUssV0FBTCxFQUFoRSxHQUFxRixHQUFyRixHQUNILElBQUksQ0FBSixFQUFPLEtBQUssUUFBTCxFQUFQLENBREcsR0FDdUIsR0FEdkIsR0FDNkIsSUFBSSxDQUFKLEVBQU8sS0FBSyxVQUFMLEVBQVAsQ0FEN0IsR0FDeUQsR0FEekQsR0FFSCxJQUFJLENBQUosRUFBTyxLQUFLLFVBQUwsRUFBUCxDQUZHLEdBRXlCLElBQUksQ0FBSixFQUFPLEtBQUssZUFBTCxFQUFQLENBRnpCLENBSlc7S0FBZixDQVY4QjtDQUFYLEVBQWpCOzs7O0FBc0JOLElBQU0sb0NBQWMsU0FBZCxXQUFjLENBQVMsS0FBVCxFQUFnQjtBQUN2QyxRQUFJLE9BQU8sSUFBUCxDQURtQztBQUV2QyxTQUFLLEtBQUwsR0FBYSxHQUFHLFVBQUgsQ0FBYyxLQUFkLENBQWIsQ0FGdUM7Q0FBaEI7O0FBSzNCLFlBQVksS0FBWixHQUFvQixZQUFXO0FBQzNCLFdBQU8sSUFBSSxXQUFKLENBQWdCLGFBQWhCLENBQVAsQ0FEMkI7Q0FBWDs7QUFJcEIsWUFBWSxRQUFaLEdBQXVCLFVBQVMsSUFBVCxFQUFlO0FBQ2xDLFdBQU8sSUFBSSxXQUFKLENBQWdCLFFBQVEsS0FBSyxLQUFMLENBQS9CLENBRGtDO0NBQWY7Ozs7QUFNaEIsSUFBTSw4QkFBVyxTQUFYLFFBQVcsQ0FBUyxLQUFULEVBQWdCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssS0FBTCxHQUFhLEdBQUcsVUFBSCxDQUFjLEtBQWQsQ0FBYixDQUZvQzs7QUFJcEMsU0FBSyxHQUFMLEdBQVcsR0FBRyxRQUFILENBQVksWUFBVztBQUM5QixlQUFPLFNBQVMsV0FBVCxDQUFxQixNQUFyQixDQUE0QixNQUE1QixDQUFtQyxLQUFLLEtBQUwsRUFBbkMsRUFBaUQsR0FBakQsQ0FEdUI7S0FBWCxDQUF2QixDQUpvQztDQUFoQjs7OztBQVd4QixJQUFNLGdCQUFnQixTQUFoQixhQUFnQixDQUFTLElBQVQsRUFBZSxHQUFmLEVBQW9CO0FBQ3RDLFFBQU0sT0FBTyxJQUFQLENBRGdDO0FBRXRDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZzQztBQUd0QyxTQUFLLEdBQUwsR0FBVyxHQUFHLFVBQUgsQ0FBYyxPQUFPLEdBQVAsQ0FBekIsQ0FIc0M7Q0FBcEI7Ozs7QUFRZixJQUFNLG9DQUFjLFNBQWQsV0FBYyxDQUFTLEVBQVQsRUFBYSxJQUFiLEVBQW1CLEdBQW5CLEVBQXdCLE1BQXhCLEVBQWdDLE9BQWhDLEVBQXlDLElBQXpDLEVBQStDO0FBQ3RFLFFBQUksT0FBTyxJQUFQLENBRGtFO0FBRXRFLFNBQUssRUFBTCxHQUFVLEdBQUcsVUFBSCxDQUFjLEVBQWQsQ0FBVixDQUZzRTtBQUd0RSxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxRQUFRLEVBQVIsQ0FBMUIsQ0FIc0U7QUFJdEUsU0FBSyxHQUFMLEdBQVcsR0FBRyxVQUFILENBQWMsT0FBTyxFQUFQLENBQXpCLENBSnNFO0FBS3RFLFNBQUssTUFBTCxHQUFjLEdBQUcsVUFBSCxDQUFjLFVBQVUsWUFBWSxLQUFaLEVBQVYsQ0FBNUIsQ0FMc0U7QUFNdEUsU0FBSyxPQUFMLEdBQWUsR0FBRyxVQUFILENBQWMsT0FBZCxDQUFmLENBTnNFO0FBT3RFLFNBQUssSUFBTCxHQUFZLEdBQUcsZUFBSCxDQUFtQixRQUFRLEVBQVIsQ0FBL0IsQ0FQc0U7O0FBU3RFLFNBQUssR0FBTCxHQUFXLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDOUIsZUFBTyxTQUFTLFdBQVQsQ0FBcUIsTUFBckIsQ0FBNEIsU0FBNUIsQ0FBc0MsS0FBSyxHQUFMLEVBQXRDLEVBQWtELEdBQWxELENBRHVCO0tBQVgsQ0FBdkIsQ0FUc0U7O0FBYXRFLFNBQUssS0FBTCxHQUFhLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDaEMsWUFBSSxTQUFTLEtBQUssTUFBTCxFQUFULENBRDRCO0FBRWhDLGVBQVEsU0FBUyxPQUFPLEtBQVAsRUFBVCxHQUEwQixhQUExQixDQUZ3QjtLQUFYLENBQXpCLENBYnNFOztBQWtCdEUsU0FBSyxRQUFMLEdBQWdCLFVBQVMsS0FBVCxFQUFnQjtBQUM1QixZQUFJLFNBQVMsS0FBSyxNQUFMLE1BQWlCLFlBQVksS0FBWixFQUFqQixDQURlO0FBRTVCLGVBQU8sS0FBUCxDQUFhLEtBQWIsRUFGNEI7QUFHNUIsYUFBSyxNQUFMLENBQVksTUFBWixFQUg0QjtLQUFoQixDQWxCc0Q7O0FBd0J0RSxTQUFLLGNBQUwsR0FBc0IsR0FBRyxRQUFILENBQVksWUFBVztBQUN6QyxlQUFPLGNBQWMsS0FBSyxPQUFMLEVBQWQsQ0FBUCxDQUR5QztLQUFYLENBQWxDLENBeEJzRTs7QUE0QnRFLFNBQUssT0FBTCxHQUFlLFVBQVMsSUFBVCxFQUFlO0FBQzFCLFlBQUksV0FBVyxhQUFhLEtBQUssUUFBTCxFQUFiLENBQVgsQ0FEc0I7QUFFMUIsZUFBUSxhQUFhLEtBQUssR0FBTCxFQUFiLElBQTJCLEtBQUssR0FBTCxHQUFXLE9BQVgsQ0FBbUIsV0FBVyxHQUFYLENBQW5CLEtBQXVDLENBQXZDLENBRlQ7S0FBZixDQTVCdUQ7O0FBaUN0RSxTQUFLLGNBQUwsR0FBc0IsR0FBRyxRQUFILENBQVksWUFBVztBQUN6QyxZQUFNLFFBQVEsRUFBUixDQURtQztBQUV6QyxhQUFLLEdBQUwsR0FBVyxLQUFYLENBQWlCLEdBQWpCLEVBQXNCLE1BQXRCLENBQTZCLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QyxvQkFBUSxNQUFNLENBQU4sQ0FEOEI7QUFFdEMsa0JBQU0sSUFBTixDQUFXLElBQUksYUFBSixDQUFrQixDQUFsQixFQUFxQixJQUFyQixDQUFYLEVBRnNDO0FBR3RDLG1CQUFPLElBQVAsQ0FIc0M7U0FBYixFQUkxQixFQUpILEVBRnlDO0FBT3pDLGVBQU8sS0FBUCxDQVB5QztLQUFYLENBQWxDLENBakNzRTtDQUEvQzs7QUE0QzNCLFlBQVksUUFBWixHQUF1QixVQUFTLElBQVQsRUFBZTtBQUNsQyxXQUFPLElBQUksV0FBSixDQUNILFFBQVEsS0FBSyxFQUFMLEVBQ1IsUUFBUSxLQUFLLElBQUwsRUFDUixRQUFRLEtBQUssR0FBTCxFQUNSLFlBQVksUUFBWixDQUFxQixRQUFRLEtBQUssTUFBTCxDQUoxQixFQUtILElBQUksSUFBSixDQUFTLFFBQVEsS0FBSyxPQUFMLENBTGQsRUFLNkIsQ0FBQyxRQUFRLEtBQUssSUFBTCxJQUFhLEVBQXJCLENBQUQsQ0FBMEIsR0FBMUIsQ0FBOEIsVUFBUyxDQUFULEVBQVk7QUFDdEUsZUFBTyxJQUFJLFFBQUosQ0FBYSxFQUFFLEdBQUYsQ0FBcEIsQ0FEc0U7S0FBWixDQUwzRCxDQUFQLENBRGtDO0NBQWY7Ozs7QUFhaEIsSUFBTSxnQ0FBWSxTQUFaLFNBQVksQ0FBUyxRQUFULEVBQW1CLE1BQW5CLEVBQTJCLFVBQTNCLEVBQXVDO0FBQzVELFFBQUksT0FBTyxJQUFQLENBRHdEO0FBRTVELFNBQUssUUFBTCxHQUFnQixHQUFHLFVBQUgsQ0FBYyxZQUFZLEVBQVosQ0FBOUIsQ0FGNEQ7QUFHNUQsU0FBSyxNQUFMLEdBQWMsR0FBRyxVQUFILENBQWMsVUFBVSxZQUFZLEtBQVosRUFBVixDQUE1QixDQUg0RDtBQUk1RCxTQUFLLFVBQUwsR0FBa0IsR0FBRyxVQUFILENBQWMsVUFBZCxDQUFsQixDQUo0RDs7QUFNNUQsU0FBSyxLQUFMLEdBQWEsR0FBRyxRQUFILENBQVksWUFBVztBQUNoQyxZQUFJLFNBQVMsS0FBSyxNQUFMLEVBQVQsQ0FENEI7QUFFaEMsZUFBUSxTQUFTLE9BQU8sS0FBUCxFQUFULEdBQTBCLGFBQTFCLENBRndCO0tBQVgsQ0FBekIsQ0FONEQ7Q0FBdkM7O0FBWXpCLFVBQVUsUUFBVixHQUFxQixVQUFTLElBQVQsRUFBZTtBQUNoQyxXQUFPLElBQUksU0FBSixDQUNILFFBQVEsS0FBSyxRQUFMLEVBQ1IsWUFBWSxRQUFaLENBQXFCLFFBQVEsS0FBSyxNQUFMLENBRjFCLEVBR0gsUUFBUSxLQUFLLFVBQUwsQ0FIWixDQURnQztDQUFmOzs7O0FBU2QsSUFBTSxrQ0FBYSxTQUFiLFVBQWEsQ0FBUyxHQUFULEVBQWM7QUFDcEMsUUFBSSxPQUFPLElBQVAsQ0FEZ0M7QUFFcEMsU0FBSyxHQUFMLEdBQVcsR0FBRyxVQUFILENBQWMsR0FBZCxDQUFYLENBRm9DO0FBR3BDLFNBQUssUUFBTCxHQUFnQixHQUFHLGVBQUgsRUFBaEIsQ0FIb0M7O0FBS3BDLFNBQUssUUFBTCxHQUFnQixVQUFTLEtBQVQsRUFBZ0I7QUFDNUIsYUFBSyxRQUFMLENBQWMsTUFBZCxDQUFxQixVQUFTLENBQVQsRUFBWTtBQUM3QixtQkFBTyxFQUFFLEdBQUYsT0FBWSxNQUFNLEdBQU4sRUFBWixDQURzQjtTQUFaLENBQXJCLENBRDRCO0FBSTVCLGFBQUssUUFBTCxDQUFjLE9BQWQsQ0FBc0IsS0FBdEIsRUFKNEI7S0FBaEIsQ0FMb0I7Q0FBZDs7OztBQ3ZKMUI7Ozs7O0FBRU8sSUFBTSw4Q0FBbUIsU0FBbkIsZ0JBQW1CLENBQUMsV0FBRCxFQUFpQjtBQUM3QyxXQUFPLFlBQVksTUFBWixDQUFtQixDQUFuQixFQUFzQixLQUF0QixDQUE0QixHQUE1QixFQUNGLE1BREUsQ0FDSyxVQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3pCLFlBQUksS0FBSyxLQUFLLEtBQUwsQ0FBVyxHQUFYLENBQUwsQ0FEcUI7QUFFekIsWUFBSSxJQUFJLEdBQUcsQ0FBSCxDQUFKLENBRnFCO0FBR3pCLFlBQUksSUFBSSxtQkFBbUIsR0FBRyxDQUFILENBQW5CLENBQUosQ0FIcUI7QUFJekIsWUFBSSxLQUFLLElBQUwsRUFBVyxLQUFLLENBQUwsRUFBUSxJQUFSLENBQWEsQ0FBYixFQUFmLEtBQXFDLEtBQUssQ0FBTCxJQUFVLENBQUMsQ0FBRCxDQUFWLENBQXJDO0FBQ0EsZUFBTyxJQUFQLENBTHlCO0tBQXJCLEVBTUwsRUFQQSxDQUFQLENBRDZDO0NBQWpCOztBQVd6QixJQUFNLDBDQUFpQixTQUFqQixjQUFpQixHQUFNO0FBQ2hDLFdBQU8saUJBQWlCLE9BQU8sUUFBUCxDQUFnQixNQUFoQixDQUF4QixDQURnQztDQUFOOztBQUl2QixJQUFNLGtDQUFhLFNBQWIsVUFBYSxDQUFDLEdBQUQsRUFBUztBQUM5QixRQUNJLElBREosQ0FDUyxVQURULEVBQ3FCLElBRHJCLEVBRUksUUFGSixDQUVhLFlBRmIsRUFHUSxRQUhSLENBR2lCLDZDQUhqQixFQUQ4QjtDQUFUOztBQU9uQixJQUFNLHNDQUFlLFNBQWYsWUFBZSxDQUFDLEdBQUQsRUFBUztBQUNqQyxRQUNJLElBREosQ0FDUyxVQURULEVBQ3FCLEtBRHJCLEVBRUksUUFGSixDQUVhLFlBRmIsRUFHUSxXQUhSLENBR29CLDhDQUhwQixFQURpQztDQUFUOzs7QUN4QjVCOztBQUNBLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDs7QUFHTixJQUFJLGFBQWEsU0FBYixVQUFhLEdBQVc7QUFDeEIsUUFBSSxTQUFTLE9BQU8sUUFBUCxDQUFnQixRQUFoQixLQUE2QixRQUE3QixDQURXO0FBRXhCLFdBQU8sQ0FBQyxTQUFTLEtBQVQsR0FBaUIsSUFBakIsQ0FBRCxHQUEwQixLQUExQixHQUFrQyxPQUFPLFFBQVAsQ0FBZ0IsSUFBaEIsR0FBdUIsUUFBekQsQ0FGaUI7Q0FBWDs7OztBQU9qQixJQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLFFBQUksT0FBTyxJQUFQLENBRHVCO0FBRTNCLFNBQUssT0FBTCxHQUFlLEVBQWYsQ0FGMkI7QUFHM0IsU0FBSyxXQUFMLEdBQW1CLEVBQW5CLENBSDJCOztBQUszQixRQUFJLGlCQUFpQixTQUFqQixjQUFpQixDQUFTLEdBQVQsRUFBYztBQUMvQixZQUFJLENBQUMsR0FBRCxJQUFRLENBQUMsSUFBSSxJQUFKLEVBQ1QsT0FESjs7QUFHQSxZQUFJLE9BQU8sSUFBSSxJQUFKLENBSm9CO0FBSy9CLFlBQUksU0FBVSxJQUFJLE1BQUosR0FBYSxLQUFLLFdBQUwsQ0FBaUIsSUFBSSxNQUFKLENBQTlCLEdBQTRDLEtBQUssT0FBTCxDQUFhLElBQUksSUFBSixDQUF6RCxDQUxpQjtBQU0vQixTQUFDLFNBQVMsT0FBTyxTQUFQLEdBQW1CLEVBQTVCLENBQUQsQ0FBaUMsT0FBakMsQ0FBeUMsVUFBUyxDQUFULEVBQVk7QUFDakQsZ0JBQUksRUFBRSxJQUFGLENBQUosRUFDSSxFQUFFLElBQUYsRUFBUSxHQUFSLEVBREo7U0FEcUMsQ0FBekMsQ0FOK0I7S0FBZCxDQUxNOztBQWlCM0IsU0FBSyxLQUFMLEdBQWEsS0FBYixDQWpCMkI7O0FBbUIzQixRQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLFlBQUksU0FBUyxJQUFJLFNBQUosQ0FBYyxZQUFkLENBQVQsQ0FEdUI7O0FBRzNCLGVBQU8sTUFBUCxHQUFnQixVQUFTLENBQVQsRUFBWTtBQUN4QixpQkFBSyxLQUFMLEdBQWEsSUFBYixDQUR3QjtBQUV4QixnQkFBSSxnQkFBZ0IsT0FBTyxJQUFQLENBQVksS0FBSyxPQUFMLENBQTVCLENBRm9CO0FBR3hCLGdCQUFJLGNBQWMsTUFBZCxFQUFzQjtBQUN0Qix1QkFBTyxJQUFQLENBQVksS0FBSyxTQUFMLENBQWU7QUFDdkIsNEJBQVEsV0FBUjtBQUNBLDBCQUFNLGFBQU47aUJBRlEsQ0FBWixFQURzQjthQUExQjs7QUFPQSxnQkFBSSxvQkFBb0IsT0FBTyxJQUFQLENBQVksS0FBSyxXQUFMLENBQWhDLENBVm9CO0FBV3hCLGdCQUFJLGtCQUFrQixNQUFsQixFQUEwQjtBQUMxQixrQ0FBa0IsT0FBbEIsQ0FBMEIsVUFBUyxDQUFULEVBQVk7QUFDbEMsMkJBQU8sSUFBUCxDQUFZLEtBQUssU0FBTCxDQUFlO0FBQ3ZCLGdDQUFRLHFCQUFSO0FBQ0EsOEJBQU0sQ0FBTjtxQkFGUSxDQUFaLEVBRGtDO2lCQUFaLENBQTFCLENBRDBCO2FBQTlCO1NBWFksQ0FIVzs7QUF3QjNCLGVBQU8sU0FBUCxHQUFtQixVQUFTLEtBQVQsRUFBZ0I7QUFDL0IsZ0JBQUksT0FBTyxLQUFLLEtBQUwsQ0FBVyxNQUFNLElBQU4sQ0FBbEIsQ0FEMkI7QUFFL0IsZ0JBQUksSUFBSixFQUNJLGVBQWUsSUFBZixFQURKO1NBRmUsQ0F4QlE7O0FBOEIzQixlQUFPLE9BQVAsR0FBaUIsWUFBVztBQUN4QixvQkFBUSxHQUFSLENBQVksUUFBWixFQUR3QjtBQUV4QixnQkFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLHFCQUFLLEtBQUwsR0FBYSxLQUFiLENBRFk7QUFFWixxQkFBSyxNQUFMLEdBQWMsZUFBZCxDQUZZO2FBQWhCO1NBRmEsQ0E5QlU7S0FBWCxDQW5CTzs7QUEwRDNCLFNBQUssTUFBTCxHQUFjLGVBQWQsQ0ExRDJCO0NBQVg7O0FBNkRwQixjQUFjLFNBQWQsQ0FBd0IsU0FBeEIsR0FBb0MsVUFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUN6RCxTQUFLLFlBQUwsQ0FBa0IsQ0FBQyxJQUFELENBQWxCLEVBQTBCLFFBQTFCLEVBRHlEO0NBQXpCOztBQUlwQyxjQUFjLFNBQWQsQ0FBd0IsWUFBeEIsR0FBdUMsVUFBUyxLQUFULEVBQWdCLFFBQWhCLEVBQTBCO0FBQzdELFFBQUksT0FBTyxJQUFQLENBRHlEOztBQUc3RCxRQUFJLG1CQUFtQixFQUFuQixDQUh5RDtBQUk3RCxVQUFNLEdBQU4sQ0FBVSxPQUFPLFlBQVAsQ0FBVixDQUErQixPQUEvQixDQUF1QyxVQUFTLElBQVQsRUFBZTtBQUNsRCxZQUFJLFVBQVUsS0FBSyxPQUFMLENBQWEsSUFBYixDQUFWLENBRDhDO0FBRWxELFlBQUksT0FBSixFQUFhO0FBQ1Qsb0JBQVEsU0FBUixDQUFrQixJQUFsQixDQUF1QixRQUF2QixFQURTO1NBQWIsTUFFTztBQUNILGlCQUFLLE9BQUwsQ0FBYSxJQUFiLElBQXFCLEVBQUUsV0FBVyxDQUFDLFFBQUQsQ0FBWCxFQUF2QixDQURHO0FBRUgsNkJBQWlCLElBQWpCLENBQXNCLElBQXRCLEVBRkc7U0FGUDtLQUZtQyxDQUF2QyxDQUo2RDs7QUFjN0QsUUFBSSxpQkFBaUIsTUFBakIsRUFBeUI7QUFDekIsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLFdBQVI7QUFDQSxzQkFBTSxnQkFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FESjtDQWRtQzs7QUF3QnZDLGNBQWMsU0FBZCxDQUF3QixtQkFBeEIsR0FBOEMsVUFBUyxJQUFULEVBQWUsUUFBZixFQUF5QjtBQUNuRSxRQUFJLE9BQU8sSUFBUCxDQUQrRDtBQUVuRSxXQUFPLE9BQU8sWUFBUCxDQUFvQixJQUFwQixDQUFQLENBRm1FOztBQUluRSxRQUFJLFVBQVUsS0FBSyxXQUFMLENBQWlCLElBQWpCLENBQVYsQ0FKK0Q7QUFLbkUsUUFBSSxPQUFKLEVBQWE7QUFDVCxnQkFBUSxTQUFSLENBQWtCLElBQWxCLENBQXVCLFFBQXZCLEVBRFM7S0FBYixNQUVPO0FBQ0gsYUFBSyxXQUFMLENBQWlCLElBQWpCLElBQXlCLEVBQUUsV0FBVyxDQUFDLFFBQUQsQ0FBWCxFQUEzQixDQURHO0FBRUgsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLHFCQUFSO0FBQ0Esc0JBQU0sSUFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FKSjtDQUwwQzs7QUFtQjlDLE9BQU8sT0FBUCxHQUFpQjtBQUNiLG1CQUFlLGFBQWY7Q0FESjs7OztBQ3ZIQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCO0FBQ04sSUFBTSxvQkFBb0IsUUFBUSxxQkFBUixDQUFwQjtBQUNOLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDs7OztBQUlOLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxHQUFULEVBQWMsSUFBZCxFQUFvQixPQUFwQixFQUE2QjtBQUM1QyxRQUFJLE9BQU8sSUFBUCxDQUR3QztBQUU1QyxzQkFBa0IsWUFBbEIsQ0FBK0IsSUFBL0IsQ0FBb0MsSUFBcEMsRUFBMEMsSUFBMUMsRUFGNEM7O0FBSTVDLFNBQUssR0FBTCxHQUFXLEdBQUcsVUFBSCxDQUFjLEdBQWQsQ0FBWCxDQUo0QztBQUs1QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FMNEM7QUFNNUMsU0FBSyxRQUFMLEdBQWdCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEdBQXRCLENBQWQsQ0FBaEIsQ0FONEM7QUFPNUMsU0FBSyxLQUFMLEdBQWEsR0FBRyxVQUFILENBQWMsU0FBZCxDQUFiLENBUDRDOztBQVM1QyxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxLQUFULEVBQWdCO0FBQzVCLGFBQUssUUFBTCxHQUFnQixRQUFoQixDQUF5QixLQUF6QixFQUQ0QjtLQUFoQixDQVQ0Qjs7QUFhNUMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsUUFBVCxFQUFtQjtBQUNsQyxlQUFPLEtBQUssUUFBTCxHQUFnQixRQUFoQixDQUF5QixNQUF6QixDQUFnQyxVQUFTLENBQVQsRUFBWTtBQUM5QyxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHVDO1NBQVosQ0FBdkMsQ0FEa0M7S0FBbkIsQ0FieUI7Q0FBN0I7O0FBb0JuQixJQUFJLGlCQUFpQixTQUFqQixjQUFpQixDQUFTLEtBQVQsRUFBZ0I7QUFDakMsV0FBTyxVQUFVLEtBQVYsRUFBaUIsT0FBakIsQ0FBeUIsS0FBekIsRUFBZ0MsR0FBaEMsRUFBcUMsSUFBckMsRUFBUCxDQURpQztDQUFoQjs7QUFJckIsSUFBSSw4QkFBOEIsU0FBOUIsMkJBQThCLENBQVMsS0FBVCxFQUFnQixLQUFoQixFQUF1QjtBQUNyRCxZQUFRLGVBQWUsS0FBZixDQUFSLENBRHFEO0FBRXJELE1BQUUsZUFBRixFQUFtQixXQUFuQixDQUErQixRQUEvQixFQUZxRDtBQUdyRCxNQUFFLElBQUYsQ0FBTztBQUNILGNBQU0sS0FBTjtBQUNBLGFBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxjQUF6QyxDQUF3RCxNQUFNLEdBQU4sRUFBeEQsRUFBcUUsR0FBckU7QUFDTCxjQUFNO0FBQ0YscUJBQVMsS0FBVDtTQURKO0FBR0EsaUJBQVM7QUFDTCxvQkFBUSxrQkFBUjtTQURKO0FBR0EsZUFBTyxpQkFBVztBQUNkLGNBQUUsZUFBRixFQUFtQixRQUFuQixDQUE0QixRQUE1Qjs7QUFEYyxTQUFYO0tBVFgsRUFhRyxJQWJILENBYVEsVUFBUyxNQUFULEVBQWlCO0FBQ3JCLFVBQUUsZUFBRixFQUFtQixRQUFuQixDQUE0QixRQUE1QixFQURxQjtBQUVyQixjQUFNLEtBQU4sQ0FBWSxLQUFaLEVBRnFCO0FBR3JCLGNBQU0sUUFBTixHQUFpQixRQUFqQixDQUEwQixDQUFDLFVBQVUsRUFBVixDQUFELENBQWUsR0FBZixDQUFtQixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBN0MsRUFIcUI7S0FBakIsQ0FiUixDQUhxRDtDQUF2Qjs7QUF1QmxDLElBQUksc0JBQXNCLFNBQXRCLG1CQUFzQixDQUFTLEtBQVQsRUFBZ0I7QUFDdEMsV0FBTyw0QkFDSCxLQURHLEVBRUgsZUFBZSxFQUFFLDJCQUFGLEVBQStCLEdBQS9CLEVBQWYsQ0FGRyxDQUFQLENBRHNDO0NBQWhCOztBQU0xQixJQUFJLDBCQUEwQixTQUExQix1QkFBMEIsR0FBVztBQUNyQyxRQUFJLEtBQUssT0FBTyxjQUFQLEdBQXdCLEtBQXhCLENBRDRCO0FBRXJDLFdBQVEsS0FBSyxlQUFlLEdBQUcsQ0FBSCxDQUFmLENBQUwsR0FBNkIsRUFBN0IsQ0FGNkI7Q0FBWDs7QUFLOUIsSUFBSSx3QkFBd0IsU0FBeEIscUJBQXdCLENBQVMsS0FBVCxFQUFnQjtBQUN4QyxRQUFJLFFBQVEseUJBQVIsQ0FEb0M7QUFFeEMsTUFBRSwyQkFBRixFQUErQixHQUEvQixDQUFtQyxLQUFuQyxFQUZ3QztBQUd4QyxnQ0FBNEIsS0FBNUIsRUFBbUMsS0FBbkMsRUFId0M7Q0FBaEI7O0FBTTVCLEVBQUUsWUFBVTtBQUNSLFFBQUksUUFBUSxJQUFJLFlBQUosQ0FDUixPQUFPLFVBQVAsQ0FBa0IsR0FBbEIsRUFDQSxrQkFBa0IsV0FBbEIsRUFGUSxFQUdSLEVBSFEsQ0FBUixDQURJOztBQU1SLE1BQUUsNEJBQUYsRUFBZ0MsS0FBaEMsQ0FBc0MsVUFBUyxDQUFULEVBQVk7QUFDOUMsVUFBRSxjQUFGLEdBRDhDO0FBRTlDLDRCQUFvQixLQUFwQixFQUY4QztLQUFaLENBQXRDLENBTlE7O0FBV1IsTUFBRSwyQkFBRixFQUErQixRQUEvQixDQUF3QyxVQUFTLENBQVQsRUFBWTtBQUNoRCxZQUFJLEVBQUUsT0FBRixLQUFjLEVBQWQsRUFBa0I7QUFDbEIsZ0NBQW9CLEtBQXBCLEVBRGtCO0FBRWxCLGNBQUUsY0FBRixHQUZrQjtTQUF0QjtLQURvQyxDQUF4QyxDQVhROztBQWtCUixVQUFNLFFBQU4sR0FBaUIsUUFBakIsQ0FBMEIsU0FBMUIsQ0FBb0MsVUFBUyxPQUFULEVBQWtCO0FBQ2xELFlBQUksUUFBUSxNQUFSLEVBQ0EsRUFBRSxhQUFGLEVBQWlCLFFBQWpCLENBQTBCLFFBQTFCLEVBREosS0FHSSxFQUFFLGFBQUYsRUFBaUIsV0FBakIsQ0FBNkIsUUFBN0IsRUFISjtLQURnQyxDQUFwQyxDQWxCUTs7QUF5QlIsVUFBTSxLQUFOLENBQVksU0FBWixDQUFzQixVQUFTLEtBQVQsRUFBZ0I7QUFDbEMsWUFBSSxlQUFnQixPQUFPLE9BQVAsQ0FBZSxLQUFmLEdBQXVCLE9BQU8sT0FBUCxDQUFlLEtBQWYsQ0FBcUIsS0FBckIsR0FBNkIsU0FBcEQsQ0FEYztBQUVsQyxZQUFJLFVBQVUsWUFBVixFQUNBLE9BREo7QUFFQSxZQUFJLE9BQU8sT0FBTyxRQUFQLENBQWdCLE1BQWhCLEdBQXlCLE9BQU8sUUFBUCxDQUFnQixRQUFoQixDQUpGO0FBS2xDLFlBQUksTUFBTyxRQUFRLE9BQU8sU0FBUCxHQUFtQixtQkFBbUIsS0FBbkIsQ0FBbkIsR0FBK0MsSUFBdkQsQ0FMdUI7QUFNbEMsZUFBTyxPQUFQLENBQWUsU0FBZixDQUF5QixFQUFFLE9BQU8sS0FBUCxFQUEzQixFQUEyQyxFQUEzQyxFQUErQyxHQUEvQyxFQU5rQztLQUFoQixDQUF0QixDQXpCUTs7QUFrQ1IsVUFBTSxPQUFOLENBQWMsbUJBQWQsQ0FBa0MsTUFBTSxNQUFNLEdBQU4sRUFBTixFQUFtQjtBQUNsRCx5QkFBaUIsdUJBQVMsR0FBVCxFQUFjO0FBQzNCLGdCQUFJLGdCQUFnQixNQUFNLFdBQU4sQ0FBa0IsSUFBSSxJQUFKLENBQWxDLENBRHVCO0FBRTNCLGdCQUFJLGNBQWMsTUFBZCxFQUFzQjtBQUN0Qiw4QkFBYyxDQUFkLEVBQWlCLE1BQWpCLENBQXdCLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE0QixJQUFJLE1BQUosQ0FBcEQsRUFEc0I7QUFFdEIsc0JBQU0sUUFBTixDQUFlLGNBQWMsQ0FBZCxDQUFmLEVBRnNCO2FBQTFCO1NBRmE7QUFPakIsc0JBQWMsb0JBQVMsR0FBVCxFQUFjO0FBQ3hCLGtCQUFNLFFBQU4sQ0FBZSxPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBSSxLQUFKLENBQTNDLEVBRHdCO1NBQWQ7QUFHZCx3QkFBZ0Isc0JBQVMsR0FBVCxFQUFjO0FBQzFCLGtCQUFNLFdBQU4sQ0FBa0IsSUFBSSxLQUFKLENBQWxCLENBRDBCO1NBQWQ7S0FYbkIsRUFsQ1E7O0FBa0RSLFdBQU8sVUFBUCxHQUFvQixVQUFTLENBQVQsRUFBWTtBQUM1Qiw4QkFBc0IsS0FBdEIsRUFENEI7S0FBWixDQWxEWjs7QUFzRFIsV0FBTyxPQUFQLENBQWUsWUFBZixDQUE0QixFQUFFLE9BQU8seUJBQVAsRUFBOUIsRUFBa0UsRUFBbEUsRUFBc0UsT0FBTyxRQUFQLENBQWdCLElBQWhCLENBQXRFLENBdERROztBQXdEUiwwQkFBc0IsS0FBdEIsRUF4RFE7O0FBMERSLE9BQUcsYUFBSCxDQUFpQixLQUFqQixFQTFEUTtDQUFWLENBQUYiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Utc3RyaWN0XCI7XG5jb25zdCBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xuY29uc3Qgc3RyZWFtX21hbmFnZXIgPSByZXF1aXJlKCcuL3N0cmVhbV9tYW5hZ2VyJyk7XG5cbi8qKlxuKi9cbnZhciBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBwYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5wYWdlID0ga28ub2JzZXJ2YWJsZShwYWdlKTtcbiAgICBzZWxmLmZhdm9yaXRlcyA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSkpO1xuXG4gICAgc2VsZi5tYW5hZ2VyID0gbmV3IHN0cmVhbV9tYW5hZ2VyLlN0cmVhbU1hbmFnZXIoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIHN0YXR1cyB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZSh1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYudXNlcigpLnN0YXR1cyhuZXcgbW9kZWxzLlN0YXR1c01vZGVsKG1zZy5zdGF0dXMuY29sb3IpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8ICF1c2VyLnJvb3RTdHJlYW0oKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKHVzZXIucm9vdFN0cmVhbSgpKS51cmwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHsgY29uc29sZS5lcnJvcihlKTsgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xuXG4gICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIGNvbGxlY3Rpb24gdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbnZhciBpbml0aWFsVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuVXNlck1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsVXNlckRhdGEpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgQXBwVmlld01vZGVsOiBBcHBWaWV3TW9kZWwsXG4gICAgaW5pdGlhbFVzZXI6IGluaXRpYWxVc2VyXG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBzbGljZSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09MT1IgPSAnIzc3Nzc3Nyc7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplVXJpID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSSh1cmkpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgLnJlcGxhY2UoJyAnLCAnLycpO1xufTtcblxuLyoqXG4gICAgUHJldHR5IHByaW50cyBhIGRhdGEuXG4qL1xuZXhwb3J0IGNvbnN0IGRhdGVUb0Rpc3BsYXkgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuICAgIHZhciBwYWQgPSBmdW5jdGlvbihtaW4sIGlucHV0KSB7XG4gICAgICAgIGlucHV0ICs9ICcnO1xuICAgICAgICB3aGlsZSAoaW5wdXQubGVuZ3RoIDwgbWluKVxuICAgICAgICAgICAgaW5wdXQgPSAnMCcgKyBpbnB1dDtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZGF0ZSkge1xuICAgICAgICBpZiAoIWRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJy0nO1xuXG4gICAgICAgIHJldHVybiBtb250aHNbZGF0ZS5nZXRNb250aCgpXSArICcgJyArIHBhZCgyLCBkYXRlLmdldERhdGUoKSkgKyAnLCAnICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJyAnICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldEhvdXJzKCkpICsgJzonICsgcGFkKDIsIGRhdGUuZ2V0TWludXRlcygpKSArICcuJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRTZWNvbmRzKCkpICsgcGFkKDMsIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIH07XG59KCkpO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0YXR1c01vZGVsID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jb2xvciA9IGtvLm9ic2VydmFibGUoY29sb3IpO1xufTtcblxuU3RhdHVzTW9kZWwuZW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKERFRkFVTFRfQ09MT1IpO1xufTtcblxuU3RhdHVzTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChkYXRhICYmIGRhdGEuY29sb3IpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBUYWdNb2RlbCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudmFsdWUgPSBrby5vYnNlcnZhYmxlKHZhbHVlKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0VGFnKHNlbGYudmFsdWUoKSkudXJsO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKi9cbmNvbnN0IFBhdGhDb21wb25lbnQgPSBmdW5jdGlvbihuYW1lLCB1cmkpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSgnL3MnICsgdXJpKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RyZWFtTW9kZWwgPSBmdW5jdGlvbihpZCwgbmFtZSwgdXJpLCBzdGF0dXMsIHVwZGF0ZWQsIHRhZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5pZCA9IGtvLm9ic2VydmFibGUoaWQpO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSB8fCAnJyk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnVwZGF0ZWQgPSBrby5vYnNlcnZhYmxlKHVwZGF0ZWQpO1xuICAgIHNlbGYudGFncyA9IGtvLm9ic2VydmFibGVBcnJheSh0YWdzIHx8IFtdKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW0uZ2V0U3RyZWFtKHNlbGYudXJpKCkpLnVybDtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKSB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpO1xuICAgICAgICBzdGF0dXMuY29sb3IoY29sb3IpO1xuICAgICAgICBzZWxmLnN0YXR1cyhzdGF0dXMpO1xuICAgIH07XG5cbiAgICBzZWxmLmRpc3BsYXlVcGRhdGVkID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRlVG9EaXNwbGF5KHNlbGYudXBkYXRlZCgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuaXNPd25lciA9IGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgdmFyIG93bmVyVXJpID0gbm9ybWFsaXplVXJpKHVzZXIudXNlck5hbWUoKSk7XG4gICAgICAgIHJldHVybiAob3duZXJVcmkgPT09IHNlbGYudXJpKCkgfHwgc2VsZi51cmkoKS5pbmRleE9mKG93bmVyVXJpICsgJy8nKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIHNlbGYucGF0aENvbXBvbmVudHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc3QgcGF0aHMgPSBbXTtcbiAgICAgICAgc2VsZi51cmkoKS5zcGxpdCgnLycpLnJlZHVjZSgocGF0aCwgYykgPT4ge1xuICAgICAgICAgICAgcGF0aCArPSAnLycgKyBjO1xuICAgICAgICAgICAgcGF0aHMucHVzaChuZXcgUGF0aENvbXBvbmVudChjLCBwYXRoKSk7XG4gICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgfSwgJycpO1xuICAgICAgICByZXR1cm4gcGF0aHM7XG4gICAgfSk7XG59O1xuXG5TdHJlYW1Nb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbU1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEuaWQsXG4gICAgICAgIGRhdGEgJiYgZGF0YS5uYW1lLFxuICAgICAgICBkYXRhICYmIGRhdGEudXJpLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgbmV3IERhdGUoZGF0YSAmJiBkYXRhLnVwZGF0ZWQpLCAoZGF0YSAmJiBkYXRhLnRhZ3MgfHwgW10pLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRhZ01vZGVsKHgudGFnKTtcbiAgICAgICAgfSkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBVc2VyTW9kZWwgPSBmdW5jdGlvbih1c2VyTmFtZSwgc3RhdHVzLCByb290U3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlck5hbWUgPSBrby5vYnNlcnZhYmxlKHVzZXJOYW1lIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYucm9vdFN0cmVhbSA9IGtvLm9ic2VydmFibGUocm9vdFN0cmVhbSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG59O1xuXG5Vc2VyTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBVc2VyTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS51c2VyTmFtZSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIGRhdGEgJiYgZGF0YS5yb290U3RyZWFtKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkLnVyaSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi51bnNoaWZ0KGNoaWxkKTtcbiAgICB9O1xufTtcbiIsIlwidXNlLXN0cmljdFwiO1xuXG5leHBvcnQgY29uc3QgcGFyc2VRdWVyeVN0cmluZyA9IChxdWVyeVN0cmluZykgPT4ge1xuICAgIHJldHVybiBxdWVyeVN0cmluZy5zdWJzdHIoMSkuc3BsaXQoXCImXCIpXG4gICAgICAgIC5yZWR1Y2UoZnVuY3Rpb24oZGljdCwgaXRlbSkge1xuICAgICAgICAgICAgdmFyIGt2ID0gaXRlbS5zcGxpdChcIj1cIik7XG4gICAgICAgICAgICB2YXIgayA9IGt2WzBdO1xuICAgICAgICAgICAgdmFyIHYgPSBkZWNvZGVVUklDb21wb25lbnQoa3ZbMV0pO1xuICAgICAgICAgICAgaWYgKGsgaW4gZGljdCkgZGljdFtrXS5wdXNoKHYpOyBlbHNlIGRpY3Rba10gPSBbdl07XG4gICAgICAgICAgICByZXR1cm4gZGljdDtcbiAgICAgICAgfSwge30pO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFF1ZXJ5U3RyaW5nID0gKCkgPT4ge1xuICAgIHJldHVybiBwYXJzZVF1ZXJ5U3RyaW5nKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xufTtcblxuZXhwb3J0IGNvbnN0IGxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIHRydWUpXG4gICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG5cbmV4cG9ydCBjb25zdCB1bmxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCBmYWxzZSlcbiAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoICBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xuXG5cbnZhciBzb2NrZXRQYXRoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4qL1xudmFyIFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0geyB9O1xuICAgIHNlbGYuY29sbGVjdGlvbnMgPSB7IH07XG5cbiAgICB2YXIgcHJvY2Vzc01lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgaWYgKCFtc2cgfHwgIW1zZy50eXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgIHZhciB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgKHRhcmdldCA/IHRhcmdldC5saXN0ZW5lcnMgOiBbXSkuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICBpZiAoeFt0eXBlXSlcbiAgICAgICAgICAgICAgICB4W3R5cGVdKG1zZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG5cbiAgICB2YXIgb3BlbldlYnNvY2tldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRTdHJlYW1zID0gT2JqZWN0LmtleXMoc2VsZi5zdHJlYW1zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29sbGVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogeFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICBwcm9jZXNzTWVzc2FnZShkYXRhKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlb3BlbicpO1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnN1YnNjcmliZUFsbChbcGF0aF0sIGNhbGxiYWNrKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUFsbCA9IGZ1bmN0aW9uKHBhdGhzLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBuZXdTdWJzY3JpcHRpb25zID0gW107XG4gICAgcGF0aHMubWFwKG1vZGVscy5ub3JtYWxpemVVcmkpLmZvckVhY2goZnVuY3Rpb24ocGF0aCkge1xuICAgICAgICB2YXIgY3VycmVudCA9IHNlbGYuc3RyZWFtc1twYXRoXTtcbiAgICAgICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW1zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgICAgIG5ld1N1YnNjcmlwdGlvbnMucHVzaChwYXRoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKG5ld1N1YnNjcmlwdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IG5ld1N1YnNjcmlwdGlvbnNcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUNvbGxlY3Rpb24gPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBwYXRoID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXRoKTtcblxuICAgIHZhciBjdXJyZW50ID0gc2VsZi5jb2xsZWN0aW9uc1twYXRoXTtcbiAgICBpZiAoY3VycmVudCkge1xuICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU3RyZWFtTWFuYWdlcjogU3RyZWFtTWFuYWdlclxufTtcbiIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuY29uc3QgYXBwbGljYXRpb25fbW9kZWwgPSByZXF1aXJlKCcuL2FwcGxpY2F0aW9uX21vZGVsJyk7XG5jb25zdCBzaGFyZWQgPSByZXF1aXJlKCcuL3NoYXJlZCcpO1xuXG4vKipcbiovXG52YXIgVGFnVmlld01vZGVsID0gZnVuY3Rpb24odGFnLCB1c2VyLCByZXN1bHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFwcGxpY2F0aW9uX21vZGVsLkFwcFZpZXdNb2RlbC5jYWxsKHRoaXMsIHVzZXIpO1xuXG4gICAgc2VsZi50YWcgPSBrby5vYnNlcnZhYmxlKHRhZyk7XG4gICAgc2VsZi51c2VyID0ga28ub2JzZXJ2YWJsZSh1c2VyKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZShuZXcgbW9kZWxzLkNvbGxlY3Rpb24odGFnKSk7XG4gICAgc2VsZi5xdWVyeSA9IGtvLm9ic2VydmFibGUodW5kZWZpbmVkKTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4oKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgIH0pO1xuICAgIH07XG59O1xuXG52YXIgbm9ybWFsaXplUXVlcnkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkocXVlcnkpLnJlcGxhY2UoL1xcKy9nLCAnICcpLnRyaW0oKTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkgPSBmdW5jdGlvbihtb2RlbCwgcXVlcnkpIHtcbiAgICBxdWVyeSA9IG5vcm1hbGl6ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAkKCcubGlzdC1sb2FkaW5nJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5nZXRUYWdDaGlsZHJlbihtb2RlbC50YWcoKSkudXJsLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAncXVlcnknOiBxdWVyeVxuICAgICAgICB9LFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICAvLyB0b2RvOiBkaXNwbGF5IGVycm9yIG1zZ1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgbW9kZWwucXVlcnkocXVlcnkpO1xuICAgICAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICByZXR1cm4gdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KFxuICAgICAgICBtb2RlbCxcbiAgICAgICAgbm9ybWFsaXplUXVlcnkoJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLnZhbCgpKSk7XG59O1xuXG52YXIgZ2V0UXVlcnlGcm9tUXVlcnlTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcXMgPSBzaGFyZWQuZ2V0UXVlcnlTdHJpbmcoKS5xdWVyeTtcbiAgICByZXR1cm4gKHFzID8gbm9ybWFsaXplUXVlcnkocXNbMF0pIDogJycpO1xufTtcblxudmFyIHVwZGF0ZUZyb21RdWVyeVN0cmluZyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgdmFyIHF1ZXJ5ID0gZ2V0UXVlcnlGcm9tUXVlcnlTdHJpbmcoKTtcbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGlucHV0JykudmFsKHF1ZXJ5KTtcbiAgICB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkobW9kZWwsIHF1ZXJ5KTtcbn07XG5cbiQoZnVuY3Rpb24oKXtcbiAgICB2YXIgbW9kZWwgPSBuZXcgVGFnVmlld01vZGVsKFxuICAgICAgICB3aW5kb3cuaW5pdGlhbFRhZy50YWcsXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCksXG4gICAgICAgIFtdKTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gYnV0dG9uJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuLnN1YnNjcmliZShmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHRzLmxlbmd0aClcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICB9KTtcblxuICAgIG1vZGVsLnF1ZXJ5LnN1YnNjcmliZShmdW5jdGlvbihxdWVyeSkge1xuICAgICAgICB2YXIgY3VycmVudFF1ZXJ5ID0gKHdpbmRvdy5oaXN0b3J5LnN0YXRlID8gd2luZG93Lmhpc3Rvcnkuc3RhdGUucXVlcnkgOiB1bmRlZmluZWQpO1xuICAgICAgICBpZiAocXVlcnkgPT09IGN1cnJlbnRRdWVyeSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdmFyIHBhdGggPSB3aW5kb3cubG9jYXRpb24ub3JpZ2luICsgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xuICAgICAgICB2YXIgdXJsID0gKHF1ZXJ5ID8gcGF0aCArIFwiP3F1ZXJ5PVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5KSA6IHBhdGgpO1xuICAgICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoeyBxdWVyeTogcXVlcnkgfSwgJycsIHVybCk7XG4gICAgfSk7XG5cbiAgICBtb2RlbC5tYW5hZ2VyLnN1YnNjcmliZUNvbGxlY3Rpb24oJyMnICsgbW9kZWwudGFnKCksIHtcbiAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5mcm9tKTtcbiAgICAgICAgICAgaWYgKGV4aXN0aW5nQ2hpbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgIH1cbiAgICAgICB9LFxuICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgIG1vZGVsLmFkZENoaWxkKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICB9LFxuICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgbW9kZWwucmVtb3ZlQ2hpbGQobXNnLmNoaWxkKTtcbiAgICAgICB9XG4gICAgfSk7XG5cbiAgICB3aW5kb3cub25wb3BzdGF0ZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdXBkYXRlRnJvbVF1ZXJ5U3RyaW5nKG1vZGVsKTtcbiAgICB9O1xuXG4gICAgd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHsgcXVlcnk6IGdldFF1ZXJ5RnJvbVF1ZXJ5U3RyaW5nKCkgfSwgJycsIHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcblxuICAgIHVwZGF0ZUZyb21RdWVyeVN0cmluZyhtb2RlbCk7XG5cbiAgICBrby5hcHBseUJpbmRpbmdzKG1vZGVsKTtcbn0pO1xuIl19
