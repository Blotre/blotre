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
    }, null, "beforeChange")
};

var initialUser = function() {
    if (window.initialUserData) {
        return new models.UserModel(
            initialUserData.userName,
            new models.StatusModel(initialUserData.status.color));
    }

    return new models.UserModel('', new models.StatusModel(models.DEFAULT_COLOR));
};

return {
    AppViewModel: AppViewModel,
    initialUser: initialUser
};

});