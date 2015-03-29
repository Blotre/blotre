require([
    './models',
    './stream_manager',
    './application_model'],
function(
    models,
    stream_manager,
    application_model)
{
"use-strict";


var AppViewModel = function(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);
};

var getTarget = function() {
    var path = window.location.pathname.match('/s/(.+)');
    return ((path && path[1]) || '');
};

$(function(){
    var model = new AppViewModel(
        application_model.initialUser());

    $('.create-child-button').click(function(e) {
        $.ajax({
            type: "PUT",
            url: jsRoutes.controllers.Stream.createChildStream(getTarget()).url
        })
        .then(function(result) {
            debugger;
        });
    });

    ko.applyBindings(model);
});

});