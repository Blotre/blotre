(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

require(['./models', './stream_manager', './application_model', './shared'], function (models, stream_manager, application_model, shared) {
    "use-strict";

    /**
    */

    var TagViewModel = function TagViewModel(tag, user, results) {
        var self = this;
        application_model.AppViewModel.call(this, user);

        self.tag = ko.observable(tag);
        self.user = ko.observable(user);
        self.children = ko.observable(new models.Collection(tag));
        self.query = ko.observable(undefined);

        self.addChild = function (child) {
            self.children().addChild(child);
        };

        self.removeChild = function (childUri) {
            return self.children().children.remove(function (x) {
                return x.uri() === childUri;
            });
        };
    };

    var normalizeQuery = function normalizeQuery(query) {
        return decodeURI(query).replace(/\+/g, ' ').trim();
    };

    var updateSearchResultsForQuery = function updateSearchResultsForQuery(model, query) {
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
            error: function error() {
                $('.list-loading').addClass('hidden');
                // todo: display error msg
            }
        }).done(function (result) {
            $('.list-loading').addClass('hidden');
            model.query(query);
            model.children().children((result || []).map(models.StreamModel.fromJson));
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
        var model = new TagViewModel(window.initialTag.tag, application_model.initialUser(), []);

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

        model.children().children.subscribe(function (results) {
            if (results.length) $('.no-results').addClass('hidden');else $('.no-results').removeClass('hidden');
        });

        model.query.subscribe(function (query) {
            var currentQuery = window.history.state ? window.history.state.query : undefined;
            if (query === currentQuery) return;
            var path = window.location.origin + window.location.pathname;
            var url = query ? path + "?query=" + encodeURIComponent(query) : path;
            window.history.pushState({ query: query }, '', url);
        });

        model.manager.subscribeCollection('#' + model.tag(), {
            'StatusUpdated': function StatusUpdated(msg) {
                var existingChild = model.removeChild(msg.from);
                if (existingChild.length) {
                    existingChild[0].status(models.StatusModel.fromJson(msg.status));
                    model.addChild(existingChild[0]);
                }
            },
            'ChildAdded': function ChildAdded(msg) {
                model.addChild(models.StreamModel.fromJson(msg.child));
            },
            'ChildRemoved': function ChildRemoved(msg) {
                model.removeChild(msg.child);
            }
        });

        window.onpopstate = function (e) {
            updateFromQueryString(model);
        };

        window.history.replaceState({ query: getQueryFromQueryString() }, '', window.location.href);

        updateFromQueryString(model);

        ko.applyBindings(model);
    });
});

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvanMvdGFnLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxRQUFRLENBQ0osVUFESSxFQUVKLGtCQUZJLEVBR0oscUJBSEksRUFJSixVQUpJLENBQVIsRUFLQSxVQUNJLE1BREosRUFFSSxjQUZKLEVBR0ksaUJBSEosRUFJSSxNQUpKLEVBS0E7QUFDQTs7OztBQURBO0FBS0EsUUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLEdBQVQsRUFBYyxJQUFkLEVBQW9CLE9BQXBCLEVBQTZCO0FBQzVDLFlBQUksT0FBTyxJQUFQLENBRHdDO0FBRTVDLDBCQUFrQixZQUFsQixDQUErQixJQUEvQixDQUFvQyxJQUFwQyxFQUEwQyxJQUExQyxFQUY0Qzs7QUFJNUMsYUFBSyxHQUFMLEdBQVcsR0FBRyxVQUFILENBQWMsR0FBZCxDQUFYLENBSjRDO0FBSzVDLGFBQUssSUFBTCxHQUFZLEdBQUcsVUFBSCxDQUFjLElBQWQsQ0FBWixDQUw0QztBQU01QyxhQUFLLFFBQUwsR0FBZ0IsR0FBRyxVQUFILENBQWMsSUFBSSxPQUFPLFVBQVAsQ0FBa0IsR0FBdEIsQ0FBZCxDQUFoQixDQU40QztBQU81QyxhQUFLLEtBQUwsR0FBYSxHQUFHLFVBQUgsQ0FBYyxTQUFkLENBQWIsQ0FQNEM7O0FBUzVDLGFBQUssUUFBTCxHQUFnQixVQUFTLEtBQVQsRUFBZ0I7QUFDNUIsaUJBQUssUUFBTCxHQUFnQixRQUFoQixDQUF5QixLQUF6QixFQUQ0QjtTQUFoQixDQVQ0Qjs7QUFhNUMsYUFBSyxXQUFMLEdBQW1CLFVBQVMsUUFBVCxFQUFtQjtBQUNsQyxtQkFBTyxLQUFLLFFBQUwsR0FBZ0IsUUFBaEIsQ0FBeUIsTUFBekIsQ0FBZ0MsVUFBUyxDQUFULEVBQVk7QUFDOUMsdUJBQU8sRUFBRSxHQUFGLE9BQVksUUFBWixDQUR1QzthQUFaLENBQXZDLENBRGtDO1NBQW5CLENBYnlCO0tBQTdC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QUFNLFdBQU4sQ0FBa0IsSUFBSSxLQUFKLENBQWxCLENBRDBCO2FBQWQ7U0FYbkIsRUFsQ1E7O0FBa0RSLGVBQU8sVUFBUCxHQUFvQixVQUFTLENBQVQsRUFBWTtBQUM1QixrQ0FBc0IsS0FBdEIsRUFENEI7U0FBWixDQWxEWjs7QUFzRFIsZUFBTyxPQUFQLENBQWUsWUFBZixDQUE0QixFQUFFLE9BQU8seUJBQVAsRUFBOUIsRUFBa0UsRUFBbEUsRUFBc0UsT0FBTyxRQUFQLENBQWdCLElBQWhCLENBQXRFLENBdERROztBQXdEUiw4QkFBc0IsS0FBdEIsRUF4RFE7O0FBMERSLFdBQUcsYUFBSCxDQUFpQixLQUFqQixFQTFEUTtLQUFWLENBQUYsQ0FyRUE7Q0FMQSxDQUxBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInJlcXVpcmUoW1xuICAgICcuL21vZGVscycsXG4gICAgJy4vc3RyZWFtX21hbmFnZXInLFxuICAgICcuL2FwcGxpY2F0aW9uX21vZGVsJyxcbiAgICAnLi9zaGFyZWQnXSxcbmZ1bmN0aW9uKFxuICAgIG1vZGVscyxcbiAgICBzdHJlYW1fbWFuYWdlcixcbiAgICBhcHBsaWNhdGlvbl9tb2RlbCxcbiAgICBzaGFyZWQpXG57XG5cInVzZS1zdHJpY3RcIjtcblxuLyoqXG4qL1xudmFyIFRhZ1ZpZXdNb2RlbCA9IGZ1bmN0aW9uKHRhZywgdXNlciwgcmVzdWx0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhcHBsaWNhdGlvbl9tb2RlbC5BcHBWaWV3TW9kZWwuY2FsbCh0aGlzLCB1c2VyKTtcblxuICAgIHNlbGYudGFnID0ga28ub2JzZXJ2YWJsZSh0YWcpO1xuICAgIHNlbGYudXNlciA9IGtvLm9ic2VydmFibGUodXNlcik7XG4gICAgc2VsZi5jaGlsZHJlbiA9IGtvLm9ic2VydmFibGUobmV3IG1vZGVscy5Db2xsZWN0aW9uKHRhZykpO1xuICAgIHNlbGYucXVlcnkgPSBrby5vYnNlcnZhYmxlKHVuZGVmaW5lZCk7XG5cbiAgICBzZWxmLmFkZENoaWxkID0gZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgc2VsZi5jaGlsZHJlbigpLmFkZENoaWxkKGNoaWxkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5yZW1vdmVDaGlsZCA9IGZ1bmN0aW9uKGNoaWxkVXJpKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmNoaWxkcmVuKCkuY2hpbGRyZW4ucmVtb3ZlKGZ1bmN0aW9uKHgpIHtcbiAgICAgICAgICAgICByZXR1cm4geC51cmkoKSA9PT0gY2hpbGRVcmk7XG4gICAgICAgICB9KTtcbiAgICB9O1xufTtcblxudmFyIG5vcm1hbGl6ZVF1ZXJ5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJKHF1ZXJ5KS5yZXBsYWNlKC9cXCsvZywgJyAnKS50cmltKCk7XG59O1xuXG52YXIgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5ID0gZnVuY3Rpb24obW9kZWwsIHF1ZXJ5KSB7XG4gICAgcXVlcnkgPSBub3JtYWxpemVRdWVyeShxdWVyeSk7XG4gICAgJCgnLmxpc3QtbG9hZGluZycpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlOiBcIkdFVFwiLFxuICAgICAgICB1cmw6IGpzUm91dGVzLmNvbnRyb2xsZXJzLlN0cmVhbUFwaUNvbnRyb2xsZXIuZ2V0VGFnQ2hpbGRyZW4obW9kZWwudGFnKCkpLnVybCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgJ3F1ZXJ5JzogcXVlcnlcbiAgICAgICAgfSxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgYWNjZXB0OiBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICB9LFxuICAgICAgICBlcnJvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAkKCcubGlzdC1sb2FkaW5nJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgICAgICAgICAgLy8gdG9kbzogZGlzcGxheSBlcnJvciBtc2dcbiAgICAgICAgfVxuICAgIH0pLmRvbmUoZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICQoJy5saXN0LWxvYWRpbmcnKS5hZGRDbGFzcygnaGlkZGVuJyk7XG4gICAgICAgIG1vZGVsLnF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgbW9kZWwuY2hpbGRyZW4oKS5jaGlsZHJlbigocmVzdWx0IHx8IFtdKS5tYXAobW9kZWxzLlN0cmVhbU1vZGVsLmZyb21Kc29uKSk7XG4gICAgfSk7XG59O1xuXG52YXIgdXBkYXRlU2VhcmNoUmVzdWx0cyA9IGZ1bmN0aW9uKG1vZGVsKSB7XG4gICAgcmV0dXJuIHVwZGF0ZVNlYXJjaFJlc3VsdHNGb3JRdWVyeShcbiAgICAgICAgbW9kZWwsXG4gICAgICAgIG5vcm1hbGl6ZVF1ZXJ5KCQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS52YWwoKSkpO1xufTtcblxudmFyIGdldFF1ZXJ5RnJvbVF1ZXJ5U3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHFzID0gc2hhcmVkLmdldFF1ZXJ5U3RyaW5nKCkucXVlcnk7XG4gICAgcmV0dXJuIChxcyA/IG5vcm1hbGl6ZVF1ZXJ5KHFzWzBdKSA6ICcnKTtcbn07XG5cbnZhciB1cGRhdGVGcm9tUXVlcnlTdHJpbmcgPSBmdW5jdGlvbihtb2RlbCkge1xuICAgIHZhciBxdWVyeSA9IGdldFF1ZXJ5RnJvbVF1ZXJ5U3RyaW5nKCk7XG4gICAgJCgnI3N0cmVhbS1zZWFyY2gtZm9ybSBpbnB1dCcpLnZhbChxdWVyeSk7XG4gICAgdXBkYXRlU2VhcmNoUmVzdWx0c0ZvclF1ZXJ5KG1vZGVsLCBxdWVyeSk7XG59O1xuXG4kKGZ1bmN0aW9uKCl7XG4gICAgdmFyIG1vZGVsID0gbmV3IFRhZ1ZpZXdNb2RlbChcbiAgICAgICAgd2luZG93LmluaXRpYWxUYWcudGFnLFxuICAgICAgICBhcHBsaWNhdGlvbl9tb2RlbC5pbml0aWFsVXNlcigpLFxuICAgICAgICBbXSk7XG5cbiAgICAkKCcjc3RyZWFtLXNlYXJjaC1mb3JtIGJ1dHRvbicpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICB9KTtcblxuICAgICQoJyNzdHJlYW0tc2VhcmNoLWZvcm0gaW5wdXQnKS5rZXlwcmVzcyhmdW5jdGlvbihlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzKSB7XG4gICAgICAgICAgICB1cGRhdGVTZWFyY2hSZXN1bHRzKG1vZGVsKTtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgbW9kZWwuY2hpbGRyZW4oKS5jaGlsZHJlbi5zdWJzY3JpYmUoZnVuY3Rpb24ocmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGgpXG4gICAgICAgICAgICAkKCcubm8tcmVzdWx0cycpLmFkZENsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgJCgnLm5vLXJlc3VsdHMnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gICAgfSk7XG5cbiAgICBtb2RlbC5xdWVyeS5zdWJzY3JpYmUoZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRRdWVyeSA9ICh3aW5kb3cuaGlzdG9yeS5zdGF0ZSA/IHdpbmRvdy5oaXN0b3J5LnN0YXRlLnF1ZXJ5IDogdW5kZWZpbmVkKTtcbiAgICAgICAgaWYgKHF1ZXJ5ID09PSBjdXJyZW50UXVlcnkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHZhciBwYXRoID0gd2luZG93LmxvY2F0aW9uLm9yaWdpbiArIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZTtcbiAgICAgICAgdmFyIHVybCA9IChxdWVyeSA/IHBhdGggKyBcIj9xdWVyeT1cIiArIGVuY29kZVVSSUNvbXBvbmVudChxdWVyeSkgOiBwYXRoKTtcbiAgICAgICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHsgcXVlcnk6IHF1ZXJ5IH0sICcnLCB1cmwpO1xuICAgIH0pO1xuXG4gICAgbW9kZWwubWFuYWdlci5zdWJzY3JpYmVDb2xsZWN0aW9uKCcjJyArIG1vZGVsLnRhZygpLCB7XG4gICAgICAgJ1N0YXR1c1VwZGF0ZWQnOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgICAgdmFyIGV4aXN0aW5nQ2hpbGQgPSBtb2RlbC5yZW1vdmVDaGlsZChtc2cuZnJvbSk7XG4gICAgICAgICAgIGlmIChleGlzdGluZ0NoaWxkLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgZXhpc3RpbmdDaGlsZFswXS5zdGF0dXMobW9kZWxzLlN0YXR1c01vZGVsLmZyb21Kc29uKG1zZy5zdGF0dXMpKTtcbiAgICAgICAgICAgICAgIG1vZGVsLmFkZENoaWxkKGV4aXN0aW5nQ2hpbGRbMF0pO1xuICAgICAgICAgICB9XG4gICAgICAgfSxcbiAgICAgICAnQ2hpbGRBZGRlZCc6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICAgICBtb2RlbC5hZGRDaGlsZChtb2RlbHMuU3RyZWFtTW9kZWwuZnJvbUpzb24obXNnLmNoaWxkKSk7XG4gICAgICAgfSxcbiAgICAgICAnQ2hpbGRSZW1vdmVkJzogZnVuY3Rpb24obXNnKSB7XG4gICAgICAgICAgIG1vZGVsLnJlbW92ZUNoaWxkKG1zZy5jaGlsZCk7XG4gICAgICAgfVxuICAgIH0pO1xuXG4gICAgd2luZG93Lm9ucG9wc3RhdGUgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIHVwZGF0ZUZyb21RdWVyeVN0cmluZyhtb2RlbCk7XG4gICAgfTtcblxuICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7IHF1ZXJ5OiBnZXRRdWVyeUZyb21RdWVyeVN0cmluZygpIH0sICcnLCB3aW5kb3cubG9jYXRpb24uaHJlZik7XG5cbiAgICB1cGRhdGVGcm9tUXVlcnlTdHJpbmcobW9kZWwpO1xuXG4gICAga28uYXBwbHlCaW5kaW5ncyhtb2RlbCk7XG59KTtcblxufSk7Il19
