"use strict";

define([], function () {
    "use-strict";

    var parseQueryString = function parseQueryString(queryString) {
        return queryString.substr(1).split("&").reduce(function (dict, item) {
            var kv = item.split("=");
            var k = kv[0];
            var v = decodeURIComponent(kv[1]);
            if (k in dict) dict[k].push(v);else dict[k] = [v];
            return dict;
        }, {});
    };

    var getQueryString = function getQueryString() {
        return parseQueryString(window.location.search);
    };

    var lockButton = function lockButton(sel) {
        sel.prop("disabled", true).children('.glyphicon').addClass('glyphicon-refresh glyphicon-refresh-animate');
    };

    var unlockButton = function unlockButton(sel) {
        sel.prop("disabled", false).children('.glyphicon').removeClass('glyphicon-refresh  glyphicon-refresh-animate');
    };

    return {
        'getQueryString': getQueryString,
        'parseQueryString': parseQueryString,

        'lockButton': lockButton,
        'unlockButton': unlockButton
    };
});
//# sourceMappingURL=shared.js.map
