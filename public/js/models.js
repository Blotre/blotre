define([], function() {

var slice = Function.prototype.call.bind(Array.prototype.slice);

var DEFAULT_COLOR = '#777777';

/**
*/
var normalizeUri = function(uri) {
    return decodeURI(uri)
        .trim()
        .toLowerCase()
        .replace(' ', '/');
};

/**
    Pretty prints a data.
*/
var dateToDisplay = (function(){
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    var pad = function(min, input) {
        input += '';
        while (input.length < min)
            input = '0' + input;
        return input;
    };

    return function(date) {
        if (!date)
            return '-';

        return months[date.getMonth()] + ' ' + pad(2, date.getDate()) + ', ' + date.getFullYear() + ' '
            + pad(2, date.getHours()) + ':' + pad(2, date.getMinutes()) + '.'
            + pad(2, date.getSeconds()) + pad(3, date.getMilliseconds())
    };
}());

/**
*/
var StatusModel = function(color) {
   var self = this;
   self.color = ko.observable(color);
};

StatusModel.empty = function() {
    return new StatusModel(DEFAULT_COLOR);
};

StatusModel.fromJson = function(data) {
    return new StatusModel(data && data.color);
};

/**
*/
var TagModel = function(value) {
   var self = this;
   self.value = ko.observable(value);

    self.url = ko.computed(function() {
       return jsRoutes.controllers.Stream.getTag(self.value()).url;
   });
};

/**
*/
var StreamModel = function(id, name, uri, status, updated, tags) {
    var self = this;
    self.id = ko.observable(id);
    self.name = ko.observable(name || '');
    self.uri = ko.observable(uri || '');
    self.status = ko.observable(status || StatusModel.empty());
    self.updated = ko.observable(updated);
    self.tags = ko.observableArray(tags || []);

    self.url = ko.computed(function() {
        return jsRoutes.controllers.Stream.getStream(self.uri()).url;
    });

    self.color = ko.computed(function() {
        var status = self.status();
        return (status ? status.color() : DEFAULT_COLOR);
    });

    self.setColor = function(color) {
        var status = self.status() || StatusModel.empty();
        status.color(color);
        self.status(status);
    };

    self.displayUpdated = ko.computed(function() {
        return dateToDisplay(self.updated());
    });

    self.isOwner = function(user) {
        var ownerUri = normalizeUri(user.userName());
        return (ownerUri === self.uri() || self.uri().indexOf(ownerUri + '/') === 0);
    };
};

StreamModel.fromJson = function(data) {
    return new StreamModel(
        data && data.id,
        data && data.name,
        data && data.uri,
        StatusModel.fromJson(data && data.status),
        new Date(data && data.updated),
        (data && data.tags || []).map(function(x){ return new TagModel(x.tag); }));
};

/**
*/
var UserModel = function(userName, status, rootStream) {
    var self = this;
    self.userName = ko.observable(userName || '');
    self.status = ko.observable(status || StatusModel.empty());
    self.rootStream = ko.observable(rootStream);

    self.color = ko.computed(function() {
        var status = self.status();
        return (status ? status.color() : DEFAULT_COLOR);
    });
};

UserModel.fromJson = function(data) {
    return new UserModel(
        data && data.userName,
        StatusModel.fromJson(data && data.status),
        data && data.rootStream);
};

/**
*/
var Collection = function(uri) {
    var self = this;
    self.uri = ko.observable(uri);
    self.children = ko.observableArray();

     self.addChild = function(child) {
       self.children.remove(function(x) {
            return x.uri() === child.uri();
        });
        self.children.unshift(child);
    };
};

return {
    DEFAULT_COLOR: DEFAULT_COLOR,

    normalizeUri: normalizeUri,

    StatusModel: StatusModel,
    StreamModel: StreamModel,
    TagModel: TagModel,

    UserModel: UserModel,
    Collection: Collection
};

});