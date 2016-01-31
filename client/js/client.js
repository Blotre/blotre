"use-strict";
import * as models from './models';
import * as ui from './ui';
import * as application_model from './application_model';

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
