require([
    './models',
    './shared',
    './stream_manager',
    './application_model'],
function(
    models,
    shared,
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
        var btn = $(this);
        shared.lockButton(btn);

        var uri = getTarget();
        var name = uri.slice(uri.lastIndexOf('/') + 1);
        $.ajax({
            type: "PUT",
            url: jsRoutes.controllers.Stream.apiCreateStream().url,
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

});