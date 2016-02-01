"use strict";
import * as models from './models.js';
import * as stream_manager from './stream_manager.js';
import * as application_model from './application_model.js';
import * as shared from './shared.js';

var AppViewModel = function(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);
};

var getTarget = function() {
    var path = decodeURIComponent(window.location.pathname).match('/s/(.+)');
    return ((path && path[1]) || '');
};

$(function() {
    var model = new AppViewModel(
        application_model.initialUser());

    $('.create-child-button').click(function(e) {
        var btn = $(this);
        shared.lockButton(btn);

        var rawUri = getTarget();
        var parentIndex = rawUri.lastIndexOf('/');
        var parent = rawUri.slice(0, parentIndex);
        var name = rawUri.slice(parentIndex + 1).trim();
        var uri = parent + "/" + name;
        $.ajax({
                type: "PUT",
                url: jsRoutes.controllers.StreamApiController.apiCreateStream().url,
                contentType: 'application/json',
                data: JSON.stringify({
                    name: name,
                    uri: uri
                }),
                error: function(e) {
                    shared.unlockButton(btn);
                }
            })
            .then(function(result) {
                if (result && !result.error) {
                    document.location.href = jsRoutes.controllers.Stream.getStream(result.uri).url;
                } else {
                    shared.unlockButton(btn);
                }
            });
    });

    ko.applyBindings(model);
});
