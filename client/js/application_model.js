"use strict";
import * as models from './models';
import * as stream_manager from './stream_manager';

/**
*/
var AppViewModel = function(user, page) {
    var self = this;
    self.user = ko.observable(user);
    self.page = ko.observable(page);
    self.favorites = ko.observable(new models.Collection(user.userName()));

    self.manager = new stream_manager.StreamManager();

    self.addFavorite = function(child) {
        self.favorites().addChild(child);
    };

    self.removeFavorite = function(childUri) {
        return self.favorites().children.remove(function(x) {
             return x.uri() === childUri;
         });
    };

    // Subscribe to user status updates
    self.manager.subscribe(user.userName(), {
        'StatusUpdated': function(msg) {
            self.user().status(new models.StatusModel(msg.status.color));
        }
    });

    if (!user || !user.rootStream())
        return;

    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.apiGetChildren(user.rootStream()).url,
        headers: {
            accept: "application/json"
        },
        error: function(e) { console.error(e); }
    }).done(function(result) {
        self.favorites().children((result || []).map(models.StreamModel.fromJson));
    });

     // Subscribe to user collection updates
    self.manager.subscribeCollection(user.userName(), {
        'StatusUpdated': function(msg) {
            var existingChild = self.removeFavorite(msg.from);
            if (existingChild.length) {
                existingChild[0].status(models.StatusModel.fromJson(msg.status));
                self.addFavorite(existingChild[0]);
            }
        },
        'ChildAdded': function(msg) {
            self.addFavorite(models.StreamModel.fromJson(msg.child));
        },
        'ChildRemoved': function(msg) {
            self.removeFavorite(msg.child);
        }
    });
};

var initialUser = function() {
    return models.UserModel.fromJson(window.initialUserData);
};

module.exports = {
    AppViewModel: AppViewModel,
    initialUser: initialUser
};
