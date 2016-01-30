'use strict';

define([], function () {
    "use-strict";

    var showLoadingScreen = function showLoadingScreen() {
        $('#loading-overlay').removeClass('hidden');
    };

    var hideLoadingScreen = function hideLoadingScreen() {
        $('#loading-overlay').addClass('hidden');
    };

    /**
        Remove all alerts.
    */
    var clearAlerts = function clearAlerts() {
        $('#alerts').empty();
    };

    /**
        Append a new alert
    */
    var addAlert = function addAlert(type, content) {
        $('#alerts').append($('<li class="alert" role="alert">').addClass(type).append('<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>', content));
    };

    /**
        Set the current alert, removing all existing one.
    */
    var setAlert = function setAlert(type, content) {
        clearAlerts();
        addAlert(type, content);
    };

    return {
        'showLoadingScreen': showLoadingScreen,
        'hideLoadingScreen': hideLoadingScreen,

        'clearAlerts': clearAlerts,
        'addAlert': addAlert,
        'setAlert': setAlert
    };
});
//# sourceMappingURL=ui.js.map
