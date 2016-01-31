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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCOzs7O0FBSU4sSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7QUFDcEMseUJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixpQkFBSyxJQUFMLEdBQVksTUFBWixDQUFtQixJQUFJLE9BQU8sV0FBUCxDQUFtQixJQUFJLE1BQUosQ0FBVyxLQUFYLENBQTFDLEVBRDJCO1NBQWQ7S0FEckIsRUFuQm9DOztBQXlCcEMsUUFBSSxDQUFDLElBQUQsSUFBUyxDQUFDLEtBQUssVUFBTCxFQUFELEVBQ1QsT0FESjs7QUFHQSxNQUFFLElBQUYsQ0FBTztBQUNILGNBQU0sS0FBTjtBQUNBLGFBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxjQUF6QyxDQUF3RCxLQUFLLFVBQUwsRUFBeEQsRUFBMkUsR0FBM0U7QUFDTCxpQkFBUztBQUNMLG9CQUFRLGtCQUFSO1NBREo7QUFHQSxlQUFPLGVBQVMsQ0FBVCxFQUFZO0FBQUUsb0JBQVEsS0FBUixDQUFjLENBQWQsRUFBRjtTQUFaO0tBTlgsRUFPRyxJQVBILENBT1EsVUFBUyxNQUFULEVBQWlCO0FBQ3JCLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixDQUFDLFVBQVUsRUFBVixDQUFELENBQWUsR0FBZixDQUFtQixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBN0MsRUFEcUI7S0FBakIsQ0FQUjs7O0FBNUJvQyxRQXdDcEMsQ0FBSyxPQUFMLENBQWEsbUJBQWIsQ0FBaUMsS0FBSyxRQUFMLEVBQWpDLEVBQWtEO0FBQzlDLHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsZ0JBQUksZ0JBQWdCLEtBQUssY0FBTCxDQUFvQixJQUFJLElBQUosQ0FBcEMsQ0FEdUI7QUFFM0IsZ0JBQUksY0FBYyxNQUFkLEVBQXNCO0FBQ3RCLDhCQUFjLENBQWQsRUFBaUIsTUFBakIsQ0FBd0IsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksTUFBSixDQUFwRCxFQURzQjtBQUV0QixxQkFBSyxXQUFMLENBQWlCLGNBQWMsQ0FBZCxDQUFqQixFQUZzQjthQUExQjtTQUZhO0FBT2pCLHNCQUFjLG9CQUFTLEdBQVQsRUFBYztBQUN4QixpQkFBSyxXQUFMLENBQWlCLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE0QixJQUFJLEtBQUosQ0FBN0MsRUFEd0I7U0FBZDtBQUdkLHdCQUFnQixzQkFBUyxHQUFULEVBQWM7QUFDMUIsaUJBQUssY0FBTCxDQUFvQixJQUFJLEtBQUosQ0FBcEIsQ0FEMEI7U0FBZDtLQVhwQixFQXhDb0M7Q0FBckI7O0FBeURuQixJQUFJLGNBQWMsU0FBZCxXQUFjLEdBQVc7QUFDekIsV0FBTyxPQUFPLFNBQVAsQ0FBaUIsUUFBakIsQ0FBMEIsT0FBTyxlQUFQLENBQWpDLENBRHlCO0NBQVg7O0FBSWxCLE9BQU8sT0FBUCxHQUFpQjtBQUNiLGtCQUFjLFlBQWQ7QUFDQSxpQkFBYSxXQUFiO0NBRko7OztBQ25FQTs7Ozs7QUFDQSxJQUFNLFFBQVEsU0FBUyxTQUFULENBQW1CLElBQW5CLENBQXdCLElBQXhCLENBQTZCLE1BQU0sU0FBTixDQUFnQixLQUFoQixDQUFyQzs7QUFFQyxJQUFNLHdDQUFnQixTQUFoQjs7OztBQUlOLElBQU0sc0NBQWUsU0FBZixZQUFlLENBQVMsR0FBVCxFQUFjO0FBQ3RDLFdBQU8sVUFBVSxHQUFWLEVBQ0YsSUFERSxHQUVGLFdBRkUsR0FHRixPQUhFLENBR00sR0FITixFQUdXLEdBSFgsQ0FBUCxDQURzQztDQUFkOzs7OztBQVVyQixJQUFNLHdDQUFpQixZQUFXO0FBQ3JDLFFBQUksU0FBUyxDQUFDLEtBQUQsRUFBUSxLQUFSLEVBQWUsS0FBZixFQUFzQixLQUF0QixFQUE2QixLQUE3QixFQUFvQyxLQUFwQyxFQUEyQyxLQUEzQyxFQUFrRCxLQUFsRCxFQUF5RCxLQUF6RCxFQUFnRSxLQUFoRSxFQUF1RSxLQUF2RSxFQUE4RSxLQUE5RSxDQUFULENBRGlDOztBQUdyQyxRQUFJLE1BQU0sU0FBTixHQUFNLENBQVMsR0FBVCxFQUFjLEtBQWQsRUFBcUI7QUFDM0IsaUJBQVMsRUFBVCxDQUQyQjtBQUUzQixlQUFPLE1BQU0sTUFBTixHQUFlLEdBQWY7QUFDSCxvQkFBUSxNQUFNLEtBQU47U0FEWixPQUVPLEtBQVAsQ0FKMkI7S0FBckIsQ0FIMkI7O0FBVXJDLFdBQU8sVUFBUyxJQUFULEVBQWU7QUFDbEIsWUFBSSxDQUFDLElBQUQsRUFDQSxPQUFPLEdBQVAsQ0FESjs7QUFHQSxlQUFPLE9BQU8sS0FBSyxRQUFMLEVBQVAsSUFBMEIsR0FBMUIsR0FBZ0MsSUFBSSxDQUFKLEVBQU8sS0FBSyxPQUFMLEVBQVAsQ0FBaEMsR0FBeUQsSUFBekQsR0FBZ0UsS0FBSyxXQUFMLEVBQWhFLEdBQXFGLEdBQXJGLEdBQ0gsSUFBSSxDQUFKLEVBQU8sS0FBSyxRQUFMLEVBQVAsQ0FERyxHQUN1QixHQUR2QixHQUM2QixJQUFJLENBQUosRUFBTyxLQUFLLFVBQUwsRUFBUCxDQUQ3QixHQUN5RCxHQUR6RCxHQUVILElBQUksQ0FBSixFQUFPLEtBQUssVUFBTCxFQUFQLENBRkcsR0FFeUIsSUFBSSxDQUFKLEVBQU8sS0FBSyxlQUFMLEVBQVAsQ0FGekIsQ0FKVztLQUFmLENBVjhCO0NBQVgsRUFBakI7Ozs7QUFzQk4sSUFBTSxvQ0FBYyxTQUFkLFdBQWMsQ0FBUyxLQUFULEVBQWdCO0FBQ3ZDLFFBQUksT0FBTyxJQUFQLENBRG1DO0FBRXZDLFNBQUssS0FBTCxHQUFhLEdBQUcsVUFBSCxDQUFjLEtBQWQsQ0FBYixDQUZ1QztDQUFoQjs7QUFLM0IsWUFBWSxLQUFaLEdBQW9CLFlBQVc7QUFDM0IsV0FBTyxJQUFJLFdBQUosQ0FBZ0IsYUFBaEIsQ0FBUCxDQUQyQjtDQUFYOztBQUlwQixZQUFZLFFBQVosR0FBdUIsVUFBUyxJQUFULEVBQWU7QUFDbEMsV0FBTyxJQUFJLFdBQUosQ0FBZ0IsUUFBUSxLQUFLLEtBQUwsQ0FBL0IsQ0FEa0M7Q0FBZjs7OztBQU1oQixJQUFNLDhCQUFXLFNBQVgsUUFBVyxDQUFTLEtBQVQsRUFBZ0I7QUFDcEMsUUFBSSxPQUFPLElBQVAsQ0FEZ0M7QUFFcEMsU0FBSyxLQUFMLEdBQWEsR0FBRyxVQUFILENBQWMsS0FBZCxDQUFiLENBRm9DOztBQUlwQyxTQUFLLEdBQUwsR0FBVyxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQzlCLGVBQU8sU0FBUyxXQUFULENBQXFCLE1BQXJCLENBQTRCLE1BQTVCLENBQW1DLEtBQUssS0FBTCxFQUFuQyxFQUFpRCxHQUFqRCxDQUR1QjtLQUFYLENBQXZCLENBSm9DO0NBQWhCOzs7O0FBV3hCLElBQU0sZ0JBQWdCLFNBQWhCLGFBQWdCLENBQVMsSUFBVCxFQUFlLEdBQWYsRUFBb0I7QUFDdEMsUUFBTSxPQUFPLElBQVAsQ0FEZ0M7QUFFdEMsU0FBSyxJQUFMLEdBQVksR0FBRyxVQUFILENBQWMsSUFBZCxDQUFaLENBRnNDO0FBR3RDLFNBQUssR0FBTCxHQUFXLEdBQUcsVUFBSCxDQUFjLE9BQU8sR0FBUCxDQUF6QixDQUhzQztDQUFwQjs7OztBQVFmLElBQU0sb0NBQWMsU0FBZCxXQUFjLENBQVMsRUFBVCxFQUFhLElBQWIsRUFBbUIsR0FBbkIsRUFBd0IsTUFBeEIsRUFBZ0MsT0FBaEMsRUFBeUMsSUFBekMsRUFBK0M7QUFDdEUsUUFBSSxPQUFPLElBQVAsQ0FEa0U7QUFFdEUsU0FBSyxFQUFMLEdBQVUsR0FBRyxVQUFILENBQWMsRUFBZCxDQUFWLENBRnNFO0FBR3RFLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLFFBQVEsRUFBUixDQUExQixDQUhzRTtBQUl0RSxTQUFLLEdBQUwsR0FBVyxHQUFHLFVBQUgsQ0FBYyxPQUFPLEVBQVAsQ0FBekIsQ0FKc0U7QUFLdEUsU0FBSyxNQUFMLEdBQWMsR0FBRyxVQUFILENBQWMsVUFBVSxZQUFZLEtBQVosRUFBVixDQUE1QixDQUxzRTtBQU10RSxTQUFLLE9BQUwsR0FBZSxHQUFHLFVBQUgsQ0FBYyxPQUFkLENBQWYsQ0FOc0U7QUFPdEUsU0FBSyxJQUFMLEdBQVksR0FBRyxlQUFILENBQW1CLFFBQVEsRUFBUixDQUEvQixDQVBzRTs7QUFTdEUsU0FBSyxHQUFMLEdBQVcsR0FBRyxRQUFILENBQVksWUFBVztBQUM5QixlQUFPLFNBQVMsV0FBVCxDQUFxQixNQUFyQixDQUE0QixTQUE1QixDQUFzQyxLQUFLLEdBQUwsRUFBdEMsRUFBa0QsR0FBbEQsQ0FEdUI7S0FBWCxDQUF2QixDQVRzRTs7QUFhdEUsU0FBSyxLQUFMLEdBQWEsR0FBRyxRQUFILENBQVksWUFBVztBQUNoQyxZQUFJLFNBQVMsS0FBSyxNQUFMLEVBQVQsQ0FENEI7QUFFaEMsZUFBUSxTQUFTLE9BQU8sS0FBUCxFQUFULEdBQTBCLGFBQTFCLENBRndCO0tBQVgsQ0FBekIsQ0Fic0U7O0FBa0J0RSxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxLQUFULEVBQWdCO0FBQzVCLFlBQUksU0FBUyxLQUFLLE1BQUwsTUFBaUIsWUFBWSxLQUFaLEVBQWpCLENBRGU7QUFFNUIsZUFBTyxLQUFQLENBQWEsS0FBYixFQUY0QjtBQUc1QixhQUFLLE1BQUwsQ0FBWSxNQUFaLEVBSDRCO0tBQWhCLENBbEJzRDs7QUF3QnRFLFNBQUssY0FBTCxHQUFzQixHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQ3pDLGVBQU8sY0FBYyxLQUFLLE9BQUwsRUFBZCxDQUFQLENBRHlDO0tBQVgsQ0FBbEMsQ0F4QnNFOztBQTRCdEUsU0FBSyxPQUFMLEdBQWUsVUFBUyxJQUFULEVBQWU7QUFDMUIsWUFBSSxXQUFXLGFBQWEsS0FBSyxRQUFMLEVBQWIsQ0FBWCxDQURzQjtBQUUxQixlQUFRLGFBQWEsS0FBSyxHQUFMLEVBQWIsSUFBMkIsS0FBSyxHQUFMLEdBQVcsT0FBWCxDQUFtQixXQUFXLEdBQVgsQ0FBbkIsS0FBdUMsQ0FBdkMsQ0FGVDtLQUFmLENBNUJ1RDs7QUFpQ3RFLFNBQUssY0FBTCxHQUFzQixHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQ3pDLFlBQU0sUUFBUSxFQUFSLENBRG1DO0FBRXpDLGFBQUssR0FBTCxHQUFXLEtBQVgsQ0FBaUIsR0FBakIsRUFBc0IsTUFBdEIsQ0FBNkIsVUFBQyxJQUFELEVBQU8sQ0FBUCxFQUFhO0FBQ3RDLG9CQUFRLE1BQU0sQ0FBTixDQUQ4QjtBQUV0QyxrQkFBTSxJQUFOLENBQVcsSUFBSSxhQUFKLENBQWtCLENBQWxCLEVBQXFCLElBQXJCLENBQVgsRUFGc0M7QUFHdEMsbUJBQU8sSUFBUCxDQUhzQztTQUFiLEVBSTFCLEVBSkgsRUFGeUM7QUFPekMsZUFBTyxLQUFQLENBUHlDO0tBQVgsQ0FBbEMsQ0FqQ3NFO0NBQS9DOztBQTRDM0IsWUFBWSxRQUFaLEdBQXVCLFVBQVMsSUFBVCxFQUFlO0FBQ2xDLFdBQU8sSUFBSSxXQUFKLENBQ0gsUUFBUSxLQUFLLEVBQUwsRUFDUixRQUFRLEtBQUssSUFBTCxFQUNSLFFBQVEsS0FBSyxHQUFMLEVBQ1IsWUFBWSxRQUFaLENBQXFCLFFBQVEsS0FBSyxNQUFMLENBSjFCLEVBS0gsSUFBSSxJQUFKLENBQVMsUUFBUSxLQUFLLE9BQUwsQ0FMZCxFQUs2QixDQUFDLFFBQVEsS0FBSyxJQUFMLElBQWEsRUFBckIsQ0FBRCxDQUEwQixHQUExQixDQUE4QixVQUFTLENBQVQsRUFBWTtBQUN0RSxlQUFPLElBQUksUUFBSixDQUFhLEVBQUUsR0FBRixDQUFwQixDQURzRTtLQUFaLENBTDNELENBQVAsQ0FEa0M7Q0FBZjs7OztBQWFoQixJQUFNLGdDQUFZLFNBQVosU0FBWSxDQUFTLFFBQVQsRUFBbUIsTUFBbkIsRUFBMkIsVUFBM0IsRUFBdUM7QUFDNUQsUUFBSSxPQUFPLElBQVAsQ0FEd0Q7QUFFNUQsU0FBSyxRQUFMLEdBQWdCLEdBQUcsVUFBSCxDQUFjLFlBQVksRUFBWixDQUE5QixDQUY0RDtBQUc1RCxTQUFLLE1BQUwsR0FBYyxHQUFHLFVBQUgsQ0FBYyxVQUFVLFlBQVksS0FBWixFQUFWLENBQTVCLENBSDREO0FBSTVELFNBQUssVUFBTCxHQUFrQixHQUFHLFVBQUgsQ0FBYyxVQUFkLENBQWxCLENBSjREOztBQU01RCxTQUFLLEtBQUwsR0FBYSxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQ2hDLFlBQUksU0FBUyxLQUFLLE1BQUwsRUFBVCxDQUQ0QjtBQUVoQyxlQUFRLFNBQVMsT0FBTyxLQUFQLEVBQVQsR0FBMEIsYUFBMUIsQ0FGd0I7S0FBWCxDQUF6QixDQU40RDtDQUF2Qzs7QUFZekIsVUFBVSxRQUFWLEdBQXFCLFVBQVMsSUFBVCxFQUFlO0FBQ2hDLFdBQU8sSUFBSSxTQUFKLENBQ0gsUUFBUSxLQUFLLFFBQUwsRUFDUixZQUFZLFFBQVosQ0FBcUIsUUFBUSxLQUFLLE1BQUwsQ0FGMUIsRUFHSCxRQUFRLEtBQUssVUFBTCxDQUhaLENBRGdDO0NBQWY7Ozs7QUFTZCxJQUFNLGtDQUFhLFNBQWIsVUFBYSxDQUFTLEdBQVQsRUFBYztBQUNwQyxRQUFJLE9BQU8sSUFBUCxDQURnQztBQUVwQyxTQUFLLEdBQUwsR0FBVyxHQUFHLFVBQUgsQ0FBYyxHQUFkLENBQVgsQ0FGb0M7QUFHcEMsU0FBSyxRQUFMLEdBQWdCLEdBQUcsZUFBSCxFQUFoQixDQUhvQzs7QUFLcEMsU0FBSyxRQUFMLEdBQWdCLFVBQVMsS0FBVCxFQUFnQjtBQUM1QixhQUFLLFFBQUwsQ0FBYyxNQUFkLENBQXFCLFVBQVMsQ0FBVCxFQUFZO0FBQzdCLG1CQUFPLEVBQUUsR0FBRixPQUFZLE1BQU0sR0FBTixFQUFaLENBRHNCO1NBQVosQ0FBckIsQ0FENEI7QUFJNUIsYUFBSyxRQUFMLENBQWMsT0FBZCxDQUFzQixLQUF0QixFQUo0QjtLQUFoQixDQUxvQjtDQUFkOzs7O0FDdkoxQjs7Ozs7QUFFTyxJQUFNLDhDQUFtQixTQUFuQixnQkFBbUIsQ0FBQyxXQUFELEVBQWlCO0FBQzdDLFdBQU8sWUFBWSxNQUFaLENBQW1CLENBQW5CLEVBQXNCLEtBQXRCLENBQTRCLEdBQTVCLEVBQ0YsTUFERSxDQUNLLFVBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUI7QUFDekIsWUFBSSxLQUFLLEtBQUssS0FBTCxDQUFXLEdBQVgsQ0FBTCxDQURxQjtBQUV6QixZQUFJLElBQUksR0FBRyxDQUFILENBQUosQ0FGcUI7QUFHekIsWUFBSSxJQUFJLG1CQUFtQixHQUFHLENBQUgsQ0FBbkIsQ0FBSixDQUhxQjtBQUl6QixZQUFJLEtBQUssSUFBTCxFQUFXLEtBQUssQ0FBTCxFQUFRLElBQVIsQ0FBYSxDQUFiLEVBQWYsS0FBcUMsS0FBSyxDQUFMLElBQVUsQ0FBQyxDQUFELENBQVYsQ0FBckM7QUFDQSxlQUFPLElBQVAsQ0FMeUI7S0FBckIsRUFNTCxFQVBBLENBQVAsQ0FENkM7Q0FBakI7O0FBV3pCLElBQU0sMENBQWlCLFNBQWpCLGNBQWlCLEdBQU07QUFDaEMsV0FBTyxpQkFBaUIsT0FBTyxRQUFQLENBQWdCLE1BQWhCLENBQXhCLENBRGdDO0NBQU47O0FBSXZCLElBQU0sa0NBQWEsU0FBYixVQUFhLENBQUMsR0FBRCxFQUFTO0FBQzlCLFFBQ0ksSUFESixDQUNTLFVBRFQsRUFDcUIsSUFEckIsRUFFSSxRQUZKLENBRWEsWUFGYixFQUdRLFFBSFIsQ0FHaUIsNkNBSGpCLEVBRDhCO0NBQVQ7O0FBT25CLElBQU0sc0NBQWUsU0FBZixZQUFlLENBQUMsR0FBRCxFQUFTO0FBQ2pDLFFBQ0ksSUFESixDQUNTLFVBRFQsRUFDcUIsS0FEckIsRUFFSSxRQUZKLENBRWEsWUFGYixFQUdRLFdBSFIsQ0FHb0IsOENBSHBCLEVBRGlDO0NBQVQ7Ozs7QUN4QjVCOztBQUNBLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDtBQUNOLElBQU0saUJBQWlCLFFBQVEsa0JBQVIsQ0FBakI7QUFDTixJQUFNLG9CQUFvQixRQUFRLHFCQUFSLENBQXBCO0FBQ04sSUFBTSxTQUFTLFFBQVEsVUFBUixDQUFUOztBQUVOLElBQUksaUJBQWlCLE9BQU8sTUFBUCxDQUFjO0FBQy9CLGFBQVMsQ0FBVDtBQUNBLFFBQUksQ0FBSjtBQUNBLFNBQUssQ0FBTDtBQUNBLGtCQUFjLENBQWQ7Q0FKaUIsQ0FBakI7O0FBT0osSUFBSSxpQkFBaUIsU0FBakIsY0FBaUIsQ0FBUyxVQUFULEVBQXFCLEdBQXJCLEVBQTBCO0FBQzNDLGlCQUFhLE9BQU8sWUFBUCxDQUFvQixVQUFwQixDQUFiLENBRDJDO0FBRTNDLFFBQUksZUFBZSxHQUFmLEVBQ0EsT0FBTyxJQUFQLENBREo7O0FBR0EsUUFBSSxRQUFRLElBQUksV0FBSixDQUFnQixHQUFoQixDQUFSLENBTHVDO0FBTTNDLFdBQVEsU0FBUyxDQUFULElBQWMsZUFBZSxJQUFJLEtBQUosQ0FBVSxDQUFWLEVBQWEsS0FBYixDQUFmLENBTnFCO0NBQTFCOztBQVNyQixJQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsR0FBVCxFQUFjO0FBQzdCLFdBQVEsSUFBSSxPQUFKLENBQVksR0FBWixNQUFxQixDQUFDLENBQUQsQ0FEQTtDQUFkOzs7O0FBTW5CLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWUsTUFBZixFQUF1QjtBQUN0QyxRQUFJLE9BQU8sSUFBUCxDQURrQztBQUV0QyxzQkFBa0IsWUFBbEIsQ0FBK0IsSUFBL0IsQ0FBb0MsSUFBcEMsRUFBMEMsSUFBMUMsRUFGc0M7O0FBSXRDLFNBQUssTUFBTCxHQUFjLEdBQUcsVUFBSCxDQUFjLE1BQWQsQ0FBZCxDQUpzQztBQUt0QyxTQUFLLEtBQUwsR0FBYSxHQUFHLFVBQUgsRUFBYixDQUxzQztBQU10QyxTQUFLLFFBQUwsR0FBZ0IsR0FBRyxVQUFILENBQWMsZUFBZSxPQUFmLENBQTlCLENBTnNDOztBQVF0QyxTQUFLLFFBQUwsR0FBZ0IsR0FBRyxRQUFILENBQVksWUFBTTtBQUM5QixlQUFPLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssTUFBTCxHQUFjLEdBQWQsRUFBdEIsQ0FBUCxDQUQ4QjtLQUFOLENBQTVCLENBUnNDOztBQVl0QyxTQUFLLEtBQUwsR0FBYSxHQUFHLFFBQUgsQ0FBWSxZQUFNO0FBQzNCLFlBQU0sU0FBUyxLQUFLLE1BQUwsRUFBVCxDQURxQjtBQUUzQixlQUFRLFNBQVMsT0FBTyxLQUFQLEVBQVQsR0FBMEIsT0FBTyxhQUFQLENBRlA7S0FBTixDQUF6QixDQVpzQzs7QUFpQnRDLFNBQUssUUFBTCxHQUFnQixVQUFTLEtBQVQsRUFBZ0I7QUFDNUIsWUFBSSxDQUFDLEtBQUssTUFBTCxFQUFELEVBQ0EsS0FBSyxNQUFMLENBQVksSUFBSSxPQUFPLFdBQVAsRUFBaEIsRUFESjtBQUVBLGFBQUssTUFBTCxHQUFjLFFBQWQsQ0FBdUIsS0FBdkIsRUFINEI7S0FBaEIsQ0FqQnNCOztBQXVCdEMsU0FBSyxRQUFMLEdBQWdCLFVBQVMsS0FBVCxFQUFnQjtBQUM1QixhQUFLLFFBQUwsR0FBZ0IsUUFBaEIsQ0FBeUIsS0FBekIsRUFENEI7S0FBaEIsQ0F2QnNCOztBQTJCdEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsUUFBVCxFQUFtQjtBQUNsQyxlQUFPLEtBQUssUUFBTCxHQUFnQixRQUFoQixDQUF5QixNQUF6QixDQUFnQyxVQUFTLENBQVQsRUFBWTtBQUMvQyxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHdDO1NBQVosQ0FBdkMsQ0FEa0M7S0FBbkIsQ0EzQm1COztBQWlDdEMsU0FBSyxZQUFMLEdBQW9CLFVBQVMsS0FBVCxFQUFnQjtBQUNoQyxVQUFFLElBQUYsQ0FBTztBQUNILGtCQUFNLFFBQU47QUFDQSxpQkFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGVBQXpDLENBQXlELE1BQU0sRUFBTixFQUF6RCxFQUFxRSxHQUFyRTtBQUNMLG1CQUFPLGVBQVMsQ0FBVCxFQUFZLEVBQVo7U0FIWCxFQU1HLElBTkgsQ0FNUSxZQUFXO0FBQ2YsaUJBQUssV0FBTCxDQUFpQixNQUFNLEdBQU4sRUFBakIsRUFEZTtTQUFYLENBTlIsQ0FEZ0M7S0FBaEIsQ0FqQ2tCOztBQTZDdEMsU0FBSyxhQUFMLEdBQXFCLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDeEMsZUFBUSxDQUFDLENBQUMsS0FBSyxNQUFMLEVBQUQsSUFBa0IsT0FBTyxPQUFQLENBQWUsS0FBSyxJQUFMLEVBQWYsQ0FBbkIsQ0FEZ0M7S0FBWCxDQUFqQyxDQTdDc0M7O0FBaUR0QyxTQUFLLHNCQUFMLEdBQThCLFVBQVMsS0FBVCxFQUFnQixLQUFoQixFQUF1QjtBQUNqRCxZQUFJLGVBQWUsS0FBSyxNQUFMLEdBQWMsR0FBZCxFQUFmLEVBQW9DLE1BQU0sR0FBTixFQUFwQyxDQUFKLEVBQXNEO0FBQ2xELG9CQUFRLE9BQVIsQ0FBZ0I7QUFDWix1QkFBTyxlQUFQO0FBQ0EseUJBQVMsS0FBVDtBQUNBLDZCQUFhLEtBQWI7QUFDQSx5QkFBUyxtRUFBVDtBQUNBLDBCQUFVLGtCQUFTLE1BQVQsRUFBaUI7QUFDdkIsd0JBQUksTUFBSixFQUFZO0FBQ1IsNkJBQUssWUFBTCxDQUFrQixLQUFsQixFQURRO3FCQUFaO2lCQURNO2FBTGQsRUFEa0Q7U0FBdEQsTUFZTztBQUNILGNBQUUsSUFBRixDQUFPO0FBQ0gsc0JBQU0sUUFBTjtBQUNBLHFCQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsY0FBekMsQ0FBd0QsS0FBSyxNQUFMLEdBQWMsRUFBZCxFQUF4RCxFQUE0RSxNQUFNLEVBQU4sRUFBNUUsRUFBd0YsR0FBeEY7QUFDTCx1QkFBTyxlQUFTLENBQVQsRUFBWSxFQUFaO2FBSFgsRUFNRyxJQU5ILENBTVEsWUFBVztBQUNmLHFCQUFLLFdBQUwsQ0FBaUIsTUFBTSxHQUFOLEVBQWpCLEVBRGU7YUFBWCxDQU5SLENBREc7U0FaUDtLQUQwQixDQWpEUTs7QUEyRXRDLFNBQUssZUFBTCxHQUF1QixVQUFDLEtBQUQsRUFBVztBQUM5QixhQUFLLE1BQUwsQ0FBWSxLQUFaLEVBRDhCO0tBQVgsQ0EzRWU7Q0FBdkI7O0FBZ0ZuQixhQUFhLFNBQWIsQ0FBdUIsYUFBdkIsR0FBdUMsWUFBVztBQUM5QyxRQUFJLE9BQU8sSUFBUCxDQUQwQztBQUU5QyxRQUFJLENBQUMsS0FBSyxJQUFMLEdBQVksUUFBWixFQUFELEVBQ0EsT0FESjs7O0FBRjhDLFFBTTFDLEtBQUssTUFBTCxHQUFjLEVBQWQsT0FBdUIsS0FBSyxJQUFMLEdBQVksVUFBWixFQUF2QixJQUFtRCxlQUFlLEtBQUssSUFBTCxHQUFZLFFBQVosRUFBZixFQUF1QyxLQUFLLE1BQUwsR0FBYyxHQUFkLEVBQXZDLENBQW5ELEVBQWdIO0FBQ2hILGFBQUssUUFBTCxDQUFjLGVBQWUsWUFBZixDQUFkLENBRGdIO0tBQXBILE1BRU87QUFDSCxVQUFFLElBQUYsQ0FBTztBQUNILGtCQUFNLEtBQU47QUFDQSxpQkFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLFdBQXpDLENBQXFELEtBQUssSUFBTCxHQUFZLFVBQVosRUFBckQsRUFBK0UsS0FBSyxNQUFMLEdBQWMsRUFBZCxFQUEvRSxFQUFtRyxHQUFuRztBQUNMLG1CQUFPLGVBQVMsQ0FBVCxFQUFZO0FBQ2Ysb0JBQUksRUFBRSxNQUFGLEtBQWEsR0FBYixFQUFrQjtBQUNsQix5QkFBSyxRQUFMLENBQWMsZUFBZSxFQUFmLENBQWQsQ0FEa0I7aUJBQXRCO2FBREc7U0FIWCxFQVFHLElBUkgsQ0FRUSxZQUFXO0FBQ2YsaUJBQUssUUFBTCxDQUFjLGVBQWUsR0FBZixDQUFkLENBRGU7U0FBWCxDQVJSLENBREc7S0FGUDtDQU5tQzs7QUF1QnZDLElBQUksZ0JBQWdCLFNBQWhCLGFBQWdCLEdBQVc7QUFDM0IsV0FBTyxPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsT0FBTyxpQkFBUCxDQUFuQyxDQUQyQjtDQUFYOzs7OztBQU9wQixJQUFJLGdCQUFnQixTQUFoQixhQUFnQixDQUFTLEtBQVQsRUFBZ0I7QUFDaEMsUUFBSSxTQUFTLFNBQVMsYUFBVCxDQUF1QixRQUF2QixDQUFULENBRDRCO0FBRWhDLFFBQUksT0FBTyxTQUFTLGNBQVQsQ0FBd0IsU0FBeEIsQ0FBUCxDQUY0Qjs7QUFJaEMsV0FBTyxLQUFQLEdBQWUsT0FBTyxNQUFQLEdBQWdCLENBQWhCLENBSmlCO0FBS2hDLFFBQUksTUFBTSxPQUFPLFVBQVAsQ0FBa0IsSUFBbEIsQ0FBTixDQUw0QjtBQU1oQyxRQUFJLFNBQUosR0FBZ0IsS0FBaEIsQ0FOZ0M7QUFPaEMsUUFBSSxRQUFKLENBQWEsQ0FBYixFQUFnQixDQUFoQixFQUFtQixPQUFPLEtBQVAsRUFBYyxPQUFPLE1BQVAsQ0FBakMsQ0FQZ0M7QUFRaEMsU0FBSyxJQUFMLEdBQVksT0FBTyxTQUFQLENBQWlCLFdBQWpCLENBQVosQ0FSZ0M7Q0FBaEI7Ozs7QUFhcEIsSUFBSSx1QkFBdUIsU0FBdkIsb0JBQXVCLENBQVMsUUFBVCxFQUFtQjtBQUMxQyxNQUFFLGtCQUFGLEVBQ0ssSUFETCxDQUNVLFVBRFYsRUFDc0IsS0FEdEIsRUFFSyxJQUZMLENBRVUsT0FGVixFQUVtQixXQUFXLGlCQUFYLEdBQStCLGNBQS9CLENBRm5CLENBRDBDOztBQUsxQyxRQUFJLFFBQUosRUFDSSxFQUFFLGtCQUFGLEVBQXNCLFFBQXRCLENBQStCLFFBQS9CLEVBREosS0FHSSxFQUFFLGtCQUFGLEVBQXNCLFdBQXRCLENBQWtDLFFBQWxDLEVBSEo7Q0FMdUI7O0FBWTNCLElBQUksd0JBQXdCLFNBQXhCLHFCQUF3QixHQUFXO0FBQ25DLE1BQUUsa0JBQUYsRUFDSyxJQURMLENBQ1UsVUFEVixFQUNzQixJQUR0QixFQURtQztDQUFYOzs7O0FBTzVCLElBQUksZ0JBQWdCLFNBQWhCLGFBQWdCLEdBQVc7QUFDM0IsTUFBRSx1REFBRixFQUEyRCxRQUEzRCxDQUFvRSxRQUFwRSxFQUQyQjtBQUUzQixNQUFFLGdDQUFGLEVBQW9DLEdBQXBDLENBQXdDLEVBQXhDLEVBRjJCO0FBRzNCLE1BQUUsc0JBQUYsRUFDSyxRQURMLENBQ2MsUUFEZCxFQUVLLElBRkwsQ0FFVSxFQUZWLEVBSDJCO0NBQVg7O0FBUXBCLElBQUksb0JBQW9CLFNBQXBCLGlCQUFvQixDQUFTLEtBQVQsRUFBZ0IsTUFBaEIsRUFBd0IsSUFBeEIsRUFBOEIsSUFBOUIsRUFBb0M7QUFDeEQsTUFBRSxzQkFBRixFQUEwQixRQUExQixDQUFtQyxRQUFuQyxFQUR3RDs7QUFHeEQsTUFBRSxrQ0FBRixFQUNLLFFBREwsQ0FDYyw2Q0FEZCxFQUh3RDs7QUFNeEQsTUFBRSxpR0FBRixFQUNLLElBREwsQ0FDVSxVQURWLEVBQ3NCLElBRHRCLEVBTndEOztBQVN4RCxRQUFJLGFBQWEsU0FBYixVQUFhLEdBQVc7QUFDeEIsVUFBRSxrQ0FBRixFQUNLLFdBREwsQ0FDaUIsNkNBRGpCLEVBRHdCOztBQUl4QixVQUFFLGlHQUFGLEVBQ0ssSUFETCxDQUNVLFVBRFYsRUFDc0IsS0FEdEIsRUFKd0I7S0FBWCxDQVR1Qzs7QUFpQnhELFFBQUksV0FBVyxTQUFYLFFBQVcsQ0FBUyxDQUFULEVBQVk7QUFDdkIsWUFBSSxDQUFKLEVBQU87QUFDSCxnQkFBSSxFQUFFLE9BQUYsRUFBVztBQUNYLG9CQUFJLEVBQUUsT0FBRixDQUFVLFVBQVYsQ0FBSixFQUEyQjtBQUN2QiwyQkFBTyxnRUFBUCxDQUR1QjtpQkFBM0I7YUFESjtBQUtBLGdCQUFJLEVBQUUsS0FBRixFQUNBLE9BQU8sRUFBRSxLQUFGLENBRFg7U0FOSjs7QUFVQSxlQUFPLG1CQUFQLENBWHVCO0tBQVosQ0FqQnlDOztBQStCeEQsTUFBRSxJQUFGLENBQU87QUFDSCxjQUFNLEtBQU47QUFDQSxhQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsZUFBekMsR0FBMkQsR0FBM0Q7QUFDTCxxQkFBYSxrQkFBYjtBQUNBLGNBQU0sS0FBSyxTQUFMLENBQWU7QUFDakIsa0JBQU0sSUFBTjtBQUNBLGlCQUFLLE9BQU8sR0FBUCxLQUFlLEdBQWYsR0FBcUIsSUFBckI7U0FGSCxDQUFOO0FBSUEsZUFBTyxlQUFTLENBQVQsRUFBWTtBQUNmLGNBQUUsc0JBQUYsRUFDSyxXQURMLENBQ2lCLFFBRGpCLEVBRUssSUFGTCxDQUVVLFNBQVMsRUFBRSxZQUFGLENBRm5CLEVBRGU7O0FBS2YseUJBTGU7U0FBWjtLQVJYLEVBZUcsSUFmSCxDQWVRLFVBQVMsTUFBVCxFQUFpQjtBQUNyQixjQUFNLFFBQU4sQ0FBZSxPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsTUFBNUIsQ0FBZixFQURxQjtBQUVyQixxQkFGcUI7QUFHckIsd0JBSHFCO0tBQWpCLENBZlIsQ0EvQndEO0NBQXBDOzs7O0FBdUR4QixJQUFJLGNBQWMsU0FBZCxXQUFjLENBQVMsS0FBVCxFQUFnQixjQUFoQixFQUFnQyxPQUFoQyxFQUF5QztBQUN2RCw0QkFEdUQ7QUFFdkQsTUFBRSxJQUFGLENBQU87QUFDSCxjQUFNLEtBQU47QUFDQSxhQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsY0FBekMsQ0FBd0QsY0FBeEQsRUFBd0UsT0FBeEUsRUFBaUYsR0FBakY7QUFDTCxlQUFPLGVBQVMsTUFBVCxFQUFnQjtBQUNuQixrQkFBTSxRQUFOLENBQWUsZUFBZSxPQUFmLENBQWYsQ0FEbUI7U0FBaEI7S0FIWCxFQU1HLElBTkgsQ0FNUSxVQUFTLE1BQVQsRUFBaUI7QUFDckIsY0FBTSxRQUFOLENBQWUsZUFBZSxHQUFmLENBQWYsQ0FEcUI7S0FBakIsQ0FOUixDQUZ1RDtDQUF6Qzs7QUFhbEIsSUFBSSxpQkFBaUIsU0FBakIsY0FBaUIsQ0FBUyxLQUFULEVBQWdCLGNBQWhCLEVBQWdDLE9BQWhDLEVBQXlDO0FBQzFELDRCQUQwRDtBQUUxRCxNQUFFLElBQUYsQ0FBTztBQUNILGNBQU0sUUFBTjtBQUNBLGFBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxjQUF6QyxDQUF3RCxjQUF4RCxFQUF3RSxPQUF4RSxFQUFpRixHQUFqRjtBQUNMLGVBQU8sZUFBUyxPQUFULEVBQWdCO0FBQ25CLGtCQUFNLFFBQU4sQ0FBZSxlQUFlLE9BQWYsQ0FBZixDQURtQjtTQUFoQjtLQUhYLEVBTUcsSUFOSCxDQU1RLFVBQVMsTUFBVCxFQUFpQjtBQUNyQixjQUFNLFFBQU4sQ0FBZSxlQUFlLEVBQWYsQ0FBZixDQURxQjtLQUFqQixDQU5SLENBRjBEO0NBQXpDOztBQWFyQixJQUFJLDhCQUE4QixTQUE5QiwyQkFBOEIsQ0FBUyxLQUFULEVBQWdCLEtBQWhCLEVBQXVCO0FBQ3JELE1BQUUsZUFBRixFQUFtQixXQUFuQixDQUErQixRQUEvQixFQURxRDtBQUVyRCxNQUFFLGFBQUYsRUFBaUIsUUFBakIsQ0FBMEIsUUFBMUIsRUFGcUQ7QUFHckQsTUFBRSxJQUFGLENBQU87QUFDSCxjQUFNLEtBQU47QUFDQSxhQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsY0FBekMsQ0FBd0QsTUFBTSxNQUFOLEdBQWUsRUFBZixFQUF4RCxFQUE2RSxHQUE3RTtBQUNMLGNBQU07QUFDRixtQkFBTyxLQUFQO1NBREo7QUFHQSxpQkFBUztBQUNMLG9CQUFRLGtCQUFSO1NBREo7QUFHQSxlQUFPLGVBQVMsQ0FBVCxFQUFZO0FBQ2YsY0FBRSxlQUFGLEVBQW1CLFFBQW5CLENBQTRCLFFBQTVCLEVBRGU7U0FBWjtLQVRYLEVBWUcsSUFaSCxDQVlRLFVBQVMsTUFBVCxFQUFpQjtBQUNyQixVQUFFLGVBQUYsRUFBbUIsUUFBbkIsQ0FBNEIsUUFBNUIsRUFEcUI7QUFFckIsY0FBTSxLQUFOLENBQVksS0FBWixFQUZxQjtBQUdyQixjQUFNLFFBQU4sR0FBaUIsUUFBakIsQ0FBMEIsQ0FBQyxVQUFVLEVBQVYsQ0FBRCxDQUFlLEdBQWYsQ0FBbUIsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTdDLEVBSHFCO0tBQWpCLENBWlIsQ0FIcUQ7Q0FBdkI7O0FBc0JsQyxJQUFNLHNCQUFzQixTQUF0QixtQkFBc0IsQ0FBUyxLQUFULEVBQWdCO0FBQ3hDLFFBQU0sUUFBUSxFQUFFLDJCQUFGLEVBQStCLEdBQS9CLEVBQVIsQ0FEa0M7QUFFeEMsV0FBTyw0QkFBNEIsS0FBNUIsRUFBbUMsS0FBbkMsQ0FBUCxDQUZ3QztDQUFoQjs7OztBQU81QixJQUFJLG1CQUFtQixTQUFuQixnQkFBbUIsQ0FBUyxLQUFULEVBQWdCLElBQWhCLEVBQXNCO0FBQ3pDLE1BQUUsSUFBRixDQUFPO0FBQ0gsY0FBTSxNQUFOO0FBQ0EsYUFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLE9BQXpDLENBQWlELE1BQU0sTUFBTixHQUFlLEVBQWYsRUFBakQsRUFBc0UsR0FBdEU7QUFDTCxxQkFBYSxrQkFBYjtBQUNBLGNBQU0sS0FBSyxTQUFMLENBQWUsS0FBSyxHQUFMLENBQVMsVUFBUyxDQUFULEVBQVk7QUFDdEMsbUJBQU87QUFDSCx1QkFBTyxFQUFFLEtBQUYsRUFBUDthQURKLENBRHNDO1NBQVosQ0FBeEIsQ0FBTjtBQUtBLGlCQUFTO0FBQ0wsb0JBQVEsa0JBQVI7U0FESjtBQUdBLGVBQU8sZUFBUyxDQUFULEVBQVksRUFBWjtLQVpYLEVBZUcsSUFmSCxDQWVRLFVBQVMsTUFBVCxFQUFpQjtBQUNyQixjQUFNLE1BQU4sR0FBZSxJQUFmLENBQ0ksT0FBTyxHQUFQLENBQVcsVUFBUyxHQUFULEVBQWM7QUFDckIsbUJBQU8sSUFBSSxPQUFPLFFBQVAsQ0FBZ0IsSUFBSSxHQUFKLENBQTNCLENBRHFCO1NBQWQsQ0FEZixFQURxQjtLQUFqQixDQWZSLENBRHlDO0NBQXRCOzs7OztBQTJCdkIsSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZTtBQUM5QixXQUFPLE1BQU0sU0FBTixDQUFnQixHQUFoQixDQUFvQixJQUFwQixDQUF5QixJQUF6QixFQUErQixVQUFTLENBQVQsRUFBWTtBQUMxQyxlQUFPLEVBQUUsS0FBRixFQUFQLENBRDBDO0tBQVosQ0FBL0IsQ0FHRixJQUhFLENBR0csSUFISCxDQUFQLENBRDhCO0NBQWY7Ozs7O0FBVW5CLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWU7QUFDOUIsV0FBTyxDQUFDLEtBQUssS0FBTCxDQUFXLHNCQUFYLEtBQXNDLEVBQXRDLENBQUQsQ0FBMkMsR0FBM0MsQ0FBK0MsVUFBUyxHQUFULEVBQWM7QUFDaEUsZUFBTyxJQUFJLE9BQU8sUUFBUCxDQUFnQixJQUFJLElBQUosRUFBcEIsQ0FBUCxDQURnRTtLQUFkLENBQXRELENBRDhCO0NBQWY7Ozs7O0FBU25CLElBQUksV0FBVyxTQUFYLFFBQVcsQ0FBUyxLQUFULEVBQWdCO0FBQzNCLE1BQUUsbUJBQUYsRUFBdUIsV0FBdkIsQ0FBbUMsUUFBbkMsRUFEMkI7QUFFM0IsTUFBRSxtQkFBRixFQUF1QixRQUF2QixDQUFnQyxRQUFoQyxFQUYyQjtBQUczQixNQUFFLFdBQUYsRUFBZSxRQUFmLENBQXdCLFFBQXhCLEVBSDJCOztBQUszQixNQUFFLFlBQUYsRUFDSyxXQURMLENBQ2lCLFFBRGpCLEVBTDJCOztBQVEzQixNQUFFLGtCQUFGLEVBQ0ssR0FETCxDQUNTLGFBQWEsTUFBTSxNQUFOLEdBQWUsSUFBZixFQUFiLENBRFQsRUFSMkI7Q0FBaEI7Ozs7O0FBZWYsSUFBSSxXQUFXLFNBQVgsUUFBVyxDQUFTLEtBQVQsRUFBZ0I7QUFDM0IsTUFBRSxtQkFBRixFQUF1QixRQUF2QixDQUFnQyxRQUFoQyxFQUQyQjtBQUUzQixNQUFFLG1CQUFGLEVBQXVCLFdBQXZCLENBQW1DLFFBQW5DLEVBRjJCO0FBRzNCLE1BQUUsWUFBRixFQUFnQixRQUFoQixDQUF5QixRQUF6QixFQUgyQjtBQUkzQixNQUFFLFdBQUYsRUFBZSxXQUFmLENBQTJCLFFBQTNCLEVBSjJCOztBQU0zQixRQUFJLE9BQU8sYUFBYSxFQUFFLGtCQUFGLEVBQXNCLEdBQXRCLEVBQWIsQ0FBUCxDQU51QjtBQU8zQixxQkFBaUIsS0FBakIsRUFBd0IsSUFBeEIsRUFQMkI7Q0FBaEI7Ozs7QUFZZixFQUFFLFlBQVc7QUFDVCxRQUFJLFFBQVEsSUFBSSxZQUFKLENBQ1Isa0JBQWtCLFdBQWxCLEVBRFEsRUFFUixlQUZRLENBQVIsQ0FESzs7QUFLVCxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsS0FBVCxFQUFnQjtBQUMvQixZQUFJLFNBQVMsTUFBTSxNQUFOLEVBQVQsQ0FEMkI7QUFFL0IsWUFBSSxDQUFDLE1BQUQsRUFDQSxPQURKOztBQUdBLFVBQUUsSUFBRixDQUFPO0FBQ0gsa0JBQU0sTUFBTjtBQUNBLGlCQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsa0JBQXpDLENBQTRELE9BQU8sRUFBUCxFQUE1RCxFQUF5RSxHQUF6RTtBQUNMLHlCQUFhLGtCQUFiO0FBQ0Esa0JBQU0sS0FBSyxTQUFMLENBQWU7QUFDakIsdUJBQU8sS0FBUDthQURFLENBQU47U0FKSixFQUwrQjs7QUFjL0IsY0FBTSxNQUFOLEdBQWUsT0FBZixDQUF1QixJQUFJLElBQUosRUFBdkIsRUFkK0I7QUFlL0IsY0FBTSxRQUFOLENBQWUsS0FBZixFQWYrQjtLQUFoQixDQUxWOztBQXVCVCxRQUFJLGVBQWdCLFlBQVc7QUFDM0IsWUFBSSxlQUFlLE9BQU8sYUFBUCxDQURRO0FBRTNCLFlBQUksY0FBYyxPQUFPLGFBQVAsQ0FGUztBQUczQixjQUFNLE9BQU4sQ0FBYyxTQUFkLENBQXdCLE1BQU0sTUFBTixHQUFlLEdBQWYsRUFBeEIsRUFBOEM7QUFDMUMsNkJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixvQkFBSSxJQUFJLElBQUosS0FBYSxNQUFNLE1BQU4sR0FBZSxHQUFmLEVBQWIsRUFBbUM7QUFDbkMsbUNBQWUsSUFBSSxNQUFKLENBQVcsS0FBWCxDQURvQjtpQkFBdkM7YUFEYTtTQURyQixFQUgyQjs7QUFXM0IsWUFBSSxlQUFlLEVBQUUsZ0JBQUYsRUFDZCxRQURjLENBQ0w7QUFDTix1QkFBVyxJQUFYO0FBQ0EseUJBQWEsSUFBYjtBQUNBLGtDQUFzQixJQUF0QjtBQUNBLDZCQUFpQixLQUFqQjtBQUNBLDZCQUFpQiw0QkFBakI7U0FOVyxFQVFkLEVBUmMsQ0FRWCxlQVJXLEVBUU0sVUFBUyxDQUFULEVBQVksS0FBWixFQUFtQjtBQUNwQywwQkFBYyxlQUFlLFFBQVEsRUFBUixDQURPO1NBQW5CLENBUk4sQ0FXZCxFQVhjLENBV1gsK0JBWFcsRUFXc0IsVUFBUyxDQUFULEVBQVksS0FBWixFQUFtQjtBQUNwRCxrQkFBTSxRQUFOLENBQWUsUUFBUSxFQUFSLENBQWYsQ0FEb0Q7U0FBbkIsQ0FYdEIsQ0FjZCxFQWRjLENBY1gsZUFkVyxFQWNNLFVBQVMsQ0FBVCxFQUFZLEtBQVosRUFBbUI7QUFDcEMsMEJBQWMsUUFBUSxFQUFSLENBRHNCO0FBRXBDLGtCQUFNLFFBQU4sQ0FBZSxZQUFmLEVBRm9DO1NBQW5CLENBZHJCLENBWHVCOztBQThCM0IsVUFBRSxZQUFGLEVBQ0ssRUFETCxDQUNRLE9BRFIsRUFDaUIsWUFBVztBQUNwQix5QkFBYSxjQUFjLEVBQWQsQ0FBYixDQURvQjtTQUFYLENBRGpCLENBOUIyQjs7QUFtQzNCLGVBQU8sWUFBUCxDQW5DMkI7S0FBWCxFQUFoQixDQXZCSzs7QUE2RFQsTUFBRSxxQkFBRixFQUNLLEVBREwsQ0FDUSxRQURSLEVBQ2tCLFVBQVMsQ0FBVCxFQUFZO0FBQ3RCLFVBQUUsY0FBRixHQURzQjtBQUV0QixZQUFJLFFBQVEsRUFBRSxJQUFGLEVBQVEsUUFBUixDQUFpQixnQkFBakIsRUFBbUMsR0FBbkMsRUFBUixDQUZrQjtBQUd0QixxQkFBYSxLQUFiLEVBSHNCO0tBQVosQ0FEbEI7OztBQTdEUyxLQXFFVCxDQUFFLDZCQUFGLEVBQ0ssRUFETCxDQUNRLE9BRFIsRUFDaUIsVUFBUyxDQUFULEVBQVk7QUFDckIsWUFBSSxTQUFTLEVBQUUsMEJBQUYsRUFBOEIsUUFBOUIsQ0FBdUMsUUFBdkMsQ0FBVCxDQURpQjtBQUVyQixZQUFJLFNBQVMsRUFBRSx1REFBRixDQUFULENBRmlCO0FBR3JCLFlBQUksTUFBSixFQUFZO0FBQ1IsbUJBQU8sV0FBUCxDQUFtQixRQUFuQixFQURRO1NBQVosTUFFTztBQUNILDhCQUFrQixLQUFsQixFQUF5QixNQUFNLE1BQU4sRUFBekIsRUFBeUMsTUFBTSxJQUFOLEVBQXpDLEVBQXVELEVBQUUsZ0NBQUYsRUFBb0MsR0FBcEMsR0FBMEMsSUFBMUMsRUFBdkQsRUFERztTQUZQO0tBSFMsQ0FEakIsQ0FyRVM7O0FBZ0ZULE1BQUUsMEJBQUYsRUFBOEIsUUFBOUIsQ0FBdUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsWUFBSSxFQUFFLE9BQUYsS0FBYyxFQUFkLEVBQWtCO0FBQ2xCLDhCQUFrQixLQUFsQixFQUF5QixNQUFNLE1BQU4sRUFBekIsRUFBeUMsTUFBTSxJQUFOLEVBQXpDLEVBQXVELEVBQUUsZ0NBQUYsRUFBb0MsR0FBcEMsR0FBMEMsSUFBMUMsRUFBdkQsRUFEa0I7U0FBdEI7S0FEbUMsQ0FBdkMsQ0FoRlM7O0FBc0ZULE1BQUUsb0NBQUYsRUFDSyxFQURMLENBQ1EsT0FEUixFQUNpQixhQURqQjs7O0FBdEZTLEtBMEZULENBQUUsbUJBQUYsRUFBdUIsRUFBdkIsQ0FBMEIsT0FBMUIsRUFBbUMsVUFBUyxDQUFULEVBQVk7QUFDM0MsaUJBQVMsS0FBVCxFQUQyQztLQUFaLENBQW5DLENBMUZTOztBQThGVCxNQUFFLG1CQUFGLEVBQXVCLEVBQXZCLENBQTBCLE9BQTFCLEVBQW1DLFVBQVMsQ0FBVCxFQUFZO0FBQzNDLGlCQUFTLEtBQVQsRUFEMkM7S0FBWixDQUFuQyxDQTlGUzs7QUFrR1QsTUFBRSxrQkFBRixFQUFzQixRQUF0QixDQUErQixVQUFTLENBQVQsRUFBWTtBQUN2QyxZQUFJLEVBQUUsT0FBRixLQUFjLEVBQWQsVUFBSixFQUFpQztBQUM3Qix5QkFBUyxLQUFULEVBRDZCO2FBQWpDO0tBRDJCLENBQS9COzs7QUFsR1MsS0F5R1QsQ0FBRSw0QkFBRixFQUFnQyxFQUFoQyxDQUFtQyxPQUFuQyxFQUE0QyxVQUFTLENBQVQsRUFBWTtBQUNwRCxVQUFFLGNBQUYsR0FEb0Q7QUFFcEQsNEJBQW9CLEtBQXBCLEVBRm9EO0tBQVosQ0FBNUMsQ0F6R1M7O0FBOEdULE1BQUUsMkJBQUYsRUFBK0IsUUFBL0IsQ0FBd0MsVUFBUyxDQUFULEVBQVk7QUFDaEQsWUFBSSxFQUFFLE9BQUYsS0FBYyxFQUFkLFVBQUosRUFBaUM7QUFDN0Isb0NBQW9CLEtBQXBCLEVBRDZCO0FBRTdCLGtCQUFFLGNBQUYsR0FGNkI7YUFBakM7S0FEb0MsQ0FBeEM7OztBQTlHUyxRQXNITCxRQUFRLE9BQU8sY0FBUCxHQUF3QixLQUF4QixDQXRISDtBQXVIVCxnQ0FBNEIsS0FBNUIsRUFBb0MsU0FBUyxFQUFULENBQXBDLENBdkhTOztBQXlIVCxVQUFNLE9BQU4sQ0FBYyxtQkFBZCxDQUFrQyxNQUFNLE1BQU4sR0FBZSxHQUFmLEVBQWxDLEVBQXdEO0FBQ3BELHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsZ0JBQUksZ0JBQWdCLE1BQU0sV0FBTixDQUFrQixJQUFJLElBQUosQ0FBbEMsQ0FEdUI7QUFFM0IsZ0JBQUksY0FBYyxNQUFkLEVBQXNCO0FBQ3RCLDhCQUFjLENBQWQsRUFBaUIsTUFBakIsQ0FBd0IsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksTUFBSixDQUFwRCxFQURzQjtBQUV0QixzQkFBTSxRQUFOLENBQWUsY0FBYyxDQUFkLENBQWYsRUFGc0I7YUFBMUI7U0FGYTtBQU9qQixzQkFBYyxvQkFBUyxHQUFULEVBQWM7QUFDeEIsa0JBQU0sUUFBTixDQUFlLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE0QixJQUFJLEtBQUosQ0FBM0MsRUFEd0I7U0FBZDtBQUdkLHdCQUFnQixzQkFBUyxHQUFULEVBQWM7QUFDMUIsa0JBQU0sV0FBTixDQUFrQixJQUFJLEtBQUosQ0FBbEIsQ0FEMEI7U0FBZDtLQVhwQixFQXpIUzs7QUF5SVQsVUFBTSxLQUFOLENBQVksU0FBWixDQUFzQixhQUF0QixFQXpJUzs7QUEySVQsVUFBTSxRQUFOLEdBQWlCLFFBQWpCLENBQTBCLFNBQTFCLENBQW9DLFVBQVMsT0FBVCxFQUFrQjtBQUNsRCxZQUFJLFFBQVEsTUFBUixFQUNBLEVBQUUsYUFBRixFQUFpQixRQUFqQixDQUEwQixRQUExQixFQURKLEtBR0ksRUFBRSxhQUFGLEVBQWlCLFdBQWpCLENBQTZCLFFBQTdCLEVBSEo7S0FEZ0MsQ0FBcEM7OztBQTNJUyx5QkFtSlQsR0FuSlM7O0FBcUpULFVBQU0sUUFBTixDQUFlLFNBQWYsQ0FBeUIsVUFBUyxNQUFULEVBQWlCO0FBQ3RDLGdCQUFRLE1BQVI7QUFDSSxpQkFBSyxlQUFlLEdBQWY7QUFDRCx1QkFBTyxxQkFBcUIsSUFBckIsQ0FBUCxDQURKO0FBREosaUJBR1MsZUFBZSxFQUFmO0FBQ0QsdUJBQU8scUJBQXFCLEtBQXJCLENBQVAsQ0FESjtBQUhKO0FBTVEsdUJBQU8sdUJBQVAsQ0FESjtBQUxKLFNBRHNDO0tBQWpCLENBQXpCLENBckpTOztBQWdLVCxVQUFNLGFBQU4sR0FoS1M7O0FBbUtULE1BQUUsd0JBQUYsRUFBNEIsS0FBNUIsQ0FBa0MsVUFBUyxDQUFULEVBQVk7QUFDMUMsZ0JBQVEsTUFBTSxRQUFOLEVBQVI7QUFDSSxpQkFBSyxlQUFlLEdBQWY7QUFDRCx1QkFBTyxlQUFlLEtBQWYsRUFBc0IsTUFBTSxJQUFOLEdBQWEsVUFBYixFQUF0QixFQUFpRCxNQUFNLE1BQU4sR0FBZSxFQUFmLEVBQWpELENBQVAsQ0FESjtBQURKLGlCQUdTLGVBQWUsRUFBZjtBQUNELHVCQUFPLFlBQVksS0FBWixFQUFtQixNQUFNLElBQU4sR0FBYSxVQUFiLEVBQW5CLEVBQThDLE1BQU0sTUFBTixHQUFlLEVBQWYsRUFBOUMsQ0FBUCxDQURKO0FBSEosU0FEMEM7S0FBWixDQUFsQyxDQW5LUzs7QUE0S1QsVUFBTSxPQUFOLENBQWMsU0FBZCxDQUF3QixNQUFNLE1BQU4sR0FBZSxHQUFmLEVBQXhCLEVBQThDO0FBQzFDLHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsZ0JBQUksSUFBSSxJQUFKLEtBQWEsTUFBTSxNQUFOLEdBQWUsR0FBZixFQUFiLEVBQW1DO0FBQ25DLHNCQUFNLFFBQU4sQ0FBZSxJQUFJLE1BQUosQ0FBVyxLQUFYLENBQWYsQ0FEbUM7QUFFbkMsc0JBQU0sTUFBTixHQUFlLE9BQWYsQ0FBdUIsSUFBSSxJQUFKLENBQVMsSUFBSSxNQUFKLENBQVcsT0FBWCxDQUFoQyxFQUZtQztBQUduQyw2QkFBYSxRQUFiLENBQXNCLEtBQXRCLEVBQTZCLElBQUksTUFBSixDQUFXLEtBQVgsQ0FBN0IsQ0FIbUM7YUFBdkM7U0FEYTtBQU9qQix1QkFBZSxxQkFBUyxHQUFULEVBQWM7QUFDekIsZ0JBQUksSUFBSSxJQUFKLEtBQWEsTUFBTSxNQUFOLEdBQWUsR0FBZixFQUFiLElBQXFDLElBQUksTUFBSixDQUFXLEdBQVgsS0FBbUIsTUFBTSxJQUFOLEdBQWEsUUFBYixFQUFuQixFQUNyQyxNQUFNLFFBQU4sQ0FBZSxlQUFlLEdBQWYsQ0FBZixDQURKO1NBRFc7QUFJZix5QkFBaUIsdUJBQVMsR0FBVCxFQUFjO0FBQzNCLGdCQUFJLElBQUksSUFBSixLQUFhLE1BQU0sTUFBTixHQUFlLEdBQWYsRUFBYixJQUFxQyxJQUFJLE1BQUosS0FBZSxNQUFNLElBQU4sR0FBYSxRQUFiLEVBQWYsRUFDckMsTUFBTSxRQUFOLENBQWUsZUFBZSxFQUFmLENBQWYsQ0FESjtTQURhO0tBWnJCLEVBNUtTOztBQThMVCxPQUFHLGFBQUgsQ0FBaUIsS0FBakIsRUE5TFM7Q0FBWCxDQUFGOzs7QUN6V0E7O0FBQ0EsSUFBTSxTQUFTLFFBQVEsVUFBUixDQUFUOztBQUdOLElBQUksYUFBYSxTQUFiLFVBQWEsR0FBVztBQUN4QixRQUFJLFNBQVMsT0FBTyxRQUFQLENBQWdCLFFBQWhCLEtBQTZCLFFBQTdCLENBRFc7QUFFeEIsV0FBTyxDQUFDLFNBQVMsS0FBVCxHQUFpQixJQUFqQixDQUFELEdBQTBCLEtBQTFCLEdBQWtDLE9BQU8sUUFBUCxDQUFnQixJQUFoQixHQUF1QixRQUF6RCxDQUZpQjtDQUFYOzs7O0FBT2pCLElBQUksZ0JBQWdCLFNBQWhCLGFBQWdCLEdBQVc7QUFDM0IsUUFBSSxPQUFPLElBQVAsQ0FEdUI7QUFFM0IsU0FBSyxPQUFMLEdBQWUsRUFBZixDQUYyQjtBQUczQixTQUFLLFdBQUwsR0FBbUIsRUFBbkIsQ0FIMkI7O0FBSzNCLFFBQUksaUJBQWlCLFNBQWpCLGNBQWlCLENBQVMsR0FBVCxFQUFjO0FBQy9CLFlBQUksQ0FBQyxHQUFELElBQVEsQ0FBQyxJQUFJLElBQUosRUFDVCxPQURKOztBQUdBLFlBQUksT0FBTyxJQUFJLElBQUosQ0FKb0I7QUFLL0IsWUFBSSxTQUFVLElBQUksTUFBSixHQUFhLEtBQUssV0FBTCxDQUFpQixJQUFJLE1BQUosQ0FBOUIsR0FBNEMsS0FBSyxPQUFMLENBQWEsSUFBSSxJQUFKLENBQXpELENBTGlCO0FBTS9CLFNBQUMsU0FBUyxPQUFPLFNBQVAsR0FBbUIsRUFBNUIsQ0FBRCxDQUFpQyxPQUFqQyxDQUF5QyxVQUFTLENBQVQsRUFBWTtBQUNqRCxnQkFBSSxFQUFFLElBQUYsQ0FBSixFQUNJLEVBQUUsSUFBRixFQUFRLEdBQVIsRUFESjtTQURxQyxDQUF6QyxDQU4rQjtLQUFkLENBTE07O0FBaUIzQixTQUFLLEtBQUwsR0FBYSxLQUFiLENBakIyQjs7QUFtQjNCLFFBQUksZ0JBQWdCLFNBQWhCLGFBQWdCLEdBQVc7QUFDM0IsWUFBSSxTQUFTLElBQUksU0FBSixDQUFjLFlBQWQsQ0FBVCxDQUR1Qjs7QUFHM0IsZUFBTyxNQUFQLEdBQWdCLFVBQVMsQ0FBVCxFQUFZO0FBQ3hCLGlCQUFLLEtBQUwsR0FBYSxJQUFiLENBRHdCO0FBRXhCLGdCQUFJLGdCQUFnQixPQUFPLElBQVAsQ0FBWSxLQUFLLE9BQUwsQ0FBNUIsQ0FGb0I7QUFHeEIsZ0JBQUksY0FBYyxNQUFkLEVBQXNCO0FBQ3RCLHVCQUFPLElBQVAsQ0FBWSxLQUFLLFNBQUwsQ0FBZTtBQUN2Qiw0QkFBUSxXQUFSO0FBQ0EsMEJBQU0sYUFBTjtpQkFGUSxDQUFaLEVBRHNCO2FBQTFCOztBQU9BLGdCQUFJLG9CQUFvQixPQUFPLElBQVAsQ0FBWSxLQUFLLFdBQUwsQ0FBaEMsQ0FWb0I7QUFXeEIsZ0JBQUksa0JBQWtCLE1BQWxCLEVBQTBCO0FBQzFCLGtDQUFrQixPQUFsQixDQUEwQixVQUFTLENBQVQsRUFBWTtBQUNsQywyQkFBTyxJQUFQLENBQVksS0FBSyxTQUFMLENBQWU7QUFDdkIsZ0NBQVEscUJBQVI7QUFDQSw4QkFBTSxDQUFOO3FCQUZRLENBQVosRUFEa0M7aUJBQVosQ0FBMUIsQ0FEMEI7YUFBOUI7U0FYWSxDQUhXOztBQXdCM0IsZUFBTyxTQUFQLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixnQkFBSSxPQUFPLEtBQUssS0FBTCxDQUFXLE1BQU0sSUFBTixDQUFsQixDQUQyQjtBQUUvQixnQkFBSSxJQUFKLEVBQ0ksZUFBZSxJQUFmLEVBREo7U0FGZSxDQXhCUTs7QUE4QjNCLGVBQU8sT0FBUCxHQUFpQixZQUFXO0FBQ3hCLG9CQUFRLEdBQVIsQ0FBWSxRQUFaLEVBRHdCO0FBRXhCLGdCQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1oscUJBQUssS0FBTCxHQUFhLEtBQWIsQ0FEWTtBQUVaLHFCQUFLLE1BQUwsR0FBYyxlQUFkLENBRlk7YUFBaEI7U0FGYSxDQTlCVTtLQUFYLENBbkJPOztBQTBEM0IsU0FBSyxNQUFMLEdBQWMsZUFBZCxDQTFEMkI7Q0FBWDs7QUE2RHBCLGNBQWMsU0FBZCxDQUF3QixTQUF4QixHQUFvQyxVQUFTLElBQVQsRUFBZSxRQUFmLEVBQXlCO0FBQ3pELFNBQUssWUFBTCxDQUFrQixDQUFDLElBQUQsQ0FBbEIsRUFBMEIsUUFBMUIsRUFEeUQ7Q0FBekI7O0FBSXBDLGNBQWMsU0FBZCxDQUF3QixZQUF4QixHQUF1QyxVQUFTLEtBQVQsRUFBZ0IsUUFBaEIsRUFBMEI7QUFDN0QsUUFBSSxPQUFPLElBQVAsQ0FEeUQ7O0FBRzdELFFBQUksbUJBQW1CLEVBQW5CLENBSHlEO0FBSTdELFVBQU0sR0FBTixDQUFVLE9BQU8sWUFBUCxDQUFWLENBQStCLE9BQS9CLENBQXVDLFVBQVMsSUFBVCxFQUFlO0FBQ2xELFlBQUksVUFBVSxLQUFLLE9BQUwsQ0FBYSxJQUFiLENBQVYsQ0FEOEM7QUFFbEQsWUFBSSxPQUFKLEVBQWE7QUFDVCxvQkFBUSxTQUFSLENBQWtCLElBQWxCLENBQXVCLFFBQXZCLEVBRFM7U0FBYixNQUVPO0FBQ0gsaUJBQUssT0FBTCxDQUFhLElBQWIsSUFBcUIsRUFBRSxXQUFXLENBQUMsUUFBRCxDQUFYLEVBQXZCLENBREc7QUFFSCw2QkFBaUIsSUFBakIsQ0FBc0IsSUFBdEIsRUFGRztTQUZQO0tBRm1DLENBQXZDLENBSjZEOztBQWM3RCxRQUFJLGlCQUFpQixNQUFqQixFQUF5QjtBQUN6QixZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEsV0FBUjtBQUNBLHNCQUFNLGdCQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQURKO0NBZG1DOztBQXdCdkMsY0FBYyxTQUFkLENBQXdCLG1CQUF4QixHQUE4QyxVQUFTLElBQVQsRUFBZSxRQUFmLEVBQXlCO0FBQ25FLFFBQUksT0FBTyxJQUFQLENBRCtEO0FBRW5FLFdBQU8sT0FBTyxZQUFQLENBQW9CLElBQXBCLENBQVAsQ0FGbUU7O0FBSW5FLFFBQUksVUFBVSxLQUFLLFdBQUwsQ0FBaUIsSUFBakIsQ0FBVixDQUorRDtBQUtuRSxRQUFJLE9BQUosRUFBYTtBQUNULGdCQUFRLFNBQVIsQ0FBa0IsSUFBbEIsQ0FBdUIsUUFBdkIsRUFEUztLQUFiLE1BRU87QUFDSCxhQUFLLFdBQUwsQ0FBaUIsSUFBakIsSUFBeUIsRUFBRSxXQUFXLENBQUMsUUFBRCxDQUFYLEVBQTNCLENBREc7QUFFSCxZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEscUJBQVI7QUFDQSxzQkFBTSxJQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQUpKO0NBTDBDOztBQW1COUMsT0FBTyxPQUFQLEdBQWlCO0FBQ2IsbUJBQWUsYUFBZjtDQURKIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IG5ldyBzdHJlYW1fbWFuYWdlci5TdHJlYW1NYW5hZ2VyKCk7XG5cbiAgICBzZWxmLmFkZEZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG52YXIgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFwcFZpZXdNb2RlbDogQXBwVmlld01vZGVsLFxuICAgIGluaXRpYWxVc2VyOiBpbml0aWFsVXNlclxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTE9SID0gJyM3Nzc3NzcnO1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbiAgICB2YXIgcGFkID0gZnVuY3Rpb24obWluLCBpbnB1dCkge1xuICAgICAgICBpbnB1dCArPSAnJztcbiAgICAgICAgd2hpbGUgKGlucHV0Lmxlbmd0aCA8IG1pbilcbiAgICAgICAgICAgIGlucHV0ID0gJzAnICsgaW5wdXQ7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGRhdGUpIHtcbiAgICAgICAgaWYgKCFkYXRlKVxuICAgICAgICAgICAgcmV0dXJuICctJztcblxuICAgICAgICByZXR1cm4gbW9udGhzW2RhdGUuZ2V0TW9udGgoKV0gKyAnICcgKyBwYWQoMiwgZGF0ZS5nZXREYXRlKCkpICsgJywgJyArIGRhdGUuZ2V0RnVsbFllYXIoKSArICcgJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRIb3VycygpKSArICc6JyArIHBhZCgyLCBkYXRlLmdldE1pbnV0ZXMoKSkgKyAnLicgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0U2Vjb25kcygpKSArIHBhZCgzLCBkYXRlLmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICB9O1xufSgpKTtcblxuLyoqXG4gKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuY29sb3IgPSBrby5vYnNlcnZhYmxlKGNvbG9yKTtcbn07XG5cblN0YXR1c01vZGVsLmVtcHR5ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChERUZBVUxUX0NPTE9SKTtcbn07XG5cblN0YXR1c01vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoZGF0YSAmJiBkYXRhLmNvbG9yKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnZhbHVlID0ga28ub2JzZXJ2YWJsZSh2YWx1ZSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgICB9KTtcbn07XG5cbi8qKlxuICovXG5jb25zdCBQYXRoQ29tcG9uZW50ID0gZnVuY3Rpb24obmFtZSwgdXJpKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUoJy9zJyArIHVyaSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG5cbiAgICBzZWxmLnBhdGhDb21wb25lbnRzID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnN0IHBhdGhzID0gW107XG4gICAgICAgIHNlbGYudXJpKCkuc3BsaXQoJy8nKS5yZWR1Y2UoKHBhdGgsIGMpID0+IHtcbiAgICAgICAgICAgIHBhdGggKz0gJy8nICsgYztcbiAgICAgICAgICAgIHBhdGhzLnB1c2gobmV3IFBhdGhDb21wb25lbnQoYywgcGF0aCkpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sICcnKTtcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xuICAgIH0pO1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSwgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7XG4gICAgICAgIH0pKTtcbn07XG5cbi8qKlxuICovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiAqL1xuZXhwb3J0IGNvbnN0IENvbGxlY3Rpb24gPSBmdW5jdGlvbih1cmkpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi51cmkgPSBrby5vYnNlcnZhYmxlKHVyaSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZC51cmkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4udW5zaGlmdChjaGlsZCk7XG4gICAgfTtcbn07XG4iLCJcInVzZS1zdHJpY3RcIjtcblxuZXhwb3J0IGNvbnN0IHBhcnNlUXVlcnlTdHJpbmcgPSAocXVlcnlTdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcXVlcnlTdHJpbmcuc3Vic3RyKDEpLnNwbGl0KFwiJlwiKVxuICAgICAgICAucmVkdWNlKGZ1bmN0aW9uKGRpY3QsIGl0ZW0pIHtcbiAgICAgICAgICAgIHZhciBrdiA9IGl0ZW0uc3BsaXQoXCI9XCIpO1xuICAgICAgICAgICAgdmFyIGsgPSBrdlswXTtcbiAgICAgICAgICAgIHZhciB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KGt2WzFdKTtcbiAgICAgICAgICAgIGlmIChrIGluIGRpY3QpIGRpY3Rba10ucHVzaCh2KTsgZWxzZSBkaWN0W2tdID0gW3ZdO1xuICAgICAgICAgICAgcmV0dXJuIGRpY3Q7XG4gICAgICAgIH0sIHt9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRRdWVyeVN0cmluZyA9ICgpID0+IHtcbiAgICByZXR1cm4gcGFyc2VRdWVyeVN0cmluZyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbn07XG5cbmV4cG9ydCBjb25zdCBsb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgICBzZWxcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKVxuICAgICAgICAuY2hpbGRyZW4oJy5nbHlwaGljb24nKVxuICAgICAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG59O1xuXG5leHBvcnQgY29uc3QgdW5sb2NrQnV0dG9uID0gKHNlbCkgPT4ge1xuICAgIHNlbFxuICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgZmFsc2UpXG4gICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdnbHlwaGljb24tcmVmcmVzaCAgZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcbiIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuY29uc3QgYXBwbGljYXRpb25fbW9kZWwgPSByZXF1aXJlKCcuL2FwcGxpY2F0aW9uX21vZGVsJyk7XG5jb25zdCBzaGFyZWQgPSByZXF1aXJlKCcuL3NoYXJlZCcpO1xuXG52YXIgRmF2b3JpdGVTdGF0dXMgPSBPYmplY3QuZnJlZXplKHtcbiAgICBVbmtub3duOiAwLFxuICAgIE5vOiAxLFxuICAgIFllczogMixcbiAgICBIaWVyYXJjaGljYWw6IDNcbn0pO1xuXG52YXIgaXNIaWVyYXJjaGljYWwgPSBmdW5jdGlvbihwYXJlbnROYW1lLCB1cmkpIHtcbiAgICBwYXJlbnROYW1lID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXJlbnROYW1lKTtcbiAgICBpZiAocGFyZW50TmFtZSA9PT0gdXJpKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgIHZhciBpbmRleCA9IHVyaS5sYXN0SW5kZXhPZignLycpO1xuICAgIHJldHVybiAoaW5kZXggPj0gMCAmJiBwYXJlbnROYW1lID09PSB1cmkuc2xpY2UoMCwgaW5kZXgpKTtcbn07XG5cbnZhciBpc1Jvb3RTdHJlYW0gPSBmdW5jdGlvbih1cmkpIHtcbiAgICByZXR1cm4gKHVyaS5pbmRleE9mKCcvJykgPT09IC0xKTtcbn07XG5cbi8qKlxuICovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgc3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFwcGxpY2F0aW9uX21vZGVsLkFwcFZpZXdNb2RlbC5jYWxsKHRoaXMsIHVzZXIpO1xuXG4gICAgc2VsZi5zdHJlYW0gPSBrby5vYnNlcnZhYmxlKHN0cmVhbSk7XG4gICAgc2VsZi5xdWVyeSA9IGtvLm9ic2VydmFibGUoKTtcbiAgICBzZWxmLmZhdm9yaXRlID0ga28ub2JzZXJ2YWJsZShGYXZvcml0ZVN0YXR1cy5Vbmtub3duKTtcblxuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgbW9kZWxzLkNvbGxlY3Rpb24oc2VsZi5zdHJlYW0oKS51cmkoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdHJlYW0gPSBzZWxmLnN0cmVhbSgpO1xuICAgICAgICByZXR1cm4gKHN0cmVhbSA/IHN0cmVhbS5jb2xvcigpIDogbW9kZWxzLkRFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIGlmICghc2VsZi5zdHJlYW0oKSlcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtKG5ldyBtb2RlbHMuU3RyZWFtTW9kZWwoKSk7XG4gICAgICAgIHNlbGYuc3RyZWFtKCkuc2V0Q29sb3IoY29sb3IpO1xuICAgIH07XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbigpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNoaWxkcmVuKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYuZGVsZXRlU3RyZWFtID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlU3RyZWFtKGNoaWxkLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlQ2hpbGQoY2hpbGQudXJpKCkpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5pc1BhcmVudE93bmVyID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoISFzZWxmLnN0cmVhbSgpICYmIHN0cmVhbS5pc093bmVyKHNlbGYudXNlcigpKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkQnV0dG9uQ2xpY2sgPSBmdW5jdGlvbihjaGlsZCwgZXZlbnQpIHtcbiAgICAgICAgaWYgKGlzSGllcmFyY2hpY2FsKHNlbGYuc3RyZWFtKCkudXJpKCksIGNoaWxkLnVyaSgpKSkge1xuICAgICAgICAgICAgYm9vdGJveC5jb25maXJtKHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJBcmUgeW91IHN1cmU/XCIsXG4gICAgICAgICAgICAgICAgYW5pbWF0ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgY2xvc2VCdXR0b246IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiVGhpcyB3aWxsIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGlzIHN0cmVhbSBhbmQgYWxsIG9mIGl0cyBjaGlsZHJlbi5cIixcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZGVsZXRlU3RyZWFtKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVDaGlsZChzZWxmLnN0cmVhbSgpLmlkKCksIGNoaWxkLmlkKCkpLnVybCxcbiAgICAgICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbW92ZUNoaWxkKGNoaWxkLnVyaSgpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYub25DaGlsZFNlbGVjdGVkID0gKGNoaWxkKSA9PiB7XG4gICAgICAgIHNlbGYuc3RyZWFtKGNoaWxkKTtcbiAgICB9O1xufTtcblxuQXBwVmlld01vZGVsLnByb3RvdHlwZS5jaGVja0Zhdm9yaXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgc3RyZWFtIGlzIHRoZSB1c2VyJ3Mgcm9vdCBzdHJlYW0gb2YgYSBkaXJlY3QgY2hpbGQsIGl0IGNhbm5vdCBiZSBmYXZvcml0ZWQuXG4gICAgaWYgKHNlbGYuc3RyZWFtKCkuaWQoKSA9PT0gc2VsZi51c2VyKCkucm9vdFN0cmVhbSgpIHx8IGlzSGllcmFyY2hpY2FsKHNlbGYudXNlcigpLnVzZXJOYW1lKCksIHNlbGYuc3RyZWFtKCkudXJpKCkpKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuSGllcmFyY2hpY2FsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZChzZWxmLnVzZXIoKS5yb290U3RyZWFtKCksIHNlbGYuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbnZhciBpbml0aWFsU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFN0cmVhbURhdGEpO1xufTtcblxuLyoqXG4gICAgUmVkcmF3IHRoZSBmYXZpY29uIGZvciBhIGdpdmVuIHN0YXR1cy5cbiovXG52YXIgdXBkYXRlRmF2aWNvbiA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Zhdmljb24nKTtcblxuICAgIGNhbnZhcy53aWR0aCA9IGNhbnZhcy5oZWlnaHQgPSAxO1xuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHguZmlsbFN0eWxlID0gY29sb3I7XG4gICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgbGluay5ocmVmID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJyk7XG59O1xuXG4vKipcbiAqL1xudmFyIGVuYWJsZUZhdm9yaXRlQnV0dG9uID0gZnVuY3Rpb24oZXhpc3RpbmcpIHtcbiAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJylcbiAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpXG4gICAgICAgIC5wcm9wKCd0aXRsZScsIGV4aXN0aW5nID8gXCJSZW1vdmUgRmF2b3JpdGVcIiA6IFwiQWRkIEZhdm9yaXRlXCIpO1xuXG4gICAgaWYgKGV4aXN0aW5nKVxuICAgICAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xuICAgIGVsc2VcbiAgICAgICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcblxufTtcblxudmFyIGRpc2FibGVGYXZvcml0ZUJ1dHRvbiA9IGZ1bmN0aW9uKCkge1xuICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKVxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIHRydWUpO1xufTtcblxuLyoqXG4gKi9cbnZhciBoaWRlQ2hpbGRGb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCcnKTtcbiAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgIC5hZGRDbGFzcygnaGlkZGVuJylcbiAgICAgICAgLnRleHQoJycpO1xufTtcblxudmFyIGNyZWF0ZUNoaWxkU3RyZWFtID0gZnVuY3Rpb24obW9kZWwsIHN0cmVhbSwgdXNlciwgbmFtZSkge1xuICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uIHNwYW4nKVxuICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbiwgI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG5cbiAgICB2YXIgb25Db21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24gc3BhbicpXG4gICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24sICNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgfTtcblxuICAgIHZhciBnZXRFcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5kZXRhaWxzWydvYmoubmFtZSddKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIk5hbWUgaXMgaW52YWxpZC4gTXVzdCBiZSBiZXR3ZWVuIDEgYW5kIDY0IGxldHRlcnMgYW5kIG51bWJlcnMuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGUuZXJyb3IpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGUuZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gXCJBbiBlcnJvciBvY2N1cnJlZFwiO1xuICAgIH07XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlU3RyZWFtKCkudXJsLFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgdXJpOiBzdHJlYW0udXJpKCkgKyBcIi9cIiArIG5hbWVcbiAgICAgICAgfSksXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdoaWRkZW4nKVxuICAgICAgICAgICAgICAgIC50ZXh0KGdldEVycm9yKGUucmVzcG9uc2VKU09OKSk7XG5cbiAgICAgICAgICAgIG9uQ29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmFkZENoaWxkKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihyZXN1bHQpKTtcbiAgICAgICAgb25Db21wbGV0ZSgpO1xuICAgICAgICBoaWRlQ2hpbGRGb3JtKCk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqL1xudmFyIGFkZEZhdm9yaXRlID0gZnVuY3Rpb24obW9kZWwsIHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKSB7XG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQVVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUNyZWF0ZUNoaWxkKHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKS51cmwsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuVW5rbm93bik7XG4gICAgICAgIH1cbiAgICB9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5ZZXMpO1xuICAgIH0pO1xufTtcblxudmFyIHJlbW92ZUZhdm9yaXRlID0gZnVuY3Rpb24obW9kZWwsIHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKSB7XG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaURlbGV0ZUNoaWxkKHRhcmdldFN0cmVhbUlkLCBjaGlsZElkKS51cmwsXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuVW5rbm93bik7XG4gICAgICAgIH1cbiAgICB9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgfSk7XG59O1xuXG52YXIgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5ID0gZnVuY3Rpb24obW9kZWwsIHF1ZXJ5KSB7XG4gICAgJCgnLmxpc3QtbG9hZGluZycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcubm8tcmVzdWx0cycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGRyZW4obW9kZWwuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBxdWVyeTogcXVlcnlcbiAgICAgICAgfSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIG1vZGVsLnF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgbW9kZWwuY2hpbGRyZW4oKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG59O1xuXG5jb25zdCB1cGRhdGVTZWFyY2hSZXN1bHRzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICBjb25zdCBxdWVyeSA9ICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwoKTtcbiAgICByZXR1cm4gdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCBxdWVyeSk7XG59O1xuXG4vKipcbiAqL1xudmFyIHVwZGF0ZVN0cmVhbVRhZ3MgPSBmdW5jdGlvbihtb2RlbCwgdGFncykge1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuc2V0VGFncyhtb2RlbC5zdHJlYW0oKS5pZCgpKS51cmwsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHRhZ3MubWFwKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgXCJ0YWdcIjogeC52YWx1ZSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KSksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuc3RyZWFtKCkudGFncyhcbiAgICAgICAgICAgIHJlc3VsdC5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBtb2RlbHMuVGFnTW9kZWwodGFnLnRhZyk7XG4gICAgICAgICAgICB9KSk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAgICBDb252ZXJ0IGEgbGlzdCBvZiB0YWdzIHRvIGEgZWRpdGFibGUgc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuKi9cbnZhciB0YWdzVG9TdHJpbmcgPSBmdW5jdGlvbih0YWdzKSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCh0YWdzLCBmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC52YWx1ZSgpO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbignLCAnKTtcbn07XG5cbi8qKlxuICAgIENvbnZlcnQgYSBzdHJpbmcgdG8gYSBsaXN0IG9mIHRhZ3MuXG4qL1xudmFyIHN0cmluZ1RvVGFncyA9IGZ1bmN0aW9uKHRhZ3MpIHtcbiAgICByZXR1cm4gKHRhZ3MubWF0Y2goLyhbYS16QS1aMC05X1xcLSRdKSsvaWcpIHx8IFtdKS5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50cmltKCkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgRWRpdCB0aGUgc3RyZWFtJ3MgdGFncy5cbiovXG52YXIgZWRpdFRhZ3MgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyN0YWctaW5wdXQnKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpXG4gICAgICAgIC52YWwodGFnc1RvU3RyaW5nKG1vZGVsLnN0cmVhbSgpLnRhZ3MoKSkpO1xufTtcblxuLyoqXG4gICAgU2F2ZSB0aGUgZWRpdGVkIHRhZ3MuXG4qL1xudmFyIHNhdmVUYWdzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjdGFnLWlucHV0JykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcblxuICAgIHZhciB0YWdzID0gc3RyaW5nVG9UYWdzKCQoJyN0YWctaW5wdXQgaW5wdXQnKS52YWwoKSk7XG4gICAgdXBkYXRlU3RyZWFtVGFncyhtb2RlbCwgdGFncyk7XG59O1xuXG4vKipcbiAqL1xuJChmdW5jdGlvbigpIHtcbiAgICB2YXIgbW9kZWwgPSBuZXcgQXBwVmlld01vZGVsKFxuICAgICAgICBhcHBsaWNhdGlvbl9tb2RlbC5pbml0aWFsVXNlcigpLFxuICAgICAgICBpbml0aWFsU3RyZWFtKCkpO1xuXG4gICAgdmFyIHVwZGF0ZVN0YXR1cyA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdHJlYW0gPSBtb2RlbC5zdHJlYW0oKTtcbiAgICAgICAgaWYgKCFzdHJlYW0pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaVNldFN0cmVhbVN0YXR1cyhzdHJlYW0uaWQoKSkudXJsLFxuICAgICAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBjb2xvcjogY29sb3JcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG1vZGVsLnN0cmVhbSgpLnVwZGF0ZWQobmV3IERhdGUoKSk7XG4gICAgICAgIG1vZGVsLnNldENvbG9yKGNvbG9yKTtcbiAgICB9O1xuXG4gICAgdmFyIHN0YXR1c1BpY2tlciA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRDb2xvciA9IG1vZGVscy5ERUZBVUxUX0NPTE9SO1xuICAgICAgICB2YXIgcGlja2VkQ29sb3IgPSBtb2RlbHMuREVGQVVMVF9DT0xPUjtcbiAgICAgICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmUobW9kZWwuc3RyZWFtKCkudXJpKCksIHtcbiAgICAgICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50Q29sb3IgPSBtc2cuc3RhdHVzLmNvbG9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHN0YXR1c1BpY2tlciA9ICQoJy5zdGF0dXMtcGlja2VyJylcbiAgICAgICAgICAgIC5zcGVjdHJ1bSh7XG4gICAgICAgICAgICAgICAgc2hvd0lucHV0OiB0cnVlLFxuICAgICAgICAgICAgICAgIHNob3dQYWxldHRlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNob3dTZWxlY3Rpb25QYWxldHRlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHByZWZlcnJlZEZvcm1hdDogXCJoZXhcIixcbiAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2VLZXk6IFwiYmxvdHJlLnN0cmVhbS5zdGF0dXNQaWNrZXJcIlxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignc2hvdy5zcGVjdHJ1bScsIGZ1bmN0aW9uKGUsIGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgcGlja2VkQ29sb3IgPSBjdXJyZW50Q29sb3IgPSBjb2xvciArICcnO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignbW92ZS5zcGVjdHJ1bSBjaGFuZ2Uuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIG1vZGVsLnNldENvbG9yKGNvbG9yICsgJycpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5vbignaGlkZS5zcGVjdHJ1bScsIGZ1bmN0aW9uKGUsIGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgcGlja2VkQ29sb3IgPSBjb2xvciArICcnO1xuICAgICAgICAgICAgICAgIG1vZGVsLnNldENvbG9yKGN1cnJlbnRDb2xvcik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAkKCcuc3AtY2hvb3NlJylcbiAgICAgICAgICAgIC5vbignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB1cGRhdGVTdGF0dXMocGlja2VkQ29sb3IgKyAnJyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gc3RhdHVzUGlja2VyO1xuICAgIH0oKSk7XG5cbiAgICAkKCcuc3RhdHVzLXBpY2tlci1mb3JtJylcbiAgICAgICAgLm9uKCdzdWJtaXQnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB2YXIgY29sb3IgPSAkKHRoaXMpLmNoaWxkcmVuKCcuc3RhdHVzLXBpY2tlcicpLnZhbCgpO1xuICAgICAgICAgICAgdXBkYXRlU3RhdHVzKGNvbG9yKTtcbiAgICAgICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgY2hpbGQgZm9ybVxuICAgICQoJyNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgIC5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICB2YXIgaGlkZGVuID0gJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0JykuaGFzQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgdmFyIHRhcmdldCA9ICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uJyk7XG4gICAgICAgICAgICBpZiAoaGlkZGVuKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlQ2hpbGRTdHJlYW0obW9kZWwsIG1vZGVsLnN0cmVhbSgpLCBtb2RlbC51c2VyKCksICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCcpLnZhbCgpLnRyaW0oKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0Jykua2V5cHJlc3MoZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAxMykge1xuICAgICAgICAgICAgY3JlYXRlQ2hpbGRTdHJlYW0obW9kZWwsIG1vZGVsLnN0cmVhbSgpLCBtb2RlbC51c2VyKCksICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCcpLnZhbCgpLnRyaW0oKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24nKVxuICAgICAgICAub24oJ2NsaWNrJywgaGlkZUNoaWxkRm9ybSk7XG5cbiAgICAvLyBUYWcgZWRpdG9yXG4gICAgJCgnI2VkaXQtdGFncy1idXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIGVkaXRUYWdzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBzYXZlVGFncyhtb2RlbCk7XG4gICAgfSk7XG5cbiAgICAkKCcjdGFnLWlucHV0IGlucHV0Jykua2V5cHJlc3MoZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoZS5rZXlDb2RlID09PSAxMyAvKmVudGVyKi8gKSB7XG4gICAgICAgICAgICBzYXZlVGFncyhtb2RlbCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkIFNlYXJjaFxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovICkge1xuICAgICAgICAgICAgdXBkYXRlU2VhcmNoUmVzdWx0cyhtb2RlbCk7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkcmVuXG4gICAgdmFyIHF1ZXJ5ID0gc2hhcmVkLmdldFF1ZXJ5U3RyaW5nKCkucXVlcnk7XG4gICAgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCAocXVlcnkgfHwgJycpKTtcblxuICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbihtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBtb2RlbC5yZW1vdmVDaGlsZChtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIG1vZGVsLmFkZENoaWxkKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5yZW1vdmVDaGlsZChtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5jb2xvci5zdWJzY3JpYmUodXBkYXRlRmF2aWNvbik7XG5cbiAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuLnN1YnNjcmliZShmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHRzLmxlbmd0aClcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICB9KTtcblxuICAgIC8vIEZhdm9yaXRlIEJ1dHRvblxuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuXG4gICAgbW9kZWwuZmF2b3JpdGUuc3Vic2NyaWJlKGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICBzd2l0Y2ggKHN0YXR1cykge1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ZZXM6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKHRydWUpO1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ObzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5hYmxlRmF2b3JpdGVCdXR0b24oZmFsc2UpO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLmNoZWNrRmF2b3JpdGUoKTtcblxuXG4gICAgJCgnYnV0dG9uLnN0cmVhbS1mYXZvcml0ZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc3dpdGNoIChtb2RlbC5mYXZvcml0ZSgpKSB7XG4gICAgICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLlllczpcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVtb3ZlRmF2b3JpdGUobW9kZWwsIG1vZGVsLnVzZXIoKS5yb290U3RyZWFtKCksIG1vZGVsLnN0cmVhbSgpLmlkKCkpO1xuICAgICAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ObzpcbiAgICAgICAgICAgICAgICByZXR1cm4gYWRkRmF2b3JpdGUobW9kZWwsIG1vZGVsLnVzZXIoKS5yb290U3RyZWFtKCksIG1vZGVsLnN0cmVhbSgpLmlkKCkpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5tYW5hZ2VyLnN1YnNjcmliZShtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSkge1xuICAgICAgICAgICAgICAgIG1vZGVsLnNldENvbG9yKG1zZy5zdGF0dXMuY29sb3IpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN0cmVhbSgpLnVwZGF0ZWQobmV3IERhdGUobXNnLnN0YXR1cy5jcmVhdGVkKSk7XG4gICAgICAgICAgICAgICAgc3RhdHVzUGlja2VyLnNwZWN0cnVtKFwic2V0XCIsIG1zZy5zdGF0dXMuY29sb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnUGFyZW50QWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkgJiYgbXNnLnBhcmVudC51cmkgPT09IG1vZGVsLnVzZXIoKS51c2VyTmFtZSgpKVxuICAgICAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgICAgIH0sXG4gICAgICAgICdQYXJlbnRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpICYmIG1zZy5wYXJlbnQgPT09IG1vZGVsLnVzZXIoKS51c2VyTmFtZSgpKVxuICAgICAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICAgICAgfSxcbiAgICB9KTtcblxuICAgIGtvLmFwcGx5QmluZGluZ3MobW9kZWwpO1xufSk7XG4iLCJcInVzZSBzdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5cblxudmFyIHNvY2tldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VjdXJlID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JztcbiAgICByZXR1cm4gKHNlY3VyZSA/ICd3c3MnIDogJ3dzJykgKyAnOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICsgJy92MC93cyc7XG59O1xuXG4vKipcbiovXG52YXIgU3RyZWFtTWFuYWdlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnN0cmVhbXMgPSB7IH07XG4gICAgc2VsZi5jb2xsZWN0aW9ucyA9IHsgfTtcblxuICAgIHZhciBwcm9jZXNzTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBpZiAoIW1zZyB8fCAhbXNnLnR5cGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIHR5cGUgPSBtc2cudHlwZTtcbiAgICAgICAgdmFyIHRhcmdldCA9IChtc2cuc291cmNlID8gc2VsZi5jb2xsZWN0aW9uc1ttc2cuc291cmNlXSA6IHNlbGYuc3RyZWFtc1ttc2cuZnJvbV0pO1xuICAgICAgICAodGFyZ2V0ID8gdGFyZ2V0Lmxpc3RlbmVycyA6IFtdKS5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgIGlmICh4W3R5cGVdKVxuICAgICAgICAgICAgICAgIHhbdHlwZV0obXNnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcblxuICAgIHZhciBvcGVuV2Vic29ja2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHNvY2tldFBhdGgoKSk7XG5cbiAgICAgICAgc29ja2V0Lm9ub3BlbiA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIHRhcmdldFN0cmVhbXMgPSBPYmplY3Qua2V5cyhzZWxmLnN0cmVhbXMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldFN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB0YXJnZXRTdHJlYW1zXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0Q29sbGVjdGlvbnMgPSBPYmplY3Qua2V5cyhzZWxmLmNvbGxlY3Rpb25zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRDb2xsZWN0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb2xsZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ0b1wiOiB4XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIGlmIChkYXRhKVxuICAgICAgICAgICAgICAgIHByb2Nlc3NNZXNzYWdlKGRhdGEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVvcGVuJyk7XG4gICAgICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHRoaXMuc3Vic2NyaWJlQWxsKFtwYXRoXSwgY2FsbGJhY2spO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQWxsID0gZnVuY3Rpb24ocGF0aHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIG5ld1N1YnNjcmlwdGlvbnMgPSBbXTtcbiAgICBwYXRocy5tYXAobW9kZWxzLm5vcm1hbGl6ZVVyaSkuZm9yRWFjaChmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5zdHJlYW1zW3BhdGhdO1xuICAgICAgICBpZiAoY3VycmVudCkge1xuICAgICAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLnN0cmVhbXNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICAgICAgbmV3U3Vic2NyaXB0aW9ucy5wdXNoKHBhdGgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAobmV3U3Vic2NyaXB0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogbmV3U3Vic2NyaXB0aW9uc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHBhdGggPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhdGgpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdO1xuICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY29sbGVjdGlvbnNbcGF0aF0gPSB7IGxpc3RlbmVyczogW2NhbGxiYWNrXSB9O1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlQ29sbGVjdGlvblwiLFxuICAgICAgICAgICAgICAgIFwidG9cIjogcGF0aFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTdHJlYW1NYW5hZ2VyOiBTdHJlYW1NYW5hZ2VyXG59O1xuIl19
