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

/**
*/
var AppViewModel = function(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.stream = ko.observable(stream);

    self.color = ko.computed(function() {
        var stream = self.stream();
        return (stream ? stream.color() : models.DEFAULT_COLOR);
    });

    self.setColor = function(color) {
        var stream = self.stream() || new models.StreamModel();
        stream.setColor(color);
        self.stream(stream);
    };
};

var initialStream = function() {
    return models.StreamModel.fromJson(window.initialStreamData);
};

/**
*/
var updateFavicon = function(color) {
    var canvas = document.createElement('canvas');
    var link = document.getElementById('favicon');

    canvas.width = canvas.height = 1;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    link.href = canvas.toDataURL('image/png');
};

var enableFavoriteButton = function() {
    $('.stream-favorite')
        .prop("disabled", false);
};

var disableFavoriteButton = function() {
    $('.stream-favorite')
        .prop("disabled", true)
        .off('click');
};

var toggleFavoriteButton = function(stream, user) {
    if (!stream || !user) {
        disableFavoriteButton();
    } else {
        enableFavoriteButton()
    }
};

/**
*/
$(function(){
    var model = new AppViewModel(
        application_model.initialUser(),
        initialStream());

    var updateStatus = function(color) {
        var stream = model.stream();
        if (!stream)
            return;

        $.ajax({
            type: "POST",
            url: jsRoutes.controllers.Stream.apiSetStreamStatus(stream.id()).url,
            contentType: 'application/json',
            data: JSON.stringify({
                color: color
            })
        });

        model.stream().updated(new Date());
        model.setColor(color);
    };

    var statusPicker = (function(){
        var currentColor = models.DEFAULT_COLOR;
        var pickedColor = models.DEFAULT_COLOR;
        var statusPicker = $('.status-picker')
            .spectrum({
                showInput: true,
                showPalette: true,
                showSelectionPalette: true,
                preferredFormat: "hex",
                localStorageKey: "blotre.stream.statusPicker"
            })
            .on('show.spectrum', function(e, color) {
                pickedColor = currentColor = color + '';
            })
            .on('move.spectrum change.spectrum', function(e, color) {
                model.setColor(color + '');
            })
            .on('hide.spectrum', function(e, color) {
                pickedColor = color + '';
                model.setColor(currentColor);
            });

        $('.sp-choose')
            .on('click', function() {
                updateStatus(pickedColor + '');
            });

        return statusPicker;
    }());

    $('.status-picker-form')
        .on('submit', function(e) {
            e.preventDefault();
            var color = $(this).children('.status-picker').val();
            updateStatus(color);
        });

    model.stream.subscribe(function(x) {
        toggleFavoriteButton(x, model.user());
    });

    model.color.subscribe(updateFavicon);

    model.manager.subscribe(model.stream().uri(), function(stream) {
        model.setColor(stream.status.color);
        model.stream().updated(new Date(stream.updated));

        statusPicker.spectrum("set", stream.status.color);
    });

    ko.applyBindings(model);
    toggleFavoriteButton();
});

});