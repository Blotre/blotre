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
/******/ 		2:0
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

	__webpack_require__.e/* require */(3, function(__webpack_require__) { var __WEBPACK_AMD_REQUIRE_ARRAY__ = [
	    __webpack_require__(1),
	    __webpack_require__(3),
	    __webpack_require__(4)]; (function(
	    models,
	    application_model,
	    ui)
	{
	"use-strict";

	/**
	*/
	var StreamIndexViewModel = function(user, clientId) {
	    var self = this;
	    application_model.AppViewModel.call(this, user);

	    self.clientId = ko.observable(clientId);
	};


	var updateRedirects = function(clientId, rediectBlob) {
	    ui.showLoadingScreen();
	    $.ajax({
	        type: "POST",
	        url: jsRoutes.controllers.DeveloperController.setRedirects(clientId).url,
	        data: JSON.stringify(rediectBlob.split('\n')),
	        contentType: 'application/json',
	        error: function(e) {
	            ui.setAlert('alert-danger', e.status == 422 ? "Specified redirects are invalid. Must be at most 10 http(s) urls." : "An error occurred.");
	            ui.hideLoadingScreen();
	        }
	    }).done(function(result) {
	        ui.clearAlerts();
	        ui.hideLoadingScreen();
	    });
	};

	/**
	    Actually delete the client.

	    Redirects to the developer home page on success.
	*/
	var deleteClient = function(clientId) {
	    ui.showLoadingScreen();
	    $.ajax({
	        type: "DELETE",
	        url: jsRoutes.controllers.DeveloperController.deleteClient(clientId).url,
	        error: function() {
	            ui.setAlert('alert-danger', "Could not delete client, please try again.");
	            ui.hideLoadingScreen();
	        }
	    }).done(function(result) {
	        window.location = jsRoutes.controllers.DeveloperController.index().url;
	    });
	};

	/**
	    Prompt the user to ensure they really want to delete the client.
	*/
	var askDeleteClient = function(clientId) {
	    bootbox.confirm({
	        title: "Are you sure?",
	        animate: false,
	        closeButton: false,
	        message: "This will permanently delete this client and invalidate all token for it.",
	        callback: function(result) {
	            if (result) {
	                deleteClient(clientId);
	            }
	        }
	    });
	};

	/**
	*/
	$(function() {
	    var model = new StreamIndexViewModel(
	        application_model.initialUser(),
	        window.clientId);

	    var currentRedirects =  $('#redirects-textbox').val();

	    $('#cancel-redirects-button').on('click', function(e) {
	        $('#redirects-textbox').val(currentRedirects);
	        $('#save-redirects-button, #cancel-redirects-button')
	            .attr("disabled", true);
	    });

	    $('#redirects-textbox').on('input', function(e) {
	        $('#save-redirects-button, #cancel-redirects-button')
	            .attr("disabled", false);
	    });

	    $('#save-redirects-button').on('click', function() {
	        updateRedirects(model.clientId(), $('#redirects-textbox').val());
	    });

	    $('#delete-client-button').on('click', function(e) {
	        askDeleteClient(model.clientId());
	    });
	});

	}.apply(null, __WEBPACK_AMD_REQUIRE_ARRAY__));});

/***/ }
/******/ ]);