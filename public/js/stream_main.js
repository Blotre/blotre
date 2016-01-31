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

},{"./models":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7Ozs7Ozs7SUFDWTs7OztJQUNBOzs7Ozs7QUFJTCxJQUFNLHNDQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQzdDLFFBQUksT0FBTyxJQUFQLENBRHlDO0FBRTdDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUY2QztBQUc3QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FINkM7QUFJN0MsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSjZDOztBQU03QyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU42Qzs7QUFRN0MsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSMEI7O0FBWTdDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDaEQsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR5QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFadUIsUUFtQjdDLENBQUssT0FBTCxDQUFhLFNBQWIsQ0FBdUIsS0FBSyxRQUFMLEVBQXZC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QUFRLHFCQUFSO0FBQ0Esc0JBQU0sSUFBTjthQUZhLENBQWpCLEVBRFk7U0FBaEI7S0FOSjtDQUwwQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcbmltcG9ydCAqIGFzIG1vZGVscyBmcm9tICcuL21vZGVscyc7XG5pbXBvcnQgKiBhcyBzdHJlYW1fbWFuYWdlciBmcm9tICcuL3N0cmVhbV9tYW5hZ2VyJztcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBwYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5wYWdlID0ga28ub2JzZXJ2YWJsZShwYWdlKTtcbiAgICBzZWxmLmZhdm9yaXRlcyA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSkpO1xuXG4gICAgc2VsZi5tYW5hZ2VyID0gbmV3IHN0cmVhbV9tYW5hZ2VyLlN0cmVhbU1hbmFnZXIoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IHNsaWNlID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xPUiA9IFwiIzc3Nzc3N1wiO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG5jb25zdCBQYXRoQ29tcG9uZW50ID0gZnVuY3Rpb24obmFtZSwgdXJpKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUoJy9zJyArIHVyaSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG5cbiAgICBzZWxmLnBhdGhDb21wb25lbnRzID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gW107XG4gICAgICAgIHNlbGYudXJpKCkuc3BsaXQoJy8nKS5yZWR1Y2UoKHBhdGgsIGMpID0+IHtcbiAgICAgICAgICAgIHBhdGggKz0gJy8nICsgYztcbiAgICAgICAgICAgIHBhdGhzLnB1c2gobmV3IFBhdGhDb21wb25lbnQoYywgcGF0aCkpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sICcnKTtcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xuICAgIH0pO1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSwgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7XG4gICAgICAgIH0pKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0IGNvbnN0IHBhcnNlUXVlcnlTdHJpbmcgPSAocXVlcnlTdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcXVlcnlTdHJpbmcuc3Vic3RyKDEpLnNwbGl0KFwiJlwiKVxuICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGRpY3QsIGl0ZW0pIHtcbiAgICAgICAgICAgIHZhciBrdiA9IGl0ZW0uc3BsaXQoXCI9XCIpO1xuICAgICAgICAgICAgdmFyIGsgPSBrdlswXTtcbiAgICAgICAgICAgIHZhciB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KGt2WzFdKTtcbiAgICAgICAgICAgIGlmIChrIGluIGRpY3QpXG4gICAgICAgICAgICAgICAgZGljdFtrXS5wdXNoKHYpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGRpY3Rba10gPSBbdl07XG4gICAgICAgICAgICByZXR1cm4gZGljdDtcbiAgICAgICAgfSwge30pO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFF1ZXJ5U3RyaW5nID0gKCkgPT4ge1xuICAgIHJldHVybiBwYXJzZVF1ZXJ5U3RyaW5nKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xufTtcblxuZXhwb3J0IGNvbnN0IGxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG5leHBvcnQgY29uc3QgdW5sb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoICBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0ICogYXMgc3RyZWFtX21hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBhcHBsaWNhdGlvbl9tb2RlbCBmcm9tICcuL2FwcGxpY2F0aW9uX21vZGVsJztcbmltcG9ydCAqIGFzIHNoYXJlZCBmcm9tICcuL3NoYXJlZCc7XG5cbnZhciBGYXZvcml0ZVN0YXR1cyA9IE9iamVjdC5mcmVlemUoe1xuICAgIFVua25vd246IDAsXG4gICAgTm86IDEsXG4gICAgWWVzOiAyLFxuICAgIEhpZXJhcmNoaWNhbDogM1xufSk7XG5cbnZhciBpc0hpZXJhcmNoaWNhbCA9IGZ1bmN0aW9uKHBhcmVudE5hbWUsIHVyaSkge1xuICAgIHBhcmVudE5hbWUgPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhcmVudE5hbWUpO1xuICAgIGlmIChwYXJlbnROYW1lID09PSB1cmkpXG4gICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgdmFyIGluZGV4ID0gdXJpLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgcmV0dXJuIChpbmRleCA+PSAwICYmIHBhcmVudE5hbWUgPT09IHVyaS5zbGljZSgwLCBpbmRleCkpO1xufTtcblxudmFyIGlzUm9vdFN0cmVhbSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiAodXJpLmluZGV4T2YoJy8nKSA9PT0gLTEpO1xufTtcblxuLyoqXG4gKi9cbnZhciBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBzdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG5cbiAgICBzZWxmLnN0cmVhbSA9IGtvLm9ic2VydmFibGUoc3RyZWFtKTtcbiAgICBzZWxmLnF1ZXJ5ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHNlbGYuZmF2b3JpdGUgPSBrby5vYnNlcnZhYmxlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuXG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBtb2RlbHMuQ29sbGVjdGlvbihzZWxmLnN0cmVhbSgpLnVyaSgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IHNlbGYuc3RyZWFtKCk7XG4gICAgICAgIHJldHVybiAoc3RyZWFtID8gc3RyZWFtLmNvbG9yKCkgOiBtb2RlbHMuREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgaWYgKCFzZWxmLnN0cmVhbSgpKVxuICAgICAgICAgICAgc2VsZi5zdHJlYW0obmV3IG1vZGVscy5TdHJlYW1Nb2RlbCgpKTtcbiAgICAgICAgc2VsZi5zdHJlYW0oKS5zZXRDb2xvcihjb2xvcik7XG4gICAgfTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4oKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5kZWxldGVTdHJlYW0gPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVTdHJlYW0oY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVDaGlsZChjaGlsZC51cmkoKSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLmlzUGFyZW50T3duZXIgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICghIXNlbGYuc3RyZWFtKCkgJiYgc3RyZWFtLmlzT3duZXIoc2VsZi51c2VyKCkpKTtcbiAgICB9KTtcblxuICAgIHNlbGYucmVtb3ZlQ2hpbGRCdXR0b25DbGljayA9IGZ1bmN0aW9uKGNoaWxkLCBldmVudCkge1xuICAgICAgICBpZiAoaXNIaWVyYXJjaGljYWwoc2VsZi5zdHJlYW0oKS51cmkoKSwgY2hpbGQudXJpKCkpKSB7XG4gICAgICAgICAgICBib290Ym94LmNvbmZpcm0oe1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkFyZSB5b3Ugc3VyZT9cIixcbiAgICAgICAgICAgICAgICBhbmltYXRlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjbG9zZUJ1dHRvbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJUaGlzIHdpbGwgcGVybWFuZW50bHkgZGVsZXRlIHRoaXMgc3RyZWFtIGFuZCBhbGwgb2YgaXRzIGNoaWxkcmVuLlwiLFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5kZWxldGVTdHJlYW0oY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaURlbGV0ZUNoaWxkKHNlbGYuc3RyZWFtKCkuaWQoKSwgY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVtb3ZlQ2hpbGQoY2hpbGQudXJpKCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgc2VsZi5vbkNoaWxkU2VsZWN0ZWQgPSAoY2hpbGQpID0+IHtcbiAgICAgICAgc2VsZi5zdHJlYW0oY2hpbGQpO1xuICAgIH07XG59O1xuXG5BcHBWaWV3TW9kZWwucHJvdG90eXBlLmNoZWNrRmF2b3JpdGUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLnVzZXIoKS51c2VyTmFtZSgpKVxuICAgICAgICByZXR1cm47XG5cbiAgICAvLyBJZiB0aGUgY3VycmVudCBzdHJlYW0gaXMgdGhlIHVzZXIncyByb290IHN0cmVhbSBvZiBhIGRpcmVjdCBjaGlsZCwgaXQgY2Fubm90IGJlIGZhdm9yaXRlZC5cbiAgICBpZiAoc2VsZi5zdHJlYW0oKS5pZCgpID09PSBzZWxmLnVzZXIoKS5yb290U3RyZWFtKCkgfHwgaXNIaWVyYXJjaGljYWwoc2VsZi51c2VyKCkudXNlck5hbWUoKSwgc2VsZi5zdHJlYW0oKS51cmkoKSkpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5IaWVyYXJjaGljYWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkKHNlbGYudXNlcigpLnJvb3RTdHJlYW0oKSwgc2VsZi5zdHJlYW0oKS5pZCgpKS51cmwsXG4gICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIGlmIChlLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuTm8pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxudmFyIGluaXRpYWxTdHJlYW0gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsU3RyZWFtRGF0YSk7XG59O1xuXG4vKipcbiAgICBSZWRyYXcgdGhlIGZhdmljb24gZm9yIGEgZ2l2ZW4gc3RhdHVzLlxuKi9cbnZhciB1cGRhdGVGYXZpY29uID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmF2aWNvbicpO1xuXG4gICAgY2FudmFzLndpZHRoID0gY2FudmFzLmhlaWdodCA9IDE7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBsaW5rLmhyZWYgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9wbmcnKTtcbn07XG5cbi8qKlxuICovXG52YXIgZW5hYmxlRmF2b3JpdGVCdXR0b24gPSBmdW5jdGlvbihleGlzdGluZykge1xuICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKVxuICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSlcbiAgICAgICAgLnByb3AoJ3RpdGxlJywgZXhpc3RpbmcgPyBcIlJlbW92ZSBGYXZvcml0ZVwiIDogXCJBZGQgRmF2b3JpdGVcIik7XG5cbiAgICBpZiAoZXhpc3RpbmcpXG4gICAgICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKS5hZGRDbGFzcygnYWN0aXZlJyk7XG4gICAgZWxzZVxuICAgICAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xuXG59O1xuXG52YXIgZGlzYWJsZUZhdm9yaXRlQnV0dG9uID0gZnVuY3Rpb24oKSB7XG4gICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XG59O1xuXG4vKipcbiAqL1xudmFyIGhpZGVDaGlsZEZvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoJycpO1xuICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJylcbiAgICAgICAgLmFkZENsYXNzKCdoaWRkZW4nKVxuICAgICAgICAudGV4dCgnJyk7XG59O1xuXG52YXIgY3JlYXRlQ2hpbGRTdHJlYW0gPSBmdW5jdGlvbihtb2RlbCwgc3RyZWFtLCB1c2VyLCBuYW1lKSB7XG4gICAgJCgnLmNyZWF0ZS1jaGlsZCAuZXJyb3InKS5hZGRDbGFzcygnaGlkZGVuJyk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24gc3BhbicpXG4gICAgICAgIC5hZGRDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24gYnV0dG9uLCAjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24nKVxuICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCB0cnVlKTtcblxuICAgIHZhciBvbkNvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICQoJyNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbiBzcGFuJylcbiAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xuXG4gICAgICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbiwgI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgICAgIC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgICB9O1xuXG4gICAgdmFyIGdldEVycm9yID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoZSkge1xuICAgICAgICAgICAgaWYgKGUuZGV0YWlscykge1xuICAgICAgICAgICAgICAgIGlmIChlLmRldGFpbHNbJ29iai5uYW1lJ10pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiTmFtZSBpcyBpbnZhbGlkLiBNdXN0IGJlIGJldHdlZW4gMSBhbmQgNjQgbGV0dGVycyBhbmQgbnVtYmVycy5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZS5lcnJvcilcbiAgICAgICAgICAgICAgICByZXR1cm4gZS5lcnJvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBcIkFuIGVycm9yIG9jY3VycmVkXCI7XG4gICAgfTtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVTdHJlYW0oKS51cmwsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICB1cmk6IHN0cmVhbS51cmkoKSArIFwiL1wiICsgbmFtZVxuICAgICAgICB9KSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJylcbiAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpXG4gICAgICAgICAgICAgICAgLnRleHQoZ2V0RXJyb3IoZS5yZXNwb25zZUpTT04pKTtcblxuICAgICAgICAgICAgb25Db21wbGV0ZSgpO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKHJlc3VsdCkpO1xuICAgICAgICBvbkNvbXBsZXRlKCk7XG4gICAgICAgIGhpZGVDaGlsZEZvcm0oKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG52YXIgYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihtb2RlbCwgdGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpIHtcbiAgICBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlQ2hpbGQodGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpLnVybCxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Vbmtub3duKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgfSk7XG59O1xuXG52YXIgcmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihtb2RlbCwgdGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpIHtcbiAgICBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlQ2hpbGQodGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpLnVybCxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Vbmtub3duKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICB9KTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkgPSBmdW5jdGlvbihtb2RlbCwgcXVlcnkpIHtcbiAgICAkKCcubGlzdC1sb2FkaW5nJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbihtb2RlbC5zdHJlYW0oKS5pZCgpKS51cmwsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHF1ZXJ5OiBxdWVyeVxuICAgICAgICB9LFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgbW9kZWwucXVlcnkocXVlcnkpO1xuICAgICAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IHVwZGF0ZVNlYXJjaFJlc3VsdHMgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgIGNvbnN0IHF1ZXJ5ID0gJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLnZhbCgpO1xuICAgIHJldHVybiB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkobW9kZWwsIHF1ZXJ5KTtcbn07XG5cbi8qKlxuICovXG52YXIgdXBkYXRlU3RyZWFtVGFncyA9IGZ1bmN0aW9uKG1vZGVsLCB0YWdzKSB7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQT1NUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5zZXRUYWdzKG1vZGVsLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkodGFncy5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBcInRhZ1wiOiB4LnZhbHVlKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pKSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuXG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5zdHJlYW0oKS50YWdzKFxuICAgICAgICAgICAgcmVzdWx0Lm1hcChmdW5jdGlvbih0YWcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IG1vZGVscy5UYWdNb2RlbCh0YWcudGFnKTtcbiAgICAgICAgICAgIH0pKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIENvbnZlcnQgYSBsaXN0IG9mIHRhZ3MgdG8gYSBlZGl0YWJsZSBzdHJpbmcgcmVwcmVzZW50YXRpb24uXG4qL1xudmFyIHRhZ3NUb1N0cmluZyA9IGZ1bmN0aW9uKHRhZ3MpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHRhZ3MsIGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnZhbHVlKCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5qb2luKCcsICcpO1xufTtcblxuLyoqXG4gICAgQ29udmVydCBhIHN0cmluZyB0byBhIGxpc3Qgb2YgdGFncy5cbiovXG52YXIgc3RyaW5nVG9UYWdzID0gZnVuY3Rpb24odGFncykge1xuICAgIHJldHVybiAodGFncy5tYXRjaCgvKFthLXpBLVowLTlfXFwtJF0pKy9pZykgfHwgW10pLm1hcChmdW5jdGlvbih0YWcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBtb2RlbHMuVGFnTW9kZWwodGFnLnRyaW0oKSk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAgICBFZGl0IHRoZSBzdHJlYW0ncyB0YWdzLlxuKi9cbnZhciBlZGl0VGFncyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJCgnI3NhdmUtdGFncy1idXR0b24nKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2VkaXQtdGFncy1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnLnRhZy1saXN0JykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI3RhZy1pbnB1dCcpXG4gICAgICAgIC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG5cbiAgICAkKCcjdGFnLWlucHV0IGlucHV0JylcbiAgICAgICAgLnZhbCh0YWdzVG9TdHJpbmcobW9kZWwuc3RyZWFtKCkudGFncygpKSk7XG59O1xuXG4vKipcbiAgICBTYXZlIHRoZSBlZGl0ZWQgdGFncy5cbiovXG52YXIgc2F2ZVRhZ3MgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyN0YWctaW5wdXQnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnLnRhZy1saXN0JykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgdmFyIHRhZ3MgPSBzdHJpbmdUb1RhZ3MoJCgnI3RhZy1pbnB1dCBpbnB1dCcpLnZhbCgpKTtcbiAgICB1cGRhdGVTdHJlYW1UYWdzKG1vZGVsLCB0YWdzKTtcbn07XG5cbi8qKlxuICovXG4kKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb2RlbCA9IG5ldyBBcHBWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCksXG4gICAgICAgIGluaXRpYWxTdHJlYW0oKSk7XG5cbiAgICB2YXIgdXBkYXRlU3RhdHVzID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0cmVhbSA9IG1vZGVsLnN0cmVhbSgpO1xuICAgICAgICBpZiAoIXN0cmVhbSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJQT1NUXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpU2V0U3RyZWFtU3RhdHVzKHN0cmVhbS5pZCgpKS51cmwsXG4gICAgICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGNvbG9yOiBjb2xvclxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbW9kZWwuc3RyZWFtKCkudXBkYXRlZChuZXcgRGF0ZSgpKTtcbiAgICAgICAgbW9kZWwuc2V0Q29sb3IoY29sb3IpO1xuICAgIH07XG5cbiAgICB2YXIgc3RhdHVzUGlja2VyID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY3VycmVudENvbG9yID0gbW9kZWxzLkRFRkFVTFRfQ09MT1I7XG4gICAgICAgIHZhciBwaWNrZWRDb2xvciA9IG1vZGVscy5ERUZBVUxUX0NPTE9SO1xuICAgICAgICBtb2RlbC5tYW5hZ2VyLnN1YnNjcmliZShtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRDb2xvciA9IG1zZy5zdGF0dXMuY29sb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgc3RhdHVzUGlja2VyID0gJCgnLnN0YXR1cy1waWNrZXInKVxuICAgICAgICAgICAgLnNwZWN0cnVtKHtcbiAgICAgICAgICAgICAgICBzaG93SW5wdXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd1BhbGV0dGU6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd1NlbGVjdGlvblBhbGV0dGU6IHRydWUsXG4gICAgICAgICAgICAgICAgcHJlZmVycmVkRm9ybWF0OiBcImhleFwiLFxuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZUtleTogXCJibG90cmUuc3RyZWFtLnN0YXR1c1BpY2tlclwiXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdzaG93LnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBwaWNrZWRDb2xvciA9IGN1cnJlbnRDb2xvciA9IGNvbG9yICsgJyc7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdtb3ZlLnNwZWN0cnVtIGNoYW5nZS5zcGVjdHJ1bScsIGZ1bmN0aW9uKGUsIGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0Q29sb3IoY29sb3IgKyAnJyk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdoaWRlLnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBwaWNrZWRDb2xvciA9IGNvbG9yICsgJyc7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0Q29sb3IoY3VycmVudENvbG9yKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICQoJy5zcC1jaG9vc2UnKVxuICAgICAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZVN0YXR1cyhwaWNrZWRDb2xvciArICcnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBzdGF0dXNQaWNrZXI7XG4gICAgfSgpKTtcblxuICAgICQoJy5zdGF0dXMtcGlja2VyLWZvcm0nKVxuICAgICAgICAub24oJ3N1Ym1pdCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHZhciBjb2xvciA9ICQodGhpcykuY2hpbGRyZW4oJy5zdGF0dXMtcGlja2VyJykudmFsKCk7XG4gICAgICAgICAgICB1cGRhdGVTdGF0dXMoY29sb3IpO1xuICAgICAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBjaGlsZCBmb3JtXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHZhciBoaWRkZW4gPSAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQnKS5oYXNDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24nKTtcbiAgICAgICAgICAgIGlmIChoaWRkZW4pIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVDaGlsZFN0cmVhbShtb2RlbCwgbW9kZWwuc3RyZWFtKCksIG1vZGVsLnVzZXIoKSwgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCkudHJpbSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzKSB7XG4gICAgICAgICAgICBjcmVhdGVDaGlsZFN0cmVhbShtb2RlbCwgbW9kZWwuc3RyZWFtKCksIG1vZGVsLnVzZXIoKSwgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCkudHJpbSgpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbicpXG4gICAgICAgIC5vbignY2xpY2snLCBoaWRlQ2hpbGRGb3JtKTtcblxuICAgIC8vIFRhZyBlZGl0b3JcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZWRpdFRhZ3MobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3NhdmUtdGFncy1idXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHNhdmVUYWdzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyN0YWctaW5wdXQgaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzIC8qZW50ZXIqLyApIHtcbiAgICAgICAgICAgIHNhdmVUYWdzKG1vZGVsKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ2hpbGQgU2VhcmNoXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBidXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdXBkYXRlU2VhcmNoUmVzdWx0cyhtb2RlbCk7XG4gICAgfSk7XG5cbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGlucHV0Jykua2V5cHJlc3MoZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAxMyAvKmVudGVyKi8gKSB7XG4gICAgICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ2hpbGRyZW5cbiAgICB2YXIgcXVlcnkgPSBzaGFyZWQuZ2V0UXVlcnlTdHJpbmcoKS5xdWVyeTtcbiAgICB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkobW9kZWwsIChxdWVyeSB8fCAnJykpO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5hZGRDaGlsZChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLmNvbG9yLnN1YnNjcmliZSh1cGRhdGVGYXZpY29uKTtcblxuICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4uc3Vic2NyaWJlKGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoKVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgIH0pO1xuXG4gICAgLy8gRmF2b3JpdGUgQnV0dG9uXG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG5cbiAgICBtb2RlbC5mYXZvcml0ZS5zdWJzY3JpYmUoZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLlllczpcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5hYmxlRmF2b3JpdGVCdXR0b24odHJ1ZSk7XG4gICAgICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLk5vOlxuICAgICAgICAgICAgICAgIHJldHVybiBlbmFibGVGYXZvcml0ZUJ1dHRvbihmYWxzZSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwuY2hlY2tGYXZvcml0ZSgpO1xuXG5cbiAgICAkKCdidXR0b24uc3RyZWFtLWZhdm9yaXRlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgICAgICBzd2l0Y2ggKG1vZGVsLmZhdm9yaXRlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuWWVzOlxuICAgICAgICAgICAgICAgIHJldHVybiByZW1vdmVGYXZvcml0ZShtb2RlbCwgbW9kZWwudXNlcigpLnJvb3RTdHJlYW0oKSwgbW9kZWwuc3RyZWFtKCkuaWQoKSk7XG4gICAgICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLk5vOlxuICAgICAgICAgICAgICAgIHJldHVybiBhZGRGYXZvcml0ZShtb2RlbCwgbW9kZWwudXNlcigpLnJvb3RTdHJlYW0oKSwgbW9kZWwuc3RyZWFtKCkuaWQoKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0Q29sb3IobXNnLnN0YXR1cy5jb2xvcik7XG4gICAgICAgICAgICAgICAgbW9kZWwuc3RyZWFtKCkudXBkYXRlZChuZXcgRGF0ZShtc2cuc3RhdHVzLmNyZWF0ZWQpKTtcbiAgICAgICAgICAgICAgICBzdGF0dXNQaWNrZXIuc3BlY3RydW0oXCJzZXRcIiwgbXNnLnN0YXR1cy5jb2xvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdQYXJlbnRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSAmJiBtc2cucGFyZW50LnVyaSA9PT0gbW9kZWwudXNlcigpLnVzZXJOYW1lKCkpXG4gICAgICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ1BhcmVudFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkgJiYgbXNnLnBhcmVudCA9PT0gbW9kZWwudXNlcigpLnVzZXJOYW1lKCkpXG4gICAgICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuTm8pO1xuICAgICAgICB9LFxuICAgIH0pO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTtcbiIsIlwidXNlIHN0cmljdFwiO1xuaW1wb3J0ICogYXMgbW9kZWxzIGZyb20gJy4vbW9kZWxzJztcblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0ge307XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHt9O1xuXG4gICAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgdHlwZSA9IG1zZy50eXBlO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gKG1zZy5zb3VyY2UgPyBzZWxmLmNvbGxlY3Rpb25zW21zZy5zb3VyY2VdIDogc2VsZi5zdHJlYW1zW21zZy5mcm9tXSk7XG4gICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgaWYgKHhbdHlwZV0pXG4gICAgICAgICAgICAgICAgeFt0eXBlXShtc2cpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgdmFyIG9wZW5XZWJzb2NrZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc29ja2V0UGF0aCgpKTtcblxuICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0U3RyZWFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHRhcmdldFN0cmVhbXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0YXJnZXRDb2xsZWN0aW9ucyA9IE9iamVjdC5rZXlzKHNlbGYuY29sbGVjdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGRhdGEpXG4gICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVBbGwgPSBmdW5jdGlvbihwYXRocywgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnM6IFtjYWxsYmFja11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBuZXdTdWJzY3JpcHRpb25zXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVDb2xsZWN0aW9uID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uc1twYXRoXSA9IHtcbiAgICAgICAgICAgIGxpc3RlbmVyczogW2NhbGxiYWNrXVxuICAgICAgICB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcbiJdfQ==
