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
'use strict';
"use-strict";

var models = require('./models');
var stream_manager = require('./stream_manager');
var application_model = require('./application_model');
var shared = require('./shared');

var FavoriteStatus = Object.freeze({
    Unknown: 0,
    No: 1,
    Yes: 2,
    Hierarchical: 3
});

var isHierarchical = function isHierarchical(parentName, uri) {
    parentName = models.normalizeUri(parentName);
    if (parentName === uri) return true;

    var index = uri.lastIndexOf('/');
    return index >= 0 && parentName === uri.slice(0, index);
};

var isRootStream = function isRootStream(uri) {
    return uri.indexOf('/') === -1;
};

/**
*/
var AppViewModel = function AppViewModel(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.stream = ko.observable(stream);
    self.children = ko.observable(new models.Collection(stream.uri()));
    self.query = ko.observable();
    self.favorite = ko.observable(FavoriteStatus.Unknown);

    self.color = ko.computed(function () {
        var stream = self.stream();
        return stream ? stream.color() : models.DEFAULT_COLOR;
    });

    self.setColor = function (color) {
        if (!self.stream()) self.stream(new models.StreamModel());
        self.stream().setColor(color);
    };

    self.addChild = function (child) {
        self.children().addChild(child);
    };

    self.removeChild = function (childUri) {
        return self.children().children.remove(function (x) {
            return x.uri() === childUri;
        });
    };

    self.deleteStream = function (child) {
        $.ajax({
            type: "DELETE",
            url: jsRoutes.controllers.StreamApiController.apiDeleteStream(child.id()).url,
            error: function error(e) {}
        }).then(function () {
            self.removeChild(child.uri());
        });
    };

    self.isParentOwner = ko.computed(function () {
        return !!self.stream() && stream.isOwner(self.user());
    });

    self.removeChildButtonClick = function (child, event) {
        if (isHierarchical(self.stream().uri(), child.uri())) {
            bootbox.confirm({
                title: "Are you sure?",
                animate: false,
                closeButton: false,
                message: "This will permanently delete this stream and all of its children.",
                callback: function callback(result) {
                    if (result) {
                        self.deleteStream(child);
                    }
                }
            });
        } else {
            $.ajax({
                type: "DELETE",
                url: jsRoutes.controllers.StreamApiController.apiDeleteChild(self.stream().id(), child.id()).url,
                error: function error(e) {}
            }).then(function () {
                self.removeChild(child.uri());
            });
        }
    };

    self.childSelected = function (child) {};
};

AppViewModel.prototype.checkFavorite = function () {
    var self = this;
    if (!self.user().userName()) return;

    // If the current stream is the user's root stream of a direct child, it cannot be favorited.
    if (self.stream().id() === self.user().rootStream() || isHierarchical(self.user().userName(), self.stream().uri())) {
        self.favorite(FavoriteStatus.Hierarchical);
    } else {
        $.ajax({
            type: "GET",
            url: jsRoutes.controllers.StreamApiController.apiGetChild(self.user().rootStream(), self.stream().id()).url,
            error: function error(e) {
                if (e.status === 404) {
                    self.favorite(FavoriteStatus.No);
                }
            }
        }).then(function () {
            self.favorite(FavoriteStatus.Yes);
        });
    }
};

var initialStream = function initialStream() {
    return models.StreamModel.fromJson(window.initialStreamData);
};

/**
    Redraw the favicon for a given status.
*/
var updateFavicon = function updateFavicon(color) {
    var canvas = document.createElement('canvas');
    var link = document.getElementById('favicon');

    canvas.width = canvas.height = 1;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    link.href = canvas.toDataURL('image/png');
};

/**
*/
var enableFavoriteButton = function enableFavoriteButton(existing) {
    $('.stream-favorite').prop('disabled', false).prop('title', existing ? "Remove Favorite" : "Add Favorite");

    if (existing) $('.stream-favorite').addClass('active');else $('.stream-favorite').removeClass('active');
};

var disableFavoriteButton = function disableFavoriteButton() {
    $('.stream-favorite').prop("disabled", true);
};

/**
*/
var hideChildForm = function hideChildForm() {
    $('#create-child-name-input, #create-child-cancel-button').addClass('hidden');
    $('#create-child-name-input input').val('');
    $('.create-child .error').addClass('hidden').text('');
};

var createChildStream = function createChildStream(model, stream, user, name) {
    $('.create-child .error').addClass('hidden');

    $('#create-child-expand-button span').addClass('glyphicon-refresh glyphicon-refresh-animate');

    $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button').prop('disabled', true);

    var onComplete = function onComplete() {
        $('#create-child-expand-button span').removeClass('glyphicon-refresh glyphicon-refresh-animate');

        $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button').prop('disabled', false);
    };

    var getError = function getError(e) {
        if (e) {
            if (e.details) {
                if (e.details['obj.name']) {
                    return "Name is invalid. Must be between 1 and 64 letters and numbers.";
                }
            }
            if (e.error) return e.error;
        }

        return "An error occurred";
    };

    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.StreamApiController.apiCreateStream().url,
        contentType: 'application/json',
        data: JSON.stringify({
            name: name,
            uri: stream.uri() + "/" + name
        }),
        error: function error(e) {
            $('.create-child .error').removeClass('hidden').text(getError(e.responseJSON));

            onComplete();
        }
    }).then(function (result) {
        model.addChild(models.StreamModel.fromJson(result));
        onComplete();
        hideChildForm();
    });
};

/**
*/
var addFavorite = function addFavorite(model, targetStreamId, childId) {
    disableFavoriteButton();
    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.StreamApiController.apiCreateChild(targetStreamId, childId).url,
        error: function error(_error) {
            model.favorite(FavoriteStatus.Unknown);
        }
    }).then(function (result) {
        model.favorite(FavoriteStatus.Yes);
    });
};

var removeFavorite = function removeFavorite(model, targetStreamId, childId) {
    disableFavoriteButton();
    $.ajax({
        type: "DELETE",
        url: jsRoutes.controllers.StreamApiController.apiDeleteChild(targetStreamId, childId).url,
        error: function error(_error2) {
            model.favorite(FavoriteStatus.Unknown);
        }
    }).then(function (result) {
        model.favorite(FavoriteStatus.No);
    });
};

var updateSearchResultsForQuery = function updateSearchResultsForQuery(model, query) {
    $('.list-loading').removeClass('hidden');
    $('.no-results').addClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.apiGetChildren(model.stream().id()).url,
        data: {
            query: query
        },
        headers: {
            accept: "application/json"
        },
        error: function error(e) {
            $('.list-loading').addClass('hidden');
        }
    }).done(function (result) {
        $('.list-loading').addClass('hidden');
        model.query(query);
        model.children().children((result || []).map(models.StreamModel.fromJson));
    });
};

var updateSearchResults = function updateSearchResults(model) {
    var query = $('#stream-search-form input').val();
    return updateSearchResultsForQuery(model, query);
};

/**
*/
var updateStreamTags = function updateStreamTags(model, tags) {
    $.ajax({
        type: "POST",
        url: jsRoutes.controllers.StreamApiController.setTags(model.stream().id()).url,
        contentType: 'application/json',
        data: JSON.stringify(tags.map(function (x) {
            return { "tag": x.value() };
        })),
        headers: {
            accept: "application/json"
        },
        error: function error(e) {}
    }).done(function (result) {
        model.stream().tags(result.map(function (tag) {
            return new models.TagModel(tag.tag);
        }));
    });
};

/**
    Convert a list of tags to a editable string representation.
*/
var tagsToString = function tagsToString(tags) {
    return Array.prototype.map.call(tags, function (x) {
        return x.value();
    }).join(', ');
};

/**
    Convert a string to a list of tags.
*/
var stringToTags = function stringToTags(tags) {
    return (tags.match(/([a-zA-Z0-9_\-$])+/ig) || []).map(function (tag) {
        return new models.TagModel(tag.trim());
    });
};

/**
    Edit the stream's tags.
*/
var editTags = function editTags(model) {
    $('#save-tags-button').removeClass('hidden');
    $('#edit-tags-button').addClass('hidden');
    $('.tag-list').addClass('hidden');

    $('#tag-input').removeClass('hidden');

    $('#tag-input input').val(tagsToString(model.stream().tags()));
};

/**
    Save the edited tags.
*/
var saveTags = function saveTags(model) {
    $('#save-tags-button').addClass('hidden');
    $('#edit-tags-button').removeClass('hidden');
    $('#tag-input').addClass('hidden');
    $('.tag-list').removeClass('hidden');

    var tags = stringToTags($('#tag-input input').val());
    updateStreamTags(model, tags);
};

/**
*/
$(function () {
    var model = new AppViewModel(application_model.initialUser(), initialStream());

    var updateStatus = function updateStatus(color) {
        var stream = model.stream();
        if (!stream) return;

        $.ajax({
            type: "POST",
            url: jsRoutes.controllers.StreamApiController.apiSetStreamStatus(stream.id()).url,
            contentType: 'application/json',
            data: JSON.stringify({
                color: color
            })
        });

        model.stream().updated(new Date());
        model.setColor(color);
    };

    var statusPicker = function () {
        var currentColor = models.DEFAULT_COLOR;
        var pickedColor = models.DEFAULT_COLOR;
        model.manager.subscribe(model.stream().uri(), {
            'StatusUpdated': function StatusUpdated(msg) {
                if (msg.from === model.stream().uri()) {
                    currentColor = msg.status.color;
                }
            }
        });

        var statusPicker = $('.status-picker').spectrum({
            showInput: true,
            showPalette: true,
            showSelectionPalette: true,
            preferredFormat: "hex",
            localStorageKey: "blotre.stream.statusPicker"
        }).on('show.spectrum', function (e, color) {
            pickedColor = currentColor = color + '';
        }).on('move.spectrum change.spectrum', function (e, color) {
            model.setColor(color + '');
        }).on('hide.spectrum', function (e, color) {
            pickedColor = color + '';
            model.setColor(currentColor);
        });

        $('.sp-choose').on('click', function () {
            updateStatus(pickedColor + '');
        });

        return statusPicker;
    }();

    $('.status-picker-form').on('submit', function (e) {
        e.preventDefault();
        var color = $(this).children('.status-picker').val();
        updateStatus(color);
    });

    // Create child form
    $('#create-child-expand-button').on('click', function (e) {
        var hidden = $('#create-child-name-input').hasClass('hidden');
        var target = $('#create-child-name-input, #create-child-cancel-button');
        if (hidden) {
            target.removeClass('hidden');
        } else {
            createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val().trim());
        }
    });

    $('#create-child-name-input').keypress(function (e) {
        if (e.keyCode === 13) {
            createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val().trim());
        }
    });

    $('#create-child-cancel-button button').on('click', hideChildForm);

    // Tag editor
    $('#edit-tags-button').on('click', function (e) {
        editTags(model);
    });

    $('#save-tags-button').on('click', function (e) {
        saveTags(model);
    });

    $('#tag-input input').keypress(function (e) {
        if (e.keyCode === 13 /*enter*/) {
                saveTags(model);
            }
    });

    // Child Search
    $('#stream-search-form button').on('click', function (e) {
        e.preventDefault();
        updateSearchResults(model);
    });

    $('#stream-search-form input').keypress(function (e) {
        if (e.keyCode === 13 /*enter*/) {
                updateSearchResults(model);
                e.preventDefault();
            }
    });

    // Children
    var query = shared.getQueryString().query;
    updateSearchResultsForQuery(model, query || '');

    model.manager.subscribeCollection(model.stream().uri(), {
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

    model.color.subscribe(updateFavicon);

    model.children().children.subscribe(function (results) {
        if (results.length) $('.no-results').addClass('hidden');else $('.no-results').removeClass('hidden');
    });

    // Favorite Button
    disableFavoriteButton();

    model.favorite.subscribe(function (status) {
        switch (status) {
            case FavoriteStatus.Yes:
                return enableFavoriteButton(true);
            case FavoriteStatus.No:
                return enableFavoriteButton(false);
            default:
                return disableFavoriteButton();
        }
    });

    model.checkFavorite();

    $('button.stream-favorite').click(function (e) {
        switch (model.favorite()) {
            case FavoriteStatus.Yes:
                return removeFavorite(model, model.user().rootStream(), model.stream().id());
            case FavoriteStatus.No:
                return addFavorite(model, model.user().rootStream(), model.stream().id());
        }
    });

    model.manager.subscribe(model.stream().uri(), {
        'StatusUpdated': function StatusUpdated(msg) {
            if (msg.from === model.stream().uri()) {
                model.setColor(msg.status.color);
                model.stream().updated(new Date(msg.status.created));
                statusPicker.spectrum("set", msg.status.color);
            }
        },
        'ParentAdded': function ParentAdded(msg) {
            if (msg.from === model.stream().uri() && msg.parent.uri === model.user().userName()) model.favorite(FavoriteStatus.Yes);
        },
        'ParentRemoved': function ParentRemoved(msg) {
            if (msg.from === model.stream().uri() && msg.parent === model.user().userName()) model.favorite(FavoriteStatus.No);
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCOzs7O0FBSU4sSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMs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YUFBSyxXQUFMLENBQWlCLElBQWpCLElBQXlCLEVBQUUsV0FBVyxDQUFDLFFBQUQsQ0FBWCxFQUEzQixDQURHO0FBRUgsWUFBSSxLQUFLLEtBQUwsRUFBWTtBQUNaLGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLHFCQUFSO0FBQ0Esc0JBQU0sSUFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FKSjtDQUwwQzs7QUFtQjlDLE9BQU8sT0FBUCxHQUFpQjtBQUNiLG1CQUFlLGFBQWY7Q0FESiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZS1zdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5jb25zdCBzdHJlYW1fbWFuYWdlciA9IHJlcXVpcmUoJy4vc3RyZWFtX21hbmFnZXInKTtcblxuLyoqXG4qL1xudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHBhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyID0ga28ub2JzZXJ2YWJsZSh1c2VyKTtcbiAgICBzZWxmLnBhZ2UgPSBrby5vYnNlcnZhYmxlKHBhZ2UpO1xuICAgIHNlbGYuZmF2b3JpdGVzID0ga28ub2JzZXJ2YWJsZShuZXcgbW9kZWxzLkNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpKSk7XG5cbiAgICBzZWxmLm1hbmFnZXIgPSBuZXcgc3RyZWFtX21hbmFnZXIuU3RyZWFtTWFuYWdlcigpO1xuXG4gICAgc2VsZi5hZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgc3RhdHVzIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi51c2VyKCkuc3RhdHVzKG5ldyBtb2RlbHMuU3RhdHVzTW9kZWwobXNnLnN0YXR1cy5jb2xvcikpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgIXVzZXIucm9vdFN0cmVhbSgpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGRyZW4odXNlci5yb290U3RyZWFtKCkpLnVybCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkgeyBjb25zb2xlLmVycm9yKGUpOyB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgY29sbGVjdGlvbiB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZUNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmZyb20pO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ2hpbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZXhpc3RpbmdDaGlsZFswXS5zdGF0dXMobW9kZWxzLlN0YXR1c01vZGVsLmZyb21Kc29uKG1zZy5zdGF0dXMpKTtcbiAgICAgICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmNoaWxkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxudmFyIGluaXRpYWxVc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5Vc2VyTW9kZWwuZnJvbUpzb24od2luZG93LmluaXRpYWxVc2VyRGF0YSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBBcHBWaWV3TW9kZWw6IEFwcFZpZXdNb2RlbCxcbiAgICBpbml0aWFsVXNlcjogaW5pdGlhbFVzZXJcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IHNsaWNlID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xPUiA9ICcjNzc3Nzc3JztcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBub3JtYWxpemVVcmkgPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHVyaSlcbiAgICAgICAgLnRyaW0oKVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgnICcsICcvJyk7XG59O1xuXG4vKipcbiAgICBQcmV0dHkgcHJpbnRzIGEgZGF0YS5cbiovXG5leHBvcnQgY29uc3QgZGF0ZVRvRGlzcGxheSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4gICAgdmFyIHBhZCA9IGZ1bmN0aW9uKG1pbiwgaW5wdXQpIHtcbiAgICAgICAgaW5wdXQgKz0gJyc7XG4gICAgICAgIHdoaWxlIChpbnB1dC5sZW5ndGggPCBtaW4pXG4gICAgICAgICAgICBpbnB1dCA9ICcwJyArIGlucHV0O1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihkYXRlKSB7XG4gICAgICAgIGlmICghZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnLSc7XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoc1tkYXRlLmdldE1vbnRoKCldICsgJyAnICsgcGFkKDIsIGRhdGUuZ2V0RGF0ZSgpKSArICcsICcgKyBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnICcgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0SG91cnMoKSkgKyAnOicgKyBwYWQoMiwgZGF0ZS5nZXRNaW51dGVzKCkpICsgJy4nICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldFNlY29uZHMoKSkgKyBwYWQoMywgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgfTtcbn0oKSk7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgU3RhdHVzTW9kZWwgPSBmdW5jdGlvbihjb2xvcikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmNvbG9yID0ga28ub2JzZXJ2YWJsZShjb2xvcik7XG59O1xuXG5TdGF0dXNNb2RlbC5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoREVGQVVMVF9DT0xPUik7XG59O1xuXG5TdGF0dXNNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKGRhdGEgJiYgZGF0YS5jb2xvcik7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFRhZ01vZGVsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi52YWx1ZSA9IGtvLm9ic2VydmFibGUodmFsdWUpO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRUYWcoc2VsZi52YWx1ZSgpKS51cmw7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xuY29uc3QgUGF0aENvbXBvbmVudCA9IGZ1bmN0aW9uKG5hbWUsIHVyaSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHNlbGYubmFtZSA9IGtvLm9ic2VydmFibGUobmFtZSk7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKCcvcycgKyB1cmkpO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1Nb2RlbCA9IGZ1bmN0aW9uKGlkLCBuYW1lLCB1cmksIHN0YXR1cywgdXBkYXRlZCwgdGFncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmlkID0ga28ub2JzZXJ2YWJsZShpZCk7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lIHx8ICcnKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYudXBkYXRlZCA9IGtvLm9ic2VydmFibGUodXBkYXRlZCk7XG4gICAgc2VsZi50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KHRhZ3MgfHwgW10pO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0oc2VsZi51cmkoKSkudXJsO1xuICAgIH0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpIHx8IFN0YXR1c01vZGVsLmVtcHR5KCk7XG4gICAgICAgIHN0YXR1cy5jb2xvcihjb2xvcik7XG4gICAgICAgIHNlbGYuc3RhdHVzKHN0YXR1cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZGlzcGxheVVwZGF0ZWQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRhdGVUb0Rpc3BsYXkoc2VsZi51cGRhdGVkKCkpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5pc093bmVyID0gZnVuY3Rpb24odXNlcikge1xuICAgICAgICB2YXIgb3duZXJVcmkgPSBub3JtYWxpemVVcmkodXNlci51c2VyTmFtZSgpKTtcbiAgICAgICAgcmV0dXJuIChvd25lclVyaSA9PT0gc2VsZi51cmkoKSB8fCBzZWxmLnVyaSgpLmluZGV4T2Yob3duZXJVcmkgKyAnLycpID09PSAwKTtcbiAgICB9O1xuXG4gICAgc2VsZi5wYXRoQ29tcG9uZW50cyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zdCBwYXRocyA9IFtdO1xuICAgICAgICBzZWxmLnVyaSgpLnNwbGl0KCcvJykucmVkdWNlKChwYXRoLCBjKSA9PiB7XG4gICAgICAgICAgICBwYXRoICs9ICcvJyArIGM7XG4gICAgICAgICAgICBwYXRocy5wdXNoKG5ldyBQYXRoQ29tcG9uZW50KGMsIHBhdGgpKTtcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICB9LCAnJyk7XG4gICAgICAgIHJldHVybiBwYXRocztcbiAgICB9KTtcbn07XG5cblN0cmVhbU1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS5pZCxcbiAgICAgICAgZGF0YSAmJiBkYXRhLm5hbWUsXG4gICAgICAgIGRhdGEgJiYgZGF0YS51cmksXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBuZXcgRGF0ZShkYXRhICYmIGRhdGEudXBkYXRlZCksIChkYXRhICYmIGRhdGEudGFncyB8fCBbXSkubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGFnTW9kZWwoeC50YWcpO1xuICAgICAgICB9KSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFVzZXJNb2RlbCA9IGZ1bmN0aW9uKHVzZXJOYW1lLCBzdGF0dXMsIHJvb3RTdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyTmFtZSA9IGtvLm9ic2VydmFibGUodXNlck5hbWUgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi5yb290U3RyZWFtID0ga28ub2JzZXJ2YWJsZShyb290U3RyZWFtKTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCk7XG4gICAgICAgIHJldHVybiAoc3RhdHVzID8gc3RhdHVzLmNvbG9yKCkgOiBERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcbn07XG5cblVzZXJNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFVzZXJNb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVzZXJOYW1lLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnJvb3RTdHJlYW0pO1xufTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBDb2xsZWN0aW9uID0gZnVuY3Rpb24odXJpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGQudXJpKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpO1xuICAgIH07XG59O1xuIiwiXCJ1c2Utc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBwYXJzZVF1ZXJ5U3RyaW5nID0gKHF1ZXJ5U3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHF1ZXJ5U3RyaW5nLnN1YnN0cigxKS5zcGxpdChcIiZcIilcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihkaWN0LCBpdGVtKSB7XG4gICAgICAgICAgICB2YXIga3YgPSBpdGVtLnNwbGl0KFwiPVwiKTtcbiAgICAgICAgICAgIHZhciBrID0ga3ZbMF07XG4gICAgICAgICAgICB2YXIgdiA9IGRlY29kZVVSSUNvbXBvbmVudChrdlsxXSk7XG4gICAgICAgICAgICBpZiAoayBpbiBkaWN0KSBkaWN0W2tdLnB1c2godik7IGVsc2UgZGljdFtrXSA9IFt2XTtcbiAgICAgICAgICAgIHJldHVybiBkaWN0O1xuICAgICAgICB9LCB7fSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0UXVlcnlTdHJpbmcgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHBhcnNlUXVlcnlTdHJpbmcod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59O1xuXG5leHBvcnQgY29uc3QgbG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgICAgIC5hZGRDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcblxuZXhwb3J0IGNvbnN0IHVubG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICBzZWxcbiAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG4iLCJcInVzZS1zdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5jb25zdCBzdHJlYW1fbWFuYWdlciA9IHJlcXVpcmUoJy4vc3RyZWFtX21hbmFnZXInKTtcbmNvbnN0IGFwcGxpY2F0aW9uX21vZGVsID0gcmVxdWlyZSgnLi9hcHBsaWNhdGlvbl9tb2RlbCcpO1xuY29uc3Qgc2hhcmVkID0gcmVxdWlyZSgnLi9zaGFyZWQnKTtcblxudmFyIEZhdm9yaXRlU3RhdHVzID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgVW5rbm93bjogMCxcbiAgICBObzogMSxcbiAgICBZZXM6IDIsXG4gICAgSGllcmFyY2hpY2FsOiAzXG59KTtcblxudmFyIGlzSGllcmFyY2hpY2FsID0gZnVuY3Rpb24ocGFyZW50TmFtZSwgdXJpKSB7XG4gICAgcGFyZW50TmFtZSA9IG1vZGVscy5ub3JtYWxpemVVcmkocGFyZW50TmFtZSk7XG4gICAgaWYgKHBhcmVudE5hbWUgPT09IHVyaSlcbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICB2YXIgaW5kZXggPSB1cmkubGFzdEluZGV4T2YoJy8nKTtcbiAgICByZXR1cm4gKGluZGV4ID49IDAgJiYgcGFyZW50TmFtZSA9PT0gdXJpLnNsaWNlKDAsIGluZGV4KSk7XG59O1xuXG52YXIgaXNSb290U3RyZWFtID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuICh1cmkuaW5kZXhPZignLycpID09PSAtMSk7XG59O1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgc3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFwcGxpY2F0aW9uX21vZGVsLkFwcFZpZXdNb2RlbC5jYWxsKHRoaXMsIHVzZXIpO1xuXG4gICAgc2VsZi5zdHJlYW0gPSBrby5vYnNlcnZhYmxlKHN0cmVhbSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHN0cmVhbS51cmkoKSkpO1xuICAgIHNlbGYucXVlcnkgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgc2VsZi5mYXZvcml0ZSA9IGtvLm9ic2VydmFibGUoRmF2b3JpdGVTdGF0dXMuVW5rbm93bik7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdHJlYW0gPSBzZWxmLnN0cmVhbSgpO1xuICAgICAgICByZXR1cm4gKHN0cmVhbSA/IHN0cmVhbS5jb2xvcigpIDogbW9kZWxzLkRFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIGlmICghc2VsZi5zdHJlYW0oKSlcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtKG5ldyBtb2RlbHMuU3RyZWFtTW9kZWwoKSk7XG4gICAgICAgIHNlbGYuc3RyZWFtKCkuc2V0Q29sb3IoY29sb3IpO1xuICAgIH07XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbigpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNoaWxkcmVuKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5kZWxldGVTdHJlYW0gPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVTdHJlYW0oY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICBzZWxmLnJlbW92ZUNoaWxkKGNoaWxkLnVyaSgpKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYuaXNQYXJlbnRPd25lciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICAgcmV0dXJuICghIXNlbGYuc3RyZWFtKCkgJiYgc3RyZWFtLmlzT3duZXIoc2VsZi51c2VyKCkpKTtcbiAgICAgfSk7XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkQnV0dG9uQ2xpY2sgPSBmdW5jdGlvbihjaGlsZCwgZXZlbnQpIHtcbiAgICAgICAgaWYgKGlzSGllcmFyY2hpY2FsKHNlbGYuc3RyZWFtKCkudXJpKCksIGNoaWxkLnVyaSgpKSkge1xuICAgICAgICAgICAgYm9vdGJveC5jb25maXJtKHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJBcmUgeW91IHN1cmU/XCIsXG4gICAgICAgICAgICAgICAgYW5pbWF0ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgY2xvc2VCdXR0b246IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiVGhpcyB3aWxsIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGlzIHN0cmVhbSBhbmQgYWxsIG9mIGl0cyBjaGlsZHJlbi5cIixcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZGVsZXRlU3RyZWFtKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlQ2hpbGQoc2VsZi5zdHJlYW0oKS5pZCgpLCBjaGlsZC5pZCgpKS51cmwsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICBzZWxmLnJlbW92ZUNoaWxkKGNoaWxkLnVyaSgpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYuY2hpbGRTZWxlY3RlZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG5cbiAgICB9O1xufTtcblxuQXBwVmlld01vZGVsLnByb3RvdHlwZS5jaGVja0Zhdm9yaXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgc3RyZWFtIGlzIHRoZSB1c2VyJ3Mgcm9vdCBzdHJlYW0gb2YgYSBkaXJlY3QgY2hpbGQsIGl0IGNhbm5vdCBiZSBmYXZvcml0ZWQuXG4gICAgaWYgKHNlbGYuc3RyZWFtKCkuaWQoKSA9PT0gc2VsZi51c2VyKCkucm9vdFN0cmVhbSgpIHx8IGlzSGllcmFyY2hpY2FsKHNlbGYudXNlcigpLnVzZXJOYW1lKCksIHNlbGYuc3RyZWFtKCkudXJpKCkpKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuSGllcmFyY2hpY2FsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZChzZWxmLnVzZXIoKS5yb290U3RyZWFtKCksIHNlbGYuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxudmFyIGluaXRpYWxTdHJlYW0gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsU3RyZWFtRGF0YSk7XG59O1xuXG4vKipcbiAgICBSZWRyYXcgdGhlIGZhdmljb24gZm9yIGEgZ2l2ZW4gc3RhdHVzLlxuKi9cbnZhciB1cGRhdGVGYXZpY29uID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmF2aWNvbicpO1xuXG4gICAgY2FudmFzLndpZHRoID0gY2FudmFzLmhlaWdodCA9IDE7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBsaW5rLmhyZWYgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9wbmcnKTtcbn07XG5cbi8qKlxuKi9cbnZhciBlbmFibGVGYXZvcml0ZUJ1dHRvbiA9IGZ1bmN0aW9uKGV4aXN0aW5nKSB7XG4gICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpXG4gICAgICAgIC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKVxuICAgICAgICAucHJvcCgndGl0bGUnLCBleGlzdGluZyA/IFwiUmVtb3ZlIEZhdm9yaXRlXCIgOiBcIkFkZCBGYXZvcml0ZVwiKTtcblxuICAgIGlmIChleGlzdGluZylcbiAgICAgICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpLmFkZENsYXNzKCdhY3RpdmUnKTtcbiAgICBlbHNlXG4gICAgICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XG5cbn07XG5cbnZhciBkaXNhYmxlRmF2b3JpdGVCdXR0b24gPSBmdW5jdGlvbigpIHtcbiAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJylcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcbn07XG5cbi8qKlxuKi9cbnZhciBoaWRlQ2hpbGRGb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCcnKTtcbiAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgIC5hZGRDbGFzcygnaGlkZGVuJylcbiAgICAgICAgLnRleHQoJycpO1xufTtcblxudmFyIGNyZWF0ZUNoaWxkU3RyZWFtID0gZnVuY3Rpb24obW9kZWwsIHN0cmVhbSwgdXNlciwgbmFtZSkge1xuICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uIHNwYW4nKVxuICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbiwgI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG5cbiAgICB2YXIgb25Db21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24gc3BhbicpXG4gICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24sICNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgfTtcblxuICAgIHZhciBnZXRFcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5kZXRhaWxzWydvYmoubmFtZSddKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIk5hbWUgaXMgaW52YWxpZC4gTXVzdCBiZSBiZXR3ZWVuIDEgYW5kIDY0IGxldHRlcnMgYW5kIG51bWJlcnMuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGUuZXJyb3IpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGUuZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gXCJBbiBlcnJvciBvY2N1cnJlZFwiO1xuICAgIH07XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlU3RyZWFtKCkudXJsLFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICB1cmk6IHN0cmVhbS51cmkoKSArIFwiL1wiICsgbmFtZVxuICAgICAgICB9KSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJylcbiAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpXG4gICAgICAgICAgICAgICAgLnRleHQoZ2V0RXJyb3IoZS5yZXNwb25zZUpTT04pKTtcblxuICAgICAgICAgICAgb25Db21wbGV0ZSgpO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKHJlc3VsdCkpO1xuICAgICAgICBvbkNvbXBsZXRlKCk7XG4gICAgICAgIGhpZGVDaGlsZEZvcm0oKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuKi9cbnZhciBhZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKG1vZGVsLCB0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkge1xuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVDaGlsZCh0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICB9KTtcbn07XG5cbnZhciByZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKG1vZGVsLCB0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkge1xuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVDaGlsZCh0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuTm8pO1xuICAgIH0pO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeSA9IGZ1bmN0aW9uKG1vZGVsLCBxdWVyeSkge1xuICAgICQoJy5saXN0LWxvYWRpbmcnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnLm5vLXJlc3VsdHMnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKG1vZGVsLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcXVlcnk6IHF1ZXJ5XG4gICAgICAgIH0sXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBtb2RlbC5xdWVyeShxdWVyeSk7XG4gICAgICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHMgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBxdWVyeSA9ICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwoKTtcbiAgICByZXR1cm4gdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCBxdWVyeSk7XG59O1xuXG4vKipcbiovXG52YXIgdXBkYXRlU3RyZWFtVGFncyA9IGZ1bmN0aW9uKG1vZGVsLCB0YWdzKSB7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQT1NUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5zZXRUYWdzKG1vZGVsLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkodGFncy5tYXAoZnVuY3Rpb24oeCkgeyByZXR1cm4geyBcInRhZ1wiOiB4LnZhbHVlKCkgfTsgfSkpLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLnN0cmVhbSgpLnRhZ3MoXG4gICAgICAgICAgICByZXN1bHQubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50YWcpO1xuICAgICAgICAgICAgfSkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgQ29udmVydCBhIGxpc3Qgb2YgdGFncyB0byBhIGVkaXRhYmxlIHN0cmluZyByZXByZXNlbnRhdGlvbi5cbiovXG52YXIgdGFnc1RvU3RyaW5nID0gZnVuY3Rpb24odGFncykge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodGFncywgZnVuY3Rpb24oeCkgeyByZXR1cm4geC52YWx1ZSgpOyB9KVxuICAgICAgICAuam9pbignLCAnKTtcbn07XG5cbi8qKlxuICAgIENvbnZlcnQgYSBzdHJpbmcgdG8gYSBsaXN0IG9mIHRhZ3MuXG4qL1xudmFyIHN0cmluZ1RvVGFncyA9IGZ1bmN0aW9uKHRhZ3MpIHtcbiAgICByZXR1cm4gKHRhZ3MubWF0Y2goLyhbYS16QS1aMC05X1xcLSRdKSsvaWcpIHx8IFtdKS5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50cmltKCkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgRWRpdCB0aGUgc3RyZWFtJ3MgdGFncy5cbiovXG52YXIgZWRpdFRhZ3MgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyN0YWctaW5wdXQnKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpXG4gICAgICAgIC52YWwodGFnc1RvU3RyaW5nKG1vZGVsLnN0cmVhbSgpLnRhZ3MoKSkpO1xufTtcblxuLyoqXG4gICAgU2F2ZSB0aGUgZWRpdGVkIHRhZ3MuXG4qL1xudmFyIHNhdmVUYWdzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjdGFnLWlucHV0JykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcblxuICAgIHZhciB0YWdzID0gc3RyaW5nVG9UYWdzKCQoJyN0YWctaW5wdXQgaW5wdXQnKS52YWwoKSk7XG4gICAgdXBkYXRlU3RyZWFtVGFncyhtb2RlbCwgdGFncyk7XG59O1xuXG4vKipcbiovXG4kKGZ1bmN0aW9uKCl7XG4gICAgdmFyIG1vZGVsID0gbmV3IEFwcFZpZXdNb2RlbChcbiAgICAgICAgYXBwbGljYXRpb25fbW9kZWwuaW5pdGlhbFVzZXIoKSxcbiAgICAgICAgaW5pdGlhbFN0cmVhbSgpKTtcblxuICAgIHZhciB1cGRhdGVTdGF0dXMgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RyZWFtID0gbW9kZWwuc3RyZWFtKCk7XG4gICAgICAgIGlmICghc3RyZWFtKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB0eXBlOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlTZXRTdHJlYW1TdGF0dXMoc3RyZWFtLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgY29sb3I6IGNvbG9yXG4gICAgICAgICAgICB9KVxuICAgICAgICB9KTtcblxuICAgICAgICBtb2RlbC5zdHJlYW0oKS51cGRhdGVkKG5ldyBEYXRlKCkpO1xuICAgICAgICBtb2RlbC5zZXRDb2xvcihjb2xvcik7XG4gICAgfTtcblxuICAgIHZhciBzdGF0dXNQaWNrZXIgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjdXJyZW50Q29sb3IgPSBtb2RlbHMuREVGQVVMVF9DT0xPUjtcbiAgICAgICAgdmFyIHBpY2tlZENvbG9yID0gbW9kZWxzLkRFRkFVTFRfQ09MT1I7XG4gICAgICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudENvbG9yID0gbXNnLnN0YXR1cy5jb2xvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBzdGF0dXNQaWNrZXIgPSAkKCcuc3RhdHVzLXBpY2tlcicpXG4gICAgICAgICAgICAuc3BlY3RydW0oe1xuICAgICAgICAgICAgICAgIHNob3dJbnB1dDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93UGFsZXR0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93U2VsZWN0aW9uUGFsZXR0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRGb3JtYXQ6IFwiaGV4XCIsXG4gICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlS2V5OiBcImJsb3RyZS5zdHJlYW0uc3RhdHVzUGlja2VyXCJcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ3Nob3cuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIHBpY2tlZENvbG9yID0gY3VycmVudENvbG9yID0gY29sb3IgKyAnJztcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ21vdmUuc3BlY3RydW0gY2hhbmdlLnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihjb2xvciArICcnKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2hpZGUuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIHBpY2tlZENvbG9yID0gY29sb3IgKyAnJztcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihjdXJyZW50Q29sb3IpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgJCgnLnNwLWNob29zZScpXG4gICAgICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlU3RhdHVzKHBpY2tlZENvbG9yICsgJycpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHN0YXR1c1BpY2tlcjtcbiAgICB9KCkpO1xuXG4gICAgJCgnLnN0YXR1cy1waWNrZXItZm9ybScpXG4gICAgICAgIC5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdmFyIGNvbG9yID0gJCh0aGlzKS5jaGlsZHJlbignLnN0YXR1cy1waWNrZXInKS52YWwoKTtcbiAgICAgICAgICAgIHVwZGF0ZVN0YXR1cyhjb2xvcik7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGNoaWxkIGZvcm1cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24nKVxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdmFyIGhpZGRlbiA9ICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCcpLmhhc0NsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIHZhciB0YXJnZXQgPSAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbicpO1xuICAgICAgICAgICAgaWYgKGhpZGRlbikge1xuICAgICAgICAgICAgICAgIHRhcmdldC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNyZWF0ZUNoaWxkU3RyZWFtKG1vZGVsLCBtb2RlbC5zdHJlYW0oKSwgbW9kZWwudXNlcigpLCAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoKS50cmltKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIGNyZWF0ZUNoaWxkU3RyZWFtKG1vZGVsLCBtb2RlbC5zdHJlYW0oKSwgbW9kZWwudXNlcigpLCAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoKS50cmltKCkpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24gYnV0dG9uJylcbiAgICAgICAgLm9uKCdjbGljaycsIGhpZGVDaGlsZEZvcm0pO1xuXG4gICAgLy8gVGFnIGVkaXRvclxuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlZGl0VGFncyhtb2RlbCk7XG4gICAgfSk7XG5cbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc2F2ZVRhZ3MobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovKSB7XG4gICAgICAgICAgICBzYXZlVGFncyhtb2RlbCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkIFNlYXJjaFxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovKSB7XG4gICAgICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ2hpbGRyZW5cbiAgICB2YXIgcXVlcnkgPSBzaGFyZWQuZ2V0UXVlcnlTdHJpbmcoKS5xdWVyeTtcbiAgICB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkobW9kZWwsIChxdWVyeSB8fCAnJykpO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5hZGRDaGlsZChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLmNvbG9yLnN1YnNjcmliZSh1cGRhdGVGYXZpY29uKTtcblxuICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4uc3Vic2NyaWJlKGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoKVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgIH0pO1xuXG4gICAgLy8gRmF2b3JpdGUgQnV0dG9uXG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG5cbiAgICBtb2RlbC5mYXZvcml0ZS5zdWJzY3JpYmUoZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuWWVzOlxuICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKHRydWUpO1xuICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLk5vOlxuICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKGZhbHNlKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwuY2hlY2tGYXZvcml0ZSgpO1xuXG5cbiAgICAkKCdidXR0b24uc3RyZWFtLWZhdm9yaXRlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgICAgICBzd2l0Y2ggKG1vZGVsLmZhdm9yaXRlKCkpIHtcbiAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ZZXM6XG4gICAgICAgICAgICByZXR1cm4gcmVtb3ZlRmF2b3JpdGUobW9kZWwsIG1vZGVsLnVzZXIoKS5yb290U3RyZWFtKCksIG1vZGVsLnN0cmVhbSgpLmlkKCkpO1xuICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLk5vOlxuICAgICAgICAgICAgcmV0dXJuIGFkZEZhdm9yaXRlKG1vZGVsLCBtb2RlbC51c2VyKCkucm9vdFN0cmVhbSgpLCBtb2RlbC5zdHJlYW0oKS5pZCgpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmUobW9kZWwuc3RyZWFtKCkudXJpKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihtc2cuc3RhdHVzLmNvbG9yKTtcbiAgICAgICAgICAgICAgICBtb2RlbC5zdHJlYW0oKS51cGRhdGVkKG5ldyBEYXRlKG1zZy5zdGF0dXMuY3JlYXRlZCkpO1xuICAgICAgICAgICAgICAgIHN0YXR1c1BpY2tlci5zcGVjdHJ1bShcInNldFwiLCBtc2cuc3RhdHVzLmNvbG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ1BhcmVudEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpICYmIG1zZy5wYXJlbnQudXJpID09PSBtb2RlbC51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5ZZXMpO1xuICAgICAgICB9LFxuICAgICAgICAnUGFyZW50UmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSAmJiBtc2cucGFyZW50ID09PSBtb2RlbC51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBrby5hcHBseUJpbmRpbmdzKG1vZGVsKTtcbn0pO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xuXG5cbnZhciBzb2NrZXRQYXRoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4qL1xudmFyIFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0geyB9O1xuICAgIHNlbGYuY29sbGVjdGlvbnMgPSB7IH07XG5cbiAgICB2YXIgcHJvY2Vzc01lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgaWYgKCFtc2cgfHwgIW1zZy50eXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgIHZhciB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgKHRhcmdldCA/IHRhcmdldC5saXN0ZW5lcnMgOiBbXSkuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICBpZiAoeFt0eXBlXSlcbiAgICAgICAgICAgICAgICB4W3R5cGVdKG1zZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG5cbiAgICB2YXIgb3BlbldlYnNvY2tldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRTdHJlYW1zID0gT2JqZWN0LmtleXMoc2VsZi5zdHJlYW1zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29sbGVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogeFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICBwcm9jZXNzTWVzc2FnZShkYXRhKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlb3BlbicpO1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnN1YnNjcmliZUFsbChbcGF0aF0sIGNhbGxiYWNrKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUFsbCA9IGZ1bmN0aW9uKHBhdGhzLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBuZXdTdWJzY3JpcHRpb25zID0gW107XG4gICAgcGF0aHMubWFwKG1vZGVscy5ub3JtYWxpemVVcmkpLmZvckVhY2goZnVuY3Rpb24ocGF0aCkge1xuICAgICAgICB2YXIgY3VycmVudCA9IHNlbGYuc3RyZWFtc1twYXRoXTtcbiAgICAgICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW1zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgICAgIG5ld1N1YnNjcmlwdGlvbnMucHVzaChwYXRoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKG5ld1N1YnNjcmlwdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IG5ld1N1YnNjcmlwdGlvbnNcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUNvbGxlY3Rpb24gPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBwYXRoID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXRoKTtcblxuICAgIHZhciBjdXJyZW50ID0gc2VsZi5jb2xsZWN0aW9uc1twYXRoXTtcbiAgICBpZiAoY3VycmVudCkge1xuICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU3RyZWFtTWFuYWdlcjogU3RyZWFtTWFuYWdlclxufTtcbiJdfQ==
