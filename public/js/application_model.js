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
    self.favorites = ko.observableArray();

    self.manager = new stream_manager.StreamManager();

    self.manager.subscribe(user.userName(), {
        'StatusUpdate': function(msg) {
            if (msg.from === user.userName()) {
                self.user().status(new models.StatusModel(msg.status.color));
            }
        }
    });
};

var initialUser = function() {
    return models.UserModel.fromJson(window.initialUserData);
};

return {
    AppViewModel: AppViewModel,
    initialUser: initialUser
};

});