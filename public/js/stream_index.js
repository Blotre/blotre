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
var StreamIndexViewModel = function(user, results) {
    var self = this;
    application_model.AppViewModel.call(this, user);

    self.user = ko.observable(user);
    self.results = ko.observableArray(results);
    self.query = ko.observableArray('');
};

/**
*/
$(function(){
    var model = new StreamIndexViewModel(
        application_model.initialUser(),
        []);

    var updateSearchResultsForQuery = function(query) {
         $.ajax({
            type: "GET",
            url: jsRoutes.controllers.Stream.index().url,
            data: "query=" + query,
            headers: {
                accept: "application/json"
            }
        }).done(function(result) {
            if (result.streams) {
                model.query(result.query);
                model.results(result.streams.map(models.StreamModel.fromJson));
            }
        });
    };

    var updateSearchResults = function() {
        var query = $('#stream-search-input input').val();
        return updateSearchResultsForQuery(query);
    };

    $('#stream-search-input button').on('click', updateSearchResults)
    $('#stream-search-input input').keypress(function(e) {
        if (e && e.keyCode === 13)
            updateSearchResults();
    });

    // Get initial set of results
    updateSearchResults();

    ko.applyBindings(model);
});

});