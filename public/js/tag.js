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
/******/ 		8:0
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

	/**
	*/
	var TagViewModel = function(tag, user, results) {
	    var self = this;
	    application_model.AppViewModel.call(this, user);

	    self.tag = ko.observable(tag);
	    self.user = ko.observable(user);
	    self.children = ko.observable(new models.Collection(tag));
	    self.query = ko.observable(undefined);

	    self.addChild = function(child) {
	        self.children().addChild(child);
	    };

	    self.removeChild = function(childUri) {
	        return self.children().children.remove(function(x) {
	             return x.uri() === childUri;
	         });
	    };
	};

	var normalizeQuery = function(query) {
	    return decodeURI(query).replace(/\+/g, ' ').trim();
	};

	var updateSearchResultsForQuery = function(model, query) {
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
	        error: function() {
	            $('.list-loading').addClass('hidden');
	            // todo: display error msg
	        }
	    }).done(function(result) {
	        $('.list-loading').addClass('hidden');
	        model.query(query);
	        model.children().children((result || []).map(models.StreamModel.fromJson));
	    });
	};

	var updateSearchResults = function(model) {
	    return updateSearchResultsForQuery(
	        model,
	        normalizeQuery($('#stream-search-form input').val()));
	};

	var getQueryFromQueryString = function() {
	    var qs = shared.getQueryString().query;
	    return (qs ? normalizeQuery(qs[0]) : '');
	};

	var updateFromQueryString = function(model) {
	    var query = getQueryFromQueryString();
	    $('#stream-search-form input').val(query);
	    updateSearchResultsForQuery(model, query);
	};

	$(function(){
	    var model = new TagViewModel(
	        window.initialTag.tag,
	        application_model.initialUser(),
	        []);

	    $('#stream-search-form button').click(function(e) {
	        e.preventDefault();
	        updateSearchResults(model);
	    });

	    $('#stream-search-form input').keypress(function(e) {
	        if (e.keyCode === 13) {
	            updateSearchResults(model);
	            e.preventDefault();
	        }
	    });

	    model.children().children.subscribe(function(results) {
	        if (results.length)
	            $('.no-results').addClass('hidden');
	        else
	            $('.no-results').removeClass('hidden');
	    });

	    model.query.subscribe(function(query) {
	        var currentQuery = (window.history.state ? window.history.state.query : undefined);
	        if (query === currentQuery)
	            return;
	        var path = window.location.origin + window.location.pathname;
	        var url = (query ? path + "?query=" + encodeURIComponent(query) : path);
	        window.history.pushState({ query: query }, '', url);
	    });

	    model.manager.subscribeCollection('#' + model.tag(), {
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

	    window.onpopstate = function(e) {
	        updateFromQueryString(model);
	    };

	    window.history.replaceState({ query: getQueryFromQueryString() }, '', window.location.href);

	    updateFromQueryString(model);

	    ko.applyBindings(model);
	});

	}.apply(null, __WEBPACK_AMD_REQUIRE_ARRAY__));});

/***/ }
/******/ ]);