"use strict";
import * as models from './models';
import * as stream_manager from './stream_manager';
import * as application_model from './application_model';
import * as shared from './shared';
import React from 'react';
import ReactDOM from 'react-dom';
import FavoriteButton from './components/favorite_button.jsx'
import StatusPicker from './components/status_picker.jsx'
import TagEditor from './components/tag_editor.jsx'

/**
 */
var AppViewModel = function(user, stream) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.stream = ko.observable(stream);
    self.query = ko.observable();

    self.children = ko.computed(() => {
        return new models.Collection(self.stream().uri());
    });

    self.color = ko.computed(() => {
        const stream = self.stream();
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

    self.deleteStream = function(child) {
        $.ajax({
            type: "DELETE",
            url: jsRoutes.controllers.StreamApiController.apiDeleteStream(child.id()).url,
            error: function(e) {

            }
        }).then(function() {
            self.removeChild(child.uri());
        });
    };

    self.isParentOwner = ko.computed(function() {
        return (!!self.stream() && stream.isOwner(self.user()));
    });

    self.removeChildButtonClick = function(child, event) {
        if (models.isHierarchical(self.stream().uri(), child.uri())) {
            bootbox.confirm({
                title: "Are you sure?",
                animate: false,
                closeButton: false,
                message: "This will permanently delete this stream and all of its children.",
                callback: function(result) {
                    if (result) {
                        self.deleteStream(child);
                    }
                }
            });
        } else {
            $.ajax({
                type: "DELETE",
                url: jsRoutes.controllers.StreamApiController.apiDeleteChild(self.stream().id(), child.id()).url,
                error: function(e) {

                }
            }).then(function() {
                self.removeChild(child.uri());
            });
        }
    };

    self.onChildSelected = (child) => {
        window.location = child.url();
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
        if (e) {
            if (e.details) {
                if (e.details['obj.name']) {
                    return "Name is invalid. Must be between 1 and 64 letters and numbers.";
                }
            }
            if (e.error)
                return e.error;
        }

        return "An error occurred";
    };

    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.StreamApiController.apiCreateStream().url,
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

var updateSearchResultsForQuery = function(model, query) {
    $('.list-loading').removeClass('hidden');
    $('.no-results').addClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.apiGetChildren(model.stream().id()).url,
        data: {
            query: query
        },
        headers: {
            accept: "application/json"
        },
        error: function(e) {
            $('.list-loading').addClass('hidden');
        }
    }).done(function(result) {
        $('.list-loading').addClass('hidden');
        model.query(query);
        model.children().children((result || []).map(models.StreamModel.fromJson));
    });
};

const updateSearchResults = function(model) {
    const query = $('#stream-search-form input').val();
    return updateSearchResultsForQuery(model, query);
};




/**
 */
$(function() {
    var model = new AppViewModel(
        application_model.initialUser(),
        initialStream());

    var updateStatus = function(color) {
        var stream = model.stream();
        if (!stream)
            return;

        $.ajax({
            type: "POST",
            url: jsRoutes.controllers.StreamApiController.apiSetStreamStatus(stream.id()).url,
            contentType: 'application/json',
            data: JSON.stringify({
                color: color
            })
        });

        model.stream().updated(new Date());
        model.setColor(color);
    };

    // Create child form
    $('#create-child-expand-button')
        .on('click', function(e) {
            var hidden = $('#create-child-name-input').hasClass('hidden');
            var target = $('#create-child-name-input, #create-child-cancel-button');
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

    // Tag editor

    $('#save-tags-button').on('click', function(e) {
        saveTags(model);
    });

    // Child Search
    $('#stream-search-form button').on('click', function(e) {
        e.preventDefault();
        updateSearchResults(model);
    });

    $('#stream-search-form input').keypress(function(e) {
        if (e.keyCode === 13 /*enter*/ ) {
            updateSearchResults(model);
            e.preventDefault();
        }
    });

    // Children
    var query = shared.getQueryString().query;
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

    model.children().children.subscribe(function(results) {
        if (results.length)
            $('.no-results').addClass('hidden');
        else
            $('.no-results').removeClass('hidden');
    });

    model.manager.subscribe(model.stream().uri(), {
        'StatusUpdated': function(msg) {
            if (msg.from === model.stream().uri()) {
                model.setColor(msg.status.color);
                model.stream().updated(new Date(msg.status.created));
                //statusPicker.spectrum("set", msg.status.color);
            }
        }
    });

    ko.applyBindings(model);

    const onColorPickerChange = hex => {
        model.setColor(hex);
    };

    const onColorPicked = hex => {
        updateStatus(hex);
    };

    const onColorPickerCancel = previous_hex => {
        model.setColor(previous_hex);
    };

    const pickerContainer = $('.status-picker-control').get(0);
    if (pickerContainer)
        ReactDOM.render(
            <StatusPicker color={model.stream().color()}
                onChange={onColorPickerChange}
                onSelect={onColorPicked}
                onCancel={onColorPickerCancel}/>,
            pickerContainer);

    const favoriteContainer = document.getElementById('favorite-button-component');
    if (favoriteContainer) {
        ReactDOM.render(
            <FavoriteButton
                stream={model.stream()}
                user={model.user()}
                manager={model.manager} />,
            favoriteContainer);
    }

    const tagsContainer = document.getElementById('tags-component');
    if (tagsContainer) {
        ReactDOM.render(
            <TagEditor
                stream={model.stream()}
                user={model.user()} />,
            tagsContainer);
    }
});
