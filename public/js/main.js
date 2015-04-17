require([
    './models',
    './stream_manager',
    './application_model',
    './shared'],
function(
    models,
    stream_manager,
    application_model,
    shared)
{
"use-strict";

var FavoriteStatus = Object.freeze({
    Unknown: 0,
    No: 1,
    Yes: 2,
    Hierarchical: 3
});

/**
*/
var AppViewModel = function(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.stream = ko.observable(stream);
    self.children = ko.observable(new models.Collection(stream.uri()));
    self.query = ko.observable();
    self.favorite = ko.observable(FavoriteStatus.Unknown);

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

    self.removeChild = function(childUri) {
        return self.children().children.remove(function(x) {
             return x.uri() === childUri;
         });
    };
};

var isHierarchical = function(parentName, uri) {
    if (parentName === uri)
        return true;

    var index = uri.lastIndexOf('/');
    return (index >= 0 && parentName === uri.slice(0, index));
};

AppViewModel.prototype.checkFavorite = function() {
    var self = this;

    if (isHierarchical(self.user().userName(), self.stream().uri())) {
        self.favorite(FavoriteStatus.Hierarchical);
    } else {
        $.ajax({
            type: "GET",
            url: jsRoutes.controllers.Stream.apiGetChild(self.user().rootStream(), self.stream().id()).url,
            error: function(e) {
                if (e.status === 404) {
                    self.favorite(FavoriteStatus.No);
                }
            }
        }).then(function() {
           self.favorite(FavoriteStatus.Yes);
        });
    }
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
var enableFavoriteButton = function(existing) {
    $('.stream-favorite')
        .prop('disabled', false)
        .prop('title', existing ? "Remove Favorite" : "Add Favorite");

    if (existing) {
        $('.stream-favorite')
            .addClass('active');
    }
};

var disableFavoriteButton = function() {
    $('.stream-favorite')
        .prop("disabled", true);
};

/**
*/
var hideChildForm = function() {
    $('#create-child-name-input, #create-child-cancel-button').addClass('hidden');
    $('#create-child-name-input input').val('');
    $('.create-child .error')
        .addClass('hidden')
        .text('');
};

var createChildStream = function(model, stream, user, name) {
    $('.create-child .error').addClass('hidden');

    $('#create-child-expand-button span')
        .addClass('glyphicon-refresh glyphicon-refresh-animate');

    $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button')
        .prop('disabled', true);

    var onComplete = function() {
        $('#create-child-expand-button span')
            .removeClass('glyphicon-refresh glyphicon-refresh-animate');

        $('#create-child-name-input input, #create-child-cancel-button button, #create-child-expand-button')
            .prop('disabled', false);
    };

    var getError = function(e) {
        if (e && e.details) {
            var details = e.details;
            if (details['obj.name'])
                return "Name is invalid. Must be between 1 and 64 letters and numbers."
        }
        return "An error occurred";
    };

    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.Stream.apiCreateStream().url,
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          uri: stream.uri() + "/" + name
        }),
        error: function(e) {
            $('.create-child .error')
                .removeClass('hidden')
                .text(getError(e.responseJSON));

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
var addFavorite = function(model, targetStreamId, childId) {
    disableFavoriteButton();
    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.Stream.apiCreateChild(targetStreamId, childId).url,
        error: function(error) {
            model.favorite(FavoriteStatus.Unknown);
        }
    }).then(function(result) {
        model.favorite(FavoriteStatus.Yes);
    });
};

var removeFavorite = function(model, targetStreamId, childId) {
    disableFavoriteButton();
    $.ajax({
        type: "DELETE",
        url: jsRoutes.controllers.Stream.apiDeleteChild(targetStreamId, childId).url,
        error: function(error) {
            model.favorite(FavoriteStatus.Unknown);
        }
    }).then(function(result) {
        model.favorite(FavoriteStatus.No);
    });
};

var updateSearchResultsForQuery = function(model, query) {
    $('.list-loading').removeClass('hidden');
    $('.no-results').addClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.Stream.apiGetChildren(model.stream().id()).url,
        data: "query=" + query,
        headers: {
            accept: "application/json"
        },
        error: function() {
            $('.list-loading').addClass('hidden');
        }
    }).done(function(result) {
        $('.list-loading').addClass('hidden');
        model.query(query);
        model.children().children((result || []).map(models.StreamModel.fromJson));
    });
};

var updateSearchResults = function(model) {
    var query = $('#stream-search-form input').val();
    return updateSearchResultsForQuery(model, query);
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
                createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val().trim());
            }
        });

    $('#create-child-name-input').keypress(function(e) {
        if (e.keyCode === 13) {
            createChildStream(model, model.stream(), model.user(), $('#create-child-name-input input').val().trim());
        }
    });

    $('#create-child-cancel-button button')
        .on('click', hideChildForm);



    // Child Search
    $('#stream-search-form button').on('click', function(e) {
        e.preventDefault();
        updateSearchResults(model);
    });

    $('#stream-search-form input').keypress(function(e) {
        if (e.keyCode === 13) {
            updateSearchResults(model);
            e.preventDefault();
        }
    });

    // Children
    var query = shared.getQueryString()['query'];
    updateSearchResultsForQuery(model, (query || ''));

    model.manager.subscribeCollection(model.stream().uri(), {
        'StatusUpdated': function(msg) {
            var existingChild = model.removeChild(msg.from);
            if (existingChild.length) {
                existingChild[0].status(models.StatusModel.fromJson(msg.status));
                model.addChild(existingChild[0]);
            }
        },
        'ChildAdded': function(msg) {
            model.addChild(models.StreamModel.fromJson(msg.child));
        },
        'ChildRemoved': function(msg) {
            model.removeChild(msg.child);
        }
    });

    model.color.subscribe(updateFavicon);

    model.children.subscribe(function(results) {
        if (results.length)
            $('.no-results').addClass('hidden');
        else
            $('.no-results').removeClass('hidden');
    });

    // Favorite Button
    disableFavoriteButton();

    model.favorite.subscribe(function(status) {
        switch (status) {
        case FavoriteStatus.Yes:
            return enableFavoriteButton(true);
        case FavoriteStatus.No:
            return enableFavoriteButton(false);
        default:
            return disableFavoriteButton();
        }
    });

    model.checkFavorite();


    $('button.stream-favorite').click(function(e) {
        switch (model.favorite()) {
        case FavoriteStatus.Yes:
            return removeFavorite(model, model.user().rootStream(), model.stream().id());
        case FavoriteStatus.No:
            return addFavorite(model, model.user().rootStream(), model.stream().id());
        }
    });

    model.manager.subscribe(model.stream().uri(), {
        'StatusUpdated': function(msg) {
            if (msg.from === model.stream().uri()) {
                model.setColor(msg.status.color);
                model.stream().updated(new Date(msg.status.created));
                statusPicker.spectrum("set", msg.status.color);
            }
        }
    });

    ko.applyBindings(model);
});

});