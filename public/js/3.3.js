webpackJsonp([3,1],[
/* 0 */,
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function() {

	var slice = Function.prototype.call.bind(Array.prototype.slice);

	var DEFAULT_COLOR = '#777777';

	/**
	*/
	var normalizeUri = function(uri) {
	    return decodeURI(uri)
	        .trim()
	        .toLowerCase()
	        .replace(' ', '/');
	};

	/**
	    Pretty prints a data.
	*/
	var dateToDisplay = (function(){
	    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	    var pad = function(min, input) {
	        input += '';
	        while (input.length < min)
	            input = '0' + input;
	        return input;
	    };

	    return function(date) {
	        if (!date)
	            return '-';

	        return months[date.getMonth()] + ' ' + pad(2, date.getDate()) + ', ' + date.getFullYear() + ' ' +
	            pad(2, date.getHours()) + ':' + pad(2, date.getMinutes()) + '.' +
	            pad(2, date.getSeconds()) + pad(3, date.getMilliseconds());
	    };
	}());

	/**
	*/
	var StatusModel = function(color) {
	   var self = this;
	   self.color = ko.observable(color);
	};

	StatusModel.empty = function() {
	    return new StatusModel(DEFAULT_COLOR);
	};

	StatusModel.fromJson = function(data) {
	    return new StatusModel(data && data.color);
	};

	/**
	*/
	var TagModel = function(value) {
	   var self = this;
	   self.value = ko.observable(value);

	    self.url = ko.computed(function() {
	       return jsRoutes.controllers.Stream.getTag(self.value()).url;
	   });
	};

	/**
	*/
	var StreamModel = function(id, name, uri, status, updated, tags) {
	    var self = this;
	    self.id = ko.observable(id);
	    self.name = ko.observable(name || '');
	    self.uri = ko.observable(uri || '');
	    self.status = ko.observable(status || StatusModel.empty());
	    self.updated = ko.observable(updated);
	    self.tags = ko.observableArray(tags || []);

	    self.url = ko.computed(function() {
	        return jsRoutes.controllers.Stream.getStream(self.uri()).url;
	    });

	    self.color = ko.computed(function() {
	        var status = self.status();
	        return (status ? status.color() : DEFAULT_COLOR);
	    });

	    self.setColor = function(color) {
	        var status = self.status() || StatusModel.empty();
	        status.color(color);
	        self.status(status);
	    };

	    self.displayUpdated = ko.computed(function() {
	        return dateToDisplay(self.updated());
	    });

	    self.isOwner = function(user) {
	        var ownerUri = normalizeUri(user.userName());
	        return (ownerUri === self.uri() || self.uri().indexOf(ownerUri + '/') === 0);
	    };
	};

	StreamModel.fromJson = function(data) {
	    return new StreamModel(
	        data && data.id,
	        data && data.name,
	        data && data.uri,
	        StatusModel.fromJson(data && data.status),
	        new Date(data && data.updated),
	        (data && data.tags || []).map(function(x){ return new TagModel(x.tag); }));
	};

	/**
	*/
	var UserModel = function(userName, status, rootStream) {
	    var self = this;
	    self.userName = ko.observable(userName || '');
	    self.status = ko.observable(status || StatusModel.empty());
	    self.rootStream = ko.observable(rootStream);

	    self.color = ko.computed(function() {
	        var status = self.status();
	        return (status ? status.color() : DEFAULT_COLOR);
	    });
	};

	UserModel.fromJson = function(data) {
	    return new UserModel(
	        data && data.userName,
	        StatusModel.fromJson(data && data.status),
	        data && data.rootStream);
	};

	/**
	*/
	var Collection = function(uri) {
	    var self = this;
	    self.uri = ko.observable(uri);
	    self.children = ko.observableArray();

	     self.addChild = function(child) {
	       self.children.remove(function(x) {
	            return x.uri() === child.uri();
	        });
	        self.children.unshift(child);
	    };
	};

	return {
	    DEFAULT_COLOR: DEFAULT_COLOR,

	    normalizeUri: normalizeUri,

	    StatusModel: StatusModel,
	    StreamModel: StreamModel,
	    TagModel: TagModel,

	    UserModel: UserModel,
	    Collection: Collection
	};

	}.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(1)], __WEBPACK_AMD_DEFINE_RESULT__ = function(models)
	{
	"use-strict";

	var socketPath = function() {
	    var secure = window.location.protocol === 'https:';
	    return (secure ? 'wss' : 'ws') + '://' + window.location.host + '/v0/ws';
	};

	/**
	*/
	var StreamManager = function() {
	    var self = this;
	    self.streams = { };
	    self.collections = { };

	    var processMessage = function(msg) {
	        if (!msg || !msg.type)
	            return;

	        var type = msg.type;
	        var target = (msg.source ? self.collections[msg.source] : self.streams[msg.from]);
	        (target ? target.listeners : []).forEach(function(x) {
	            if (x[type])
	                x[type](msg);
	        });
	    };

	    self.ready = false;

	    var openWebsocket = function() {
	        var socket = new WebSocket(socketPath());

	        socket.onopen = function(e) {
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
	                targetCollections.forEach(function(x) {
	                    socket.send(JSON.stringify({
	                        "type": "SubscribeCollection",
	                        "to": x
	                    }));
	                });
	            }
	        };

	        socket.onmessage = function(event) {
	            var data = JSON.parse(event.data);
	            if (data)
	                processMessage(data);
	        };

	        socket.onclose = function() {
	            console.log('reopen');
	            if (self.ready) {
	                self.ready = false;
	                self.socket = openWebsocket();
	            }
	        };
	    };

	    self.socket = openWebsocket();
	};

	StreamManager.prototype.subscribe = function(path, callback) {
	    this.subscribeAll([path], callback);
	};

	StreamManager.prototype.subscribeAll = function(paths, callback) {
	    var self = this;

	    var newSubscriptions = [];
	    paths.map(models.normalizeUri).forEach(function(path) {
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

	StreamManager.prototype.subscribeCollection = function(path, callback) {
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


	return {
	    StreamManager: StreamManager
	};

	}.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
	    __webpack_require__(1),
	    __webpack_require__(2)], __WEBPACK_AMD_DEFINE_RESULT__ = function(
	    models,
	    stream_manager)
	{
	"use-strict";

	/**
	*/
	var AppViewModel = function(user, page) {
	    var self = this;
	    self.user = ko.observable(user);
	    self.page = ko.observable(page);
	    self.favorites = ko.observable(new models.Collection(user.userName()));

	    self.manager = new stream_manager.StreamManager();

	    self.addFavorite = function(child) {
	        self.favorites().addChild(child);
	    };

	    self.removeFavorite = function(childUri) {
	        return self.favorites().children.remove(function(x) {
	             return x.uri() === childUri;
	         });
	    };

	    // Subscribe to user status updates
	    self.manager.subscribe(user.userName(), {
	        'StatusUpdated': function(msg) {
	            self.user().status(new models.StatusModel(msg.status.color));
	        }
	    });

	    if (!user || !user.rootStream())
	        return;

	    $.ajax({
	        type: "GET",
	        url: jsRoutes.controllers.StreamApiController.apiGetChildren(user.rootStream()).url,
	        headers: {
	            accept: "application/json"
	        },
	        error: function(e) { console.error(e); }
	    }).done(function(result) {
	        self.favorites().children((result || []).map(models.StreamModel.fromJson));
	    });

	     // Subscribe to user collection updates
	    self.manager.subscribeCollection(user.userName(), {
	        'StatusUpdated': function(msg) {
	            var existingChild = self.removeFavorite(msg.from);
	            if (existingChild.length) {
	                existingChild[0].status(models.StatusModel.fromJson(msg.status));
	                self.addFavorite(existingChild[0]);
	            }
	        },
	        'ChildAdded': function(msg) {
	            self.addFavorite(models.StreamModel.fromJson(msg.child));
	        },
	        'ChildRemoved': function(msg) {
	            self.removeFavorite(msg.child);
	        }
	    });
	};

	var initialUser = function() {
	    return models.UserModel.fromJson(window.initialUserData);
	};

	return {
	    AppViewModel: AppViewModel,
	    initialUser: initialUser
	};

	}.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function() {
	"use-strict";

	var showLoadingScreen = function() {
	    $('#loading-overlay').removeClass('hidden');
	};

	var hideLoadingScreen = function() {
	    $('#loading-overlay').addClass('hidden');
	};

	/**
	    Remove all alerts.
	*/
	var clearAlerts = function() {
	    $('#alerts').empty();
	};

	/**
	    Append a new alert
	*/
	var addAlert = function(type, content) {
	    $('#alerts').append(
	        $('<li class="alert" role="alert">')
	            .addClass(type)
	            .append(
	                '<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>',
	                content));
	};

	/**
	    Set the current alert, removing all existing one.
	*/
	var setAlert = function(type, content) {
	    clearAlerts();
	    addAlert(type, content);
	};

	return {
	    'showLoadingScreen': showLoadingScreen,
	    'hideLoadingScreen': hideLoadingScreen,

	    'clearAlerts': clearAlerts,
	    'addAlert': addAlert,
	    'setAlert': setAlert
	};

	}.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));

/***/ }
]);