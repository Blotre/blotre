"use-strict";

export const showLoadingScreen = () => {
    $('#loading-overlay').removeClass('hidden');
};

export const hideLoadingScreen = () {
    $('#loading-overlay').addClass('hidden');
};

/**
    Remove all alerts.
*/
export const clearAlerts = () => {
    $('#alerts').empty();
};

/**
    Append a new alert
*/
export const addAlert = (type, content) => {
    $('#alerts').append(
        $('<li class="alert" role="alert">')
            .addClass(type)
            .append(
                '<button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>',
                content));
};

/**
    Set the current alert, removing all existing ones.
*/
export const setAlert = (type, content) => {
    clearAlerts();
    addAlert(type, content);
};
