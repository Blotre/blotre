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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvYXBwbGljYXRpb25fbW9kZWwuanMiLCJjbGllbnQvanMvbW9kZWxzLmpzIiwiY2xpZW50L2pzL3NoYXJlZC5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFpbi5qcyIsImNsaWVudC9qcy9zdHJlYW1fbWFuYWdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCOzs7O0FBSU4sSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3BDLFFBQUksT0FBTyxJQUFQLENBRGdDO0FBRXBDLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUZvQztBQUdwQyxTQUFLLElBQUwsR0FBWSxHQUFHLFVBQUgsQ0FBYyxJQUFkLENBQVosQ0FIb0M7QUFJcEMsU0FBSyxTQUFMLEdBQWlCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLEtBQUssUUFBTCxFQUF0QixDQUFkLENBQWpCLENBSm9DOztBQU1wQyxTQUFLLE9BQUwsR0FBZSxJQUFJLGVBQWUsYUFBZixFQUFuQixDQU5vQzs7QUFRcEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsS0FBVCxFQUFnQjtBQUMvQixhQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsS0FBMUIsRUFEK0I7S0FBaEIsQ0FSaUI7O0FBWXBDLFNBQUssY0FBTCxHQUFzQixVQUFTLFFBQVQsRUFBbUI7QUFDckMsZUFBTyxLQUFLLFNBQUwsR0FBaUIsUUFBakIsQ0FBMEIsTUFBMUIsQ0FBaUMsVUFBUyxDQUFULEVBQVk7QUFDL0MsbUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR3QztTQUFaLENBQXhDLENBRHFDO0tBQW5COzs7QUFaYyxRQW1CcEMsQ0FBSyxPQUFMLENBQWEsU0FBYixDQUF1QixLQUFLLFFBQUwsRUFBdkIsRUFBd0M7QUFDcEMseUJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixpQkFBSyxJQUFMLEdBQVksTUFBWixDQUFtQixJQUFJLE9BQU8sV0FBUCxDQUFtQixJQUFJLE1BQUosQ0FBVyxLQUFYLENBQTFDLEVBRDJCO1NBQWQ7S0FEckIsRUFuQm9DOztBQXlCcEMsUUFBSSxDQUFDLElBQUQsSUFBUyxDQUFDLEtBQUssVUFBTCxFQUFELEVBQ1QsT0FESjs7QUFHQSxNQUFFLElBQUYsQ0FBTztBQUNILGNBQU0sS0FBTjtBQUNBLGFBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxjQUF6QyxDQUF3RCxLQUFLLFVBQUwsRUFBeEQsRUFBMkUsR0FBM0U7QUFDTCxpQkFBUztBQUNMLG9CQUFRLGtCQUFSO1NBREo7QUFHQSxlQUFPLGVBQVMsQ0FBVCxFQUFZO0FBQUUsb0JBQVEsS0FBUixDQUFjLENBQWQsRUFBRjtTQUFaO0tBTlgsRUFPRyxJQVBILENBT1EsVUFBUyxNQUFULEVBQWlCO0FBQ3JCLGFBQUssU0FBTCxHQUFpQixRQUFqQixDQUEwQixDQUFDLFVBQVUsRUFBVixDQUFELENBQWUsR0FBZixDQUFtQixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBN0MsRUFEcUI7S0FBakIsQ0FQUjs7O0FBNUJvQyxRQXdDcEMsQ0FBSyxPQUFMLENBQWEsbUJBQWIsQ0FBaUMsS0FBSyxRQUFMLEVBQWpDLEVBQWtEO0FBQzlDLHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsZ0JBQUksZ0JBQWdCLEtBQUssY0FBTCxDQUFvQixJQUFJLElBQUosQ0FBcEMsQ0FEdUI7QUFFM0IsZ0JBQUksY0FBYyxNQUFkLEVBQXNCO0FBQ3RCLDhCQUFjLENBQWQsRUFBaUIsTUFBakIsQ0FBd0IsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksTUFBSixDQUFwRCxFQURzQjtBQUV0QixxQkFBSyxXQUFMLENBQWlCLGNBQWMsQ0FBZCxDQUFqQixFQUZzQjthQUExQjtTQUZhO0FBT2pCLHNCQUFjLG9CQUFTLEdBQVQsRUFBYztBQUN4QixpQkFBSyxXQUFMLENBQWlCLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE0QixJQUFJLEtBQUosQ0FBN0MsRUFEd0I7U0FBZDtBQUdkLHdCQUFnQixzQkFBUyxHQUFULEVBQWM7QUFDMUIsaUJBQUssY0FBTCxDQUFvQixJQUFJLEtBQUosQ0FBcEIsQ0FEMEI7U0FBZDtLQVhwQixFQXhDb0M7Q0FBckI7O0FBeURuQixJQUFJLGNBQWMsU0FBZCxXQUFjLEdBQVc7QUFDekIsV0FBTyxPQUFPLFNBQVAsQ0FBaUIsUUFBakIsQ0FBMEIsT0FBTyxlQUFQLENBQWpDLENBRHlCO0NBQVg7O0FBSWxCLE9BQU8sT0FBUCxHQUFpQjtBQUNiLGtCQUFjLFlBQWQ7QUFDQSxpQkFBYSxXQUFiO0NBRko7OztBQ25FQTs7Ozs7QUFDQSxJQUFNLFFBQVEsU0FBUyxTQUFULENBQW1CLElBQW5CLENBQXdCLElBQXhCLENBQTZCLE1BQU0sU0FBTixDQUFnQixLQUFoQixDQUFyQzs7QUFFQyxJQUFPLHdDQUFnQixTQUFoQjs7OztBQUlQLElBQU0sc0NBQWUsU0FBZixZQUFlLENBQVMsR0FBVCxFQUFjO0FBQ3RDLFdBQU8sVUFBVSxHQUFWLEVBQ0YsSUFERSxHQUVGLFdBRkUsR0FHRixPQUhFLENBR00sR0FITixFQUdXLEdBSFgsQ0FBUCxDQURzQztDQUFkOzs7OztBQVVyQixJQUFNLHdDQUFpQixZQUFVO0FBQ3BDLFFBQUksU0FBUyxDQUFDLEtBQUQsRUFBUSxLQUFSLEVBQWUsS0FBZixFQUFzQixLQUF0QixFQUE2QixLQUE3QixFQUFvQyxLQUFwQyxFQUEyQyxLQUEzQyxFQUFrRCxLQUFsRCxFQUF5RCxLQUF6RCxFQUFnRSxLQUFoRSxFQUF1RSxLQUF2RSxFQUE4RSxLQUE5RSxDQUFULENBRGdDOztBQUdwQyxRQUFJLE1BQU0sU0FBTixHQUFNLENBQVMsR0FBVCxFQUFjLEtBQWQsRUFBcUI7QUFDM0IsaUJBQVMsRUFBVCxDQUQyQjtBQUUzQixlQUFPLE1BQU0sTUFBTixHQUFlLEdBQWY7QUFDSCxvQkFBUSxNQUFNLEtBQU47U0FEWixPQUVPLEtBQVAsQ0FKMkI7S0FBckIsQ0FIMEI7O0FBVXBDLFdBQU8sVUFBUyxJQUFULEVBQWU7QUFDbEIsWUFBSSxDQUFDLElBQUQsRUFDQSxPQUFPLEdBQVAsQ0FESjs7QUFHQSxlQUFPLE9BQU8sS0FBSyxRQUFMLEVBQVAsSUFBMEIsR0FBMUIsR0FBZ0MsSUFBSSxDQUFKLEVBQU8sS0FBSyxPQUFMLEVBQVAsQ0FBaEMsR0FBeUQsSUFBekQsR0FBZ0UsS0FBSyxXQUFMLEVBQWhFLEdBQXFGLEdBQXJGLEdBQ0gsSUFBSSxDQUFKLEVBQU8sS0FBSyxRQUFMLEVBQVAsQ0FERyxHQUN1QixHQUR2QixHQUM2QixJQUFJLENBQUosRUFBTyxLQUFLLFVBQUwsRUFBUCxDQUQ3QixHQUN5RCxHQUR6RCxHQUVILElBQUksQ0FBSixFQUFPLEtBQUssVUFBTCxFQUFQLENBRkcsR0FFeUIsSUFBSSxDQUFKLEVBQU8sS0FBSyxlQUFMLEVBQVAsQ0FGekIsQ0FKVztLQUFmLENBVjZCO0NBQVYsRUFBakI7Ozs7QUFzQk4sSUFBTSxvQ0FBYyxTQUFkLFdBQWMsQ0FBUyxLQUFULEVBQWdCO0FBQ3hDLFFBQUksT0FBTyxJQUFQLENBRG9DO0FBRXhDLFNBQUssS0FBTCxHQUFhLEdBQUcsVUFBSCxDQUFjLEtBQWQsQ0FBYixDQUZ3QztDQUFoQjs7QUFLM0IsWUFBWSxLQUFaLEdBQW9CLFlBQVc7QUFDM0IsV0FBTyxJQUFJLFdBQUosQ0FBZ0IsYUFBaEIsQ0FBUCxDQUQyQjtDQUFYOztBQUlwQixZQUFZLFFBQVosR0FBdUIsVUFBUyxJQUFULEVBQWU7QUFDbEMsV0FBTyxJQUFJLFdBQUosQ0FBZ0IsUUFBUSxLQUFLLEtBQUwsQ0FBL0IsQ0FEa0M7Q0FBZjs7OztBQU1oQixJQUFNLDhCQUFXLFNBQVgsUUFBVyxDQUFTLEtBQVQsRUFBZ0I7QUFDckMsUUFBSSxPQUFPLElBQVAsQ0FEaUM7QUFFckMsU0FBSyxLQUFMLEdBQWEsR0FBRyxVQUFILENBQWMsS0FBZCxDQUFiLENBRnFDOztBQUlwQyxTQUFLLEdBQUwsR0FBVyxHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQy9CLGVBQU8sU0FBUyxXQUFULENBQXFCLE1BQXJCLENBQTRCLE1BQTVCLENBQW1DLEtBQUssS0FBTCxFQUFuQyxFQUFpRCxHQUFqRCxDQUR3QjtLQUFYLENBQXZCLENBSm9DO0NBQWhCOzs7O0FBV2pCLElBQU0sb0NBQWMsU0FBZCxXQUFjLENBQVMsRUFBVCxFQUFhLElBQWIsRUFBbUIsR0FBbkIsRUFBd0IsTUFBeEIsRUFBZ0MsT0FBaEMsRUFBeUMsSUFBekMsRUFBK0M7QUFDdEUsUUFBSSxPQUFPLElBQVAsQ0FEa0U7QUFFdEUsU0FBSyxFQUFMLEdBQVUsR0FBRyxVQUFILENBQWMsRUFBZCxDQUFWLENBRnNFO0FBR3RFLFNBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLFFBQVEsRUFBUixDQUExQixDQUhzRTtBQUl0RSxTQUFLLEdBQUwsR0FBVyxHQUFHLFVBQUgsQ0FBYyxPQUFPLEVBQVAsQ0FBekIsQ0FKc0U7QUFLdEUsU0FBSyxNQUFMLEdBQWMsR0FBRyxVQUFILENBQWMsVUFBVSxZQUFZLEtBQVosRUFBVixDQUE1QixDQUxzRTtBQU10RSxTQUFLLE9BQUwsR0FBZSxHQUFHLFVBQUgsQ0FBYyxPQUFkLENBQWYsQ0FOc0U7QUFPdEUsU0FBSyxJQUFMLEdBQVksR0FBRyxlQUFILENBQW1CLFFBQVEsRUFBUixDQUEvQixDQVBzRTs7QUFTdEUsU0FBSyxHQUFMLEdBQVcsR0FBRyxRQUFILENBQVksWUFBVztBQUM5QixlQUFPLFNBQVMsV0FBVCxDQUFxQixNQUFyQixDQUE0QixTQUE1QixDQUFzQyxLQUFLLEdBQUwsRUFBdEMsRUFBa0QsR0FBbEQsQ0FEdUI7S0FBWCxDQUF2QixDQVRzRTs7QUFhdEUsU0FBSyxLQUFMLEdBQWEsR0FBRyxRQUFILENBQVksWUFBVztBQUNoQyxZQUFJLFNBQVMsS0FBSyxNQUFMLEVBQVQsQ0FENEI7QUFFaEMsZUFBUSxTQUFTLE9BQU8sS0FBUCxFQUFULEdBQTBCLGFBQTFCLENBRndCO0tBQVgsQ0FBekIsQ0Fic0U7O0FBa0J0RSxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxLQUFULEVBQWdCO0FBQzVCLFlBQUksU0FBUyxLQUFLLE1BQUwsTUFBaUIsWUFBWSxLQUFaLEVBQWpCLENBRGU7QUFFNUIsZUFBTyxLQUFQLENBQWEsS0FBYixFQUY0QjtBQUc1QixhQUFLLE1BQUwsQ0FBWSxNQUFaLEVBSDRCO0tBQWhCLENBbEJzRDs7QUF3QnRFLFNBQUssY0FBTCxHQUFzQixHQUFHLFFBQUgsQ0FBWSxZQUFXO0FBQ3pDLGVBQU8sY0FBYyxLQUFLLE9BQUwsRUFBZCxDQUFQLENBRHlDO0tBQVgsQ0FBbEMsQ0F4QnNFOztBQTRCdEUsU0FBSyxPQUFMLEdBQWUsVUFBUyxJQUFULEVBQWU7QUFDMUIsWUFBSSxXQUFXLGFBQWEsS0FBSyxRQUFMLEVBQWIsQ0FBWCxDQURzQjtBQUUxQixlQUFRLGFBQWEsS0FBSyxHQUFMLEVBQWIsSUFBMkIsS0FBSyxHQUFMLEdBQVcsT0FBWCxDQUFtQixXQUFXLEdBQVgsQ0FBbkIsS0FBdUMsQ0FBdkMsQ0FGVDtLQUFmLENBNUJ1RDtDQUEvQzs7QUFrQzNCLFlBQVksUUFBWixHQUF1QixVQUFTLElBQVQsRUFBZTtBQUNsQyxXQUFPLElBQUksV0FBSixDQUNILFFBQVEsS0FBSyxFQUFMLEVBQ1IsUUFBUSxLQUFLLElBQUwsRUFDUixRQUFRLEtBQUssR0FBTCxFQUNSLFlBQVksUUFBWixDQUFxQixRQUFRLEtBQUssTUFBTCxDQUoxQixFQUtILElBQUksSUFBSixDQUFTLFFBQVEsS0FBSyxPQUFMLENBTGQsRUFNSCxDQUFDLFFBQVEsS0FBSyxJQUFMLElBQWEsRUFBckIsQ0FBRCxDQUEwQixHQUExQixDQUE4QixVQUFTLENBQVQsRUFBVztBQUFFLGVBQU8sSUFBSSxRQUFKLENBQWEsRUFBRSxHQUFGLENBQXBCLENBQUY7S0FBWCxDQU4zQixDQUFQLENBRGtDO0NBQWY7Ozs7QUFZaEIsSUFBTSxnQ0FBWSxTQUFaLFNBQVksQ0FBUyxRQUFULEVBQW1CLE1BQW5CLEVBQTJCLFVBQTNCLEVBQXVDO0FBQzVELFFBQUksT0FBTyxJQUFQLENBRHdEO0FBRTVELFNBQUssUUFBTCxHQUFnQixHQUFHLFVBQUgsQ0FBYyxZQUFZLEVBQVosQ0FBOUIsQ0FGNEQ7QUFHNUQsU0FBSyxNQUFMLEdBQWMsR0FBRyxVQUFILENBQWMsVUFBVSxZQUFZLEtBQVosRUFBVixDQUE1QixDQUg0RDtBQUk1RCxTQUFLLFVBQUwsR0FBa0IsR0FBRyxVQUFILENBQWMsVUFBZCxDQUFsQixDQUo0RDs7QUFNNUQsU0FBSyxLQUFMLEdBQWEsR0FBRyxRQUFILENBQVksWUFBVztBQUNoQyxZQUFJLFNBQVMsS0FBSyxNQUFMLEVBQVQsQ0FENEI7QUFFaEMsZUFBUSxTQUFTLE9BQU8sS0FBUCxFQUFULEdBQTBCLGFBQTFCLENBRndCO0tBQVgsQ0FBekIsQ0FONEQ7Q0FBdkM7O0FBWXpCLFVBQVUsUUFBVixHQUFxQixVQUFTLElBQVQsRUFBZTtBQUNoQyxXQUFPLElBQUksU0FBSixDQUNILFFBQVEsS0FBSyxRQUFMLEVBQ1IsWUFBWSxRQUFaLENBQXFCLFFBQVEsS0FBSyxNQUFMLENBRjFCLEVBR0gsUUFBUSxLQUFLLFVBQUwsQ0FIWixDQURnQztDQUFmOzs7O0FBU2QsSUFBTSxrQ0FBYSxTQUFiLFVBQWEsQ0FBUyxHQUFULEVBQWM7QUFDcEMsUUFBSSxPQUFPLElBQVAsQ0FEZ0M7QUFFcEMsU0FBSyxHQUFMLEdBQVcsR0FBRyxVQUFILENBQWMsR0FBZCxDQUFYLENBRm9DO0FBR3BDLFNBQUssUUFBTCxHQUFnQixHQUFHLGVBQUgsRUFBaEIsQ0FIb0M7O0FBS25DLFNBQUssUUFBTCxHQUFnQixVQUFTLEtBQVQsRUFBZ0I7QUFDOUIsYUFBSyxRQUFMLENBQWMsTUFBZCxDQUFxQixVQUFTLENBQVQsRUFBWTtBQUM1QixtQkFBTyxFQUFFLEdBQUYsT0FBWSxNQUFNLEdBQU4sRUFBWixDQURxQjtTQUFaLENBQXJCLENBRDhCO0FBSTdCLGFBQUssUUFBTCxDQUFjLE9BQWQsQ0FBc0IsS0FBdEIsRUFKNkI7S0FBaEIsQ0FMbUI7Q0FBZDs7OztBQ3BJMUI7Ozs7O0FBRU8sSUFBTSw4Q0FBbUIsU0FBbkIsZ0JBQW1CLENBQUMsV0FBRCxFQUFpQjtBQUM3QyxXQUFPLFlBQVksTUFBWixDQUFtQixDQUFuQixFQUFzQixLQUF0QixDQUE0QixHQUE1QixFQUNGLE1BREUsQ0FDSyxVQUFTLElBQVQsRUFBZSxJQUFmLEVBQXFCO0FBQ3pCLFlBQUksS0FBSyxLQUFLLEtBQUwsQ0FBVyxHQUFYLENBQUwsQ0FEcUI7QUFFekIsWUFBSSxJQUFJLEdBQUcsQ0FBSCxDQUFKLENBRnFCO0FBR3pCLFlBQUksSUFBSSxtQkFBbUIsR0FBRyxDQUFILENBQW5CLENBQUosQ0FIcUI7QUFJekIsWUFBSSxLQUFLLElBQUwsRUFBVyxLQUFLLENBQUwsRUFBUSxJQUFSLENBQWEsQ0FBYixFQUFmLEtBQXFDLEtBQUssQ0FBTCxJQUFVLENBQUMsQ0FBRCxDQUFWLENBQXJDO0FBQ0EsZUFBTyxJQUFQLENBTHlCO0tBQXJCLEVBTUwsRUFQQSxDQUFQLENBRDZDO0NBQWpCOztBQVd6QixJQUFNLDBDQUFpQixTQUFqQixjQUFpQixHQUFNO0FBQ2hDLFdBQU8saUJBQWlCLE9BQU8sUUFBUCxDQUFnQixNQUFoQixDQUF4QixDQURnQztDQUFOOztBQUl2QixJQUFNLGtDQUFhLFNBQWIsVUFBYSxDQUFDLEdBQUQsRUFBUztBQUM5QixRQUNJLElBREosQ0FDUyxVQURULEVBQ3FCLElBRHJCLEVBRUksUUFGSixDQUVhLFlBRmIsRUFHUSxRQUhSLENBR2lCLDZDQUhqQixFQUQ4QjtDQUFUOztBQU9uQixJQUFNLHNDQUFlLFNBQWYsWUFBZSxDQUFDLEdBQUQsRUFBUztBQUNqQyxRQUNJLElBREosQ0FDUyxVQURULEVBQ3FCLEtBRHJCLEVBRUksUUFGSixDQUVhLFlBRmIsRUFHUSxXQUhSLENBR29CLDhDQUhwQixFQURpQztDQUFUOzs7O0FDeEI1Qjs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7QUFDTixJQUFNLGlCQUFpQixRQUFRLGtCQUFSLENBQWpCO0FBQ04sSUFBTSxvQkFBb0IsUUFBUSxxQkFBUixDQUFwQjtBQUNOLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBVDs7QUFFTixJQUFJLGlCQUFpQixPQUFPLE1BQVAsQ0FBYztBQUMvQixhQUFTLENBQVQ7QUFDQSxRQUFJLENBQUo7QUFDQSxTQUFLLENBQUw7QUFDQSxrQkFBYyxDQUFkO0NBSmlCLENBQWpCOztBQU9KLElBQUksaUJBQWlCLFNBQWpCLGNBQWlCLENBQVMsVUFBVCxFQUFxQixHQUFyQixFQUEwQjtBQUMzQyxpQkFBYSxPQUFPLFlBQVAsQ0FBb0IsVUFBcEIsQ0FBYixDQUQyQztBQUUzQyxRQUFJLGVBQWUsR0FBZixFQUNBLE9BQU8sSUFBUCxDQURKOztBQUdBLFFBQUksUUFBUSxJQUFJLFdBQUosQ0FBZ0IsR0FBaEIsQ0FBUixDQUx1QztBQU0zQyxXQUFRLFNBQVMsQ0FBVCxJQUFjLGVBQWUsSUFBSSxLQUFKLENBQVUsQ0FBVixFQUFhLEtBQWIsQ0FBZixDQU5xQjtDQUExQjs7QUFTckIsSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLEdBQVQsRUFBYztBQUM3QixXQUFRLElBQUksT0FBSixDQUFZLEdBQVosTUFBcUIsQ0FBQyxDQUFELENBREE7Q0FBZDs7OztBQU1uQixJQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsSUFBVCxFQUFlLE1BQWYsRUFBdUI7QUFDdEMsUUFBSSxPQUFPLElBQVAsQ0FEa0M7QUFFdEMsc0JBQWtCLFlBQWxCLENBQStCLElBQS9CLENBQW9DLElBQXBDLEVBQTBDLElBQTFDLEVBRnNDOztBQUl0QyxTQUFLLE1BQUwsR0FBYyxHQUFHLFVBQUgsQ0FBYyxNQUFkLENBQWQsQ0FKc0M7QUFLdEMsU0FBSyxRQUFMLEdBQWdCLEdBQUcsVUFBSCxDQUFjLElBQUksT0FBTyxVQUFQLENBQWtCLE9BQU8sR0FBUCxFQUF0QixDQUFkLENBQWhCLENBTHNDO0FBTXRDLFNBQUssS0FBTCxHQUFhLEdBQUcsVUFBSCxFQUFiLENBTnNDO0FBT3RDLFNBQUssUUFBTCxHQUFnQixHQUFHLFVBQUgsQ0FBYyxlQUFlLE9BQWYsQ0FBOUIsQ0FQc0M7O0FBU3RDLFNBQUssS0FBTCxHQUFhLEdBQUcsUUFBSCxDQUFZLFlBQVc7QUFDaEMsWUFBSSxTQUFTLEtBQUssTUFBTCxFQUFULENBRDRCO0FBRWhDLGVBQVEsU0FBUyxPQUFPLEtBQVAsRUFBVCxHQUEwQixPQUFPLGFBQVAsQ0FGRjtLQUFYLENBQXpCLENBVHNDOztBQWN0QyxTQUFLLFFBQUwsR0FBZ0IsVUFBUyxLQUFULEVBQWdCO0FBQzVCLFlBQUksQ0FBQyxLQUFLLE1BQUwsRUFBRCxFQUNBLEtBQUssTUFBTCxDQUFZLElBQUksT0FBTyxXQUFQLEVBQWhCLEVBREo7QUFFQSxhQUFLLE1BQUwsR0FBYyxRQUFkLENBQXVCLEtBQXZCLEVBSDRCO0tBQWhCLENBZHNCOztBQW9CdEMsU0FBSyxRQUFMLEdBQWdCLFVBQVMsS0FBVCxFQUFnQjtBQUM1QixhQUFLLFFBQUwsR0FBZ0IsUUFBaEIsQ0FBeUIsS0FBekIsRUFENEI7S0FBaEIsQ0FwQnNCOztBQXdCdEMsU0FBSyxXQUFMLEdBQW1CLFVBQVMsUUFBVCxFQUFtQjtBQUNsQyxlQUFPLEtBQUssUUFBTCxHQUFnQixRQUFoQixDQUF5QixNQUF6QixDQUFnQyxVQUFTLENBQVQsRUFBWTtBQUM5QyxtQkFBTyxFQUFFLEdBQUYsT0FBWSxRQUFaLENBRHVDO1NBQVosQ0FBdkMsQ0FEa0M7S0FBbkIsQ0F4Qm1COztBQThCdEMsU0FBSyxZQUFMLEdBQW9CLFVBQVMsS0FBVCxFQUFnQjtBQUNoQyxVQUFFLElBQUYsQ0FBTztBQUNILGtCQUFNLFFBQU47QUFDQSxpQkFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGVBQXpDLENBQXlELE1BQU0sRUFBTixFQUF6RCxFQUFxRSxHQUFyRTtBQUNMLG1CQUFPLGVBQVMsQ0FBVCxFQUFZLEVBQVo7U0FIWCxFQU1HLElBTkgsQ0FNUSxZQUFXO0FBQ2hCLGlCQUFLLFdBQUwsQ0FBaUIsTUFBTSxHQUFOLEVBQWpCLEVBRGdCO1NBQVgsQ0FOUixDQURnQztLQUFoQixDQTlCa0I7O0FBMEN0QyxTQUFLLGFBQUwsR0FBcUIsR0FBRyxRQUFILENBQVksWUFBVztBQUN2QyxlQUFRLENBQUMsQ0FBQyxLQUFLLE1BQUwsRUFBRCxJQUFrQixPQUFPLE9BQVAsQ0FBZSxLQUFLLElBQUwsRUFBZixDQUFuQixDQUQrQjtLQUFYLENBQWpDLENBMUNzQzs7QUE4Q3RDLFNBQUssc0JBQUwsR0FBOEIsVUFBUyxLQUFULEVBQWdCLEtBQWhCLEVBQXVCO0FBQ2pELFlBQUksZUFBZSxLQUFLLE1BQUwsR0FBYyxHQUFkLEVBQWYsRUFBb0MsTUFBTSxHQUFOLEVBQXBDLENBQUosRUFBc0Q7QUFDbEQsb0JBQVEsT0FBUixDQUFnQjtBQUNaLHVCQUFPLGVBQVA7QUFDQSx5QkFBUyxLQUFUO0FBQ0EsNkJBQWEsS0FBYjtBQUNBLHlCQUFTLG1FQUFUO0FBQ0EsMEJBQVUsa0JBQVMsTUFBVCxFQUFpQjtBQUN2Qix3QkFBSSxNQUFKLEVBQVk7QUFDUiw2QkFBSyxZQUFMLENBQWtCLEtBQWxCLEVBRFE7cUJBQVo7aUJBRE07YUFMZCxFQURrRDtTQUF0RCxNQVlPO0FBQ0YsY0FBRSxJQUFGLENBQU87QUFDSixzQkFBTSxRQUFOO0FBQ0EscUJBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxjQUF6QyxDQUF3RCxLQUFLLE1BQUwsR0FBYyxFQUFkLEVBQXhELEVBQTRFLE1BQU0sRUFBTixFQUE1RSxFQUF3RixHQUF4RjtBQUNMLHVCQUFPLGVBQVMsQ0FBVCxFQUFZLEVBQVo7YUFIVixFQU1FLElBTkYsQ0FNTyxZQUFXO0FBQ2hCLHFCQUFLLFdBQUwsQ0FBaUIsTUFBTSxHQUFOLEVBQWpCLEVBRGdCO2FBQVgsQ0FOUCxDQURFO1NBWlA7S0FEMEIsQ0E5Q1E7O0FBd0V0QyxTQUFLLGFBQUwsR0FBcUIsVUFBUyxLQUFULEVBQWdCLEVBQWhCLENBeEVpQjtDQUF2Qjs7QUE2RW5CLGFBQWEsU0FBYixDQUF1QixhQUF2QixHQUF1QyxZQUFXO0FBQzlDLFFBQUksT0FBTyxJQUFQLENBRDBDO0FBRTlDLFFBQUksQ0FBQyxLQUFLLElBQUwsR0FBWSxRQUFaLEVBQUQsRUFDQSxPQURKOzs7QUFGOEMsUUFNMUMsS0FBSyxNQUFMLEdBQWMsRUFBZCxPQUF1QixLQUFLLElBQUwsR0FBWSxVQUFaLEVBQXZCLElBQW1ELGVBQWUsS0FBSyxJQUFMLEdBQVksUUFBWixFQUFmLEVBQXVDLEtBQUssTUFBTCxHQUFjLEdBQWQsRUFBdkMsQ0FBbkQsRUFBZ0g7QUFDaEgsYUFBSyxRQUFMLENBQWMsZUFBZSxZQUFmLENBQWQsQ0FEZ0g7S0FBcEgsTUFFTztBQUNILFVBQUUsSUFBRixDQUFPO0FBQ0gsa0JBQU0sS0FBTjtBQUNBLGlCQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsV0FBekMsQ0FBcUQsS0FBSyxJQUFMLEdBQVksVUFBWixFQUFyRCxFQUErRSxLQUFLLE1BQUwsR0FBYyxFQUFkLEVBQS9FLEVBQW1HLEdBQW5HO0FBQ0wsbUJBQU8sZUFBUyxDQUFULEVBQVk7QUFDZixvQkFBSSxFQUFFLE1BQUYsS0FBYSxHQUFiLEVBQWtCO0FBQ2xCLHlCQUFLLFFBQUwsQ0FBYyxlQUFlLEVBQWYsQ0FBZCxDQURrQjtpQkFBdEI7YUFERztTQUhYLEVBUUcsSUFSSCxDQVFRLFlBQVc7QUFDaEIsaUJBQUssUUFBTCxDQUFjLGVBQWUsR0FBZixDQUFkLENBRGdCO1NBQVgsQ0FSUixDQURHO0tBRlA7Q0FObUM7O0FBdUJ2QyxJQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLFdBQU8sT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLE9BQU8saUJBQVAsQ0FBbkMsQ0FEMkI7Q0FBWDs7Ozs7QUFPcEIsSUFBSSxnQkFBZ0IsU0FBaEIsYUFBZ0IsQ0FBUyxLQUFULEVBQWdCO0FBQ2hDLFFBQUksU0FBUyxTQUFTLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBVCxDQUQ0QjtBQUVoQyxRQUFJLE9BQU8sU0FBUyxjQUFULENBQXdCLFNBQXhCLENBQVAsQ0FGNEI7O0FBSWhDLFdBQU8sS0FBUCxHQUFlLE9BQU8sTUFBUCxHQUFnQixDQUFoQixDQUppQjtBQUtoQyxRQUFJLE1BQU0sT0FBTyxVQUFQLENBQWtCLElBQWxCLENBQU4sQ0FMNEI7QUFNaEMsUUFBSSxTQUFKLEdBQWdCLEtBQWhCLENBTmdDO0FBT2hDLFFBQUksUUFBSixDQUFhLENBQWIsRUFBZ0IsQ0FBaEIsRUFBbUIsT0FBTyxLQUFQLEVBQWMsT0FBTyxNQUFQLENBQWpDLENBUGdDO0FBUWhDLFNBQUssSUFBTCxHQUFZLE9BQU8sU0FBUCxDQUFpQixXQUFqQixDQUFaLENBUmdDO0NBQWhCOzs7O0FBYXBCLElBQUksdUJBQXVCLFNBQXZCLG9CQUF1QixDQUFTLFFBQVQsRUFBbUI7QUFDMUMsTUFBRSxrQkFBRixFQUNLLElBREwsQ0FDVSxVQURWLEVBQ3NCLEtBRHRCLEVBRUssSUFGTCxDQUVVLE9BRlYsRUFFbUIsV0FBVyxpQkFBWCxHQUErQixjQUEvQixDQUZuQixDQUQwQzs7QUFLMUMsUUFBSSxRQUFKLEVBQ0ksRUFBRSxrQkFBRixFQUFzQixRQUF0QixDQUErQixRQUEvQixFQURKLEtBR0ksRUFBRSxrQkFBRixFQUFzQixXQUF0QixDQUFrQyxRQUFsQyxFQUhKO0NBTHVCOztBQVkzQixJQUFJLHdCQUF3QixTQUF4QixxQkFBd0IsR0FBVztBQUNuQyxNQUFFLGtCQUFGLEVBQ0ssSUFETCxDQUNVLFVBRFYsRUFDc0IsSUFEdEIsRUFEbUM7Q0FBWDs7OztBQU81QixJQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFXO0FBQzNCLE1BQUUsdURBQUYsRUFBMkQsUUFBM0QsQ0FBb0UsUUFBcEUsRUFEMkI7QUFFM0IsTUFBRSxnQ0FBRixFQUFvQyxHQUFwQyxDQUF3QyxFQUF4QyxFQUYyQjtBQUczQixNQUFFLHNCQUFGLEVBQ0ssUUFETCxDQUNjLFFBRGQsRUFFSyxJQUZMLENBRVUsRUFGVixFQUgyQjtDQUFYOztBQVFwQixJQUFJLG9CQUFvQixTQUFwQixpQkFBb0IsQ0FBUyxLQUFULEVBQWdCLE1BQWhCLEVBQXdCLElBQXhCLEVBQThCLElBQTlCLEVBQW9DO0FBQ3hELE1BQUUsc0JBQUYsRUFBMEIsUUFBMUIsQ0FBbUMsUUFBbkMsRUFEd0Q7O0FBR3hELE1BQUUsa0NBQUYsRUFDSyxRQURMLENBQ2MsNkNBRGQsRUFId0Q7O0FBTXhELE1BQUUsaUdBQUYsRUFDSyxJQURMLENBQ1UsVUFEVixFQUNzQixJQUR0QixFQU53RDs7QUFTeEQsUUFBSSxhQUFhLFNBQWIsVUFBYSxHQUFXO0FBQ3hCLFVBQUUsa0NBQUYsRUFDSyxXQURMLENBQ2lCLDZDQURqQixFQUR3Qjs7QUFJeEIsVUFBRSxpR0FBRixFQUNLLElBREwsQ0FDVSxVQURWLEVBQ3NCLEtBRHRCLEVBSndCO0tBQVgsQ0FUdUM7O0FBaUJ4RCxRQUFJLFdBQVcsU0FBWCxRQUFXLENBQVMsQ0FBVCxFQUFZO0FBQ3ZCLFlBQUksQ0FBSixFQUFPO0FBQ0gsZ0JBQUksRUFBRSxPQUFGLEVBQVc7QUFDWCxvQkFBSSxFQUFFLE9BQUYsQ0FBVSxVQUFWLENBQUosRUFBMkI7QUFDdkIsMkJBQU8sZ0VBQVAsQ0FEdUI7aUJBQTNCO2FBREo7QUFLQSxnQkFBSSxFQUFFLEtBQUYsRUFDQSxPQUFPLEVBQUUsS0FBRixDQURYO1NBTko7O0FBVUEsZUFBTyxtQkFBUCxDQVh1QjtLQUFaLENBakJ5Qzs7QUErQnhELE1BQUUsSUFBRixDQUFPO0FBQ0gsY0FBTSxLQUFOO0FBQ0EsYUFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGVBQXpDLEdBQTJELEdBQTNEO0FBQ0wscUJBQWEsa0JBQWI7QUFDQSxjQUFNLEtBQUssU0FBTCxDQUFlO0FBQ25CLGtCQUFNLElBQU47QUFDQSxpQkFBSyxPQUFPLEdBQVAsS0FBZSxHQUFmLEdBQXFCLElBQXJCO1NBRkQsQ0FBTjtBQUlBLGVBQU8sZUFBUyxDQUFULEVBQVk7QUFDZixjQUFFLHNCQUFGLEVBQ0ssV0FETCxDQUNpQixRQURqQixFQUVLLElBRkwsQ0FFVSxTQUFTLEVBQUUsWUFBRixDQUZuQixFQURlOztBQUtmLHlCQUxlO1NBQVo7S0FSWCxFQWVHLElBZkgsQ0FlUSxVQUFTLE1BQVQsRUFBaUI7QUFDckIsY0FBTSxRQUFOLENBQWUsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLE1BQTVCLENBQWYsRUFEcUI7QUFFckIscUJBRnFCO0FBR3JCLHdCQUhxQjtLQUFqQixDQWZSLENBL0J3RDtDQUFwQzs7OztBQXVEeEIsSUFBSSxjQUFjLFNBQWQsV0FBYyxDQUFTLEtBQVQsRUFBZ0IsY0FBaEIsRUFBZ0MsT0FBaEMsRUFBeUM7QUFDdkQsNEJBRHVEO0FBRXZELE1BQUUsSUFBRixDQUFPO0FBQ0gsY0FBTSxLQUFOO0FBQ0EsYUFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGNBQXpDLENBQXdELGNBQXhELEVBQXdFLE9BQXhFLEVBQWlGLEdBQWpGO0FBQ0wsZUFBTyxlQUFTLE1BQVQsRUFBZ0I7QUFDbkIsa0JBQU0sUUFBTixDQUFlLGVBQWUsT0FBZixDQUFmLENBRG1CO1NBQWhCO0tBSFgsRUFNRyxJQU5ILENBTVEsVUFBUyxNQUFULEVBQWlCO0FBQ3JCLGNBQU0sUUFBTixDQUFlLGVBQWUsR0FBZixDQUFmLENBRHFCO0tBQWpCLENBTlIsQ0FGdUQ7Q0FBekM7O0FBYWxCLElBQUksaUJBQWlCLFNBQWpCLGNBQWlCLENBQVMsS0FBVCxFQUFnQixjQUFoQixFQUFnQyxPQUFoQyxFQUF5QztBQUMxRCw0QkFEMEQ7QUFFMUQsTUFBRSxJQUFGLENBQU87QUFDSCxjQUFNLFFBQU47QUFDQSxhQUFLLFNBQVMsV0FBVCxDQUFxQixtQkFBckIsQ0FBeUMsY0FBekMsQ0FBd0QsY0FBeEQsRUFBd0UsT0FBeEUsRUFBaUYsR0FBakY7QUFDTCxlQUFPLGVBQVMsT0FBVCxFQUFnQjtBQUNuQixrQkFBTSxRQUFOLENBQWUsZUFBZSxPQUFmLENBQWYsQ0FEbUI7U0FBaEI7S0FIWCxFQU1HLElBTkgsQ0FNUSxVQUFTLE1BQVQsRUFBaUI7QUFDckIsY0FBTSxRQUFOLENBQWUsZUFBZSxFQUFmLENBQWYsQ0FEcUI7S0FBakIsQ0FOUixDQUYwRDtDQUF6Qzs7QUFhckIsSUFBSSw4QkFBOEIsU0FBOUIsMkJBQThCLENBQVMsS0FBVCxFQUFnQixLQUFoQixFQUF1QjtBQUNyRCxNQUFFLGVBQUYsRUFBbUIsV0FBbkIsQ0FBK0IsUUFBL0IsRUFEcUQ7QUFFckQsTUFBRSxhQUFGLEVBQWlCLFFBQWpCLENBQTBCLFFBQTFCLEVBRnFEO0FBR3JELE1BQUUsSUFBRixDQUFPO0FBQ0gsY0FBTSxLQUFOO0FBQ0EsYUFBSyxTQUFTLFdBQVQsQ0FBcUIsbUJBQXJCLENBQXlDLGNBQXpDLENBQXdELE1BQU0sTUFBTixHQUFlLEVBQWYsRUFBeEQsRUFBNkUsR0FBN0U7QUFDTCxjQUFNO0FBQ0YsbUJBQU8sS0FBUDtTQURKO0FBR0EsaUJBQVM7QUFDTCxvQkFBUSxrQkFBUjtTQURKO0FBR0EsZUFBTyxlQUFTLENBQVQsRUFBWTtBQUNmLGNBQUUsZUFBRixFQUFtQixRQUFuQixDQUE0QixRQUE1QixFQURlO1NBQVo7S0FUWCxFQVlHLElBWkgsQ0FZUSxVQUFTLE1BQVQsRUFBaUI7QUFDckIsVUFBRSxlQUFGLEVBQW1CLFFBQW5CLENBQTRCLFFBQTVCLEVBRHFCO0FBRXJCLGNBQU0sS0FBTixDQUFZLEtBQVosRUFGcUI7QUFHckIsY0FBTSxRQUFOLEdBQWlCLFFBQWpCLENBQTBCLENBQUMsVUFBVSxFQUFWLENBQUQsQ0FBZSxHQUFmLENBQW1CLE9BQU8sV0FBUCxDQUFtQixRQUFuQixDQUE3QyxFQUhxQjtLQUFqQixDQVpSLENBSHFEO0NBQXZCOztBQXNCbEMsSUFBSSxzQkFBc0IsU0FBdEIsbUJBQXNCLENBQVMsS0FBVCxFQUFnQjtBQUN0QyxRQUFJLFFBQVEsRUFBRSwyQkFBRixFQUErQixHQUEvQixFQUFSLENBRGtDO0FBRXRDLFdBQU8sNEJBQTRCLEtBQTVCLEVBQW1DLEtBQW5DLENBQVAsQ0FGc0M7Q0FBaEI7Ozs7QUFPMUIsSUFBSSxtQkFBbUIsU0FBbkIsZ0JBQW1CLENBQVMsS0FBVCxFQUFnQixJQUFoQixFQUFzQjtBQUN6QyxNQUFFLElBQUYsQ0FBTztBQUNILGNBQU0sTUFBTjtBQUNBLGFBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxPQUF6QyxDQUFpRCxNQUFNLE1BQU4sR0FBZSxFQUFmLEVBQWpELEVBQXNFLEdBQXRFO0FBQ0wscUJBQWEsa0JBQWI7QUFDQSxjQUFNLEtBQUssU0FBTCxDQUFlLEtBQUssR0FBTCxDQUFTLFVBQVMsQ0FBVCxFQUFZO0FBQUUsbUJBQU8sRUFBRSxPQUFPLEVBQUUsS0FBRixFQUFQLEVBQVQsQ0FBRjtTQUFaLENBQXhCLENBQU47QUFDQSxpQkFBUztBQUNMLG9CQUFRLGtCQUFSO1NBREo7QUFHQSxlQUFPLGVBQVMsQ0FBVCxFQUFZLEVBQVo7S0FSWCxFQVdHLElBWEgsQ0FXUSxVQUFTLE1BQVQsRUFBaUI7QUFDckIsY0FBTSxNQUFOLEdBQWUsSUFBZixDQUNJLE9BQU8sR0FBUCxDQUFXLFVBQVMsR0FBVCxFQUFjO0FBQ3JCLG1CQUFPLElBQUksT0FBTyxRQUFQLENBQWdCLElBQUksR0FBSixDQUEzQixDQURxQjtTQUFkLENBRGYsRUFEcUI7S0FBakIsQ0FYUixDQUR5QztDQUF0Qjs7Ozs7QUF1QnZCLElBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxJQUFULEVBQWU7QUFDOUIsV0FBTyxNQUFNLFNBQU4sQ0FBZ0IsR0FBaEIsQ0FBb0IsSUFBcEIsQ0FBeUIsSUFBekIsRUFBK0IsVUFBUyxDQUFULEVBQVk7QUFBRSxlQUFPLEVBQUUsS0FBRixFQUFQLENBQUY7S0FBWixDQUEvQixDQUNGLElBREUsQ0FDRyxJQURILENBQVAsQ0FEOEI7Q0FBZjs7Ozs7QUFRbkIsSUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLElBQVQsRUFBZTtBQUM5QixXQUFPLENBQUMsS0FBSyxLQUFMLENBQVcsc0JBQVgsS0FBc0MsRUFBdEMsQ0FBRCxDQUEyQyxHQUEzQyxDQUErQyxVQUFTLEdBQVQsRUFBYztBQUNoRSxlQUFPLElBQUksT0FBTyxRQUFQLENBQWdCLElBQUksSUFBSixFQUFwQixDQUFQLENBRGdFO0tBQWQsQ0FBdEQsQ0FEOEI7Q0FBZjs7Ozs7QUFTbkIsSUFBSSxXQUFXLFNBQVgsUUFBVyxDQUFTLEtBQVQsRUFBZ0I7QUFDM0IsTUFBRSxtQkFBRixFQUF1QixXQUF2QixDQUFtQyxRQUFuQyxFQUQyQjtBQUUzQixNQUFFLG1CQUFGLEVBQXVCLFFBQXZCLENBQWdDLFFBQWhDLEVBRjJCO0FBRzNCLE1BQUUsV0FBRixFQUFlLFFBQWYsQ0FBd0IsUUFBeEIsRUFIMkI7O0FBSzNCLE1BQUUsWUFBRixFQUNLLFdBREwsQ0FDaUIsUUFEakIsRUFMMkI7O0FBUTNCLE1BQUUsa0JBQUYsRUFDSyxHQURMLENBQ1MsYUFBYSxNQUFNLE1BQU4sR0FBZSxJQUFmLEVBQWIsQ0FEVCxFQVIyQjtDQUFoQjs7Ozs7QUFlZixJQUFJLFdBQVcsU0FBWCxRQUFXLENBQVMsS0FBVCxFQUFnQjtBQUMzQixNQUFFLG1CQUFGLEVBQXVCLFFBQXZCLENBQWdDLFFBQWhDLEVBRDJCO0FBRTNCLE1BQUUsbUJBQUYsRUFBdUIsV0FBdkIsQ0FBbUMsUUFBbkMsRUFGMkI7QUFHM0IsTUFBRSxZQUFGLEVBQWdCLFFBQWhCLENBQXlCLFFBQXpCLEVBSDJCO0FBSTNCLE1BQUUsV0FBRixFQUFlLFdBQWYsQ0FBMkIsUUFBM0IsRUFKMkI7O0FBTTNCLFFBQUksT0FBTyxhQUFhLEVBQUUsa0JBQUYsRUFBc0IsR0FBdEIsRUFBYixDQUFQLENBTnVCO0FBTzNCLHFCQUFpQixLQUFqQixFQUF3QixJQUF4QixFQVAyQjtDQUFoQjs7OztBQVlmLEVBQUUsWUFBVTtBQUNSLFFBQUksUUFBUSxJQUFJLFlBQUosQ0FDUixrQkFBa0IsV0FBbEIsRUFEUSxFQUVSLGVBRlEsQ0FBUixDQURJOztBQUtSLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxLQUFULEVBQWdCO0FBQy9CLFlBQUksU0FBUyxNQUFNLE1BQU4sRUFBVCxDQUQyQjtBQUUvQixZQUFJLENBQUMsTUFBRCxFQUNBLE9BREo7O0FBR0EsVUFBRSxJQUFGLENBQU87QUFDSCxrQkFBTSxNQUFOO0FBQ0EsaUJBQUssU0FBUyxXQUFULENBQXFCLG1CQUFyQixDQUF5QyxrQkFBekMsQ0FBNEQsT0FBTyxFQUFQLEVBQTVELEVBQXlFLEdBQXpFO0FBQ0wseUJBQWEsa0JBQWI7QUFDQSxrQkFBTSxLQUFLLFNBQUwsQ0FBZTtBQUNqQix1QkFBTyxLQUFQO2FBREUsQ0FBTjtTQUpKLEVBTCtCOztBQWMvQixjQUFNLE1BQU4sR0FBZSxPQUFmLENBQXVCLElBQUksSUFBSixFQUF2QixFQWQrQjtBQWUvQixjQUFNLFFBQU4sQ0FBZSxLQUFmLEVBZitCO0tBQWhCLENBTFg7O0FBdUJSLFFBQUksZUFBZ0IsWUFBVztBQUMzQixZQUFJLGVBQWUsT0FBTyxhQUFQLENBRFE7QUFFM0IsWUFBSSxjQUFjLE9BQU8sYUFBUCxDQUZTO0FBRzNCLGNBQU0sT0FBTixDQUFjLFNBQWQsQ0FBd0IsTUFBTSxNQUFOLEdBQWUsR0FBZixFQUF4QixFQUE4QztBQUMxQyw2QkFBaUIsdUJBQVMsR0FBVCxFQUFjO0FBQzNCLG9CQUFJLElBQUksSUFBSixLQUFhLE1BQU0sTUFBTixHQUFlLEdBQWYsRUFBYixFQUFtQztBQUNuQyxtQ0FBZSxJQUFJLE1BQUosQ0FBVyxLQUFYLENBRG9CO2lCQUF2QzthQURhO1NBRHJCLEVBSDJCOztBQVczQixZQUFJLGVBQWUsRUFBRSxnQkFBRixFQUNkLFFBRGMsQ0FDTDtBQUNOLHVCQUFXLElBQVg7QUFDQSx5QkFBYSxJQUFiO0FBQ0Esa0NBQXNCLElBQXRCO0FBQ0EsNkJBQWlCLEtBQWpCO0FBQ0EsNkJBQWlCLDRCQUFqQjtTQU5XLEVBUWQsRUFSYyxDQVFYLGVBUlcsRUFRTSxVQUFTLENBQVQsRUFBWSxLQUFaLEVBQW1CO0FBQ3BDLDBCQUFjLGVBQWUsUUFBUSxFQUFSLENBRE87U0FBbkIsQ0FSTixDQVdkLEVBWGMsQ0FXWCwrQkFYVyxFQVdzQixVQUFTLENBQVQsRUFBWSxLQUFaLEVBQW1CO0FBQ3BELGtCQUFNLFFBQU4sQ0FBZSxRQUFRLEVBQVIsQ0FBZixDQURvRDtTQUFuQixDQVh0QixDQWNkLEVBZGMsQ0FjWCxlQWRXLEVBY00sVUFBUyxDQUFULEVBQVksS0FBWixFQUFtQjtBQUNwQywwQkFBYyxRQUFRLEVBQVIsQ0FEc0I7QUFFcEMsa0JBQU0sUUFBTixDQUFlLFlBQWYsRUFGb0M7U0FBbkIsQ0FkckIsQ0FYdUI7O0FBOEIzQixVQUFFLFlBQUYsRUFDSyxFQURMLENBQ1EsT0FEUixFQUNpQixZQUFXO0FBQ3BCLHlCQUFhLGNBQWMsRUFBZCxDQUFiLENBRG9CO1NBQVgsQ0FEakIsQ0E5QjJCOztBQW1DM0IsZUFBTyxZQUFQLENBbkMyQjtLQUFYLEVBQWhCLENBdkJJOztBQTZEUixNQUFFLHFCQUFGLEVBQ0ssRUFETCxDQUNRLFFBRFIsRUFDa0IsVUFBUyxDQUFULEVBQVk7QUFDdEIsVUFBRSxjQUFGLEdBRHNCO0FBRXRCLFlBQUksUUFBUSxFQUFFLElBQUYsRUFBUSxRQUFSLENBQWlCLGdCQUFqQixFQUFtQyxHQUFuQyxFQUFSLENBRmtCO0FBR3RCLHFCQUFhLEtBQWIsRUFIc0I7S0FBWixDQURsQjs7O0FBN0RRLEtBcUVSLENBQUUsNkJBQUYsRUFDSyxFQURMLENBQ1EsT0FEUixFQUNpQixVQUFTLENBQVQsRUFBWTtBQUNyQixZQUFJLFNBQVMsRUFBRSwwQkFBRixFQUE4QixRQUE5QixDQUF1QyxRQUF2QyxDQUFULENBRGlCO0FBRXJCLFlBQUksU0FBUyxFQUFFLHVEQUFGLENBQVQsQ0FGaUI7QUFHckIsWUFBSSxNQUFKLEVBQVk7QUFDUixtQkFBTyxXQUFQLENBQW1CLFFBQW5CLEVBRFE7U0FBWixNQUVPO0FBQ0gsOEJBQWtCLEtBQWxCLEVBQXlCLE1BQU0sTUFBTixFQUF6QixFQUF5QyxNQUFNLElBQU4sRUFBekMsRUFBdUQsRUFBRSxnQ0FBRixFQUFvQyxHQUFwQyxHQUEwQyxJQUExQyxFQUF2RCxFQURHO1NBRlA7S0FIUyxDQURqQixDQXJFUTs7QUFnRlIsTUFBRSwwQkFBRixFQUE4QixRQUE5QixDQUF1QyxVQUFTLENBQVQsRUFBWTtBQUMvQyxZQUFJLEVBQUUsT0FBRixLQUFjLEVBQWQsRUFBa0I7QUFDbEIsOEJBQWtCLEtBQWxCLEVBQXlCLE1BQU0sTUFBTixFQUF6QixFQUF5QyxNQUFNLElBQU4sRUFBekMsRUFBdUQsRUFBRSxnQ0FBRixFQUFvQyxHQUFwQyxHQUEwQyxJQUExQyxFQUF2RCxFQURrQjtTQUF0QjtLQURtQyxDQUF2QyxDQWhGUTs7QUFzRlIsTUFBRSxvQ0FBRixFQUNLLEVBREwsQ0FDUSxPQURSLEVBQ2lCLGFBRGpCOzs7QUF0RlEsS0EwRlIsQ0FBRSxtQkFBRixFQUF1QixFQUF2QixDQUEwQixPQUExQixFQUFtQyxVQUFTLENBQVQsRUFBWTtBQUMzQyxpQkFBUyxLQUFULEVBRDJDO0tBQVosQ0FBbkMsQ0ExRlE7O0FBOEZSLE1BQUUsbUJBQUYsRUFBdUIsRUFBdkIsQ0FBMEIsT0FBMUIsRUFBbUMsVUFBUyxDQUFULEVBQVk7QUFDM0MsaUJBQVMsS0FBVCxFQUQyQztLQUFaLENBQW5DLENBOUZROztBQWtHUixNQUFFLGtCQUFGLEVBQXNCLFFBQXRCLENBQStCLFVBQVMsQ0FBVCxFQUFZO0FBQ3ZDLFlBQUksRUFBRSxPQUFGLEtBQWMsRUFBZCxVQUFKLEVBQWdDO0FBQzVCLHlCQUFTLEtBQVQsRUFENEI7YUFBaEM7S0FEMkIsQ0FBL0I7OztBQWxHUSxLQXlHUixDQUFFLDRCQUFGLEVBQWdDLEVBQWhDLENBQW1DLE9BQW5DLEVBQTRDLFVBQVMsQ0FBVCxFQUFZO0FBQ3BELFVBQUUsY0FBRixHQURvRDtBQUVwRCw0QkFBb0IsS0FBcEIsRUFGb0Q7S0FBWixDQUE1QyxDQXpHUTs7QUE4R1IsTUFBRSwyQkFBRixFQUErQixRQUEvQixDQUF3QyxVQUFTLENBQVQsRUFBWTtBQUNoRCxZQUFJLEVBQUUsT0FBRixLQUFjLEVBQWQsVUFBSixFQUFnQztBQUM1QixvQ0FBb0IsS0FBcEIsRUFENEI7QUFFNUIsa0JBQUUsY0FBRixHQUY0QjthQUFoQztLQURvQyxDQUF4Qzs7O0FBOUdRLFFBc0hKLFFBQVEsT0FBTyxjQUFQLEdBQXdCLEtBQXhCLENBdEhKO0FBdUhSLGdDQUE0QixLQUE1QixFQUFvQyxTQUFTLEVBQVQsQ0FBcEMsQ0F2SFE7O0FBeUhSLFVBQU0sT0FBTixDQUFjLG1CQUFkLENBQWtDLE1BQU0sTUFBTixHQUFlLEdBQWYsRUFBbEMsRUFBd0Q7QUFDcEQseUJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixnQkFBSSxnQkFBZ0IsTUFBTSxXQUFOLENBQWtCLElBQUksSUFBSixDQUFsQyxDQUR1QjtBQUUzQixnQkFBSSxjQUFjLE1BQWQsRUFBc0I7QUFDdEIsOEJBQWMsQ0FBZCxFQUFpQixNQUFqQixDQUF3QixPQUFPLFdBQVAsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBSSxNQUFKLENBQXBELEVBRHNCO0FBRXRCLHNCQUFNLFFBQU4sQ0FBZSxjQUFjLENBQWQsQ0FBZixFQUZzQjthQUExQjtTQUZhO0FBT2pCLHNCQUFjLG9CQUFTLEdBQVQsRUFBYztBQUN4QixrQkFBTSxRQUFOLENBQWUsT0FBTyxXQUFQLENBQW1CLFFBQW5CLENBQTRCLElBQUksS0FBSixDQUEzQyxFQUR3QjtTQUFkO0FBR2Qsd0JBQWdCLHNCQUFTLEdBQVQsRUFBYztBQUMxQixrQkFBTSxXQUFOLENBQWtCLElBQUksS0FBSixDQUFsQixDQUQwQjtTQUFkO0tBWHBCLEVBekhROztBQXlJUixVQUFNLEtBQU4sQ0FBWSxTQUFaLENBQXNCLGFBQXRCLEVBeklROztBQTJJUixVQUFNLFFBQU4sR0FBaUIsUUFBakIsQ0FBMEIsU0FBMUIsQ0FBb0MsVUFBUyxPQUFULEVBQWtCO0FBQ2xELFlBQUksUUFBUSxNQUFSLEVBQ0EsRUFBRSxhQUFGLEVBQWlCLFFBQWpCLENBQTBCLFFBQTFCLEVBREosS0FHSSxFQUFFLGFBQUYsRUFBaUIsV0FBakIsQ0FBNkIsUUFBN0IsRUFISjtLQURnQyxDQUFwQzs7O0FBM0lRLHlCQW1KUixHQW5KUTs7QUFxSlIsVUFBTSxRQUFOLENBQWUsU0FBZixDQUF5QixVQUFTLE1BQVQsRUFBaUI7QUFDdEMsZ0JBQVEsTUFBUjtBQUNBLGlCQUFLLGVBQWUsR0FBZjtBQUNELHVCQUFPLHFCQUFxQixJQUFyQixDQUFQLENBREo7QUFEQSxpQkFHSyxlQUFlLEVBQWY7QUFDRCx1QkFBTyxxQkFBcUIsS0FBckIsQ0FBUCxDQURKO0FBSEE7QUFNSSx1QkFBTyx1QkFBUCxDQURKO0FBTEEsU0FEc0M7S0FBakIsQ0FBekIsQ0FySlE7O0FBZ0tSLFVBQU0sYUFBTixHQWhLUTs7QUFtS1IsTUFBRSx3QkFBRixFQUE0QixLQUE1QixDQUFrQyxVQUFTLENBQVQsRUFBWTtBQUMxQyxnQkFBUSxNQUFNLFFBQU4sRUFBUjtBQUNBLGlCQUFLLGVBQWUsR0FBZjtBQUNELHVCQUFPLGVBQWUsS0FBZixFQUFzQixNQUFNLElBQU4sR0FBYSxVQUFiLEVBQXRCLEVBQWlELE1BQU0sTUFBTixHQUFlLEVBQWYsRUFBakQsQ0FBUCxDQURKO0FBREEsaUJBR0ssZUFBZSxFQUFmO0FBQ0QsdUJBQU8sWUFBWSxLQUFaLEVBQW1CLE1BQU0sSUFBTixHQUFhLFVBQWIsRUFBbkIsRUFBOEMsTUFBTSxNQUFOLEdBQWUsRUFBZixFQUE5QyxDQUFQLENBREo7QUFIQSxTQUQwQztLQUFaLENBQWxDLENBbktROztBQTRLUixVQUFNLE9BQU4sQ0FBYyxTQUFkLENBQXdCLE1BQU0sTUFBTixHQUFlLEdBQWYsRUFBeEIsRUFBOEM7QUFDMUMseUJBQWlCLHVCQUFTLEdBQVQsRUFBYztBQUMzQixnQkFBSSxJQUFJLElBQUosS0FBYSxNQUFNLE1BQU4sR0FBZSxHQUFmLEVBQWIsRUFBbUM7QUFDbkMsc0JBQU0sUUFBTixDQUFlLElBQUksTUFBSixDQUFXLEtBQVgsQ0FBZixDQURtQztBQUVuQyxzQkFBTSxNQUFOLEdBQWUsT0FBZixDQUF1QixJQUFJLElBQUosQ0FBUyxJQUFJLE1BQUosQ0FBVyxPQUFYLENBQWhDLEVBRm1DO0FBR25DLDZCQUFhLFFBQWIsQ0FBc0IsS0FBdEIsRUFBNkIsSUFBSSxNQUFKLENBQVcsS0FBWCxDQUE3QixDQUhtQzthQUF2QztTQURhO0FBT2pCLHVCQUFlLHFCQUFTLEdBQVQsRUFBYztBQUN6QixnQkFBSSxJQUFJLElBQUosS0FBYSxNQUFNLE1BQU4sR0FBZSxHQUFmLEVBQWIsSUFBcUMsSUFBSSxNQUFKLENBQVcsR0FBWCxLQUFtQixNQUFNLElBQU4sR0FBYSxRQUFiLEVBQW5CLEVBQ3JDLE1BQU0sUUFBTixDQUFlLGVBQWUsR0FBZixDQUFmLENBREo7U0FEVztBQUlmLHlCQUFpQix1QkFBUyxHQUFULEVBQWM7QUFDM0IsZ0JBQUksSUFBSSxJQUFKLEtBQWEsTUFBTSxNQUFOLEdBQWUsR0FBZixFQUFiLElBQXFDLElBQUksTUFBSixLQUFlLE1BQU0sSUFBTixHQUFhLFFBQWIsRUFBZixFQUNyQyxNQUFNLFFBQU4sQ0FBZSxlQUFlLEVBQWYsQ0FBZixDQURKO1NBRGE7S0FackIsRUE1S1E7O0FBOExSLE9BQUcsYUFBSCxDQUFpQixLQUFqQixFQTlMUTtDQUFWLENBQUY7OztBQ2hXQTs7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQVQ7O0FBR04sSUFBSSxhQUFhLFNBQWIsVUFBYSxHQUFXO0FBQ3hCLFFBQUksU0FBUyxPQUFPLFFBQVAsQ0FBZ0IsUUFBaEIsS0FBNkIsUUFBN0IsQ0FEVztBQUV4QixXQUFPLENBQUMsU0FBUyxLQUFULEdBQWlCLElBQWpCLENBQUQsR0FBMEIsS0FBMUIsR0FBa0MsT0FBTyxRQUFQLENBQWdCLElBQWhCLEdBQXVCLFFBQXpELENBRmlCO0NBQVg7Ozs7QUFPakIsSUFBSSxnQkFBZ0IsU0FBaEIsYUFBZ0IsR0FBVztBQUMzQixRQUFJLE9BQU8sSUFBUCxDQUR1QjtBQUUzQixTQUFLLE9BQUwsR0FBZSxFQUFmLENBRjJCO0FBRzNCLFNBQUssV0FBTCxHQUFtQixFQUFuQixDQUgyQjs7QUFLM0IsUUFBSSxpQkFBaUIsU0FBakIsY0FBaUIsQ0FBUyxHQUFULEVBQWM7QUFDL0IsWUFBSSxDQUFDLEdBQUQsSUFBUSxDQUFDLElBQUksSUFBSixFQUNULE9BREo7O0FBR0EsWUFBSSxPQUFPLElBQUksSUFBSixDQUpvQjtBQUsvQixZQUFJLFNBQVUsSUFBSSxNQUFKLEdBQWEsS0FBSyxXQUFMLENBQWlCLElBQUksTUFBSixDQUE5QixHQUE0QyxLQUFLLE9BQUwsQ0FBYSxJQUFJLElBQUosQ0FBekQsQ0FMaUI7QUFNL0IsU0FBQyxTQUFTLE9BQU8sU0FBUCxHQUFtQixFQUE1QixDQUFELENBQWlDLE9BQWpDLENBQXlDLFVBQVMsQ0FBVCxFQUFZO0FBQ2pELGdCQUFJLEVBQUUsSUFBRixDQUFKLEVBQ0ksRUFBRSxJQUFGLEVBQVEsR0FBUixFQURKO1NBRHFDLENBQXpDLENBTitCO0tBQWQsQ0FMTTs7QUFpQjNCLFNBQUssS0FBTCxHQUFhLEtBQWIsQ0FqQjJCOztBQW1CM0IsUUFBSSxnQkFBZ0IsU0FBaEIsYUFBZ0IsR0FBVztBQUMzQixZQUFJLFNBQVMsSUFBSSxTQUFKLENBQWMsWUFBZCxDQUFULENBRHVCOztBQUczQixlQUFPLE1BQVAsR0FBZ0IsVUFBUyxDQUFULEVBQVk7QUFDeEIsaUJBQUssS0FBTCxHQUFhLElBQWIsQ0FEd0I7QUFFeEIsZ0JBQUksZ0JBQWdCLE9BQU8sSUFBUCxDQUFZLEtBQUssT0FBTCxDQUE1QixDQUZvQjtBQUd4QixnQkFBSSxjQUFjLE1BQWQsRUFBc0I7QUFDdEIsdUJBQU8sSUFBUCxDQUFZLEtBQUssU0FBTCxDQUFlO0FBQ3ZCLDRCQUFRLFdBQVI7QUFDQSwwQkFBTSxhQUFOO2lCQUZRLENBQVosRUFEc0I7YUFBMUI7O0FBT0EsZ0JBQUksb0JBQW9CLE9BQU8sSUFBUCxDQUFZLEtBQUssV0FBTCxDQUFoQyxDQVZvQjtBQVd4QixnQkFBSSxrQkFBa0IsTUFBbEIsRUFBMEI7QUFDMUIsa0NBQWtCLE9BQWxCLENBQTBCLFVBQVMsQ0FBVCxFQUFZO0FBQ2xDLDJCQUFPLElBQVAsQ0FBWSxLQUFLLFNBQUwsQ0FBZTtBQUN2QixnQ0FBUSxxQkFBUjtBQUNBLDhCQUFNLENBQU47cUJBRlEsQ0FBWixFQURrQztpQkFBWixDQUExQixDQUQwQjthQUE5QjtTQVhZLENBSFc7O0FBd0IzQixlQUFPLFNBQVAsR0FBbUIsVUFBUyxLQUFULEVBQWdCO0FBQy9CLGdCQUFJLE9BQU8sS0FBSyxLQUFMLENBQVcsTUFBTSxJQUFOLENBQWxCLENBRDJCO0FBRS9CLGdCQUFJLElBQUosRUFDSSxlQUFlLElBQWYsRUFESjtTQUZlLENBeEJROztBQThCM0IsZUFBTyxPQUFQLEdBQWlCLFlBQVc7QUFDeEIsb0JBQVEsR0FBUixDQUFZLFFBQVosRUFEd0I7QUFFeEIsZ0JBQUksS0FBSyxLQUFMLEVBQVk7QUFDWixxQkFBSyxLQUFMLEdBQWEsS0FBYixDQURZO0FBRVoscUJBQUssTUFBTCxHQUFjLGVBQWQsQ0FGWTthQUFoQjtTQUZhLENBOUJVO0tBQVgsQ0FuQk87O0FBMEQzQixTQUFLLE1BQUwsR0FBYyxlQUFkLENBMUQyQjtDQUFYOztBQTZEcEIsY0FBYyxTQUFkLENBQXdCLFNBQXhCLEdBQW9DLFVBQVMsSUFBVCxFQUFlLFFBQWYsRUFBeUI7QUFDekQsU0FBSyxZQUFMLENBQWtCLENBQUMsSUFBRCxDQUFsQixFQUEwQixRQUExQixFQUR5RDtDQUF6Qjs7QUFJcEMsY0FBYyxTQUFkLENBQXdCLFlBQXhCLEdBQXVDLFVBQVMsS0FBVCxFQUFnQixRQUFoQixFQUEwQjtBQUM3RCxRQUFJLE9BQU8sSUFBUCxDQUR5RDs7QUFHN0QsUUFBSSxtQkFBbUIsRUFBbkIsQ0FIeUQ7QUFJN0QsVUFBTSxHQUFOLENBQVUsT0FBTyxZQUFQLENBQVYsQ0FBK0IsT0FBL0IsQ0FBdUMsVUFBUyxJQUFULEVBQWU7QUFDbEQsWUFBSSxVQUFVLEtBQUssT0FBTCxDQUFhLElBQWIsQ0FBVixDQUQ4QztBQUVsRCxZQUFJLE9BQUosRUFBYTtBQUNULG9CQUFRLFNBQVIsQ0FBa0IsSUFBbEIsQ0FBdUIsUUFBdkIsRUFEUztTQUFiLE1BRU87QUFDSCxpQkFBSyxPQUFMLENBQWEsSUFBYixJQUFxQixFQUFFLFdBQVcsQ0FBQyxRQUFELENBQVgsRUFBdkIsQ0FERztBQUVILDZCQUFpQixJQUFqQixDQUFzQixJQUF0QixFQUZHO1NBRlA7S0FGbUMsQ0FBdkMsQ0FKNkQ7O0FBYzdELFFBQUksaUJBQWlCLE1BQWpCLEVBQXlCO0FBQ3pCLFlBQUksS0FBSyxLQUFMLEVBQVk7QUFDWixpQkFBSyxNQUFMLENBQVksSUFBWixDQUFpQixLQUFLLFNBQUwsQ0FBZTtBQUM1Qix3QkFBUSxXQUFSO0FBQ0Esc0JBQU0sZ0JBQU47YUFGYSxDQUFqQixFQURZO1NBQWhCO0tBREo7Q0FkbUM7O0FBd0J2QyxjQUFjLFNBQWQsQ0FBd0IsbUJBQXhCLEdBQThDLFVBQVMsSUFBVCxFQUFlLFFBQWYsRUFBeUI7QUFDbkUsUUFBSSxPQUFPLElBQVAsQ0FEK0Q7QUFFbkUsV0FBTyxPQUFPLFlBQVAsQ0FBb0IsSUFBcEIsQ0FBUCxDQUZtRTs7QUFJbkUsUUFBSSxVQUFVLEtBQUssV0FBTCxDQUFpQixJQUFqQixDQUFWLENBSitEO0FBS25FLFFBQUksT0FBSixFQUFhO0FBQ1QsZ0JBQVEsU0FBUixDQUFrQixJQUFsQixDQUF1QixRQUF2QixFQURTO0tBQWIsTUFFTztBQUNILGFBQUssV0FBTCxDQUFpQixJQUFqQixJQUF5QixFQUFFLFdBQVcsQ0FBQyxRQUFELENBQVgsRUFBM0IsQ0FERztBQUVILFlBQUksS0FBSyxLQUFMLEVBQVk7QUFDWixpQkFBSyxNQUFMLENBQVksSUFBWixDQUFpQixLQUFLLFNBQUwsQ0FBZTtBQUM1Qix3QkFBUSxxQkFBUjtBQUNBLHNCQUFNLElBQU47YUFGYSxDQUFqQixFQURZO1NBQWhCO0tBSko7Q0FMMEM7O0FBbUI5QyxPQUFPLE9BQVAsR0FBaUI7QUFDYixtQkFBZSxhQUFmO0NBREoiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Utc3RyaWN0XCI7XG5jb25zdCBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xuY29uc3Qgc3RyZWFtX21hbmFnZXIgPSByZXF1aXJlKCcuL3N0cmVhbV9tYW5hZ2VyJyk7XG5cbi8qKlxuKi9cbnZhciBBcHBWaWV3TW9kZWwgPSBmdW5jdGlvbih1c2VyLCBwYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5wYWdlID0ga28ub2JzZXJ2YWJsZShwYWdlKTtcbiAgICBzZWxmLmZhdm9yaXRlcyA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSkpO1xuXG4gICAgc2VsZi5tYW5hZ2VyID0gbmV3IHN0cmVhbV9tYW5hZ2VyLlN0cmVhbU1hbmFnZXIoKTtcblxuICAgIHNlbGYuYWRkRmF2b3JpdGUgPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBzZWxmLmZhdm9yaXRlcygpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZhdm9yaXRlcygpLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgcmV0dXJuIHgudXJpKCkgPT09IGNoaWxkVXJpO1xuICAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIHN0YXR1cyB1cGRhdGVzXG4gICAgc2VsZi5tYW5hZ2VyLnN1YnNjcmliZSh1c2VyLnVzZXJOYW1lKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYudXNlcigpLnN0YXR1cyhuZXcgbW9kZWxzLlN0YXR1c01vZGVsKG1zZy5zdGF0dXMuY29sb3IpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyIHx8ICF1c2VyLnJvb3RTdHJlYW0oKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKHVzZXIucm9vdFN0cmVhbSgpKS51cmwsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHsgY29uc29sZS5lcnJvcihlKTsgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGVzKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xuXG4gICAgIC8vIFN1YnNjcmliZSB0byB1c2VyIGNvbGxlY3Rpb24gdXBkYXRlc1xuICAgIHNlbGYubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKHVzZXIudXNlck5hbWUoKSwge1xuICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgc2VsZi5hZGRGYXZvcml0ZShleGlzdGluZ0NoaWxkWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ0NoaWxkQWRkZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIHNlbGYuYWRkRmF2b3JpdGUobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKG1zZy5jaGlsZCkpO1xuICAgICAgICB9LFxuICAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBzZWxmLnJlbW92ZUZhdm9yaXRlKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbnZhciBpbml0aWFsVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBtb2RlbHMuVXNlck1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsVXNlckRhdGEpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgQXBwVmlld01vZGVsOiBBcHBWaWV3TW9kZWwsXG4gICAgaW5pdGlhbFVzZXI6IGluaXRpYWxVc2VyXG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBzbGljZSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZXhwb3J0IGNvbnN0ICBERUZBVUxUX0NPTE9SID0gJyM3Nzc3NzcnO1xuXG4vKipcbiovXG5leHBvcnQgY29uc3Qgbm9ybWFsaXplVXJpID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSSh1cmkpXG4gICAgICAgIC50cmltKClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgICAgLnJlcGxhY2UoJyAnLCAnLycpO1xufTtcblxuLyoqXG4gICAgUHJldHR5IHByaW50cyBhIGRhdGEuXG4qL1xuZXhwb3J0IGNvbnN0IGRhdGVUb0Rpc3BsYXkgPSAoZnVuY3Rpb24oKXtcbiAgICB2YXIgbW9udGhzID0gWydKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYyddO1xuXG4gICAgdmFyIHBhZCA9IGZ1bmN0aW9uKG1pbiwgaW5wdXQpIHtcbiAgICAgICAgaW5wdXQgKz0gJyc7XG4gICAgICAgIHdoaWxlIChpbnB1dC5sZW5ndGggPCBtaW4pXG4gICAgICAgICAgICBpbnB1dCA9ICcwJyArIGlucHV0O1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihkYXRlKSB7XG4gICAgICAgIGlmICghZGF0ZSlcbiAgICAgICAgICAgIHJldHVybiAnLSc7XG5cbiAgICAgICAgcmV0dXJuIG1vbnRoc1tkYXRlLmdldE1vbnRoKCldICsgJyAnICsgcGFkKDIsIGRhdGUuZ2V0RGF0ZSgpKSArICcsICcgKyBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnICcgK1xuICAgICAgICAgICAgcGFkKDIsIGRhdGUuZ2V0SG91cnMoKSkgKyAnOicgKyBwYWQoMiwgZGF0ZS5nZXRNaW51dGVzKCkpICsgJy4nICtcbiAgICAgICAgICAgIHBhZCgyLCBkYXRlLmdldFNlY29uZHMoKSkgKyBwYWQoMywgZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgfTtcbn0oKSk7XG5cbi8qKlxuKi9cbmV4cG9ydCBjb25zdCBTdGF0dXNNb2RlbCA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICB2YXIgc2VsZiA9IHRoaXM7XG4gICBzZWxmLmNvbG9yID0ga28ub2JzZXJ2YWJsZShjb2xvcik7XG59O1xuXG5TdGF0dXNNb2RlbC5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgU3RhdHVzTW9kZWwoREVGQVVMVF9DT0xPUik7XG59O1xuXG5TdGF0dXNNb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0YXR1c01vZGVsKGRhdGEgJiYgZGF0YS5jb2xvcik7XG59O1xuXG4vKipcbiovXG5leHBvcnQgY29uc3QgVGFnTW9kZWwgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgc2VsZi52YWx1ZSA9IGtvLm9ic2VydmFibGUodmFsdWUpO1xuXG4gICAgc2VsZi51cmwgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcbiAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFRhZyhzZWxmLnZhbHVlKCkpLnVybDtcbiAgIH0pO1xufTtcblxuLyoqXG4qL1xuZXhwb3J0IGNvbnN0IFN0cmVhbU1vZGVsID0gZnVuY3Rpb24oaWQsIG5hbWUsIHVyaSwgc3RhdHVzLCB1cGRhdGVkLCB0YWdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuaWQgPSBrby5vYnNlcnZhYmxlKGlkKTtcbiAgICBzZWxmLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUgfHwgJycpO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkgfHwgJycpO1xuICAgIHNlbGYuc3RhdHVzID0ga28ub2JzZXJ2YWJsZShzdGF0dXMgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKSk7XG4gICAgc2VsZi51cGRhdGVkID0ga28ub2JzZXJ2YWJsZSh1cGRhdGVkKTtcbiAgICBzZWxmLnRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkodGFncyB8fCBbXSk7XG5cbiAgICBzZWxmLnVybCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtLmdldFN0cmVhbShzZWxmLnVyaSgpKS51cmw7XG4gICAgfSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG5cbiAgICBzZWxmLnNldENvbG9yID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICAgICAgdmFyIHN0YXR1cyA9IHNlbGYuc3RhdHVzKCkgfHwgU3RhdHVzTW9kZWwuZW1wdHkoKTtcbiAgICAgICAgc3RhdHVzLmNvbG9yKGNvbG9yKTtcbiAgICAgICAgc2VsZi5zdGF0dXMoc3RhdHVzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNwbGF5VXBkYXRlZCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0ZVRvRGlzcGxheShzZWxmLnVwZGF0ZWQoKSk7XG4gICAgfSk7XG5cbiAgICBzZWxmLmlzT3duZXIgPSBmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBvd25lclVyaSA9IG5vcm1hbGl6ZVVyaSh1c2VyLnVzZXJOYW1lKCkpO1xuICAgICAgICByZXR1cm4gKG93bmVyVXJpID09PSBzZWxmLnVyaSgpIHx8IHNlbGYudXJpKCkuaW5kZXhPZihvd25lclVyaSArICcvJykgPT09IDApO1xuICAgIH07XG59O1xuXG5TdHJlYW1Nb2RlbC5mcm9tSnNvbiA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbU1vZGVsKFxuICAgICAgICBkYXRhICYmIGRhdGEuaWQsXG4gICAgICAgIGRhdGEgJiYgZGF0YS5uYW1lLFxuICAgICAgICBkYXRhICYmIGRhdGEudXJpLFxuICAgICAgICBTdGF0dXNNb2RlbC5mcm9tSnNvbihkYXRhICYmIGRhdGEuc3RhdHVzKSxcbiAgICAgICAgbmV3IERhdGUoZGF0YSAmJiBkYXRhLnVwZGF0ZWQpLFxuICAgICAgICAoZGF0YSAmJiBkYXRhLnRhZ3MgfHwgW10pLm1hcChmdW5jdGlvbih4KXsgcmV0dXJuIG5ldyBUYWdNb2RlbCh4LnRhZyk7IH0pKTtcbn07XG5cbi8qKlxuKi9cbmV4cG9ydCBjb25zdCBVc2VyTW9kZWwgPSBmdW5jdGlvbih1c2VyTmFtZSwgc3RhdHVzLCByb290U3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXNlck5hbWUgPSBrby5vYnNlcnZhYmxlKHVzZXJOYW1lIHx8ICcnKTtcbiAgICBzZWxmLnN0YXR1cyA9IGtvLm9ic2VydmFibGUoc3RhdHVzIHx8IFN0YXR1c01vZGVsLmVtcHR5KCkpO1xuICAgIHNlbGYucm9vdFN0cmVhbSA9IGtvLm9ic2VydmFibGUocm9vdFN0cmVhbSk7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSBzZWxmLnN0YXR1cygpO1xuICAgICAgICByZXR1cm4gKHN0YXR1cyA/IHN0YXR1cy5jb2xvcigpIDogREVGQVVMVF9DT0xPUik7XG4gICAgfSk7XG59O1xuXG5Vc2VyTW9kZWwuZnJvbUpzb24gPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBVc2VyTW9kZWwoXG4gICAgICAgIGRhdGEgJiYgZGF0YS51c2VyTmFtZSxcbiAgICAgICAgU3RhdHVzTW9kZWwuZnJvbUpzb24oZGF0YSAmJiBkYXRhLnN0YXR1cyksXG4gICAgICAgIGRhdGEgJiYgZGF0YS5yb290U3RyZWFtKTtcbn07XG5cbi8qKlxuKi9cbmV4cG9ydCBjb25zdCBDb2xsZWN0aW9uID0gZnVuY3Rpb24odXJpKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudXJpID0ga28ub2JzZXJ2YWJsZSh1cmkpO1xuICAgIHNlbGYuY2hpbGRyZW4gPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcblxuICAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICBzZWxmLmNoaWxkcmVuLnJlbW92ZShmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGQudXJpKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmNoaWxkcmVuLnVuc2hpZnQoY2hpbGQpO1xuICAgIH07XG59O1xuIiwiXCJ1c2Utc3RyaWN0XCI7XG5cbmV4cG9ydCBjb25zdCBwYXJzZVF1ZXJ5U3RyaW5nID0gKHF1ZXJ5U3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHF1ZXJ5U3RyaW5nLnN1YnN0cigxKS5zcGxpdChcIiZcIilcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihkaWN0LCBpdGVtKSB7XG4gICAgICAgICAgICB2YXIga3YgPSBpdGVtLnNwbGl0KFwiPVwiKTtcbiAgICAgICAgICAgIHZhciBrID0ga3ZbMF07XG4gICAgICAgICAgICB2YXIgdiA9IGRlY29kZVVSSUNvbXBvbmVudChrdlsxXSk7XG4gICAgICAgICAgICBpZiAoayBpbiBkaWN0KSBkaWN0W2tdLnB1c2godik7IGVsc2UgZGljdFtrXSA9IFt2XTtcbiAgICAgICAgICAgIHJldHVybiBkaWN0O1xuICAgICAgICB9LCB7fSk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0UXVlcnlTdHJpbmcgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHBhcnNlUXVlcnlTdHJpbmcod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG59O1xuXG5leHBvcnQgY29uc3QgbG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICAgc2VsXG4gICAgICAgIC5wcm9wKFwiZGlzYWJsZWRcIiwgdHJ1ZSlcbiAgICAgICAgLmNoaWxkcmVuKCcuZ2x5cGhpY29uJylcbiAgICAgICAgICAgIC5hZGRDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggZ2x5cGhpY29uLXJlZnJlc2gtYW5pbWF0ZScpO1xufTtcblxuZXhwb3J0IGNvbnN0IHVubG9ja0J1dHRvbiA9IChzZWwpID0+IHtcbiAgICBzZWxcbiAgICAgICAucHJvcChcImRpc2FibGVkXCIsIGZhbHNlKVxuICAgICAgIC5jaGlsZHJlbignLmdseXBoaWNvbicpXG4gICAgICAgICAgIC5yZW1vdmVDbGFzcygnZ2x5cGhpY29uLXJlZnJlc2ggIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcbn07XG4iLCJcInVzZS1zdHJpY3RcIjtcbmNvbnN0IG1vZGVscyA9IHJlcXVpcmUoJy4vbW9kZWxzJyk7XG5jb25zdCBzdHJlYW1fbWFuYWdlciA9IHJlcXVpcmUoJy4vc3RyZWFtX21hbmFnZXInKTtcbmNvbnN0IGFwcGxpY2F0aW9uX21vZGVsID0gcmVxdWlyZSgnLi9hcHBsaWNhdGlvbl9tb2RlbCcpO1xuY29uc3Qgc2hhcmVkID0gcmVxdWlyZSgnLi9zaGFyZWQnKTtcblxudmFyIEZhdm9yaXRlU3RhdHVzID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgVW5rbm93bjogMCxcbiAgICBObzogMSxcbiAgICBZZXM6IDIsXG4gICAgSGllcmFyY2hpY2FsOiAzXG59KTtcblxudmFyIGlzSGllcmFyY2hpY2FsID0gZnVuY3Rpb24ocGFyZW50TmFtZSwgdXJpKSB7XG4gICAgcGFyZW50TmFtZSA9IG1vZGVscy5ub3JtYWxpemVVcmkocGFyZW50TmFtZSk7XG4gICAgaWYgKHBhcmVudE5hbWUgPT09IHVyaSlcbiAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICB2YXIgaW5kZXggPSB1cmkubGFzdEluZGV4T2YoJy8nKTtcbiAgICByZXR1cm4gKGluZGV4ID49IDAgJiYgcGFyZW50TmFtZSA9PT0gdXJpLnNsaWNlKDAsIGluZGV4KSk7XG59O1xuXG52YXIgaXNSb290U3RyZWFtID0gZnVuY3Rpb24odXJpKSB7XG4gICAgcmV0dXJuICh1cmkuaW5kZXhPZignLycpID09PSAtMSk7XG59O1xuXG4vKipcbiovXG52YXIgQXBwVmlld01vZGVsID0gZnVuY3Rpb24odXNlciwgc3RyZWFtKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGFwcGxpY2F0aW9uX21vZGVsLkFwcFZpZXdNb2RlbC5jYWxsKHRoaXMsIHVzZXIpO1xuXG4gICAgc2VsZi5zdHJlYW0gPSBrby5vYnNlcnZhYmxlKHN0cmVhbSk7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHN0cmVhbS51cmkoKSkpO1xuICAgIHNlbGYucXVlcnkgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgc2VsZi5mYXZvcml0ZSA9IGtvLm9ic2VydmFibGUoRmF2b3JpdGVTdGF0dXMuVW5rbm93bik7XG5cbiAgICBzZWxmLmNvbG9yID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdHJlYW0gPSBzZWxmLnN0cmVhbSgpO1xuICAgICAgICByZXR1cm4gKHN0cmVhbSA/IHN0cmVhbS5jb2xvcigpIDogbW9kZWxzLkRFRkFVTFRfQ09MT1IpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5zZXRDb2xvciA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICAgIGlmICghc2VsZi5zdHJlYW0oKSlcbiAgICAgICAgICAgIHNlbGYuc3RyZWFtKG5ldyBtb2RlbHMuU3RyZWFtTW9kZWwoKSk7XG4gICAgICAgIHNlbGYuc3RyZWFtKCkuc2V0Q29sb3IoY29sb3IpO1xuICAgIH07XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbigpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNoaWxkcmVuKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgc2VsZi5kZWxldGVTdHJlYW0gPSBmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVTdHJlYW0oY2hpbGQuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICBzZWxmLnJlbW92ZUNoaWxkKGNoaWxkLnVyaSgpKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHNlbGYuaXNQYXJlbnRPd25lciA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xuICAgICAgICAgcmV0dXJuICghIXNlbGYuc3RyZWFtKCkgJiYgc3RyZWFtLmlzT3duZXIoc2VsZi51c2VyKCkpKTtcbiAgICAgfSk7XG5cbiAgICBzZWxmLnJlbW92ZUNoaWxkQnV0dG9uQ2xpY2sgPSBmdW5jdGlvbihjaGlsZCwgZXZlbnQpIHtcbiAgICAgICAgaWYgKGlzSGllcmFyY2hpY2FsKHNlbGYuc3RyZWFtKCkudXJpKCksIGNoaWxkLnVyaSgpKSkge1xuICAgICAgICAgICAgYm9vdGJveC5jb25maXJtKHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJBcmUgeW91IHN1cmU/XCIsXG4gICAgICAgICAgICAgICAgYW5pbWF0ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgY2xvc2VCdXR0b246IGZhbHNlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiVGhpcyB3aWxsIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGlzIHN0cmVhbSBhbmQgYWxsIG9mIGl0cyBjaGlsZHJlbi5cIixcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZGVsZXRlU3RyZWFtKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJERUxFVEVcIixcbiAgICAgICAgICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpRGVsZXRlQ2hpbGQoc2VsZi5zdHJlYW0oKS5pZCgpLCBjaGlsZC5pZCgpKS51cmwsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICBzZWxmLnJlbW92ZUNoaWxkKGNoaWxkLnVyaSgpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYuY2hpbGRTZWxlY3RlZCA9IGZ1bmN0aW9uKGNoaWxkKSB7XG5cbiAgICB9O1xufTtcblxuQXBwVmlld01vZGVsLnByb3RvdHlwZS5jaGVja0Zhdm9yaXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgc3RyZWFtIGlzIHRoZSB1c2VyJ3Mgcm9vdCBzdHJlYW0gb2YgYSBkaXJlY3QgY2hpbGQsIGl0IGNhbm5vdCBiZSBmYXZvcml0ZWQuXG4gICAgaWYgKHNlbGYuc3RyZWFtKCkuaWQoKSA9PT0gc2VsZi51c2VyKCkucm9vdFN0cmVhbSgpIHx8IGlzSGllcmFyY2hpY2FsKHNlbGYudXNlcigpLnVzZXJOYW1lKCksIHNlbGYuc3RyZWFtKCkudXJpKCkpKSB7XG4gICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuSGllcmFyY2hpY2FsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlHZXRDaGlsZChzZWxmLnVzZXIoKS5yb290U3RyZWFtKCksIHNlbGYuc3RyZWFtKCkuaWQoKSkudXJsLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLk5vKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgIHNlbGYuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxudmFyIGluaXRpYWxTdHJlYW0gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKHdpbmRvdy5pbml0aWFsU3RyZWFtRGF0YSk7XG59O1xuXG4vKipcbiAgICBSZWRyYXcgdGhlIGZhdmljb24gZm9yIGEgZ2l2ZW4gc3RhdHVzLlxuKi9cbnZhciB1cGRhdGVGYXZpY29uID0gZnVuY3Rpb24oY29sb3IpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgdmFyIGxpbmsgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmF2aWNvbicpO1xuXG4gICAgY2FudmFzLndpZHRoID0gY2FudmFzLmhlaWdodCA9IDE7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgICBjdHguZmlsbFJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgICBsaW5rLmhyZWYgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9wbmcnKTtcbn07XG5cbi8qKlxuKi9cbnZhciBlbmFibGVGYXZvcml0ZUJ1dHRvbiA9IGZ1bmN0aW9uKGV4aXN0aW5nKSB7XG4gICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpXG4gICAgICAgIC5wcm9wKCdkaXNhYmxlZCcsIGZhbHNlKVxuICAgICAgICAucHJvcCgndGl0bGUnLCBleGlzdGluZyA/IFwiUmVtb3ZlIEZhdm9yaXRlXCIgOiBcIkFkZCBGYXZvcml0ZVwiKTtcblxuICAgIGlmIChleGlzdGluZylcbiAgICAgICAgJCgnLnN0cmVhbS1mYXZvcml0ZScpLmFkZENsYXNzKCdhY3RpdmUnKTtcbiAgICBlbHNlXG4gICAgICAgICQoJy5zdHJlYW0tZmF2b3JpdGUnKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XG5cbn07XG5cbnZhciBkaXNhYmxlRmF2b3JpdGVCdXR0b24gPSBmdW5jdGlvbigpIHtcbiAgICAkKCcuc3RyZWFtLWZhdm9yaXRlJylcbiAgICAgICAgLnByb3AoXCJkaXNhYmxlZFwiLCB0cnVlKTtcbn07XG5cbi8qKlxuKi9cbnZhciBoaWRlQ2hpbGRGb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0LCAjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24nKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1uYW1lLWlucHV0IGlucHV0JykudmFsKCcnKTtcbiAgICAkKCcuY3JlYXRlLWNoaWxkIC5lcnJvcicpXG4gICAgICAgIC5hZGRDbGFzcygnaGlkZGVuJylcbiAgICAgICAgLnRleHQoJycpO1xufTtcblxudmFyIGNyZWF0ZUNoaWxkU3RyZWFtID0gZnVuY3Rpb24obW9kZWwsIHN0cmVhbSwgdXNlciwgbmFtZSkge1xuICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uIHNwYW4nKVxuICAgICAgICAuYWRkQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCBpbnB1dCwgI2NyZWF0ZS1jaGlsZC1jYW5jZWwtYnV0dG9uIGJ1dHRvbiwgI2NyZWF0ZS1jaGlsZC1leHBhbmQtYnV0dG9uJylcbiAgICAgICAgLnByb3AoJ2Rpc2FibGVkJywgdHJ1ZSk7XG5cbiAgICB2YXIgb25Db21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24gc3BhbicpXG4gICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2dseXBoaWNvbi1yZWZyZXNoIGdseXBoaWNvbi1yZWZyZXNoLWFuaW1hdGUnKTtcblxuICAgICAgICAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbiBidXR0b24sICNjcmVhdGUtY2hpbGQtZXhwYW5kLWJ1dHRvbicpXG4gICAgICAgICAgICAucHJvcCgnZGlzYWJsZWQnLCBmYWxzZSk7XG4gICAgfTtcblxuICAgIHZhciBnZXRFcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUpIHtcbiAgICAgICAgICAgIGlmIChlLmRldGFpbHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZS5kZXRhaWxzWydvYmoubmFtZSddKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBcIk5hbWUgaXMgaW52YWxpZC4gTXVzdCBiZSBiZXR3ZWVuIDEgYW5kIDY0IGxldHRlcnMgYW5kIG51bWJlcnMuXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGUuZXJyb3IpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGUuZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gXCJBbiBlcnJvciBvY2N1cnJlZFwiO1xuICAgIH07XG5cbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIlBVVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuYXBpQ3JlYXRlU3RyZWFtKCkudXJsLFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICB1cmk6IHN0cmVhbS51cmkoKSArIFwiL1wiICsgbmFtZVxuICAgICAgICB9KSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICQoJy5jcmVhdGUtY2hpbGQgLmVycm9yJylcbiAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpXG4gICAgICAgICAgICAgICAgLnRleHQoZ2V0RXJyb3IoZS5yZXNwb25zZUpTT04pKTtcblxuICAgICAgICAgICAgb25Db21wbGV0ZSgpO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuYWRkQ2hpbGQobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKHJlc3VsdCkpO1xuICAgICAgICBvbkNvbXBsZXRlKCk7XG4gICAgICAgIGhpZGVDaGlsZEZvcm0oKTtcbiAgICB9KTtcbn07XG5cbi8qKlxuKi9cbnZhciBhZGRGYXZvcml0ZSA9IGZ1bmN0aW9uKG1vZGVsLCB0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkge1xuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlDcmVhdGVDaGlsZCh0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuWWVzKTtcbiAgICB9KTtcbn07XG5cbnZhciByZW1vdmVGYXZvcml0ZSA9IGZ1bmN0aW9uKG1vZGVsLCB0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkge1xuICAgIGRpc2FibGVGYXZvcml0ZUJ1dHRvbigpO1xuICAgICQuYWpheCh7XG4gICAgICAgIHR5cGU6IFwiREVMRVRFXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlEZWxldGVDaGlsZCh0YXJnZXRTdHJlYW1JZCwgY2hpbGRJZCkudXJsLFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIG1vZGVsLmZhdm9yaXRlKEZhdm9yaXRlU3RhdHVzLlVua25vd24pO1xuICAgICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgbW9kZWwuZmF2b3JpdGUoRmF2b3JpdGVTdGF0dXMuTm8pO1xuICAgIH0pO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeSA9IGZ1bmN0aW9uKG1vZGVsLCBxdWVyeSkge1xuICAgICQoJy5saXN0LWxvYWRpbmcnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgJCgnLm5vLXJlc3VsdHMnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJHRVRcIixcbiAgICAgICAgdXJsOiBqc1JvdXRlcy5jb250cm9sbGVycy5TdHJlYW1BcGlDb250cm9sbGVyLmFwaUdldENoaWxkcmVuKG1vZGVsLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcXVlcnk6IHF1ZXJ5XG4gICAgICAgIH0sXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIGFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIH1cbiAgICB9KS5kb25lKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICBtb2RlbC5xdWVyeShxdWVyeSk7XG4gICAgICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4oKHJlc3VsdCB8fCBbXSkubWFwKG1vZGVscy5TdHJlYW1Nb2RlbC5mcm9tSnNvbikpO1xuICAgIH0pO1xufTtcblxudmFyIHVwZGF0ZVNlYXJjaFJlc3VsdHMgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBxdWVyeSA9ICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwoKTtcbiAgICByZXR1cm4gdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCBxdWVyeSk7XG59O1xuXG4vKipcbiovXG52YXIgdXBkYXRlU3RyZWFtVGFncyA9IGZ1bmN0aW9uKG1vZGVsLCB0YWdzKSB7XG4gICAgJC5hamF4KHtcbiAgICAgICAgdHlwZTogXCJQT1NUXCIsXG4gICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5zZXRUYWdzKG1vZGVsLnN0cmVhbSgpLmlkKCkpLnVybCxcbiAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgZGF0YTogSlNPTi5zdHJpbmdpZnkodGFncy5tYXAoZnVuY3Rpb24oeCkgeyByZXR1cm4geyBcInRhZ1wiOiB4LnZhbHVlKCkgfTsgfSkpLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBhY2NlcHQ6IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBmdW5jdGlvbihlKSB7XG5cbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIG1vZGVsLnN0cmVhbSgpLnRhZ3MoXG4gICAgICAgICAgICByZXN1bHQubWFwKGZ1bmN0aW9uKHRhZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50YWcpO1xuICAgICAgICAgICAgfSkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgQ29udmVydCBhIGxpc3Qgb2YgdGFncyB0byBhIGVkaXRhYmxlIHN0cmluZyByZXByZXNlbnRhdGlvbi5cbiovXG52YXIgdGFnc1RvU3RyaW5nID0gZnVuY3Rpb24odGFncykge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwodGFncywgZnVuY3Rpb24oeCkgeyByZXR1cm4geC52YWx1ZSgpOyB9KVxuICAgICAgICAuam9pbignLCAnKTtcbn07XG5cbi8qKlxuICAgIENvbnZlcnQgYSBzdHJpbmcgdG8gYSBsaXN0IG9mIHRhZ3MuXG4qL1xudmFyIHN0cmluZ1RvVGFncyA9IGZ1bmN0aW9uKHRhZ3MpIHtcbiAgICByZXR1cm4gKHRhZ3MubWF0Y2goLyhbYS16QS1aMC05X1xcLSRdKSsvaWcpIHx8IFtdKS5tYXAoZnVuY3Rpb24odGFnKSB7XG4gICAgICAgIHJldHVybiBuZXcgbW9kZWxzLlRhZ01vZGVsKHRhZy50cmltKCkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gICAgRWRpdCB0aGUgc3RyZWFtJ3MgdGFncy5cbiovXG52YXIgZWRpdFRhZ3MgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgICQoJyNzYXZlLXRhZ3MtYnV0dG9uJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICQoJyN0YWctaW5wdXQnKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpXG4gICAgICAgIC52YWwodGFnc1RvU3RyaW5nKG1vZGVsLnN0cmVhbSgpLnRhZ3MoKSkpO1xufTtcblxuLyoqXG4gICAgU2F2ZSB0aGUgZWRpdGVkIHRhZ3MuXG4qL1xudmFyIHNhdmVUYWdzID0gZnVuY3Rpb24obW9kZWwpIHtcbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjZWRpdC10YWdzLWJ1dHRvbicpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkKCcjdGFnLWlucHV0JykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICQoJy50YWctbGlzdCcpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcblxuICAgIHZhciB0YWdzID0gc3RyaW5nVG9UYWdzKCQoJyN0YWctaW5wdXQgaW5wdXQnKS52YWwoKSk7XG4gICAgdXBkYXRlU3RyZWFtVGFncyhtb2RlbCwgdGFncyk7XG59O1xuXG4vKipcbiovXG4kKGZ1bmN0aW9uKCl7XG4gICAgdmFyIG1vZGVsID0gbmV3IEFwcFZpZXdNb2RlbChcbiAgICAgICAgYXBwbGljYXRpb25fbW9kZWwuaW5pdGlhbFVzZXIoKSxcbiAgICAgICAgaW5pdGlhbFN0cmVhbSgpKTtcblxuICAgIHZhciB1cGRhdGVTdGF0dXMgPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgICB2YXIgc3RyZWFtID0gbW9kZWwuc3RyZWFtKCk7XG4gICAgICAgIGlmICghc3RyZWFtKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB0eXBlOiBcIlBPU1RcIixcbiAgICAgICAgICAgIHVybDoganNSb3V0ZXMuY29udHJvbGxlcnMuU3RyZWFtQXBpQ29udHJvbGxlci5hcGlTZXRTdHJlYW1TdGF0dXMoc3RyZWFtLmlkKCkpLnVybCxcbiAgICAgICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgY29sb3I6IGNvbG9yXG4gICAgICAgICAgICB9KVxuICAgICAgICB9KTtcblxuICAgICAgICBtb2RlbC5zdHJlYW0oKS51cGRhdGVkKG5ldyBEYXRlKCkpO1xuICAgICAgICBtb2RlbC5zZXRDb2xvcihjb2xvcik7XG4gICAgfTtcblxuICAgIHZhciBzdGF0dXNQaWNrZXIgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjdXJyZW50Q29sb3IgPSBtb2RlbHMuREVGQVVMVF9DT0xPUjtcbiAgICAgICAgdmFyIHBpY2tlZENvbG9yID0gbW9kZWxzLkRFRkFVTFRfQ09MT1I7XG4gICAgICAgIG1vZGVsLm1hbmFnZXIuc3Vic2NyaWJlKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICAgICAnU3RhdHVzVXBkYXRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudENvbG9yID0gbXNnLnN0YXR1cy5jb2xvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBzdGF0dXNQaWNrZXIgPSAkKCcuc3RhdHVzLXBpY2tlcicpXG4gICAgICAgICAgICAuc3BlY3RydW0oe1xuICAgICAgICAgICAgICAgIHNob3dJbnB1dDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93UGFsZXR0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzaG93U2VsZWN0aW9uUGFsZXR0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwcmVmZXJyZWRGb3JtYXQ6IFwiaGV4XCIsXG4gICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlS2V5OiBcImJsb3RyZS5zdHJlYW0uc3RhdHVzUGlja2VyXCJcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ3Nob3cuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIHBpY2tlZENvbG9yID0gY3VycmVudENvbG9yID0gY29sb3IgKyAnJztcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ21vdmUuc3BlY3RydW0gY2hhbmdlLnNwZWN0cnVtJywgZnVuY3Rpb24oZSwgY29sb3IpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihjb2xvciArICcnKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAub24oJ2hpZGUuc3BlY3RydW0nLCBmdW5jdGlvbihlLCBjb2xvcikge1xuICAgICAgICAgICAgICAgIHBpY2tlZENvbG9yID0gY29sb3IgKyAnJztcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihjdXJyZW50Q29sb3IpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgJCgnLnNwLWNob29zZScpXG4gICAgICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlU3RhdHVzKHBpY2tlZENvbG9yICsgJycpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHN0YXR1c1BpY2tlcjtcbiAgICB9KCkpO1xuXG4gICAgJCgnLnN0YXR1cy1waWNrZXItZm9ybScpXG4gICAgICAgIC5vbignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdmFyIGNvbG9yID0gJCh0aGlzKS5jaGlsZHJlbignLnN0YXR1cy1waWNrZXInKS52YWwoKTtcbiAgICAgICAgICAgIHVwZGF0ZVN0YXR1cyhjb2xvcik7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGNoaWxkIGZvcm1cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWV4cGFuZC1idXR0b24nKVxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgdmFyIGhpZGRlbiA9ICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCcpLmhhc0NsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIHZhciB0YXJnZXQgPSAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQsICNjcmVhdGUtY2hpbGQtY2FuY2VsLWJ1dHRvbicpO1xuICAgICAgICAgICAgaWYgKGhpZGRlbikge1xuICAgICAgICAgICAgICAgIHRhcmdldC5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNyZWF0ZUNoaWxkU3RyZWFtKG1vZGVsLCBtb2RlbC5zdHJlYW0oKSwgbW9kZWwudXNlcigpLCAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoKS50cmltKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICQoJyNjcmVhdGUtY2hpbGQtbmFtZS1pbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMpIHtcbiAgICAgICAgICAgIGNyZWF0ZUNoaWxkU3RyZWFtKG1vZGVsLCBtb2RlbC5zdHJlYW0oKSwgbW9kZWwudXNlcigpLCAkKCcjY3JlYXRlLWNoaWxkLW5hbWUtaW5wdXQgaW5wdXQnKS52YWwoKS50cmltKCkpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkKCcjY3JlYXRlLWNoaWxkLWNhbmNlbC1idXR0b24gYnV0dG9uJylcbiAgICAgICAgLm9uKCdjbGljaycsIGhpZGVDaGlsZEZvcm0pO1xuXG4gICAgLy8gVGFnIGVkaXRvclxuICAgICQoJyNlZGl0LXRhZ3MtYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlZGl0VGFncyhtb2RlbCk7XG4gICAgfSk7XG5cbiAgICAkKCcjc2F2ZS10YWdzLWJ1dHRvbicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgc2F2ZVRhZ3MobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3RhZy1pbnB1dCBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovKSB7XG4gICAgICAgICAgICBzYXZlVGFncyhtb2RlbCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoaWxkIFNlYXJjaFxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gYnV0dG9uJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHVwZGF0ZVNlYXJjaFJlc3VsdHMobW9kZWwpO1xuICAgIH0pO1xuXG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMTMgLyplbnRlciovKSB7XG4gICAgICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ2hpbGRyZW5cbiAgICB2YXIgcXVlcnkgPSBzaGFyZWQuZ2V0UXVlcnlTdHJpbmcoKS5xdWVyeTtcbiAgICB1cGRhdGVTZWFyY2hSZXN1bHRzRm9yUXVlcnkobW9kZWwsIChxdWVyeSB8fCAnJykpO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKG1vZGVsLnN0cmVhbSgpLnVyaSgpLCB7XG4gICAgICAgICdTdGF0dXNVcGRhdGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICB2YXIgZXhpc3RpbmdDaGlsZCA9IG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5mcm9tKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGV4aXN0aW5nQ2hpbGRbMF0uc3RhdHVzKG1vZGVscy5TdGF0dXNNb2RlbC5mcm9tSnNvbihtc2cuc3RhdHVzKSk7XG4gICAgICAgICAgICAgICAgbW9kZWwuYWRkQ2hpbGQoZXhpc3RpbmdDaGlsZFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBtb2RlbC5hZGRDaGlsZChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgIH0sXG4gICAgICAgICdDaGlsZFJlbW92ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5jaGlsZCk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIG1vZGVsLmNvbG9yLnN1YnNjcmliZSh1cGRhdGVGYXZpY29uKTtcblxuICAgIG1vZGVsLmNoaWxkcmVuKCkuY2hpbGRyZW4uc3Vic2NyaWJlKGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoKVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgICQoJy5uby1yZXN1bHRzJykucmVtb3ZlQ2xhc3MoJ2hpZGRlbicpO1xuICAgIH0pO1xuXG4gICAgLy8gRmF2b3JpdGUgQnV0dG9uXG4gICAgZGlzYWJsZUZhdm9yaXRlQnV0dG9uKCk7XG5cbiAgICBtb2RlbC5mYXZvcml0ZS5zdWJzY3JpYmUoZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICAgIGNhc2UgRmF2b3JpdGVTdGF0dXMuWWVzOlxuICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKHRydWUpO1xuICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLk5vOlxuICAgICAgICAgICAgcmV0dXJuIGVuYWJsZUZhdm9yaXRlQnV0dG9uKGZhbHNlKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBkaXNhYmxlRmF2b3JpdGVCdXR0b24oKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwuY2hlY2tGYXZvcml0ZSgpO1xuXG5cbiAgICAkKCdidXR0b24uc3RyZWFtLWZhdm9yaXRlJykuY2xpY2soZnVuY3Rpb24oZSkge1xuICAgICAgICBzd2l0Y2ggKG1vZGVsLmZhdm9yaXRlKCkpIHtcbiAgICAgICAgY2FzZSBGYXZvcml0ZVN0YXR1cy5ZZXM6XG4gICAgICAgICAgICByZXR1cm4gcmVtb3ZlRmF2b3JpdGUobW9kZWwsIG1vZGVsLnVzZXIoKS5yb290U3RyZWFtKCksIG1vZGVsLnN0cmVhbSgpLmlkKCkpO1xuICAgICAgICBjYXNlIEZhdm9yaXRlU3RhdHVzLk5vOlxuICAgICAgICAgICAgcmV0dXJuIGFkZEZhdm9yaXRlKG1vZGVsLCBtb2RlbC51c2VyKCkucm9vdFN0cmVhbSgpLCBtb2RlbC5zdHJlYW0oKS5pZCgpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmUobW9kZWwuc3RyZWFtKCkudXJpKCksIHtcbiAgICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgIGlmIChtc2cuZnJvbSA9PT0gbW9kZWwuc3RyZWFtKCkudXJpKCkpIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5zZXRDb2xvcihtc2cuc3RhdHVzLmNvbG9yKTtcbiAgICAgICAgICAgICAgICBtb2RlbC5zdHJlYW0oKS51cGRhdGVkKG5ldyBEYXRlKG1zZy5zdGF0dXMuY3JlYXRlZCkpO1xuICAgICAgICAgICAgICAgIHN0YXR1c1BpY2tlci5zcGVjdHJ1bShcInNldFwiLCBtc2cuc3RhdHVzLmNvbG9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ1BhcmVudEFkZGVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgICBpZiAobXNnLmZyb20gPT09IG1vZGVsLnN0cmVhbSgpLnVyaSgpICYmIG1zZy5wYXJlbnQudXJpID09PSBtb2RlbC51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5ZZXMpO1xuICAgICAgICB9LFxuICAgICAgICAnUGFyZW50UmVtb3ZlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICAgaWYgKG1zZy5mcm9tID09PSBtb2RlbC5zdHJlYW0oKS51cmkoKSAmJiBtc2cucGFyZW50ID09PSBtb2RlbC51c2VyKCkudXNlck5hbWUoKSlcbiAgICAgICAgICAgICAgICBtb2RlbC5mYXZvcml0ZShGYXZvcml0ZVN0YXR1cy5Obyk7XG4gICAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBrby5hcHBseUJpbmRpbmdzKG1vZGVsKTtcbn0pO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCBtb2RlbHMgPSByZXF1aXJlKCcuL21vZGVscycpO1xuXG5cbnZhciBzb2NrZXRQYXRoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlY3VyZSA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgcmV0dXJuIChzZWN1cmUgPyAnd3NzJyA6ICd3cycpICsgJzovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdCArICcvdjAvd3MnO1xufTtcblxuLyoqXG4qL1xudmFyIFN0cmVhbU1hbmFnZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5zdHJlYW1zID0geyB9O1xuICAgIHNlbGYuY29sbGVjdGlvbnMgPSB7IH07XG5cbiAgICB2YXIgcHJvY2Vzc01lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgaWYgKCFtc2cgfHwgIW1zZy50eXBlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciB0eXBlID0gbXNnLnR5cGU7XG4gICAgICAgIHZhciB0YXJnZXQgPSAobXNnLnNvdXJjZSA/IHNlbGYuY29sbGVjdGlvbnNbbXNnLnNvdXJjZV0gOiBzZWxmLnN0cmVhbXNbbXNnLmZyb21dKTtcbiAgICAgICAgKHRhcmdldCA/IHRhcmdldC5saXN0ZW5lcnMgOiBbXSkuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICBpZiAoeFt0eXBlXSlcbiAgICAgICAgICAgICAgICB4W3R5cGVdKG1zZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG5cbiAgICB2YXIgb3BlbldlYnNvY2tldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc29ja2V0ID0gbmV3IFdlYlNvY2tldChzb2NrZXRQYXRoKCkpO1xuXG4gICAgICAgIHNvY2tldC5vbm9wZW4gPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRTdHJlYW1zID0gT2JqZWN0LmtleXMoc2VsZi5zdHJlYW1zKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRTdHJlYW1zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiU3Vic2NyaWJlXCIsXG4gICAgICAgICAgICAgICAgICAgIFwidG9cIjogdGFyZ2V0U3RyZWFtc1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHRhcmdldENvbGxlY3Rpb25zID0gT2JqZWN0LmtleXMoc2VsZi5jb2xsZWN0aW9ucyk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29sbGVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidG9cIjogeFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YSlcbiAgICAgICAgICAgICAgICBwcm9jZXNzTWVzc2FnZShkYXRhKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzb2NrZXQub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3Jlb3BlbicpO1xuICAgICAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgc2VsZi5zb2NrZXQgPSBvcGVuV2Vic29ja2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIHNlbGYuc29ja2V0ID0gb3BlbldlYnNvY2tldCgpO1xufTtcblxuU3RyZWFtTWFuYWdlci5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnN1YnNjcmliZUFsbChbcGF0aF0sIGNhbGxiYWNrKTtcbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUFsbCA9IGZ1bmN0aW9uKHBhdGhzLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBuZXdTdWJzY3JpcHRpb25zID0gW107XG4gICAgcGF0aHMubWFwKG1vZGVscy5ub3JtYWxpemVVcmkpLmZvckVhY2goZnVuY3Rpb24ocGF0aCkge1xuICAgICAgICB2YXIgY3VycmVudCA9IHNlbGYuc3RyZWFtc1twYXRoXTtcbiAgICAgICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgICAgIGN1cnJlbnQubGlzdGVuZXJzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5zdHJlYW1zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgICAgIG5ld1N1YnNjcmlwdGlvbnMucHVzaChwYXRoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKG5ld1N1YnNjcmlwdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIGlmIChzZWxmLnJlYWR5KSB7XG4gICAgICAgICAgICBzZWxmLnNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJTdWJzY3JpYmVcIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IG5ld1N1YnNjcmlwdGlvbnNcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblN0cmVhbU1hbmFnZXIucHJvdG90eXBlLnN1YnNjcmliZUNvbGxlY3Rpb24gPSBmdW5jdGlvbihwYXRoLCBjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBwYXRoID0gbW9kZWxzLm5vcm1hbGl6ZVVyaShwYXRoKTtcblxuICAgIHZhciBjdXJyZW50ID0gc2VsZi5jb2xsZWN0aW9uc1twYXRoXTtcbiAgICBpZiAoY3VycmVudCkge1xuICAgICAgICBjdXJyZW50Lmxpc3RlbmVycy5wdXNoKGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmNvbGxlY3Rpb25zW3BhdGhdID0geyBsaXN0ZW5lcnM6IFtjYWxsYmFja10gfTtcbiAgICAgICAgaWYgKHNlbGYucmVhZHkpIHtcbiAgICAgICAgICAgIHNlbGYuc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcIlN1YnNjcmliZUNvbGxlY3Rpb25cIixcbiAgICAgICAgICAgICAgICBcInRvXCI6IHBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU3RyZWFtTWFuYWdlcjogU3RyZWFtTWFuYWdlclxufTtcbiJdfQ==
