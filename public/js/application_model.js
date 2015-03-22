define([
    './models',
    './stream_manager'],
function(
    models,
    stream_manager)
{
"use-strict";

/**
*/
var AppViewModel = function(user, page) {
    var self = this;
    self.user = ko.observable(user);
    self.page = ko.observable(page);

    self.manager = new stream_manager.StreamManager();

    self.user().userName.subscribe(function(userName) {
        self.manager.subscribe(userName, function(stream) {
            model.user().status(new models.StatusModel(stream.status.color));
        });
    });

    self.user().userName.subscribe(function(userName) {
        self.manager.unsubscribe(userName);
    }, null, "beforeChange");
};

var initialUser = function() {
    return models.UserModel.fromJson(window.initialUserData);
};

return {
    AppViewModel: AppViewModel,
    initialUser: initialUser
};

});