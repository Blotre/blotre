/******/ (function(modules) { // webpackBootstrap
/******/ 	// install a JSONP callback for chunk loading
/******/ 	var parentJsonpFunction = window["webpackJsonp"];
/******/ 	window["webpackJsonp"] = function webpackJsonpCallback(chunkIds, moreModules) {
/******/ 		// add "moreModules" to the modules object,
/******/ 		// then flag all "chunkIds" as loaded and fire callback
/******/ 		var moduleId, chunkId, i = 0, callbacks = [];
/******/ 		for(;i < chunkIds.length; i++) {
/******/ 			chunkId = chunkIds[i];
/******/ 			if(installedChunks[chunkId])
/******/ 				callbacks.push.apply(callbacks, installedChunks[chunkId]);
/******/ 			installedChunks[chunkId] = 0;
/******/ 		}
/******/ 		for(moduleId in moreModules) {
/******/ 			modules[moduleId] = moreModules[moduleId];
/******/ 		}
/******/ 		if(parentJsonpFunction) parentJsonpFunction(chunkIds, moreModules);
/******/ 		while(callbacks.length)
/******/ 			callbacks.shift().call(null, __webpack_require__);

/******/ 	};

/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// object to store loaded and loading chunks
/******/ 	// "0" means "already loaded"
/******/ 	// Array means "loading", array contains callbacks
/******/ 	var installedChunks = {
/******/ 		7:0
/******/ 	};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}

/******/ 	// This file contains only the entry chunk.
/******/ 	// The chunk loading function for additional chunks
/******/ 	__webpack_require__.e = function requireEnsure(chunkId, callback) {
/******/ 		// "0" is the signal for "already loaded"
/******/ 		if(installedChunks[chunkId] === 0)
/******/ 			return callback.call(null, __webpack_require__);

/******/ 		// an array means "currently loading".
/******/ 		if(installedChunks[chunkId] !== undefined) {
/******/ 			installedChunks[chunkId].push(callback);
/******/ 		} else {
/******/ 			// start chunk loading
/******/ 			installedChunks[chunkId] = [callback];
/******/ 			var head = document.getElementsByTagName('head')[0];
/******/ 			var script = document.createElement('script');
/******/ 			script.type = 'text/javascript';
/******/ 			script.charset = 'utf-8';
/******/ 			script.async = true;

/******/ 			script.src = __webpack_require__.p + "" + chunkId + "." + ({}[chunkId]||chunkId) + ".js";
/******/ 			head.appendChild(script);
/******/ 		}
/******/ 	};

/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/assets/js/";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	__webpack_require__.e/* require */(5/* duplicate */, function(__webpack_require__) { var __WEBPACK_AMD_REQUIRE_ARRAY__ = [
	    __webpack_require__(1),
	    __webpack_require__(2),
	    __webpack_require__(3),
	    __webpack_require__(5)]; (function(
	    models,
	    stream_manager,
	    application_model,
	    shared)
	{
	"use-strict";

	var FavoriteStatus = Object.freeze({
	    Unknown: 0,
	    No: 1,
	    Yes: 2,
	    Hierarchical: 3
	});

	var isHierarchical = function(parentName, uri) {
	    parentName = models.normalizeUri(parentName);
	    if (parentName === uri)
	        return true;

	    var index = uri.lastIndexOf('/');
	    return (index >= 0 && parentName === uri.slice(0, index));
	};

	var isRootStream = function(uri) {
	    return (uri.indexOf('/') === -1);
	};

	/**
	*/
	var AppViewModel = function(user, stream) {
	    var self = this;
	    application_model.AppViewModel.call(this, user);

	    self.stream = ko.observable(stream);
	    self.children = ko.observable(new models.Collection(stream.uri()));
	    self.query = ko.observable();
	    self.favorite = ko.observable(FavoriteStatus.Unknown);

	    self.color = ko.computed(function() {
	        var stream = self.stream();
	        return (stream ? stream.color() : models.DEFAULT_COLOR);
	    });

	    self.setColor = function(color) {
	        if (!self.stream())
	            self.stream(new models.StreamModel());
	        self.stream().setColor(color);
	    };

	    self.addChild = function(child) {
	        self.children().addChild(child);
	    };

	    self.removeChild = function(childUri) {
	        return self.children().children.remove(function(x) {
	             return x.uri() === childUri;
	         });
	    };

	    self.deleteStream = function(child) {
	        $.ajax({
	            type: "DELETE",
	            url: jsRoutes.controllers.StreamApiController.apiDeleteStream(child.id()).url,
	            error: function(e) {

	            }
	        }).then(function() {
	           self.removeChild(child.uri());
	        });
	    };

	    self.isParentOwner = ko.computed(function() {
	         return (!!self.stream() && stream.isOwner(self.user()));
	     });

	    self.removeChildButtonClick = function(child, event) {
	        if (isHierarchical(self.stream().uri(), child.uri())) {
	            bootbox.confirm({
	                title: "Are you sure?",
	                animate: false,
	                closeButton: false,
	                message: "This will permanently delete this stream and all of its children.",
	                callback: function(result) {
	                    if (result) {
	                        self.deleteStream(child);
	                    }
	                }
	            });
	        } else {
	             $.ajax({
	                type: "DELETE",
	                url: jsRoutes.controllers.StreamApiController.apiDeleteChild(self.stream().id(), child.id()).url,
	                error: function(e) {

	                }
	            }).then(function() {
	               self.removeChild(child.uri());
	            });
	        }
	    };

	    self.childSelected = function(child) {

	    };
	};

	AppViewModel.prototype.checkFavorite = function() {
	    var self = this;
	    if (!self.user().userName())
	        return;

	    // If the current stream is the user's root stream of a direct child, it cannot be favorited.
	    if (self.stream().id() === self.user().rootStream() || isHierarchical(self.user().userName(), self.stream().uri())) {
	        self.favorite(FavoriteStatus.Hierarchical);
	    } else {
	        $.ajax({
	            type: "GET",
	            url: jsRoutes.controllers.StreamApiController.apiGetChild(self.user().rootStream(), self.stream().id()).url,
	            error: function(e) {
	                if (e.status === 404) {
	                    self.favorite(FavoriteStatus.No);
	                }
	            }
	        }).then(function() {
	           self.favorite(FavoriteStatus.Yes);
	        });
	    }
	};

	var initialStream = function() {
	    return models.StreamModel.fromJson(window.initialStreamData);
	};

	/**
	    Redraw the favicon for a given status.
	*/
	var updateFavicon = function(color) {
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
	var enableFavoriteButton = function(existing) {
	    $('.stream-favorite')
	        .prop('disabled', false)
	        .prop('title', existing ? "Remove Favorite" : "Add Favorite");

	    if (existing)
	        $('.stream-favorite').addClass('active');
	    else
	        $('.stream-favorite').removeClass('active');

	};

	var disableFavoriteButton = function() {
	    $('.stream-favorite')
	        .prop("disabled", true);
	};

	/**
	*/
	var hideChildForm = function() {
	    $('#create-child-name-input, #create-child-cancel-button').addClass('hidden');
	    $('#create-child-name-input input').val('');
	    $('.create-child .error')
	        .addClass('hidden')
	        .text('');
	};

	var createChildStream = function(model, stream, user, name) {
	    $('.create-child .error').addClass('hidden');

	    $('#create-child-expand-button span')
	        .addClass('glyphicon-refresh glyphicon-refresh-animate');

	    $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button')
	        .prop('disabled', true);

	    var onComplete = function() {
	        $('#create-child-expand-button span')
	            .removeClass('glyphicon-refresh glyphicon-refresh-animate');

	        $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button')
	            .prop('disabled', false);
	    };

	    var getError = function(e) {
	        if (e) {
	            if (e.details) {
	                if (e.details['obj.name']) {
	                    return "Name is invalid. Must be between 1 and 64 letters and numbers.";
	                }
	            }
	            if (e.error)
	                return e.error;
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
	        error: function(e) {
	            $('.create-child .error')
	                .removeClass('hidden')
	                .text(getError(e.responseJSON));

	            onComplete();
	        }
	    }).then(function(result) {
	        model.addChild(models.StreamModel.fromJson(result));
	        onComplete();
	        hideChildForm();
	    });
	};

	/**
	*/
	var addFavorite = function(model, targetStreamId, childId) {
	    disableFavoriteButton();
	    $.ajax({
	        type: "PUT",
	        url: jsRoutes.controllers.StreamApiController.apiCreateChild(targetStreamId, childId).url,
	        error: function(error) {
	            model.favorite(FavoriteStatus.Unknown);
	        }
	    }).then(function(result) {
	        model.favorite(FavoriteStatus.Yes);
	    });
	};

	var removeFavorite = function(model, targetStreamId, childId) {
	    disableFavoriteButton();
	    $.ajax({
	        type: "DELETE",
	        url: jsRoutes.controllers.StreamApiController.apiDeleteChild(targetStreamId, childId).url,
	        error: function(error) {
	            model.favorite(FavoriteStatus.Unknown);
	        }
	    }).then(function(result) {
	        model.favorite(FavoriteStatus.No);
	    });
	};

	var updateSearchResultsForQuery = function(model, query) {
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
	        error: function(e) {
	            $('.list-loading').addClass('hidden');
	        }
	    }).done(function(result) {
	        $('.list-loading').addClass('hidden');
	        model.query(query);
	        model.children().children((result || []).map(models.StreamModel.fromJson));
	    });
	};

	var updateSearchResults = function(model) {
	    var query = $('#stream-search-form input').val();
	    return updateSearchResultsForQuery(model, query);
	};

	/**
	*/
	var updateStreamTags = function(model, tags) {
	    $.ajax({
	        type: "POST",
	        url: jsRoutes.controllers.StreamApiController.setTags(model.stream().id()).url,
	        contentType: 'application/json',
	        data: JSON.stringify(tags.map(function(x) { return { "tag": x.value() }; })),
	        headers: {
	            accept: "application/json"
	        },
	        error: function(e) {

	        }
	    }).done(function(result) {
	        model.stream().tags(
	            result.map(function(tag) {
	                return new models.TagModel(tag.tag);
	            }));
	    });
	};

	/**
	    Convert a list of tags to a editable string representation.
	*/
	var tagsToString = function(tags) {
	    return Array.prototype.map.call(tags, function(x) { return x.value(); })
	        .join(', ');
	};

	/**
	    Convert a string to a list of tags.
	*/
	var stringToTags = function(tags) {
	    return (tags.match(/([a-zA-Z0-9_\-$])+/ig) || []).map(function(tag) {
	        return new models.TagModel(tag.trim());
	    });
	};

	/**
	    Edit the stream's tags.
	*/
	var editTags = function(model) {
	    $('#save-tags-button').removeClass('hidden');
	    $('#edit-tags-button').addClass('hidden');
	    $('.tag-list').addClass('hidden');

	    $('#tag-input')
	        .removeClass('hidden');

	    $('#tag-input input')
	        .val(tagsToString(model.stream().tags()));
	};

	/**
	    Save the edited tags.
	*/
	var saveTags = function(model) {
	    $('#save-tags-button').addClass('hidden');
	    $('#edit-tags-button').removeClass('hidden');
	    $('#tag-input').addClass('hidden');
	    $('.tag-list').removeClass('hidden');

	    var tags = stringToTags($('#tag-input input').val());
	    updateStreamTags(model, tags);
	};

	/**
	*/
	$(function(){
	    var model = new AppViewModel(
	        application_model.initialUser(),
	        initialStream());

	    var updateStatus = function(color) {
	        var stream = model.stream();
	        if (!stream)
	            return;

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

	    var statusPicker = (function() {
	        var currentColor = models.DEFAULT_COLOR;
	        var pickedColor = models.DEFAULT_COLOR;
	        model.manager.subscribe(model.stream().uri(), {
	            'StatusUpdated': function(msg) {
	                if (msg.from === model.stream().uri()) {
	                    currentColor = msg.status.color;
	                }
	            }
	        });

	        var statusPicker = $('.status-picker')
	            .spectrum({
	                showInput: true,
	                showPalette: true,
	                showSelectionPalette: true,
	                preferredFormat: "hex",
	                localStorageKey: "blotre.stream.statusPicker"
	            })
	            .on('show.spectrum', function(e, color) {
	                pickedColor = currentColor = color + '';
	            })
	            .on('move.spectrum change.spectrum', function(e, color) {
	                model.setColor(color + '');
	            })
	            .on('hide.spectrum', function(e, color) {
	                pickedColor = color + '';
	                model.setColor(currentColor);
	            });

	        $('.sp-choose')
	            .on('click', function() {
	                updateStatus(pickedColor + '');
	            });

	        return statusPicker;
	    }());

	    $('.status-picker-form')
	        .on('submit', function(e) {
	            e.preventDefault();
	            var color = $(this).children('.status-picker').val();
	            updateStatus(color);
	        });

	    // Create child form
	    $('#create-child-expand-button')
	        .on('click', function(e) {
	            var hidden = $('#create-child-name-input').hasClass('hidden');
	            var target = $('#create-child-name-input, #create-child-cancel-button');
	            if (hidden) {
	                target.removeClass('hidden');
	            } else {
	                createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val().trim());
	            }
	        });

	    $('#create-child-name-input').keypress(function(e) {
	        if (e.keyCode === 13) {
	            createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val().trim());
	        }
	    });

	    $('#create-child-cancel-button button')
	        .on('click', hideChildForm);

	    // Tag editor
	    $('#edit-tags-button').on('click', function(e) {
	        editTags(model);
	    });

	    $('#save-tags-button').on('click', function(e) {
	        saveTags(model);
	    });

	    $('#tag-input input').keypress(function(e) {
	        if (e.keyCode === 13 /*enter*/) {
	            saveTags(model);
	        }
	    });

	    // Child Search
	    $('#stream-search-form button').on('click', function(e) {
	        e.preventDefault();
	        updateSearchResults(model);
	    });

	    $('#stream-search-form input').keypress(function(e) {
	        if (e.keyCode === 13 /*enter*/) {
	            updateSearchResults(model);
	            e.preventDefault();
	        }
	    });

	    // Children
	    var query = shared.getQueryString().query;
	    updateSearchResultsForQuery(model, (query || ''));

	    model.manager.subscribeCollection(model.stream().uri(), {
	        'StatusUpdated': function(msg) {
	            var existingChild = model.removeChild(msg.from);
	            if (existingChild.length) {
	                existingChild[0].status(models.StatusModel.fromJson(msg.status));
	                model.addChild(existingChild[0]);
	            }
	        },
	        'ChildAdded': function(msg) {
	            model.addChild(models.StreamModel.fromJson(msg.child));
	        },
	        'ChildRemoved': function(msg) {
	            model.removeChild(msg.child);
	        }
	    });

	    model.color.subscribe(updateFavicon);

	    model.children().children.subscribe(function(results) {
	        if (results.length)
	            $('.no-results').addClass('hidden');
	        else
	            $('.no-results').removeClass('hidden');
	    });

	    // Favorite Button
	    disableFavoriteButton();

	    model.favorite.subscribe(function(status) {
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


	    $('button.stream-favorite').click(function(e) {
	        switch (model.favorite()) {
	        case FavoriteStatus.Yes:
	            return removeFavorite(model, model.user().rootStream(), model.stream().id());
	        case FavoriteStatus.No:
	            return addFavorite(model, model.user().rootStream(), model.stream().id());
	        }
	    });

	    model.manager.subscribe(model.stream().uri(), {
	        'StatusUpdated': function(msg) {
	            if (msg.from === model.stream().uri()) {
	                model.setColor(msg.status.color);
	                model.stream().updated(new Date(msg.status.created));
	                statusPicker.spectrum("set", msg.status.color);
	            }
	        },
	        'ParentAdded': function(msg) {
	            if (msg.from === model.stream().uri() && msg.parent.uri === model.user().userName())
	                model.favorite(FavoriteStatus.Yes);
	        },
	        'ParentRemoved': function(msg) {
	            if (msg.from === model.stream().uri() && msg.parent === model.user().userName())
	                model.favorite(FavoriteStatus.No);
	        },
	    });

	    ko.applyBindings(model);
	});

	}.apply(null, __WEBPACK_AMD_REQUIRE_ARRAY__));});

/***/ }
/******/ ]);