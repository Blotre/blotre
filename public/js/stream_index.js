'use strict';

require(['./models', './stream_manager', './application_model', './shared'], function (models, stream_manager, application_model, shared) {
    "use-strict";

    /**
    */

    var StreamIndexViewModel = function StreamIndexViewModel(user, results) {
        var self = this;
        application_model.AppViewModel.call(this, user);

        self.user = ko.observable(user);
        self.results = ko.observableArray(results);
        self.query = ko.observable(undefined);
    };

    var normalizeQuery = function normalizeQuery(query) {
        return decodeURI(query).replace(/\+/g, ' ').trim();
    };

    var updateSearchResultsForQuery = function updateSearchResultsForQuery(model, query) {
        query = normalizeQuery(query);
        $('.list-loading').removeClass('hidden');
        $.ajax({
            type: "GET",
            url: jsRoutes.controllers.StreamApiController.apiGetStreams().url,
            data: {
                'query': query
            },
            headers: {
                accept: "application/json"
            },
            error: function error() {
                $('.list-loading').addClass('hidden');
                // todo: display error msg
            }
        }).done(function (result) {
            $('.list-loading').addClass('hidden');
            model.query(query);
            model.results((result || []).map(models.StreamModel.fromJson));
        });
    };

    var updateSearchResults = function updateSearchResults(model) {
        return updateSearchResultsForQuery(model, normalizeQuery($('#stream-search-form input').val()));
    };

    var getQueryFromQueryString = function getQueryFromQueryString() {
        var qs = shared.getQueryString().query;
        return qs ? normalizeQuery(qs[0]) : '';
    };

    var updateFromQueryString = function updateFromQueryString(model) {
        var query = getQueryFromQueryString();
        $('#stream-search-form input').val(query);
        updateSearchResultsForQuery(model, query);
    };

    $(function () {
        var model = new StreamIndexViewModel(application_model.initialUser(), []);

        $('#stream-search-form button').click(function (e) {
            e.preventDefault();
            updateSearchResults(model);
        });

        $('#stream-search-form input').keypress(function (e) {
            if (e.keyCode === 13) {
                updateSearchResults(model);
                e.preventDefault();
            }
        });

        model.results.subscribe(function (results) {
            if (results.length) $('.no-results').addClass('hidden');else $('.no-results').removeClass('hidden');
        });

        model.query.subscribe(function (query) {
            var currentQuery = window.history.state ? window.history.state.query : undefined;
            if (query === currentQuery) return;
            var path = window.location.origin + window.location.pathname;
            var url = query ? path + "?query=" + encodeURIComponent(query) : path;
            window.history.pushState({ query: query }, '', url);
        });

        window.onpopstate = function (e) {
            updateFromQueryString(model);
        };

        window.history.replaceState({ query: getQueryFromQueryString() }, '', window.location.href);

        updateFromQueryString(model);

        ko.applyBindings(model);
    });
});
//# sourceMappingURL=stream_index.js.map
