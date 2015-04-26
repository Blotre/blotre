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

/**
*/
$(function() {
    var model = new StreamIndexViewModel(
        application_model.initialUser(),
        window.clientId);

    $('#cancel-redirects-button').on('click', function(e) {
        $('#save-redirects-button, #cancel-redirects-button')
            .attr("disabled", true);
    });

    $('#redirects-textbox').on('input', function(e) {
        $('#save-redirects-button, #cancel-redirects-button')
            .attr("disabled", false);
    });

    $('#save-redirects-button').on('click', function(e) {
        updateRedirects(model.clientId(), $('#redirects-textbox').val());
    });
});

});