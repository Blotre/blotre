"use strict";
import * as shared from './shared.js';

const getTarget = () => {
    const path = decodeURIComponent(window.location.pathname).match('/s/(.+)');
    return ((path && path[1]) || '');
};

const createChild = (name, uri) =>
    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.StreamApiController.apiCreateStream().url,
        contentType: 'application/json',
        data: JSON.stringify({
            name: name,
            uri: uri
        })
    });

$(() => {
    $('.create-child-button').click(e => {
        const btn = $(this);
        shared.lockButton(btn);

        const rawUri = getTarget();
        const parentIndex = rawUri.lastIndexOf('/');
        const parent = rawUri.slice(0, parentIndex);
        const name = rawUri.slice(parentIndex + 1).trim();
        const uri = parent + "/" + name;
        createChild(name, uri)
            .then(result => {
                if (result && !result.error) {
                    document.location.href = jsRoutes.controllers.Stream.getStream(result.uri).url;
                } else {
                    shared.unlockButton(btn);
                }
            })
            .fail(e => {
                shared.unlockButton(btn);
            });
    });
});
