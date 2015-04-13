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

    self.manager.subscribe(user.userName(), {
        'statusUpdate': function(stream) {
            self.user().status(new models.StatusModel(stream.status.color));
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