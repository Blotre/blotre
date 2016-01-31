"use-strict";

export const parseQueryString = (queryString) => {
    return queryString.substr(1).split("&")
        .reduce(function(dict, item) {
            var kv = item.split("=");
            var k = kv[0];
            var v = decodeURIComponent(kv[1]);
            if (k in dict) dict[k].push(v); else dict[k] = [v];
            return dict;
        }, {});
};

export const getQueryString = () => {
    return parseQueryString(window.location.search);
};

export const lockButton = (sel) => {
     sel
        .prop("disabled", true)
        .children('.glyphicon')
            .addClass('glyphicon-refresh glyphicon-refresh-animate');
};

export const unlockButton = (sel) => {
    sel
       .prop("disabled", false)
       .children('.glyphicon')
           .removeClass('glyphicon-refresh  glyphicon-refresh-animate');
};
