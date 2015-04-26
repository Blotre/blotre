require([
    './models',
    './application_model'],
function(
    models,
    application_model)
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
    $.ajax({
        type: "POST",
        url: jsRoutes.controllers.DeveloperController.setRedirects(clientId).url,
        data: JSON.stringify(rediectBlob.split('\n')),
        contentType: 'application/json',
        error: function() {
            // todo: display error msg
        }
    }).done(function(result) {

    });
};

var deleteClient = function(clientId) {
    $.ajax({
        type: "DELETE",
        url: jsRoutes.controllers.DeveloperController.deleteClient(clientId).url,
        error: function() {
            // todo: display error msg
        }
    }).done(function(result) {
        window.location = jsRoutes.controllers.DeveloperController.index().url;
    });
};


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
        currentRedirects = $('#redirects-textbox').val();
        updateRedirects(model.clientId(), currentRedirects);
    });

    $('#delete-client-button').on('click', function(e) {
        askDeleteClient(model.clientId());
    });
});

});