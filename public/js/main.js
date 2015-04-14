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

    self.children = ko.observable(new models.Collection(stream.uri()));

    self.color = ko.computed(function() {
        var stream = self.stream();
        return (stream ? stream.color() : models.DEFAULT_COLOR);
    });

    self.setColor = function(color) {
        if (!self.stream())
            self.stream(new models.StreamModel());
        self.stream().setColor(color);
    };

    self.addChild = function(child) {
        self.children().addChild(child);
    };
};

var initialStream = function() {
    return models.StreamModel.fromJson(window.initialStreamData);
};

/**
    Redraw the favicon for a given status.
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

/**
*/
var enableFavoriteButton = function() {
    $('.stream-favorite')
        .prop("disabled", false);
};

var disableFavoriteButton = function() {
    $('.stream-favorite')
        .prop("disabled", true);
};

var toggleFavoriteButton = function(stream, user) {
    disableFavoriteButton();

    if (stream && user && user.rootStream() && user.rootStream() !== stream.id()) {
        $.ajax({
            type: "GET",
            url: jsRoutes.controllers.Stream.apiGetChild(user.rootStream(), stream.id()).url,
            error: function(e) {
                enableFavoriteButton();
            }
        });
    }
};

/**
*/
var hideChildForm = function() {
    $('#create-child-name-input, #create-child-cancel-button').addClass('hidden');
    $('#create-child-name-input input').val('');
};

var createChildStream = function(model, stream, user, name) {
    $('#create-child-expand-button')
        .addClass('glyphicon-refresh glyphicon-refresh-animate');

    $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button')
        .prop('disabled', true);

    var onComplete = function() {
        $('#create-child-expand-button')
            .removeClass('glyphicon-refresh glyphicon-refresh-animate');

        $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button')
            .prop('disabled', false);
    };

    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.Stream.apiCreateStream().url,
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          uri: stream.uri() + "/" + name
        }),
        error: function(error) {
            console.error(error);
            onComplete();
        }
    }).then(function(result) {
        model.addChild(models.StreamModel.fromJson(result));
        onComplete();
        hideChildForm();
    });
};

/**
*/
var addFavorite = function(targetStreamId, childId) {
    disableFavoriteButton();
    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.Stream.apiCreateChild(targetStreamId, childId).url,
        error: function(error) {
            enableFavoriteButton();
        }
    }).then(function(result) {
        alert('fas')
    });
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

    // Create child form
    $('#create-child-expand-button')
        .on('click', function(e) {
            var hidden = $('#create-child-name-input').hasClass('hidden');
            var target = $('#create-child-name-input, #create-child-cancel-button')
            if (hidden) {
                target.removeClass('hidden');
            } else {
                createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val());
            }
        });

    $('#create-child-cancel-button button')
        .on('click', hideChildForm);

    // Favorite Button
    $('button.stream-favorite').click(function(e) {
        addFavorite(model.user().rootStream(), model.stream().id());
    });

    // Children
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.Stream.apiGetChildren(model.stream().id()).url
    }).then(function(children) {
        model.children().children((children || []).map(models.StreamModel.fromJson));
    });

    model.manager.subscribeCollection(model.stream().uri(), {
        'statusUpdate': function(from, stream) {
            var existingChild = model.children.remove(function(x) {
                return x.uri() === stream.uri;
            });
            if (existingChild.length) {
                existingChild[0].status(models.StatusModel.fromJson(stream.status));
                model.children.unshift(existingChild[0]);
            }
        },
        'childAdded': function(from, child) {
            model.addChild(models.StreamModel.fromJson(child));
        }
    });

    model.color.subscribe(updateFavicon);

    model.manager.subscribe(model.stream().uri(), {
        'statusUpdate': function(stream) {
            model.setColor(stream.status.color);
            model.stream().updated(new Date(stream.updated));

            statusPicker.spectrum("set", stream.status.color);
        }
    });

    ko.applyBindings(model);
    toggleFavoriteButton();
});

});