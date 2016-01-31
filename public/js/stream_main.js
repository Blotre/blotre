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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCOzs7O0FBSU4sSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMs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QUZQO0tBRm1DLENBQXZDLENBSjZEOztBQWM3RCxRQUFJLGlCQUFpQixNQUFqQixFQUF5QjtBQUN6QixZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEsV0FBUjtBQUNBLHNCQUFNLGdCQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQURKO0NBZG1DOztBQXdCdkMsY0FBYyxTQUFkLENBQXdCLG1CQUF4QixHQUE4QyxVQUFTLElBQVQsRUFBZSxRQUFmLEVBQXlCO0FBQ25FLFFBQUksT0FBTyxJQUFQLENBRCtEO0FBRW5FLFdBQU8sT0FBTyxZQUFQLENBQW9CLElBQXBCLENBQVAsQ0FGbUU7O0FBSW5FLFFBQUksVUFBVSxLQUFLLFdBQUwsQ0FBaUIsSUFBakIsQ0FBVixDQUorRDtBQUtuRSxRQUFJLE9BQUosRUFBYTtBQUNULGdCQUFRLFNBQVIsQ0FBa0IsSUFBbEIsQ0FBdUIsUUFBdkIsRUFEUztLQUFiLE1BRU87QUFDSCxhQUFLLFdBQUwsQ0FBaUIsSUFBakIsSUFBeUIsRUFBRSxXQUFXLENBQUMsUUFBRCxDQUFYLEVBQTNCLENBREc7QUFFSCxZQUFJLEtBQUssS0FBTCxFQUFZO0FBQ1osaUJBQUssTUFBTCxDQUFZLElBQVosQ0FBaUIsS0FBSyxTQUFMLENBQWU7QUFDNUIsd0JBQVEscUJBQVI7QUFDQSxzQkFBTSxJQUFOO2FBRmEsQ0FBakIsRUFEWTtTQUFoQjtLQUpKO0NBTDBDOztBQW1COUMsT0FBTyxPQUFQLEdBQWlCO0FBQ2IsbUJBQWUsYUFBZjtDQURKIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlLXN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcbmNvbnN0IHN0cmVhbV9tYW5hZ2VyID0gcmVxdWlyZSgnLi9zdHJlYW1fbWFuYWdlcicpO1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgcGFnZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXIgPSBrby5vYnNlcnZhYmxlKHVzZXIpO1xuICAgIHNlbGYucGFnZSA9IGtvLm9ic2VydmFibGUocGFnZSk7XG4gICAgc2VsZi5mYXZvcml0ZXMgPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCkpKTtcblxuICAgIHNlbGYubWFuYWdlciA9IG5ldyBzdHJlYW1fbWFuYWdlci5TdHJlYW1NYW5hZ2VyKCk7XG5cbiAgICBzZWxmLmFkZEZhdm9yaXRlID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5mYXZvcml0ZXMoKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5mYXZvcml0ZXMoKS5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgIHJldHVybiB4LnVyaSgpID09PSBjaGlsZFVyaTtcbiAgICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBzdGF0dXMgdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmUodXNlci51c2VyTmFtZSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnVzZXIoKS5zdGF0dXMobmV3IG1vZGVscy5TdGF0dXNNb2RlbChtc2cuc3RhdHVzLmNvbG9yKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmICghdXNlciB8fCAhdXNlci5yb290U3RyZWFtKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbih1c2VyLnJvb3RTdHJlYW0oKSkudXJsLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcblxuICAgICAvLyBTdWJzY3JpYmUgdG8gdXNlciBjb2xsZWN0aW9uIHVwZGF0ZXNcbiAgICBzZWxmLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbih1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHZhciBleGlzdGluZ0NoaWxkID0gc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLmFkZEZhdm9yaXRlKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihtc2cuY2hpbGQpKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkUmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgc2VsZi5yZW1vdmVGYXZvcml0ZShtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG52YXIgaW5pdGlhbFVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlVzZXJNb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFVzZXJEYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFwcFZpZXdNb2RlbDogQXBwVmlld01vZGVsLFxuICAgIGluaXRpYWxVc2VyOiBpbml0aWFsVXNlclxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3Qgc2xpY2UgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmV4cG9ydCBjb25zdCAgREVGQVVMVF9DT0xPUiA9ICcjNzc3Nzc3JztcblxuLyoqXG4qL1xuZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVVyaSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiBkZWNvZGVVUkkodXJpKVxuICAgICAgICAudHJpbSgpXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKCcgJywgJy8nKTtcbn07XG5cbi8qKlxuICAgIFByZXR0eSBwcmludHMgYSBkYXRhLlxuKi9cbmV4cG9ydCBjb25zdCBkYXRlVG9EaXNwbGF5ID0gKGZ1bmN0aW9uKCl7XG4gICAgdmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuICAgIHZhciBwYWQgPSBmdW5jdGlvbihtaW4sIGlucHV0KSB7XG4gICAgICAgIGlucHV0ICs9ICcnO1xuICAgICAgICB3aGlsZSAoaW5wdXQubGVuZ3RoIDwgbWluKVxuICAgICAgICAgICAgaW5wdXQgPSAnMCcgKyBpbnB1dDtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oZGF0ZSkge1xuICAgICAgICBpZiAoIWRhdGUpXG4gICAgICAgICAgICByZXR1cm4gJy0nO1xuXG4gICAgICAgIHJldHVybiBtb250aHNbZGF0ZS5nZXRNb250aCgpXSArICcgJyArIHBhZCgyLCBkYXRlLmdldERhdGUoKSkgKyAnLCAnICsgZGF0ZS5nZXRGdWxsWWVhcigpICsgJyAnICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldEhvdXJzKCkpICsgJzonICsgcGFkKDIsIGRhdGUuZ2V0TWludXRlcygpKSArICcuJyArXG4gICAgICAgICAgICBwYWQoMiwgZGF0ZS5nZXRTZWNvbmRzKCkpICsgcGFkKDMsIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIH07XG59KCkpO1xuXG4vKipcbiovXG5leHBvcnQgY29uc3QgU3RhdHVzTW9kZWwgPSBmdW5jdGlvbihjb2xvcikge1xuICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgc2VsZi5jb2xvciA9IGtvLm9ic2VydmFibGUoY29sb3IpO1xufTtcblxuU3RhdHVzTW9kZWwuZW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKERFRkFVTFRfQ09MT1IpO1xufTtcblxuU3RhdHVzTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdGF0dXNNb2RlbChkYXRhICYmIGRhdGEuY29sb3IpO1xufTtcblxuLyoqXG4qL1xuZXhwb3J0IGNvbnN0IFRhZ01vZGVsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgIHZhciBzZWxmID0gdGhpcztcbiAgIHNlbGYudmFsdWUgPSBrby5vYnNlcnZhYmxlKHZhbHVlKTtcblxuICAgIHNlbGYudXJsID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRUYWcoc2VsZi52YWx1ZSgpKS51cmw7XG4gICB9KTtcbn07XG5cbi8qKlxuKi9cbmV4cG9ydCBjb25zdCBTdHJlYW1Nb2RlbCA9IGZ1bmN0aW9uKGlkLCBuYW1lLCB1cmksIHN0YXR1cywgdXBkYXRlZCwgdGFncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLmlkID0ga28ub2JzZXJ2YWJsZShpZCk7XG4gICAgc2VsZi5uYW1lID0ga28ub2JzZXJ2YWJsZShuYW1lIHx8ICcnKTtcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYudXBkYXRlZCA9IGtvLm9ic2VydmFibGUodXBkYXRlZCk7XG4gICAgc2VsZi50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KHRhZ3MgfHwgW10pO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbS5nZXRTdHJlYW0oc2VsZi51cmkoKSkudXJsO1xuICAgIH0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpIHx8IFN0YXR1c01vZGVsLmVtcHR5KCk7XG4gICAgICAgIHN0YXR1cy5jb2xvcihjb2xvcik7XG4gICAgICAgIHNlbGYuc3RhdHVzKHN0YXR1cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZGlzcGxheVVwZGF0ZWQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGRhdGVUb0Rpc3BsYXkoc2VsZi51cGRhdGVkKCkpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5pc093bmVyID0gZnVuY3Rpb24odXNlcikge1xuICAgICAgICB2YXIgb3duZXJVcmkgPSBub3JtYWxpemVVcmkodXNlci51c2VyTmFtZSgpKTtcbiAgICAgICAgcmV0dXJuIChvd25lclVyaSA9PT0gc2VsZi51cmkoKSB8fCBzZWxmLnVyaSgpLmluZGV4T2Yob3duZXJVcmkgKyAnLycpID09PSAwKTtcbiAgICB9O1xufTtcblxuU3RyZWFtTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1Nb2RlbChcbiAgICAgICAgZGF0YSAmJiBkYXRhLmlkLFxuICAgICAgICBkYXRhICYmIGRhdGEubmFtZSxcbiAgICAgICAgZGF0YSAmJiBkYXRhLnVyaSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIG5ldyBEYXRlKGRhdGEgJiYgZGF0YS51cGRhdGVkKSxcbiAgICAgICAgKGRhdGEgJiYgZGF0YS50YWdzIHx8IFtdKS5tYXAoZnVuY3Rpb24oeCl7IHJldHVybiBuZXcgVGFnTW9kZWwoeC50YWcpOyB9KSk7XG59O1xuXG4vKipcbiovXG5leHBvcnQgY29uc3QgVXNlck1vZGVsID0gZnVuY3Rpb24odXNlck5hbWUsIHN0YXR1cywgcm9vdFN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVzZXJOYW1lID0ga28ub2JzZXJ2YWJsZSh1c2VyTmFtZSB8fCAnJyk7XG4gICAgc2VsZi5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKHN0YXR1cyB8fCBTdGF0dXNNb2RlbC5lbXB0eSgpKTtcbiAgICBzZWxmLnJvb3RTdHJlYW0gPSBrby5vYnNlcnZhYmxlKHJvb3RTdHJlYW0pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdHVzID0gc2VsZi5zdGF0dXMoKTtcbiAgICAgICAgcmV0dXJuIChzdGF0dXMgPyBzdGF0dXMuY29sb3IoKSA6IERFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xufTtcblxuVXNlck1vZGVsLmZyb21Kc29uID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHJldHVybiBuZXcgVXNlck1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEudXNlck5hbWUsXG4gICAgICAgIFN0YXR1c01vZGVsLmZyb21Kc29uKGRhdGEgJiYgZGF0YS5zdGF0dXMpLFxuICAgICAgICBkYXRhICYmIGRhdGEucm9vdFN0cmVhbSk7XG59O1xuXG4vKipcbiovXG5leHBvcnQgY29uc3QgQ29sbGVjdGlvbiA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnVyaSA9IGtvLm9ic2VydmFibGUodXJpKTtcbiAgICBzZWxmLmNoaWxkcmVuID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG5cbiAgICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgc2VsZi5jaGlsZHJlbi5yZW1vdmUoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkLnVyaSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2VsZi5jaGlsZHJlbi51bnNoaWZ0KGNoaWxkKTtcbiAgICB9O1xufTtcbiIsIlwidXNlLXN0cmljdFwiO1xuXG52YXIgcGFyc2VRdWVyeVN0cmluZyA9IGZ1bmN0aW9uKHF1ZXJ5U3RyaW5nKSB7XG4gICAgcmV0dXJuIHF1ZXJ5U3RyaW5nLnN1YnN0cigxKS5zcGxpdChcIiZcIilcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihkaWN0LCBpdGVtKSB7XG4gICAgICAgICAgICB2YXIga3YgPSBpdGVtLnNwbGl0KFwiPVwiKTtcbiAgICAgICAgICAgIHZhciBrID0ga3ZbMF07XG4gICAgICAgICAgICB2YXIgdiA9IGRlY29kZVVSSUNvbXBvbmVudChrdlsxXSk7XG4gICAgICAgICAgICBpZiAoayBpbiBkaWN0KSBkaWN0W2tdLnB1c2godik7IGVsc2UgZGljdFtrXSA9IFt2XTtcbiAgICAgICAgICAgIHJldHVybiBkaWN0O1xuICAgICAgICB9LCB7fSk7XG59O1xuXG52YXIgZ2V0UXVlcnlTdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gcGFyc2VRdWVyeVN0cmluZyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbn07XG5cbnZhciBsb2NrQnV0dG9uID0gZnVuY3Rpb24oc2VsKSB7XG4gICAgIHNlbFxuICAgICAgICAucHJvcChcImRpc2FibGVkXCIsIHRydWUpXG4gICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG5cbnZhciB1bmxvY2tCdXR0b24gPSBmdW5jdGlvbihzZWwpIHtcbiAgICBzZWxcbiAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgICdnZXRRdWVyeVN0cmluZyc6IGdldFF1ZXJ5U3RyaW5nLFxuICAgICdwYXJzZVF1ZXJ5U3RyaW5nJzogcGFyc2VRdWVyeVN0cmluZyxcblxuICAgICdsb2NrQnV0dG9uJzogbG9ja0J1dHRvbixcbiAgICAndW5sb2NrQnV0dG9uJzogdW5sb2NrQnV0dG9uXG59O1xuIiwiXCJ1c2Utc3RyaWN0XCI7XG5jb25zdCBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xuY29uc3Qgc3RyZWFtX21hbmFnZXIgPSByZXF1aXJlKCcuL3N0cmVhbV9tYW5hZ2VyJyk7XG5jb25zdCBhcHBsaWNhdGlvbl9tb2RlbCA9IHJlcXVpcmUoJy4vYXBwbGljYXRpb25fbW9kZWwnKTtcbmNvbnN0IHNoYXJlZCA9IHJlcXVpcmUoJy4vc2hhcmVkJyk7XG5cbnZhciBGYXZvcml0ZVN0YXR1cyA9IE9iamVjdC5mcmVlemUoe1xuICAgIFVua25vd246IDAsXG4gICAgTm86IDEsXG4gICAgWWVzOiAyLFxuICAgIEhpZXJhcmNoaWNhbDogM1xufSk7XG5cbnZhciBpc0hpZXJhcmNoaWNhbCA9IGZ1bmN0aW9uKHBhcmVudE5hbWUsIHVyaSkge1xuICAgIHBhcmVudE5hbWUgPSBtb2RlbHMubm9ybWFsaXplVXJpKHBhcmVudE5hbWUpO1xuICAgIGlmIChwYXJlbnROYW1lID09PSB1cmkpXG4gICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgdmFyIGluZGV4ID0gdXJpLmxhc3RJbmRleE9mKCcvJyk7XG4gICAgcmV0dXJuIChpbmRleCA+PSAwICYmIHBhcmVudE5hbWUgPT09IHVyaS5zbGljZSgwLCBpbmRleCkpO1xufTtcblxudmFyIGlzUm9vdFN0cmVhbSA9IGZ1bmN0aW9uKHVyaSkge1xuICAgIHJldHVybiAodXJpLmluZGV4T2YoJy8nKSA9PT0gLTEpO1xufTtcblxuLyoqXG4qL1xudmFyIEFwcFZpZXdNb2RlbCA9IGZ1bmN0aW9uKHVzZXIsIHN0cmVhbSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcblxuICAgIHNlbGYuc3RyZWFtID0ga28ub2JzZXJ2YWJsZShzdHJlYW0pO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlKG5ldyBtb2RlbHMuQ29sbGVjdGlvbihzdHJlYW0udXJpKCkpKTtcbiAgICBzZWxmLnF1ZXJ5ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHNlbGYuZmF2b3JpdGUgPSBrby5vYnNlcnZhYmxlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuXG4gICAgc2VsZi5jb2xvciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RyZWFtID0gc2VsZi5zdHJlYW0oKTtcbiAgICAgICAgcmV0dXJuIChzdHJlYW0gPyBzdHJlYW0uY29sb3IoKSA6IG1vZGVscy5ERUZBVUxUX0NPTE9SKTtcbiAgICB9KTtcblxuICAgIHNlbGYuc2V0Q29sb3IgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICBpZiAoIXNlbGYuc3RyZWFtKCkpXG4gICAgICAgICAgICBzZWxmLnN0cmVhbShuZXcgbW9kZWxzLlN0cmVhbU1vZGVsKCkpO1xuICAgICAgICBzZWxmLnN0cmVhbSgpLnNldENvbG9yKGNvbG9yKTtcbiAgICB9O1xuXG4gICAgc2VsZi5hZGRDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgIHNlbGYuY2hpbGRyZW4oKS5hZGRDaGlsZChjaGlsZCk7XG4gICAgfTtcblxuICAgIHNlbGYucmVtb3ZlQ2hpbGQgPSBmdW5jdGlvbihjaGlsZFVyaSkge1xuICAgICAgICByZXR1cm4gc2VsZi5jaGlsZHJlbigpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYuZGVsZXRlU3RyZWFtID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlU3RyZWFtKGNoaWxkLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgc2VsZi5yZW1vdmVDaGlsZChjaGlsZC51cmkoKSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLmlzUGFyZW50T3duZXIgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICAgIHJldHVybiAoISFzZWxmLnN0cmVhbSgpICYmIHN0cmVhbS5pc093bmVyKHNlbGYudXNlcigpKSk7XG4gICAgIH0pO1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZEJ1dHRvbkNsaWNrID0gZnVuY3Rpb24oY2hpbGQsIGV2ZW50KSB7XG4gICAgICAgIGlmIChpc0hpZXJhcmNoaWNhbChzZWxmLnN0cmVhbSgpLnVyaSgpLCBjaGlsZC51cmkoKSkpIHtcbiAgICAgICAgICAgIGJvb3Rib3guY29uZmlybSh7XG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiQXJlIHlvdSBzdXJlP1wiLFxuICAgICAgICAgICAgICAgIGFuaW1hdGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGNsb3NlQnV0dG9uOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIlRoaXMgd2lsbCBwZXJtYW5lbnRseSBkZWxldGUgdGhpcyBzdHJlYW0gYW5kIGFsbCBvZiBpdHMgY2hpbGRyZW4uXCIsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmRlbGV0ZVN0cmVhbShjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgICAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaURlbGV0ZUNoaWxkKHNlbGYuc3RyZWFtKCkuaWQoKSwgY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgc2VsZi5yZW1vdmVDaGlsZChjaGlsZC51cmkoKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLmNoaWxkU2VsZWN0ZWQgPSBmdW5jdGlvbihjaGlsZCkge1xuXG4gICAgfTtcbn07XG5cbkFwcFZpZXdNb2RlbC5wcm90b3R5cGUuY2hlY2tGYXZvcml0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYudXNlcigpLnVzZXJOYW1lKCkpXG4gICAgICAgIHJldHVybjtcblxuICAgIC8vIElmIHRoZSBjdXJyZW50IHN0cmVhbSBpcyB0aGUgdXNlcidzIHJvb3Qgc3RyZWFtIG9mIGEgZGlyZWN0IGNoaWxkLCBpdCBjYW5ub3QgYmUgZmF2b3JpdGVkLlxuICAgIGlmIChzZWxmLnN0cmVhbSgpLmlkKCkgPT09IHNlbGYudXNlcigpLnJvb3RTdHJlYW0oKSB8fCBpc0hpZXJhcmNoaWNhbChzZWxmLnVzZXIoKS51c2VyTmFtZSgpLCBzZWxmLnN0cmVhbSgpLnVyaSgpKSkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLkhpZXJhcmNoaWNhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpR2V0Q2hpbGQoc2VsZi51c2VyKCkucm9vdFN0cmVhbSgpLCBzZWxmLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbnZhciBpbml0aWFsU3RyZWFtID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbih3aW5kb3cuaW5pdGlhbFN0cmVhbURhdGEpO1xufTtcblxuLyoqXG4gICAgUmVkcmF3IHRoZSBmYXZpY29uIGZvciBhIGdpdmVuIHN0YXR1cy5cbiovXG52YXIgdXBkYXRlRmF2aWNvbiA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHZhciBsaW5rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Zhdmljb24nKTtcblxuICAgIGNhbnZhcy53aWR0aCA9IGNhbnZhcy5oZWlnaHQgPSAxO1xuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBjdHguZmlsbFN0eWxlID0gY29sb3I7XG4gICAgY3R4LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgbGluay5ocmVmID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJyk7XG59O1xuXG4vKipcbiovXG52YXIgZW5hYmxlRmF2b3JpdGVCdXR0b24gPSBmdW5jdGlvbihleGlzdGluZykge1xuICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKVxuICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSlcbiAgICAgICAgLnByb3AoJ3RpdGxlJywgZXhpc3RpbmcgPyBcIlJlbW92ZSBGYXZvcml0ZVwiIDogXCJBZGQgRmF2b3JpdGVcIik7XG5cbiAgICBpZiAoZXhpc3RpbmcpXG4gICAgICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKS5hZGRDbGFzcygnYWN0aXZlJyk7XG4gICAgZWxzZVxuICAgICAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xuXG59O1xuXG52YXIgZGlzYWJsZUZhdm9yaXRlQnV0dG9uID0gZnVuY3Rpb24oKSB7XG4gICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSk7XG59O1xuXG4vKipcbiovXG52YXIgaGlkZUNoaWxkRm9ybSA9IGZ1bmN0aW9uKCkge1xuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCcpLnZhbCgnJyk7XG4gICAgJCgnLmNyZWF0ZS1jaGlsZCAuZXJyb3InKVxuICAgICAgICAuYWRkQ2xhc3MoJ2hpZGRlbicpXG4gICAgICAgIC50ZXh0KCcnKTtcbn07XG5cbnZhciBjcmVhdGVDaGlsZFN0cmVhbSA9IGZ1bmN0aW9uKG1vZGVsLCBzdHJlYW0sIHVzZXIsIG5hbWUpIHtcbiAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbiBzcGFuJylcbiAgICAgICAgLmFkZENsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24sICNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgIC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xuXG4gICAgdmFyIG9uQ29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uIHNwYW4nKVxuICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdnbHlwaGljb24tcmVmcmVzaCBnbHlwaGljb24tcmVmcmVzaC1hbmltYXRlJyk7XG5cbiAgICAgICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24gYnV0dG9uLCAjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24nKVxuICAgICAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgIH07XG5cbiAgICB2YXIgZ2V0RXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICBpZiAoZS5kZXRhaWxzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUuZGV0YWlsc1snb2JqLm5hbWUnXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJOYW1lIGlzIGludmFsaWQuIE11c3QgYmUgYmV0d2VlbiAxIGFuZCA2NCBsZXR0ZXJzIGFuZCBudW1iZXJzLlwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlLmVycm9yKVxuICAgICAgICAgICAgICAgIHJldHVybiBlLmVycm9yO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFwiQW4gZXJyb3Igb2NjdXJyZWRcIjtcbiAgICB9O1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQVVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUNyZWF0ZVN0cmVhbSgpLnVybCxcbiAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgdXJpOiBzdHJlYW0udXJpKCkgKyBcIi9cIiArIG5hbWVcbiAgICAgICAgfSksXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdoaWRkZW4nKVxuICAgICAgICAgICAgICAgIC50ZXh0KGdldEVycm9yKGUucmVzcG9uc2VKU09OKSk7XG5cbiAgICAgICAgICAgIG9uQ29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmFkZENoaWxkKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbihyZXN1bHQpKTtcbiAgICAgICAgb25Db21wbGV0ZSgpO1xuICAgICAgICBoaWRlQ2hpbGRGb3JtKCk7XG4gICAgfSk7XG59O1xuXG4vKipcbiovXG52YXIgYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihtb2RlbCwgdGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpIHtcbiAgICBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlQ2hpbGQodGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpLnVybCxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Vbmtub3duKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlllcyk7XG4gICAgfSk7XG59O1xuXG52YXIgcmVtb3ZlRmF2b3JpdGUgPSBmdW5jdGlvbihtb2RlbCwgdGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpIHtcbiAgICBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkRFTEVURVwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlQ2hpbGQodGFyZ2V0U3RyZWFtSWQsIGNoaWxkSWQpLnVybCxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Vbmtub3duKTtcbiAgICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICB9KTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkgPSBmdW5jdGlvbihtb2RlbCwgcXVlcnkpIHtcbiAgICAkKCcubGlzdC1sb2FkaW5nJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiR0VUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZHJlbihtb2RlbC5zdHJlYW0oKS5pZCgpKS51cmwsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHF1ZXJ5OiBxdWVyeVxuICAgICAgICB9LFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICB9XG4gICAgfSkuZG9uZShmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgJCgnLmxpc3QtbG9hZGluZycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgbW9kZWwucXVlcnkocXVlcnkpO1xuICAgICAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuKChyZXN1bHQgfHwgW10pLm1hcChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24pKTtcbiAgICB9KTtcbn07XG5cbnZhciB1cGRhdGVTZWFyY2hSZXN1bHRzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICB2YXIgcXVlcnkgPSAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGlucHV0JykudmFsKCk7XG4gICAgcmV0dXJuIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeShtb2RlbCwgcXVlcnkpO1xufTtcblxuLyoqXG4qL1xudmFyIHVwZGF0ZVN0cmVhbVRhZ3MgPSBmdW5jdGlvbihtb2RlbCwgdGFncykge1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUE9TVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuc2V0VGFncyhtb2RlbC5zdHJlYW0oKS5pZCgpKS51cmwsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHRhZ3MubWFwKGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHsgXCJ0YWdcIjogeC52YWx1ZSgpIH07IH0pKSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZSkge1xuXG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBtb2RlbC5zdHJlYW0oKS50YWdzKFxuICAgICAgICAgICAgcmVzdWx0Lm1hcChmdW5jdGlvbih0YWcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IG1vZGVscy5UYWdNb2RlbCh0YWcudGFnKTtcbiAgICAgICAgICAgIH0pKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIENvbnZlcnQgYSBsaXN0IG9mIHRhZ3MgdG8gYSBlZGl0YWJsZSBzdHJpbmcgcmVwcmVzZW50YXRpb24uXG4qL1xudmFyIHRhZ3NUb1N0cmluZyA9IGZ1bmN0aW9uKHRhZ3MpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKHRhZ3MsIGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHgudmFsdWUoKTsgfSlcbiAgICAgICAgLmpvaW4oJywgJyk7XG59O1xuXG4vKipcbiAgICBDb252ZXJ0IGEgc3RyaW5nIHRvIGEgbGlzdCBvZiB0YWdzLlxuKi9cbnZhciBzdHJpbmdUb1RhZ3MgPSBmdW5jdGlvbih0YWdzKSB7XG4gICAgcmV0dXJuICh0YWdzLm1hdGNoKC8oW2EtekEtWjAtOV9cXC0kXSkrL2lnKSB8fCBbXSkubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgICByZXR1cm4gbmV3IG1vZGVscy5UYWdNb2RlbCh0YWcudHJpbSgpKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuICAgIEVkaXQgdGhlIHN0cmVhbSdzIHRhZ3MuXG4qL1xudmFyIGVkaXRUYWdzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcudGFnLWxpc3QnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG5cbiAgICAkKCcjdGFnLWlucHV0JylcbiAgICAgICAgLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyN0YWctaW5wdXQgaW5wdXQnKVxuICAgICAgICAudmFsKHRhZ3NUb1N0cmluZyhtb2RlbC5zdHJlYW0oKS50YWdzKCkpKTtcbn07XG5cbi8qKlxuICAgIFNhdmUgdGhlIGVkaXRlZCB0YWdzLlxuKi9cbnZhciBzYXZlVGFncyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgJCgnI3NhdmUtdGFncy1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2VkaXQtdGFncy1idXR0b24nKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI3RhZy1pbnB1dCcpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcudGFnLWxpc3QnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG5cbiAgICB2YXIgdGFncyA9IHN0cmluZ1RvVGFncygkKCcjdGFnLWlucHV0IGlucHV0JykudmFsKCkpO1xuICAgIHVwZGF0ZVN0cmVhbVRhZ3MobW9kZWwsIHRhZ3MpO1xufTtcblxuLyoqXG4qL1xuJChmdW5jdGlvbigpe1xuICAgIHZhciBtb2RlbCA9IG5ldyBBcHBWaWV3TW9kZWwoXG4gICAgICAgIGFwcGxpY2F0aW9uX21vZGVsLmluaXRpYWxVc2VyKCksXG4gICAgICAgIGluaXRpYWxTdHJlYW0oKSk7XG5cbiAgICB2YXIgdXBkYXRlU3RhdHVzID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0cmVhbSA9IG1vZGVsLnN0cmVhbSgpO1xuICAgICAgICBpZiAoIXN0cmVhbSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJQT1NUXCIsXG4gICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpU2V0U3RyZWFtU3RhdHVzKHN0cmVhbS5pZCgpKS51cmwsXG4gICAgICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGNvbG9yOiBjb2xvclxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbW9kZWwuc3RyZWFtKCkudXBkYXRlZChuZXcgRGF0ZSgpKTtcbiAgICAgICAgbW9kZWwuc2V0Q29sb3IoY29sb3IpO1xuICAgIH07XG5cbiAgICB2YXIgc3RhdHVzUGlja2VyID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY3VycmVudENvbG9yID0gbW9kZWxzLkRFRkFVTFRfQ09MT1I7XG4gICAgICAgIHZhciBwaWNrZWRDb2xvciA9IG1vZGVscy5ERUZBVUxUX0NPTE9SO1xuICAgICAgICBtb2RlbC5tYW5hZ2VyLnN1YnNjcmliZShtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRDb2xvciA9IG1zZy5zdGF0dXMuY29sb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgc3RhdHVzUGlja2VyID0gJCgnLnN0YXR1cy1waWNrZXInKVxuICAgICAgICAgICAgLnNwZWN0cnVtKHtcbiAgICAgICAgICAgICAgICBzaG93SW5wdXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd1BhbGV0dGU6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd1NlbGVjdGlvblBhbGV0dGU6IHRydWUsXG4gICAgICAgICAgICAgICAgcHJlZmVycmVkRm9ybWF0OiBcImhleFwiLFxuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZUtleTogXCJibG90cmUuc3RyZWFtLnN0YXR1c1BpY2tlclwiXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdzaG93LnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBwaWNrZWRDb2xvciA9IGN1cnJlbnRDb2xvciA9IGNvbG9yICsgJyc7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdtb3ZlLnNwZWN0cnVtIGNoYW5nZS5zcGVjdHJ1bScsIGZ1bmN0aW9uKGUsIGNvbG9yKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0Q29sb3IoY29sb3IgKyAnJyk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdoaWRlLnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBwaWNrZWRDb2xvciA9IGNvbG9yICsgJyc7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0Q29sb3IoY3VycmVudENvbG9yKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICQoJy5zcC1jaG9vc2UnKVxuICAgICAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZVN0YXR1cyhwaWNrZWRDb2xvciArICcnKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBzdGF0dXNQaWNrZXI7XG4gICAgfSgpKTtcblxuICAgICQoJy5zdGF0dXMtcGlja2VyLWZvcm0nKVxuICAgICAgICAub24oJ3N1Ym1pdCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHZhciBjb2xvciA9ICQodGhpcykuY2hpbGRyZW4oJy5zdGF0dXMtcGlja2VyJykudmFsKCk7XG4gICAgICAgICAgICB1cGRhdGVTdGF0dXMoY29sb3IpO1xuICAgICAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBjaGlsZCBmb3JtXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHZhciBoaWRkZW4gPSAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQnKS5oYXNDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24nKTtcbiAgICAgICAgICAgIGlmIChoaWRkZW4pIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVDaGlsZFN0cmVhbShtb2RlbCwgbW9kZWwuc3RyZWFtKCksIG1vZGVsLnVzZXIoKSwgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCkudHJpbSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzKSB7XG4gICAgICAgICAgICBjcmVhdGVDaGlsZFN0cmVhbShtb2RlbCwgbW9kZWwuc3RyZWFtKCksIG1vZGVsLnVzZXIoKSwgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCkudHJpbSgpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbicpXG4gICAgICAgIC5vbignY2xpY2snLCBoaWRlQ2hpbGRGb3JtKTtcblxuICAgIC8vIFRhZyBlZGl0b3JcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZWRpdFRhZ3MobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3NhdmUtdGFncy1idXR0b24nKS5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHNhdmVUYWdzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyN0YWctaW5wdXQgaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzIC8qZW50ZXIqLykge1xuICAgICAgICAgICAgc2F2ZVRhZ3MobW9kZWwpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDaGlsZCBTZWFyY2hcbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzIC8qZW50ZXIqLykge1xuICAgICAgICAgICAgdXBkYXRlU2VhcmNoUmVzdWx0cyhtb2RlbCk7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkcmVuXG4gICAgdmFyIHF1ZXJ5ID0gc2hhcmVkLmdldFF1ZXJ5U3RyaW5nKCkucXVlcnk7XG4gICAgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCAocXVlcnkgfHwgJycpKTtcblxuICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlQ29sbGVjdGlvbihtb2RlbC5zdHJlYW0oKS51cmkoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBtb2RlbC5yZW1vdmVDaGlsZChtc2cuZnJvbSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDaGlsZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBleGlzdGluZ0NoaWxkWzBdLnN0YXR1cyhtb2RlbHMuU3RhdHVzTW9kZWwuZnJvbUpzb24obXNnLnN0YXR1cykpO1xuICAgICAgICAgICAgICAgIG1vZGVsLmFkZENoaWxkKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5yZW1vdmVDaGlsZChtc2cuY2hpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBtb2RlbC5jb2xvci5zdWJzY3JpYmUodXBkYXRlRmF2aWNvbik7XG5cbiAgICBtb2RlbC5jaGlsZHJlbigpLmNoaWxkcmVuLnN1YnNjcmliZShmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHRzLmxlbmd0aClcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICB9KTtcblxuICAgIC8vIEZhdm9yaXRlIEJ1dHRvblxuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuXG4gICAgbW9kZWwuZmF2b3JpdGUuc3Vic2NyaWJlKGZ1bmN0aW9uKHN0YXR1cykge1xuICAgICAgICBzd2l0Y2ggKHN0YXR1cykge1xuICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLlllczpcbiAgICAgICAgICAgIHJldHVybiBlbmFibGVGYXZvcml0ZUJ1dHRvbih0cnVlKTtcbiAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ObzpcbiAgICAgICAgICAgIHJldHVybiBlbmFibGVGYXZvcml0ZUJ1dHRvbihmYWxzZSk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLmNoZWNrRmF2b3JpdGUoKTtcblxuXG4gICAgJCgnYnV0dG9uLnN0cmVhbS1mYXZvcml0ZScpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc3dpdGNoIChtb2RlbC5mYXZvcml0ZSgpKSB7XG4gICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuWWVzOlxuICAgICAgICAgICAgcmV0dXJuIHJlbW92ZUZhdm9yaXRlKG1vZGVsLCBtb2RlbC51c2VyKCkucm9vdFN0cmVhbSgpLCBtb2RlbC5zdHJlYW0oKS5pZCgpKTtcbiAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ObzpcbiAgICAgICAgICAgIHJldHVybiBhZGRGYXZvcml0ZShtb2RlbCwgbW9kZWwudXNlcigpLnJvb3RTdHJlYW0oKSwgbW9kZWwuc3RyZWFtKCkuaWQoKSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuc2V0Q29sb3IobXNnLnN0YXR1cy5jb2xvcik7XG4gICAgICAgICAgICAgICAgbW9kZWwuc3RyZWFtKCkudXBkYXRlZChuZXcgRGF0ZShtc2cuc3RhdHVzLmNyZWF0ZWQpKTtcbiAgICAgICAgICAgICAgICBzdGF0dXNQaWNrZXIuc3BlY3RydW0oXCJzZXRcIiwgbXNnLnN0YXR1cy5jb2xvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdQYXJlbnRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSAmJiBtc2cucGFyZW50LnVyaSA9PT0gbW9kZWwudXNlcigpLnVzZXJOYW1lKCkpXG4gICAgICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ1BhcmVudFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkgJiYgbXNnLnBhcmVudCA9PT0gbW9kZWwudXNlcigpLnVzZXJOYW1lKCkpXG4gICAgICAgICAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuTm8pO1xuICAgICAgICB9LFxuICAgIH0pO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTtcbiIsIlwidXNlIHN0cmljdFwiO1xuY29uc3QgbW9kZWxzID0gcmVxdWlyZSgnLi9tb2RlbHMnKTtcblxuXG52YXIgc29ja2V0UGF0aCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWN1cmUgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwczonO1xuICAgIHJldHVybiAoc2VjdXJlID8gJ3dzcycgOiAnd3MnKSArICc6Ly8nICsgd2luZG93LmxvY2F0aW9uLmhvc3QgKyAnL3YwL3dzJztcbn07XG5cbi8qKlxuKi9cbnZhciBTdHJlYW1NYW5hZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuc3RyZWFtcyA9IHsgfTtcbiAgICBzZWxmLmNvbGxlY3Rpb25zID0geyB9O1xuXG4gICAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICAgIGlmICghbXNnIHx8ICFtc2cudHlwZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB2YXIgdHlwZSA9IG1zZy50eXBlO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gKG1zZy5zb3VyY2UgPyBzZWxmLmNvbGxlY3Rpb25zW21zZy5zb3VyY2VdIDogc2VsZi5zdHJlYW1zW21zZy5mcm9tXSk7XG4gICAgICAgICh0YXJnZXQgPyB0YXJnZXQubGlzdGVuZXJzIDogW10pLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgaWYgKHhbdHlwZV0pXG4gICAgICAgICAgICAgICAgeFt0eXBlXShtc2cpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuXG4gICAgdmFyIG9wZW5XZWJzb2NrZXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoc29ja2V0UGF0aCgpKTtcblxuICAgICAgICBzb2NrZXQub25vcGVuID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0U3RyZWFtcyA9IE9iamVjdC5rZXlzKHNlbGYuc3RyZWFtcyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0U3RyZWFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZVwiLFxuICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHRhcmdldFN0cmVhbXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB0YXJnZXRDb2xsZWN0aW9ucyA9IE9iamVjdC5rZXlzKHNlbGYuY29sbGVjdGlvbnMpO1xuICAgICAgICAgICAgaWYgKHRhcmdldENvbGxlY3Rpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbGxlY3Rpb25zLmZvckVhY2goZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRvXCI6IHhcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgaWYgKGRhdGEpXG4gICAgICAgICAgICAgICAgcHJvY2Vzc01lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdyZW9wZW4nKTtcbiAgICAgICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnNvY2tldCA9IG9wZW5XZWJzb2NrZXQoKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKHBhdGgsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdWJzY3JpYmVBbGwoW3BhdGhdLCBjYWxsYmFjayk7XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVBbGwgPSBmdW5jdGlvbihwYXRocywgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgbmV3U3Vic2NyaXB0aW9ucyA9IFtdO1xuICAgIHBhdGhzLm1hcChtb2RlbHMubm9ybWFsaXplVXJpKS5mb3JFYWNoKGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLnN0cmVhbXNbcGF0aF07XG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtc1twYXRoXSA9IHsgbGlzdGVuZXJzOiBbY2FsbGJhY2tdIH07XG4gICAgICAgICAgICBuZXdTdWJzY3JpcHRpb25zLnB1c2gocGF0aCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChuZXdTdWJzY3JpcHRpb25zLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VsZi5yZWFkeSkge1xuICAgICAgICAgICAgc2VsZi5zb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBuZXdTdWJzY3JpcHRpb25zXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5TdHJlYW1NYW5hZ2VyLnByb3RvdHlwZS5zdWJzY3JpYmVDb2xsZWN0aW9uID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcGF0aCA9IG1vZGVscy5ub3JtYWxpemVVcmkocGF0aCk7XG5cbiAgICB2YXIgY3VycmVudCA9IHNlbGYuY29sbGVjdGlvbnNbcGF0aF07XG4gICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgY3VycmVudC5saXN0ZW5lcnMucHVzaChjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5jb2xsZWN0aW9uc1twYXRoXSA9IHsgbGlzdGVuZXJzOiBbY2FsbGJhY2tdIH07XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVDb2xsZWN0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJ0b1wiOiBwYXRoXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIFN0cmVhbU1hbmFnZXI6IFN0cmVhbU1hbmFnZXJcbn07XG4iXX0=
