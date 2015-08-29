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

/**
*/
var TagViewModel = function(tag, user, results) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.tag = ko.observable(tag);
    self.user = ko.observable(user);
    self.results = ko.observableArray(results);
    self.query = ko.observable(undefined);
};

var normalizeQuery = function(query) {
    return decodeURI(query).replace(/\+/g, ' ').trim();
};

var updateSearchResultsForQuery = function(model, query) {
    query = normalizeQuery(query);
    $('.list-loading').removeClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.StreamApiController.getTagChildren(model.tag()).url,
        data: {
            'query': query
        },
        headers: {
            accept: "application/json"
        },
        error: function() {
            $('.list-loading').addClass('hidden');
            // todo: display error msg
        }
    }).done(function(result) {
        $('.list-loading').addClass('hidden');
        model.query(query);
        model.results((result || []).map(models.StreamModel.fromJson));
    });
};

var updateSearchResults = function(model) {
    return updateSearchResultsForQuery(
        model,
        normalizeQuery($('#stream-search-form input').val()));
};

var getQueryFromQueryString = function() {
    var qs = shared.getQueryString()['query'];
    return (qs ? normalizeQuery(qs[0]) : '');
};

var updateFromQueryString = function(model) {
    var query = getQueryFromQueryString();
    $('#stream-search-form input').val(query);
    updateSearchResultsForQuery(model, query);
};

$(function(){
    var model = new TagViewModel(
        'fads',
        application_model.initialUser(),
        []);

    $('#stream-search-form button').click(function(e) {
        e.preventDefault();
        updateSearchResults(model);
    });

    $('#stream-search-form input').keypress(function(e) {
        if (e.keyCode === 13) {
            updateSearchResults(model);
            e.preventDefault();
        }
    });

    model.results.subscribe(function(results) {
        if (results.length)
            $('.no-results').addClass('hidden');
        else
            $('.no-results').removeClass('hidden');
    });

    model.query.subscribe(function(query) {
        var currentQuery = (window.history.state ? window.history.state.query : undefined);
        if (query === currentQuery)
            return;
        var path = window.location.origin + window.location.pathname;
        var url = (query ? path + "?query=" + encodeURIComponent(query) : path);
        window.history.pushState({ query: query }, '', url);
    });

    model.manager.subscribeCollection('#' + model.tag(), {
        'StatusUpdated': function(msg) {
            if (msg.from === model.stream().uri()) {
                model.setColor(msg.status.color);
                model.stream().updated(new Date(msg.status.created));
                statusPicker.spectrum("set", msg.status.color);
            }
        },
        'ParentAdded': function(msg) {
            if (msg.from === model.stream().uri() && msg.parent.uri === model.user().userName())
                model.favorite(FavoriteStatus.Yes);
        },
        'ParentRemoved': function(msg) {
            if (msg.from === model.stream().uri() && msg.parent === model.user().userName())
                model.favorite(FavoriteStatus.No);
        },
    });

    window.onpopstate = function(e) {
        updateFromQueryString(model);
    };

    window.history.replaceState({ query: getQueryFromQueryString() }, '', window.location.href);

    updateFromQueryString(model);

    ko.applyBindings(model);
});

});