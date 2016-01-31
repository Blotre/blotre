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
    self.query = ko.observable();
    self.favorite = ko.observable(FavoriteStatus.Unknown);

    self.children = ko.computed(function () {
        return new models.Collection(self.stream().uri());
    });

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

    self.onChildSelected = function (child) {
        self.stream(child);
    };
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
            return {
                "tag": x.value()
            };
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7O0lBQ1k7Ozs7SUFDQTs7Ozs7O0FBSVosSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7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LGlCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLEtBQUssU0FBTCxDQUFlO0FBQzVCLHdCQUFRLHFCQUFSO0FBQ0Esc0JBQU0sSUFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FKSjtDQUwwQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyBzdHJlYW1fbWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcblxuLyoqXG4qL1xudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHBhZ2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51c2VyID0ga28ub2JzZXJ2YWJsZSh1c2VyKTtcbiAgICBzZWxmLnBhZ2UgPSBrby5vYnNlcnZhYmxlKHBhZ2UpO1xuICAgIHNlbGYuZmF2b3JpdGVzID0ga28ub2JzZXJ2YWJsZShuZXcgbW9kZWxzLkNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpKSk7XG5cbiAgICBzZWxmLm1hbmFnZXIgPSBuZXcgc3RyZWFtX21hbmFnZXIuU3RyZWFtTWFuYWdlcigpO1xuXG4gICAgc2VsZi5hZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgc3RhdHVzIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi51c2VyKCkuc3RhdHVzKG5ldyBtb2RlbHMuU3RhdHVzTW9kZWwobXNnLnN0YXR1cy5jb2xvcikpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIgfHwgIXVzZXIucm9vdFN0cmVhbSgpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGRyZW4odXNlci5yb290U3RyZWFtKCkpLnVybCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkgeyBjb25zb2xlLmVycm9yKGUpOyB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAgLy8gU3Vic2NyaWJlIHRvIHVzZXIgY29sbGVjdGlvbiB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZUNvbGxlY3Rpb24odXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmZyb20pO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ2hpbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZXhpc3RpbmdDaGlsZFswXS5zdGF0dXMobW9kZWxzLlN0YXR1c01vZGVsLmZyb21Kc29uKG1zZy5zdGF0dXMpKTtcbiAgICAgICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUobXNnLmNoaWxkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxudmFyIGluaXRpYWxVc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5Vc2VyTW9kZWwuZnJvbUpzb24od2luZG93LmluaXRpYWxVc2VyRGF0YSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBBcHBWaWV3TW9kZWw6IEFwcFZpZXdNb2RlbCxcbiAgICBpbml0aWFsVXNlcjogaW5pdGlhbFVzZXJcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IHNsaWNlID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xPUiA9IFwiIzc3Nzc3N1wiO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG5jb25zdCBQYXRoQ29tcG9uZW50ID0gZnVuY3Rpb24obmFtZSwgdXJpKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUoJy9zJyArIHVyaSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG5cbiAgICBzZWxmLnBhdGhDb21wb25lbnRzID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gW107XG4gICAgICAgIHNlbGYudXJpKCkuc3BsaXQoJy8nKS5yZWR1Y2UoKHBhdGgsIGMpID0+IHtcbiAgICAgICAgICAgIHBhdGggKz0gJy8nICsgYztcbiAgICAgICAgICAgIHBhdGhzLnB1c2gobmV3IFBhdGhDb21wb25lbnQoYywgcGF0aCkpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sICcnKTtcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xuICAgIH0pO1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSwgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7XG4gICAgICAgIH0pKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0IGNvbnN0IHBhcnNlUXVlcnlTdHJpbmcgPSAocXVlcnlTdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcXVlcnlTdHJpbmcuc3Vic3RyKDEpLnNwbGl0KFwiJlwiKVxuICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGRpY3QsIGl0ZW0pIHtcbiAgICAgICAgICAgIHZhciBrdiA9IGl0ZW0uc3BsaXQoXCI9XCIpO1xuICAgICAgICAgICAgdmFyIGsgPSBrdlswXTtcbiAgICAgICAgICAgIHZhciB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KGt2WzFdKTtcbiAgICAgICAgICAgIGlmIChrIGluIGRpY3QpIGRpY3Rba10ucHVzaCh2KTsgZWxzZSBkaWN0W2tdID0gW3ZdO1xuICAgICAgICAgICAgcmV0dXJuIGRpY3Q7XG4gICAgICAgIH0sIHt9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRRdWVyeVN0cmluZyA9ICgpID0+IHtcbiAgICByZXR1cm4gcGFyc2VRdWVyeVN0cmluZyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbn07XG5cbmV4cG9ydCBjb25zdCBsb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgICBzZWxcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG5leHBvcnQgY29uc3QgdW5sb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgIHNlbFxuICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpXG4gICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdnbHlwaGljb24tcmVmcmVzaCAgZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcbmltcG9ydCAqIGFzIHN0cmVhbV9tYW5hZ2VyIGZyb20gJy4vc3RyZWFtX21hbmFnZXInO1xuaW1wb3J0ICogYXMgYXBwbGljYXRpb25fbW9kZWwgZnJvbSAnLi9hcHBsaWNhdGlvbl9tb2RlbCc7XG5pbXBvcnQgKiBhcyBzaGFyZWQgZnJvbSAnLi9zaGFyZWQnO1xuXG52YXIgRmF2b3JpdGVTdGF0dXMgPSBPYmplY3QuZnJlZXplKHtcbiAgICBVbmtub3duOiAwLFxuICAgIE5vOiAxLFxuICAgIFllczogMixcbiAgICBIaWVyYXJjaGljYWw6IDNcbn0pO1xuXG52YXIgaXNIaWVyYXJjaGljYWwgPSBmdW5jdGlvbihwYXJlbnROYW1lLCB1cmkpIHtcbiAgICBwYXJlbnROYW1lID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXJlbnROYW1lKTtcbiAgICBpZiAocGFyZW50TmFtZSA9PT0gdXJpKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHZhciBpbmRleCA9IHVyaS5sYXN0SW5kZXhPZignLycpO1xuICAgIHJldHVybiAoaW5kZXggPj0gMCAmJiBwYXJlbnROYW1lID09PSB1cmkuc2xpY2UoMCwgaW5kZXgpKTtcbn07XG5cbnZhciBpc1Jvb3RTdHJlYW0gPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gKHVyaS5pbmRleE9mKCcvJykgPT09IC0xKTtcbn07XG5cbi8qKlxuICovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgc3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFwcGxpY2F0aW9uX21vZGVsLkFwcFZpZXdNb2RlbC5jYWxsKHRoaXMsIHVzZXIpO1xuXG4gICAgc2VsZi5zdHJlYW0gPSBrby5vYnNlcnZhYmxlKHN0cmVhbSk7XG4gICAgc2VsZi5xdWVyeSA9IGtvLm9ic2VydmFibGUoKTtcbiAgICBzZWxmLmZhdm9yaXRlID0ga28ub2JzZXJ2YWJsZShGYXZvcml0ZVN0YXR1cy5Vbmtub3duKTtcblxuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgbW9kZWxzLkNvbGxlY3Rpb24oc2VsZi5zdHJlYW0oKS51cmkoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBzZWxmLnN0cmVhbSgpO1xuICAgICAgICByZXR1cm4gKHN0cmVhbSA/IHN0cmVhbS5jb2xvcigpIDogbW9kZWxzLkRFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIGlmICghc2VsZi5zdHJlYW0oKSlcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtKG5ldyBtb2RlbHMuU3RyZWFtTW9kZWwoKSk7XG4gICAgICAgIHNlbGYuc3RyZWFtKCkuc2V0Q29sb3IoY29sb3IpO1xuICAgIH07XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbigpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNoaWxkcmVuKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYuZGVsZXRlU3RyZWFtID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlU3RyZWFtKGNoaWxkLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlQ2hpbGQoY2hpbGQudXJpKCkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5pc1BhcmVudE93bmVyID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoISFzZWxmLnN0cmVhbSgpICYmIHN0cmVhbS5pc093bmVyKHNlbGYudXNlcigpKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkQnV0dG9uQ2xpY2sgPSBmdW5jdGlvbihjaGlsZCwgZXZlbnQpIHtcbiAgICAgICAgaWYgKGlzSGllcmFyY2hpY2FsKHNlbGYuc3RyZWFtKCkudXJpKCksIGNoaWxkLnVyaSgpKSkge1xuICAgICAgICAgICAgYm9vdGJveC5jb25maXJtKHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJBcmUgeW91IHN1cmU/XCIsXG4gICAgICAgICAgICAgICAgYW5pbWF0ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgY2xvc2VCdXR0b246IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiVGhpcyB3aWxsIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGlzIHN0cmVhbSBhbmQgYWxsIG9mIGl0cyBjaGlsZHJlbi5cIixcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZGVsZXRlU3RyZWFtKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVDaGlsZChzZWxmLnN0cmVhbSgpLmlkKCksIGNoaWxkLmlkKCkpLnVybCxcbiAgICAgICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbW92ZUNoaWxkKGNoaWxkLnVyaSgpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYub25DaGlsZFNlbGVjdGVkID0gKGNoaWxkKSA9PiB7XG4gICAgICAgIHNlbGYuc3RyZWFtKGNoaWxkKTtcbiAgICB9O1xufTtcblxuQXBwVmlld01vZGVsLnByb3RvdHlwZS5jaGVja0Zhdm9yaXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgc3RyZWFtIGlzIHRoZSB1c2VyJ3Mgcm9vdCBzdHJlYW0gb2YgYSBkaXJlY3QgY2hpbGQsIGl0IGNhbm5vdCBiZSBmYXZvcml0ZWQuXG4gICAgaWYgKHNlbGYuc3RyZWFtKCkuaWQoKSA9PT0gc2VsZi51c2VyKCkucm9vdFN0cmVhbSgpIHx8IGlzSGllcmFyY2hpY2FsKHNlbGYudXNlcigpLnVzZXJOYW1lKCksIHNlbGYuc3RyZWFtKCkudXJpKCkpKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuSGllcmFyY2hpY2FsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZChzZWxmLnVzZXIoKS5yb290U3RyZWFtKCksIHNlbGYuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbnZhciBpbml0aWFsU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFN0cmVhbURhdGEpO1xufTtcblxuLyoqXG4gICAgUmVkcmF3IHRoZSBmYXZpY29uIGZvciBhIGdpdmVuIHN0YXR1cy5cbiovXG52YXIgdXBkYXRlRmF2aWNvbiA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Zhdmljb24nKTtcblxuICAgIGNhbnZhcy53aWR0aCA9IGNhbnZhcy5oZWlnaHQgPSAxO1xuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHguZmlsbFN0eWxlID0gY29sb3I7XG4gICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgbGluay5ocmVmID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJyk7XG59O1xuXG4vKipcbiAqL1xudmFyIGVuYWJsZUZhdm9yaXRlQnV0dG9uID0gZnVuY3Rpb24oZXhpc3RpbmcpIHtcbiAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJylcbiAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpXG4gICAgICAgIC5wcm9wKCd0aXRsZScsIGV4aXN0aW5nID8gXCJSZW1vdmUgRmF2b3JpdGVcIiA6IFwiQWRkIEZhdm9yaXRlXCIpO1xuXG4gICAgaWYgKGV4aXN0aW5nKVxuICAgICAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xuICAgIGVsc2VcbiAgICAgICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcblxufTtcblxudmFyIGRpc2FibGVGYXZvcml0ZUJ1dHRvbiA9IGZ1bmN0aW9uKCkge1xuICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKVxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIHRydWUpO1xufTtcblxuLyoqXG4gKi9cbnZhciBoaWRlQ2hpbGRGb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCcnKTtcbiAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgIC5hZGRDbGFzcygnaGlkZGVuJylcbiAgICAgICAgLnRleHQoJycpO1xufTtcblxudmFyIGNyZWF0ZUNoaWxkU3RyZWFtID0gZnVuY3Rpb24obW9kZWwsIHN0cmVhbSwgdXNlciwgbmFtZSkge1xuICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uIHNwYW4nKVxuICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbiwgI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG5cbiAgICB2YXIgb25Db21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24gc3BhbicpXG4gICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24sICNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgfTtcblxuICAgIHZhciBnZXRFcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5kZXRhaWxzWydvYmoubmFtZSddKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIk5hbWUgaXMgaW52YWxpZC4gTXVzdCBiZSBiZXR3ZWVuIDEgYW5kIDY0IGxldHRlcnMgYW5kIG51bWJlcnMuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGUuZXJyb3IpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGUuZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gXCJBbiBlcnJvciBvY2N1cnJlZFwiO1xuICAgIH07XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlU3RyZWFtKCkudXJsLFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgdXJpOiBzdHJlYW0udXJpKCkgKyBcIi9cIiArIG5hbWVcbiAgICAgICAgfSksXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdoaWRkZW4nKVxuICAgICAgICAgICAgICAgIC50ZXh0KGdldEVycm9yKGUucmVzcG9uc2VKU09OKSk7XG5cbiAgICAgICAgICAgIG9uQ29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmFkZENoaWxkKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihyZXN1bHQpKTtcbiAgICAgICAgb25Db21wbGV0ZSgpO1xuICAgICAgICBoaWRlQ2hpbGRGb3JtKCk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xudmFyIGFkZEZhdm9yaXRlID0gZnVuY3Rpb24obW9kZWwsIHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKSB7XG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQVVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUNyZWF0ZUNoaWxkKHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKS51cmwsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuVW5rbm93bik7XG4gICAgICAgIH1cbiAgICB9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5ZZXMpO1xuICAgIH0pO1xufTtcblxudmFyIHJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24obW9kZWwsIHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKSB7XG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaURlbGV0ZUNoaWxkKHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKS51cmwsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuVW5rbm93bik7XG4gICAgICAgIH1cbiAgICB9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgfSk7XG59O1xuXG52YXIgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5ID0gZnVuY3Rpb24obW9kZWwsIHF1ZXJ5KSB7XG4gICAgJCgnLmxpc3QtbG9hZGluZycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcubm8tcmVzdWx0cycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGRyZW4obW9kZWwuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBxdWVyeTogcXVlcnlcbiAgICAgICAgfSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIG1vZGVsLnF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgbW9kZWwuY2hpbGRyZW4oKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG59O1xuXG5jb25zdCB1cGRhdGVTZWFyY2hSZXN1bHRzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICBjb25zdCBxdWVyeSA9ICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwoKTtcbiAgICByZXR1cm4gdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCBxdWVyeSk7XG59O1xuXG4vKipcbiAqL1xudmFyIHVwZGF0ZVN0cmVhbVRhZ3MgPSBmdW5jdGlvbihtb2RlbCwgdGFncykge1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuc2V0VGFncyhtb2RlbC5zdHJlYW0oKS5pZCgpKS51cmwsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHRhZ3MubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgXCJ0YWdcIjogeC52YWx1ZSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KSksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuc3RyZWFtKCkudGFncyhcbiAgICAgICAgICAgIHJlc3VsdC5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBtb2RlbHMuVGFnTW9kZWwodGFnLnRhZyk7XG4gICAgICAgICAgICB9KSk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAgICBDb252ZXJ0IGEgbGlzdCBvZiB0YWdzIHRvIGEgZWRpdGFibGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuKi9cbnZhciB0YWdzVG9TdHJpbmcgPSBmdW5jdGlvbih0YWdzKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCh0YWdzLCBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC52YWx1ZSgpO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbignLCAnKTtcbn07XG5cbi8qKlxuICAgIENvbnZlcnQgYSBzdHJpbmcgdG8gYSBsaXN0IG9mIHRhZ3MuXG4qL1xudmFyIHN0cmluZ1RvVGFncyA9IGZ1bmN0aW9uKHRhZ3MpIHtcbiAgICByZXR1cm4gKHRhZ3MubWF0Y2goLyhbYS16QS1aMC05X1xcLSRdKSsvaWcpIHx8IFtdKS5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50cmltKCkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgRWRpdCB0aGUgc3RyZWFtJ3MgdGFncy5cbiovXG52YXIgZWRpdFRhZ3MgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyN0YWctaW5wdXQnKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpXG4gICAgICAgIC52YWwodGFnc1RvU3RyaW5nKG1vZGVsLnN0cmVhbSgpLnRhZ3MoKSkpO1xufTtcblxuLyoqXG4gICAgU2F2ZSB0aGUgZWRpdGVkIHRhZ3MuXG4qL1xudmFyIHNhdmVUYWdzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjdGFnLWlucHV0JykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcblxuICAgIHZhciB0YWdzID0gc3RyaW5nVG9UYWdzKCQoJyN0YWctaW5wdXQgaW5wdXQnKS52YWwoKSk7XG4gICAgdXBkYXRlU3RyZWFtVGFncyhtb2RlbCwgdGFncyk7XG59O1xuXG4vKipcbiAqL1xuJChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSBuZXcgQXBwVmlld01vZGVsKFxuICAgICAgICBhcHBsaWNhdGlvbl9tb2RlbC5pbml0aWFsVXNlcigpLFxuICAgICAgICBpbml0aWFsU3RyZWFtKCkpO1xuXG4gICAgdmFyIHVwZGF0ZVN0YXR1cyA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdHJlYW0gPSBtb2RlbC5zdHJlYW0oKTtcbiAgICAgICAgaWYgKCFzdHJlYW0pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaVNldFN0cmVhbVN0YXR1cyhzdHJlYW0uaWQoKSkudXJsLFxuICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBjb2xvcjogY29sb3JcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG1vZGVsLnN0cmVhbSgpLnVwZGF0ZWQobmV3IERhdGUoKSk7XG4gICAgICAgIG1vZGVsLnNldENvbG9yKGNvbG9yKTtcbiAgICB9O1xuXG4gICAgdmFyIHN0YXR1c1BpY2tlciA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRDb2xvciA9IG1vZGVscy5ERUZBVUxUX0NPTE9SO1xuICAgICAgICB2YXIgcGlja2VkQ29sb3IgPSBtb2RlbHMuREVGQVVMVF9DT0xPUjtcbiAgICAgICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmUobW9kZWwuc3RyZWFtKCkudXJpKCksIHtcbiAgICAgICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50Q29sb3IgPSBtc2cuc3RhdHVzLmNvbG9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHN0YXR1c1BpY2tlciA9ICQoJy5zdGF0dXMtcGlja2VyJylcbiAgICAgICAgICAgIC5zcGVjdHJ1bSh7XG4gICAgICAgICAgICAgICAgc2hvd0lucHV0OiB0cnVlLFxuICAgICAgICAgICAgICAgIHNob3dQYWxldHRlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNob3dTZWxlY3Rpb25QYWxldHRlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHByZWZlcnJlZEZvcm1hdDogXCJoZXhcIixcbiAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2VLZXk6IFwiYmxvdHJlLnN0cmVhbS5zdGF0dXNQaWNrZXJcIlxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignc2hvdy5zcGVjdHJ1bScsIGZ1bmN0aW9uKGUsIGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgcGlja2VkQ29sb3IgPSBjdXJyZW50Q29sb3IgPSBjb2xvciArICcnO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignbW92ZS5zcGVjdHJ1bSBjaGFuZ2Uuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIG1vZGVsLnNldENvbG9yKGNvbG9yICsgJycpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignaGlkZS5zcGVjdHJ1bScsIGZ1bmN0aW9uKGUsIGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgcGlja2VkQ29sb3IgPSBjb2xvciArICcnO1xuICAgICAgICAgICAgICAgIG1vZGVsLnNldENvbG9yKGN1cnJlbnRDb2xvcik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAkKCcuc3AtY2hvb3NlJylcbiAgICAgICAgICAgIC5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB1cGRhdGVTdGF0dXMocGlja2VkQ29sb3IgKyAnJyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gc3RhdHVzUGlja2VyO1xuICAgIH0oKSk7XG5cbiAgICAkKCcuc3RhdHVzLXBpY2tlci1mb3JtJylcbiAgICAgICAgLm9uKCdzdWJtaXQnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB2YXIgY29sb3IgPSAkKHRoaXMpLmNoaWxkcmVuKCcuc3RhdHVzLXBpY2tlcicpLnZhbCgpO1xuICAgICAgICAgICAgdXBkYXRlU3RhdHVzKGNvbG9yKTtcbiAgICAgICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgY2hpbGQgZm9ybVxuICAgICQoJyNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgIC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB2YXIgaGlkZGVuID0gJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0JykuaGFzQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgdmFyIHRhcmdldCA9ICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uJyk7XG4gICAgICAgICAgICBpZiAoaGlkZGVuKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlQ2hpbGRTdHJlYW0obW9kZWwsIG1vZGVsLnN0cmVhbSgpLCBtb2RlbC51c2VyKCksICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCcpLnZhbCgpLnRyaW0oKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0Jykua2V5cHJlc3MoZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAxMykge1xuICAgICAgICAgICAgY3JlYXRlQ2hpbGRTdHJlYW0obW9kZWwsIG1vZGVsLnN0cmVhbSgpLCBtb2RlbC51c2VyKCksICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCcpLnZhbCgpLnRyaW0oKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24nKVxuICAgICAgICAub24oJ2NsaWNrJywgaGlkZUNoaWxkRm9ybSk7XG5cbiAgICAvLyBUYWcgZWRpdG9yXG4gICAgJCgnI2VkaXQtdGFncy1idXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGVkaXRUYWdzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBzYXZlVGFncyhtb2RlbCk7XG4gICAgfSk7XG5cbiAgICAkKCcjdGFnLWlucHV0IGlucHV0Jykua2V5cHJlc3MoZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAxMyAvKmVudGVyKi8gKSB7XG4gICAgICAgICAgICBzYXZlVGFncyhtb2RlbCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkIFNlYXJjaFxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovICkge1xuICAgICAgICAgICAgdXBkYXRlU2VhcmNoUmVzdWx0cyhtb2RlbCk7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkcmVuXG4gICAgdmFyIHF1ZXJ5ID0gc2hhcmVkLmdldFF1ZXJ5U3RyaW5nKCkucXVlcnk7XG4gICAgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCAocXVlcnkgfHwgJycpKTtcblxuICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbihtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBtb2RlbC5yZW1vdmVDaGlsZChtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIG1vZGVsLmFkZENoaWxkKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5yZW1vdmVDaGlsZChtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5jb2xvci5zdWJzY3JpYmUodXBkYXRlRmF2aWNvbik7XG5cbiAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuLnN1YnNjcmliZShmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHRzLmxlbmd0aClcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICB9KTtcblxuICAgIC8vIEZhdm9yaXRlIEJ1dHRvblxuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuXG4gICAgbW9kZWwuZmF2b3JpdGUuc3Vic2NyaWJlKGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICBzd2l0Y2ggKHN0YXR1cykge1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ZZXM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKHRydWUpO1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ObzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5hYmxlRmF2b3JpdGVCdXR0b24oZmFsc2UpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLmNoZWNrRmF2b3JpdGUoKTtcblxuXG4gICAgJCgnYnV0dG9uLnN0cmVhbS1mYXZvcml0ZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc3dpdGNoIChtb2RlbC5mYXZvcml0ZSgpKSB7XG4gICAgICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLlllczpcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVtb3ZlRmF2b3JpdGUobW9kZWwsIG1vZGVsLnVzZXIoKS5yb290U3RyZWFtKCksIG1vZGVsLnN0cmVhbSgpLmlkKCkpO1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ObzpcbiAgICAgICAgICAgICAgICByZXR1cm4gYWRkRmF2b3JpdGUobW9kZWwsIG1vZGVsLnVzZXIoKS5yb290U3RyZWFtKCksIG1vZGVsLnN0cmVhbSgpLmlkKCkpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5tYW5hZ2VyLnN1YnNjcmliZShtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSkge1xuICAgICAgICAgICAgICAgIG1vZGVsLnNldENvbG9yKG1zZy5zdGF0dXMuY29sb3IpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN0cmVhbSgpLnVwZGF0ZWQobmV3IERhdGUobXNnLnN0YXR1cy5jcmVhdGVkKSk7XG4gICAgICAgICAgICAgICAgc3RhdHVzUGlja2VyLnNwZWN0cnVtKFwic2V0XCIsIG1zZy5zdGF0dXMuY29sb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnUGFyZW50QWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkgJiYgbXNnLnBhcmVudC51cmkgPT09IG1vZGVsLnVzZXIoKS51c2VyTmFtZSgpKVxuICAgICAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgICAgIH0sXG4gICAgICAgICdQYXJlbnRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpICYmIG1zZy5wYXJlbnQgPT09IG1vZGVsLnVzZXIoKS51c2VyTmFtZSgpKVxuICAgICAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICAgICAgfSxcbiAgICB9KTtcblxuICAgIGtvLmFwcGx5QmluZGluZ3MobW9kZWwpO1xufSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5cbnZhciBzb2NrZXRQYXRoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4qL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0geyB9O1xuICAgIHNlbGYuY29sbGVjdGlvbnMgPSB7IH07XG5cbiAgICB2YXIgcHJvY2Vzc01lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgaWYgKCFtc2cgfHwgIW1zZy50eXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgIHZhciB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgKHRhcmdldCA/IHRhcmdldC5saXN0ZW5lcnMgOiBbXSkuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICBpZiAoeFt0eXBlXSlcbiAgICAgICAgICAgICAgICB4W3R5cGVdKG1zZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG5cbiAgICB2YXIgb3BlbldlYnNvY2tldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRTdHJlYW1zID0gT2JqZWN0LmtleXMoc2VsZi5zdHJlYW1zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29sbGVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogeFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICBwcm9jZXNzTWVzc2FnZShkYXRhKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlb3BlbicpO1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnN1YnNjcmliZUFsbChbcGF0aF0sIGNhbGxiYWNrKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUFsbCA9IGZ1bmN0aW9uKHBhdGhzLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBuZXdTdWJzY3JpcHRpb25zID0gW107XG4gICAgcGF0aHMubWFwKG1vZGVscy5ub3JtYWxpemVVcmkpLmZvckVhY2goZnVuY3Rpb24ocGF0aCkge1xuICAgICAgICB2YXIgY3VycmVudCA9IHNlbGYuc3RyZWFtc1twYXRoXTtcbiAgICAgICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW1zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgICAgIG5ld1N1YnNjcmlwdGlvbnMucHVzaChwYXRoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKG5ld1N1YnNjcmlwdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IG5ld1N1YnNjcmlwdGlvbnNcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUNvbGxlY3Rpb24gPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBwYXRoID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXRoKTtcblxuICAgIHZhciBjdXJyZW50ID0gc2VsZi5jb2xsZWN0aW9uc1twYXRoXTtcbiAgICBpZiAoY3VycmVudCkge1xuICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG4iXX0=
