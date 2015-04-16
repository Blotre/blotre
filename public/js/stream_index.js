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
    self.query = ko.observableArray('');
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

/**
*/
$(function(){
    var model = new StreamIndexViewModel(
        application_model.initialUser(),
        []);

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

    model.results.subscribe(function(results) {
        if (results.length)
            $('.no-results').addClass('hidden');
        else
            $('.no-results').removeClass('hidden');
    });

    // Get initial set of results
    var query = shared.getQueryString()['query'];
    $('#stream-search-form input').val(query);
    updateSearchResultsForQuery(model, (query || ''));

    ko.applyBindings(model);
});

});