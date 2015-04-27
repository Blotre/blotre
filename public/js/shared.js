define([],
function() {
"use-strict";

var parseQueryString = function(queryString) {
    return queryString.substr(1).split("&")
        .reduce(function(dict, item) {
            var kv = item.split("=");
            var k = kv[0];
            var v = decodeURIComponent(kv[1]);
            if (k in dict) dict[k].push(v); else dict[k] = [v];
            return dict;
        }, {});
};

var getQueryString = function() {
    return parseQueryString(window.location.search);
};

return {
    'getQueryString': getQueryString,
    'parseQueryString': parseQueryString
};

});