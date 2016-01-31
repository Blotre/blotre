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
        window.location = child.url();
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
exports.default = StreamManager;

var _models = require('./models');

var models = _interopRequireWildcard(_models);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var socketPath = function socketPath() {
    var secure = window.location.protocol === 'https:';
    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws';
};

/**
 */
function StreamManager() {
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
}

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

var instance = undefined;

StreamManager.getInstance = function () {
    if (!instance) instance = new StreamManager();
    return instance;
};

},{"./models":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7Ozs7Ozs7SUFDWTs7Ozs7Ozs7Ozs7O0FBS0wsSUFBTSxzQ0FBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsSUFBZixFQUFxQjtBQUM3QyxRQUFJLE9BQU8sSUFBUCxDQUR5QztBQUU3QyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FGNkM7QUFHN0MsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBSDZDO0FBSTdDLFNBQUssU0FBTCxHQUFpQixHQUFHLFVBQUgsQ0FBYyxJQUFJLE9BQU8sVUFBUCxDQUFrQixLQUFLLFFBQUwsRUFBdEIsQ0FBZCxDQUFqQixDQUo2Qzs7QUFNN0MsU0FBSyxPQUFMLEdBQWUseUJBQWMsV0FBZCxFQUFmLENBTjZDOztBQVE3QyxTQUFLLFdBQUwsR0FBbUIsVUFBUyxLQUFULEVBQWdCO0FBQy9CLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixLQUExQixFQUQrQjtLQUFoQixDQVIwQjs7QUFZN0MsU0FBSyxjQUFMLEdBQXNCLFVBQVMsUUFBVCxFQUFtQjtBQUNyQyxlQUFPLEtBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixNQUExQixDQUFpQyxVQUFTLENBQVQsRUFBWTtBQUNoRCxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHlDO1NBQVosQ0FBeEMsQ0FEcUM7S0FBbkI7OztBQVp1QixRQW1CN0MsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7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USxxQkFBUjtBQUNBLHNCQUFNLElBQU47YUFGYSxDQUFqQixFQURZO1NBQWhCO0tBTko7Q0FMMEM7O0FBcUI5QyxJQUFJLG9CQUFKOztBQUVBLGNBQWMsV0FBZCxHQUE0QixZQUFXO0FBQ25DLFFBQUksQ0FBQyxRQUFELEVBQ0EsV0FBVyxJQUFJLGFBQUosRUFBWCxDQURKO0FBRUEsV0FBTyxRQUFQLENBSG1DO0NBQVgiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0IFN0cmVhbU1hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IFN0cmVhbU1hbmFnZXIuZ2V0SW5zdGFuY2UoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5leHBvcnQgY29uc3QgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IHNsaWNlID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xPUiA9IFwiIzc3Nzc3N1wiO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG5jb25zdCBQYXRoQ29tcG9uZW50ID0gZnVuY3Rpb24obmFtZSwgdXJpKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUoJy9zJyArIHVyaSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG5cbiAgICBzZWxmLnBhdGhDb21wb25lbnRzID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gW107XG4gICAgICAgIHNlbGYudXJpKCkuc3BsaXQoJy8nKS5yZWR1Y2UoKHBhdGgsIGMpID0+IHtcbiAgICAgICAgICAgIHBhdGggKz0gJy8nICsgYztcbiAgICAgICAgICAgIHBhdGhzLnB1c2gobmV3IFBhdGhDb21wb25lbnQoYywgcGF0aCkpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sICcnKTtcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xuICAgIH0pO1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSwgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7XG4gICAgICAgIH0pKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0IGNvbnN0IHBhcnNlUXVlcnlTdHJpbmcgPSAocXVlcnlTdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcXVlcnlTdHJpbmcuc3Vic3RyKDEpLnNwbGl0KFwiJlwiKVxuICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGRpY3QsIGl0ZW0pIHtcbiAgICAgICAgICAgIHZhciBrdiA9IGl0ZW0uc3BsaXQoXCI9XCIpO1xuICAgICAgICAgICAgdmFyIGsgPSBrdlswXTtcbiAgICAgICAgICAgIHZhciB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KGt2WzFdKTtcbiAgICAgICAgICAgIGlmIChrIGluIGRpY3QpXG4gICAgICAgICAgICAgICAgZGljdFtrXS5wdXNoKHYpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGRpY3Rba10gPSBbdl07XG4gICAgICAgICAgICByZXR1cm4gZGljdDtcbiAgICAgICAgfSwge30pO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFF1ZXJ5U3RyaW5nID0gKCkgPT4ge1xuICAgIHJldHVybiBwYXJzZVF1ZXJ5U3RyaW5nKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xufTtcblxuZXhwb3J0IGNvbnN0IGxvY2tCdXR0b24gPSAoc2VsKSA9PiB7XG4gICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG5leHBvcnQgY29uc3QgdW5sb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoICBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuaW1wb3J0ICogYXMgc3RyZWFtX21hbmFnZXIgZnJvbSAnLi9zdHJlYW1fbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBhcHBsaWNhdGlvbl9tb2RlbCBmcm9tICcuL2FwcGxpY2F0aW9uX21vZGVsJztcbmltcG9ydCAqIGFzIHNoYXJlZCBmcm9tICcuL3NoYXJlZCc7XG5cbnZhciBGYXZvcml0ZVN0YXR1cyA9IE9iamVjdC5mcmVlemUoe1xuICAgIFVua25vd246IDAsXG4gICAgTm86IDEsXG4gICAgWWVzOiAyLFxuICAgIEhpZXJhcmNoaWNhbDogM1xufSk7XG5cbnZhciBpc0hpZXJhcmNoaWNhbCA9IGZ1bmN0aW9uKHBhcmVudE5hbWUsIHVyaSkge1xuICAgIHBhcmVudE5hbWUgPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhcmVudE5hbWUpO1xuICAgIGlmIChwYXJlbnROYW1lID09PSB1cmkpXG4gICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgdmFyIGluZGV4ID0gdXJpLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgcmV0dXJuIChpbmRleCA+PSAwICYmIHBhcmVudE5hbWUgPT09IHVyaS5zbGljZSgwLCBpbmRleCkpO1xufTtcblxudmFyIGlzUm9vdFN0cmVhbSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiAodXJpLmluZGV4T2YoJy8nKSA9PT0gLTEpO1xufTtcblxuLyoqXG4gKi9cbnZhciBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBzdHJlYW0pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXBwbGljYXRpb25fbW9kZWwuQXBwVmlld01vZGVsLmNhbGwodGhpcywgdXNlcik7XG5cbiAgICBzZWxmLnN0cmVhbSA9IGtvLm9ic2VydmFibGUoc3RyZWFtKTtcbiAgICBzZWxmLnF1ZXJ5ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHNlbGYuZmF2b3JpdGUgPSBrby5vYnNlcnZhYmxlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuXG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBtb2RlbHMuQ29sbGVjdGlvbihzZWxmLnN0cmVhbSgpLnVyaSgpKTtcbiAgICB9KTtcblxuICAgIHNlbGYuY29sb3IgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0cmVhbSA9IHNlbGYuc3RyZWFtKCk7XG4gICAgICAgIHJldHVybiAoc3RyZWFtID8gc3RyZWFtLmNvbG9yKCkgOiBtb2RlbHMuREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgaWYgKCFzZWxmLnN0cmVhbSgpKVxuICAgICAgICAgICAgc2VsZi5zdHJlYW0obmV3IG1vZGVscy5TdHJlYW1Nb2RlbCgpKTtcbiAgICAgICAgc2VsZi5zdHJlYW0oKS5zZXRDb2xvcihjb2xvcik7XG4gICAgfTtcblxuICAgIHNlbGYuYWRkQ2hpbGQgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmNoaWxkcmVuKCkuYWRkQ2hpbGQoY2hpbGQpO1xuICAgIH07XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkID0gZnVuY3Rpb24oY2hpbGRVcmkpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuY2hpbGRyZW4oKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5kZWxldGVTdHJlYW0gPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVTdHJlYW0oY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVDaGlsZChjaGlsZC51cmkoKSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLmlzUGFyZW50T3duZXIgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICghIXNlbGYuc3RyZWFtKCkgJiYgc3RyZWFtLmlzT3duZXIoc2VsZi51c2VyKCkpKTtcbiAgICB9KTtcblxuICAgIHNlbGYucmVtb3ZlQ2hpbGRCdXR0b25DbGljayA9IGZ1bmN0aW9uKGNoaWxkLCBldmVudCkge1xuICAgICAgICBpZiAoaXNIaWVyYXJjaGljYWwoc2VsZi5zdHJlYW0oKS51cmkoKSwgY2hpbGQudXJpKCkpKSB7XG4gICAgICAgICAgICBib290Ym94LmNvbmZpcm0oe1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkFyZSB5b3Ugc3VyZT9cIixcbiAgICAgICAgICAgICAgICBhbmltYXRlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjbG9zZUJ1dHRvbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJUaGlzIHdpbGwgcGVybWFuZW50bHkgZGVsZXRlIHRoaXMgc3RyZWFtIGFuZCBhbGwgb2YgaXRzIGNoaWxkcmVuLlwiLFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5kZWxldGVTdHJlYW0oY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaURlbGV0ZUNoaWxkKHNlbGYuc3RyZWFtKCkuaWQoKSwgY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVtb3ZlQ2hpbGQoY2hpbGQudXJpKCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgc2VsZi5vbkNoaWxkU2VsZWN0ZWQgPSAoY2hpbGQpID0+IHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uID0gY2hpbGQudXJsKCk7XG4gICAgfTtcbn07XG5cbkFwcFZpZXdNb2RlbC5wcm90b3R5cGUuY2hlY2tGYXZvcml0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYudXNlcigpLnVzZXJOYW1lKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IHN0cmVhbSBpcyB0aGUgdXNlcidzIHJvb3Qgc3RyZWFtIG9mIGEgZGlyZWN0IGNoaWxkLCBpdCBjYW5ub3QgYmUgZmF2b3JpdGVkLlxuICAgIGlmIChzZWxmLnN0cmVhbSgpLmlkKCkgPT09IHNlbGYudXNlcigpLnJvb3RTdHJlYW0oKSB8fCBpc0hpZXJhcmNoaWNhbChzZWxmLnVzZXIoKS51c2VyTmFtZSgpLCBzZWxmLnN0cmVhbSgpLnVyaSgpKSkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLkhpZXJhcmNoaWNhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGQoc2VsZi51c2VyKCkucm9vdFN0cmVhbSgpLCBzZWxmLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5ZZXMpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG52YXIgaW5pdGlhbFN0cmVhbSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24od2luZG93LmluaXRpYWxTdHJlYW1EYXRhKTtcbn07XG5cbi8qKlxuICAgIFJlZHJhdyB0aGUgZmF2aWNvbiBmb3IgYSBnaXZlbiBzdGF0dXMuXG4qL1xudmFyIHVwZGF0ZUZhdmljb24gPSBmdW5jdGlvbihjb2xvcikge1xuICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICB2YXIgbGluayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmYXZpY29uJyk7XG5cbiAgICBjYW52YXMud2lkdGggPSBjYW52YXMuaGVpZ2h0ID0gMTtcbiAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yO1xuICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIGxpbmsuaHJlZiA9IGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpO1xufTtcblxuLyoqXG4gKi9cbnZhciBlbmFibGVGYXZvcml0ZUJ1dHRvbiA9IGZ1bmN0aW9uKGV4aXN0aW5nKSB7XG4gICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpXG4gICAgICAgIC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKVxuICAgICAgICAucHJvcCgndGl0bGUnLCBleGlzdGluZyA/IFwiUmVtb3ZlIEZhdm9yaXRlXCIgOiBcIkFkZCBGYXZvcml0ZVwiKTtcblxuICAgIGlmIChleGlzdGluZylcbiAgICAgICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpLmFkZENsYXNzKCdhY3RpdmUnKTtcbiAgICBlbHNlXG4gICAgICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XG5cbn07XG5cbnZhciBkaXNhYmxlRmF2b3JpdGVCdXR0b24gPSBmdW5jdGlvbigpIHtcbiAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJylcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcbn07XG5cbi8qKlxuICovXG52YXIgaGlkZUNoaWxkRm9ybSA9IGZ1bmN0aW9uKCkge1xuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCcpLnZhbCgnJyk7XG4gICAgJCgnLmNyZWF0ZS1jaGlsZCAuZXJyb3InKVxuICAgICAgICAuYWRkQ2xhc3MoJ2hpZGRlbicpXG4gICAgICAgIC50ZXh0KCcnKTtcbn07XG5cbnZhciBjcmVhdGVDaGlsZFN0cmVhbSA9IGZ1bmN0aW9uKG1vZGVsLCBzdHJlYW0sIHVzZXIsIG5hbWUpIHtcbiAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbiBzcGFuJylcbiAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24sICNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgIC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuXG4gICAgdmFyIG9uQ29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uIHNwYW4nKVxuICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG5cbiAgICAgICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24gYnV0dG9uLCAjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24nKVxuICAgICAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgIH07XG5cbiAgICB2YXIgZ2V0RXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICBpZiAoZS5kZXRhaWxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUuZGV0YWlsc1snb2JqLm5hbWUnXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJOYW1lIGlzIGludmFsaWQuIE11c3QgYmUgYmV0d2VlbiAxIGFuZCA2NCBsZXR0ZXJzIGFuZCBudW1iZXJzLlwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlLmVycm9yKVxuICAgICAgICAgICAgICAgIHJldHVybiBlLmVycm9yO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFwiQW4gZXJyb3Igb2NjdXJyZWRcIjtcbiAgICB9O1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQVVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUNyZWF0ZVN0cmVhbSgpLnVybCxcbiAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHVyaTogc3RyZWFtLnVyaSgpICsgXCIvXCIgKyBuYW1lXG4gICAgICAgIH0pLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgJCgnLmNyZWF0ZS1jaGlsZCAuZXJyb3InKVxuICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnaGlkZGVuJylcbiAgICAgICAgICAgICAgICAudGV4dChnZXRFcnJvcihlLnJlc3BvbnNlSlNPTikpO1xuXG4gICAgICAgICAgICBvbkNvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICB9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5hZGRDaGlsZChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24ocmVzdWx0KSk7XG4gICAgICAgIG9uQ29tcGxldGUoKTtcbiAgICAgICAgaGlkZUNoaWxkRm9ybSgpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKi9cbnZhciBhZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKG1vZGVsLCB0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkge1xuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVDaGlsZCh0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICB9KTtcbn07XG5cbnZhciByZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKG1vZGVsLCB0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkge1xuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVDaGlsZCh0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuTm8pO1xuICAgIH0pO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeSA9IGZ1bmN0aW9uKG1vZGVsLCBxdWVyeSkge1xuICAgICQoJy5saXN0LWxvYWRpbmcnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnLm5vLXJlc3VsdHMnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKG1vZGVsLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcXVlcnk6IHF1ZXJ5XG4gICAgICAgIH0sXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBtb2RlbC5xdWVyeShxdWVyeSk7XG4gICAgICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xufTtcblxuY29uc3QgdXBkYXRlU2VhcmNoUmVzdWx0cyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgY29uc3QgcXVlcnkgPSAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGlucHV0JykudmFsKCk7XG4gICAgcmV0dXJuIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeShtb2RlbCwgcXVlcnkpO1xufTtcblxuLyoqXG4gKi9cbnZhciB1cGRhdGVTdHJlYW1UYWdzID0gZnVuY3Rpb24obW9kZWwsIHRhZ3MpIHtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBPU1RcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLnNldFRhZ3MobW9kZWwuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh0YWdzLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIFwidGFnXCI6IHgudmFsdWUoKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSkpLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLnN0cmVhbSgpLnRhZ3MoXG4gICAgICAgICAgICByZXN1bHQubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50YWcpO1xuICAgICAgICAgICAgfSkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgQ29udmVydCBhIGxpc3Qgb2YgdGFncyB0byBhIGVkaXRhYmxlIHN0cmluZyByZXByZXNlbnRhdGlvbi5cbiovXG52YXIgdGFnc1RvU3RyaW5nID0gZnVuY3Rpb24odGFncykge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodGFncywgZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudmFsdWUoKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJywgJyk7XG59O1xuXG4vKipcbiAgICBDb252ZXJ0IGEgc3RyaW5nIHRvIGEgbGlzdCBvZiB0YWdzLlxuKi9cbnZhciBzdHJpbmdUb1RhZ3MgPSBmdW5jdGlvbih0YWdzKSB7XG4gICAgcmV0dXJuICh0YWdzLm1hdGNoKC8oW2EtekEtWjAtOV9cXC0kXSkrL2lnKSB8fCBbXSkubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgICByZXR1cm4gbmV3IG1vZGVscy5UYWdNb2RlbCh0YWcudHJpbSgpKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIEVkaXQgdGhlIHN0cmVhbSdzIHRhZ3MuXG4qL1xudmFyIGVkaXRUYWdzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcudGFnLWxpc3QnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG5cbiAgICAkKCcjdGFnLWlucHV0JylcbiAgICAgICAgLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyN0YWctaW5wdXQgaW5wdXQnKVxuICAgICAgICAudmFsKHRhZ3NUb1N0cmluZyhtb2RlbC5zdHJlYW0oKS50YWdzKCkpKTtcbn07XG5cbi8qKlxuICAgIFNhdmUgdGhlIGVkaXRlZCB0YWdzLlxuKi9cbnZhciBzYXZlVGFncyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJCgnI3NhdmUtdGFncy1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2VkaXQtdGFncy1idXR0b24nKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI3RhZy1pbnB1dCcpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcudGFnLWxpc3QnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG5cbiAgICB2YXIgdGFncyA9IHN0cmluZ1RvVGFncygkKCcjdGFnLWlucHV0IGlucHV0JykudmFsKCkpO1xuICAgIHVwZGF0ZVN0cmVhbVRhZ3MobW9kZWwsIHRhZ3MpO1xufTtcblxuLyoqXG4gKi9cbiQoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG1vZGVsID0gbmV3IEFwcFZpZXdNb2RlbChcbiAgICAgICAgYXBwbGljYXRpb25fbW9kZWwuaW5pdGlhbFVzZXIoKSxcbiAgICAgICAgaW5pdGlhbFN0cmVhbSgpKTtcblxuICAgIHZhciB1cGRhdGVTdGF0dXMgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RyZWFtID0gbW9kZWwuc3RyZWFtKCk7XG4gICAgICAgIGlmICghc3RyZWFtKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB0eXBlOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlTZXRTdHJlYW1TdGF0dXMoc3RyZWFtLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgY29sb3I6IGNvbG9yXG4gICAgICAgICAgICB9KVxuICAgICAgICB9KTtcblxuICAgICAgICBtb2RlbC5zdHJlYW0oKS51cGRhdGVkKG5ldyBEYXRlKCkpO1xuICAgICAgICBtb2RlbC5zZXRDb2xvcihjb2xvcik7XG4gICAgfTtcblxuICAgIHZhciBzdGF0dXNQaWNrZXIgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjdXJyZW50Q29sb3IgPSBtb2RlbHMuREVGQVVMVF9DT0xPUjtcbiAgICAgICAgdmFyIHBpY2tlZENvbG9yID0gbW9kZWxzLkRFRkFVTFRfQ09MT1I7XG4gICAgICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudENvbG9yID0gbXNnLnN0YXR1cy5jb2xvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBzdGF0dXNQaWNrZXIgPSAkKCcuc3RhdHVzLXBpY2tlcicpXG4gICAgICAgICAgICAuc3BlY3RydW0oe1xuICAgICAgICAgICAgICAgIHNob3dJbnB1dDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93UGFsZXR0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93U2VsZWN0aW9uUGFsZXR0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRGb3JtYXQ6IFwiaGV4XCIsXG4gICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlS2V5OiBcImJsb3RyZS5zdHJlYW0uc3RhdHVzUGlja2VyXCJcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ3Nob3cuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIHBpY2tlZENvbG9yID0gY3VycmVudENvbG9yID0gY29sb3IgKyAnJztcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ21vdmUuc3BlY3RydW0gY2hhbmdlLnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihjb2xvciArICcnKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2hpZGUuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIHBpY2tlZENvbG9yID0gY29sb3IgKyAnJztcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihjdXJyZW50Q29sb3IpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgJCgnLnNwLWNob29zZScpXG4gICAgICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlU3RhdHVzKHBpY2tlZENvbG9yICsgJycpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHN0YXR1c1BpY2tlcjtcbiAgICB9KCkpO1xuXG4gICAgJCgnLnN0YXR1cy1waWNrZXItZm9ybScpXG4gICAgICAgIC5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdmFyIGNvbG9yID0gJCh0aGlzKS5jaGlsZHJlbignLnN0YXR1cy1waWNrZXInKS52YWwoKTtcbiAgICAgICAgICAgIHVwZGF0ZVN0YXR1cyhjb2xvcik7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGNoaWxkIGZvcm1cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24nKVxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdmFyIGhpZGRlbiA9ICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCcpLmhhc0NsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIHZhciB0YXJnZXQgPSAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbicpO1xuICAgICAgICAgICAgaWYgKGhpZGRlbikge1xuICAgICAgICAgICAgICAgIHRhcmdldC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNyZWF0ZUNoaWxkU3RyZWFtKG1vZGVsLCBtb2RlbC5zdHJlYW0oKSwgbW9kZWwudXNlcigpLCAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoKS50cmltKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIGNyZWF0ZUNoaWxkU3RyZWFtKG1vZGVsLCBtb2RlbC5zdHJlYW0oKSwgbW9kZWwudXNlcigpLCAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoKS50cmltKCkpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24gYnV0dG9uJylcbiAgICAgICAgLm9uKCdjbGljaycsIGhpZGVDaGlsZEZvcm0pO1xuXG4gICAgLy8gVGFnIGVkaXRvclxuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlZGl0VGFncyhtb2RlbCk7XG4gICAgfSk7XG5cbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc2F2ZVRhZ3MobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovICkge1xuICAgICAgICAgICAgc2F2ZVRhZ3MobW9kZWwpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDaGlsZCBTZWFyY2hcbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzIC8qZW50ZXIqLyApIHtcbiAgICAgICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDaGlsZHJlblxuICAgIHZhciBxdWVyeSA9IHNoYXJlZC5nZXRRdWVyeVN0cmluZygpLnF1ZXJ5O1xuICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeShtb2RlbCwgKHF1ZXJ5IHx8ICcnKSk7XG5cbiAgICBtb2RlbC5tYW5hZ2VyLnN1YnNjcmliZUNvbGxlY3Rpb24obW9kZWwuc3RyZWFtKCkudXJpKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gbW9kZWwucmVtb3ZlQ2hpbGQobXNnLmZyb20pO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ2hpbGQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZXhpc3RpbmdDaGlsZFswXS5zdGF0dXMobW9kZWxzLlN0YXR1c01vZGVsLmZyb21Kc29uKG1zZy5zdGF0dXMpKTtcbiAgICAgICAgICAgICAgICBtb2RlbC5hZGRDaGlsZChleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIG1vZGVsLmFkZENoaWxkKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgbW9kZWwucmVtb3ZlQ2hpbGQobXNnLmNoaWxkKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwuY29sb3Iuc3Vic2NyaWJlKHVwZGF0ZUZhdmljb24pO1xuXG4gICAgbW9kZWwuY2hpbGRyZW4oKS5jaGlsZHJlbi5zdWJzY3JpYmUoZnVuY3Rpb24ocmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGgpXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgfSk7XG5cbiAgICAvLyBGYXZvcml0ZSBCdXR0b25cbiAgICBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcblxuICAgIG1vZGVsLmZhdm9yaXRlLnN1YnNjcmliZShmdW5jdGlvbihzdGF0dXMpIHtcbiAgICAgICAgc3dpdGNoIChzdGF0dXMpIHtcbiAgICAgICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuWWVzOlxuICAgICAgICAgICAgICAgIHJldHVybiBlbmFibGVGYXZvcml0ZUJ1dHRvbih0cnVlKTtcbiAgICAgICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuTm86XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKGZhbHNlKTtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5jaGVja0Zhdm9yaXRlKCk7XG5cblxuICAgICQoJ2J1dHRvbi5zdHJlYW0tZmF2b3JpdGUnKS5jbGljayhmdW5jdGlvbihlKSB7XG4gICAgICAgIHN3aXRjaCAobW9kZWwuZmF2b3JpdGUoKSkge1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ZZXM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlbW92ZUZhdm9yaXRlKG1vZGVsLCBtb2RlbC51c2VyKCkucm9vdFN0cmVhbSgpLCBtb2RlbC5zdHJlYW0oKS5pZCgpKTtcbiAgICAgICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuTm86XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFkZEZhdm9yaXRlKG1vZGVsLCBtb2RlbC51c2VyKCkucm9vdFN0cmVhbSgpLCBtb2RlbC5zdHJlYW0oKS5pZCgpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmUobW9kZWwuc3RyZWFtKCkudXJpKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihtc2cuc3RhdHVzLmNvbG9yKTtcbiAgICAgICAgICAgICAgICBtb2RlbC5zdHJlYW0oKS51cGRhdGVkKG5ldyBEYXRlKG1zZy5zdGF0dXMuY3JlYXRlZCkpO1xuICAgICAgICAgICAgICAgIHN0YXR1c1BpY2tlci5zcGVjdHJ1bShcInNldFwiLCBtc2cuc3RhdHVzLmNvbG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ1BhcmVudEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpICYmIG1zZy5wYXJlbnQudXJpID09PSBtb2RlbC51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5ZZXMpO1xuICAgICAgICB9LFxuICAgICAgICAnUGFyZW50UmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSAmJiBtc2cucGFyZW50ID09PSBtb2RlbC51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBrby5hcHBseUJpbmRpbmdzKG1vZGVsKTtcbn0pO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5pbXBvcnQgKiBhcyBtb2RlbHMgZnJvbSAnLi9tb2RlbHMnO1xuXG52YXIgc29ja2V0UGF0aCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWN1cmUgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwczonO1xuICAgIHJldHVybiAoc2VjdXJlID8gJ3dzcycgOiAnd3MnKSArICc6Ly8nICsgd2luZG93LmxvY2F0aW9uLmhvc3QgKyAnL3YwL3dzJztcbn07XG5cbi8qKlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBTdHJlYW1NYW5hZ2VyKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnN0cmVhbXMgPSB7fTtcbiAgICBzZWxmLmNvbGxlY3Rpb25zID0ge307XG5cbiAgICB2YXIgcHJvY2Vzc01lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgaWYgKCFtc2cgfHwgIW1zZy50eXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgIHZhciB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgKHRhcmdldCA/IHRhcmdldC5saXN0ZW5lcnMgOiBbXSkuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICBpZiAoeFt0eXBlXSlcbiAgICAgICAgICAgICAgICB4W3R5cGVdKG1zZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG5cbiAgICB2YXIgb3BlbldlYnNvY2tldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRTdHJlYW1zID0gT2JqZWN0LmtleXMoc2VsZi5zdHJlYW1zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29sbGVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogeFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICBwcm9jZXNzTWVzc2FnZShkYXRhKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlb3BlbicpO1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xufVxuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQWxsID0gZnVuY3Rpb24ocGF0aHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG5ld1N1YnNjcmlwdGlvbnMgPSBbXTtcbiAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5zdHJlYW1zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBbY2FsbGJhY2tdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHBhdGggPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhdGgpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnM6IFtjYWxsYmFja11cbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxubGV0IGluc3RhbmNlO1xuXG5TdHJlYW1NYW5hZ2VyLmdldEluc3RhbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCFpbnN0YW5jZSlcbiAgICAgICAgaW5zdGFuY2UgPSBuZXcgU3RyZWFtTWFuYWdlcigpO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbn07XG4iXX0=
