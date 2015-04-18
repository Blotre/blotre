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
var StreamIndexViewModel = function(user, results) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.user = ko.observable(user);
    self.results = ko.observableArray(results);
    self.query = ko.observable('');
};


var updateSearchResultsForQuery = function(model, query) {
    $('.list-loading').removeClass('hidden');
    $.ajax({
        type: "GET",
        url: jsRoutes.controllers.Stream.index().url,
        data: "query=" + query,
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
    var query = $('#stream-search-form input').val();
    return updateSearchResultsForQuery(model, query);
};

var updateFromQueryString = function(model) {
    var qs = shared.getQueryString()['query'];
    var query = (qs ? qs[0] : '');
    $('#stream-search-form input').val(query);
    updateSearchResultsForQuery(model, query);
};

/**
*/
$(function(){
    var model = new StreamIndexViewModel(
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
        var qs = shared.getQueryString()['query'];
        if (qs && qs[0] === query)
            return;
        var path = window.location.origin + window.location.pathname;
        var url = (query ? path + "?query=" + encodeURIComponent(query) : path);
        window.history.pushState({path: url}, '', url)
    });

    window.onpopstate = function(e) {
      updateFromQueryString(model);
    };

    updateFromQueryString(model);

    ko.applyBindings(model);
});

});