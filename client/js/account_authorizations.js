"use strict";
const models = require('./models');
const stream_manager = require('./stream_manager');
const application_model = require('./application_model');

var AppViewModel = function(user) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.authorizations = ko.observableArray();

    self.removeAuthorization = function(clientId) {
        return self.authorizations.remove(function(x) {
            return x.clientId() === clientId;
        });
    };

    self.revokeAuthorization = function(authorization, event) {
        $.ajax({
            type: "DELETE",
            url: jsRoutes.controllers.Account.revokeAuthorization(authorization.clientId()).url,
        }).then(function() {
           self.removeAuthorization(authorization.clientId());
        });
    };
};

var Authorization = function(clientId, clientName, issued) {
    var self = this;

    self.clientId = ko.observable(clientId);
    self.clientName = ko.observable(clientName);
    self.issued = ko.observable(issued);
};

$(function(){
    var model = new AppViewModel(
        application_model.initialUser());

    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.Account.authorizations().url,
        headers: {
             Accept : "application/json"
        }
    })
    .then(function(result) {
        model.authorizations(result.map(function(x) {
            return new Authorization(x.clientId, x.clientName, x.issued);
        }));
    });

    ko.applyBindings(model);
});
