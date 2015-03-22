define([], function() {

var DEFAULT_COLOR = '#777777'

var slice = Function.prototype.call.bind(Array.prototype.slice);

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

/**
*/
var StreamModel = function(uri, status, updated) {
    var self = this;
    self.uri = ko.observable(uri);
    self.status = ko.observable(status || new StatusModel());
    self.updated = ko.observable(updated);

    self.color = ko.computed(function() {
        var status = self.status();
        return (status ? status.color() : DEFAULT_COLOR);
    });

    self.setColor = function(color) {
        var status = self.status() || new StatusModel();
        status.color(color);
        self.status(status);
    };

    self.displayUpdated = ko.computed(function() {
        return dateToDisplay(self.updated());
    });
};

/**
*/
var UserModel = function(username, status) {
    var self = this;
    self.userName = ko.observable(username);
    self.status = ko.observable(status || new StatusModel(DEFAULT_COLOR));

    self.color = ko.computed(function() {
        var status = self.status();
        return (status ? status.color() : DEFAULT_COLOR);
    });
};


return {
    DEFAULT_COLOR: DEFAULT_COLOR,
    StatusModel: StatusModel,
    StreamModel: StreamModel,
    UserModel: UserModel
};

});