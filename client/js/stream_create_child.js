"use strict";
import * as models from './models.js';
import * as shared from './shared.js';

const getTarget = () => {
    const path = decodeURIComponent(window.location.pathname).match('/s/(.+)');
    return ((path && path[1]) || '');
};

$(() => {
    $('.create-child-button').click(e => {
        const btn = $(this);
        shared.lockButton(btn);

        const rawUri = getTarget();
        const parentIndex = rawUri.lastIndexOf('/');
        const parent = rawUri.slice(0, parentIndex);
        const name = rawUri.slice(parentIndex + 1).trim();
        const uri = parent + "/" + name;
        $.ajax({
            type: "PUT",
            url: jsRoutes.controllers.StreamApiController.apiCreateStream().url,
            contentType: 'application/json',
            data: JSON.stringify({
                name: name,
                uri: uri
            }),
            error: e => {
                shared.unlockButton(btn);
            }
        })
        .then(result => {
            if (result && !result.error) {
                document.location.href = jsRoutes.controllers.Stream.getStream(result.uri).url;
            } else {
                shared.unlockButton(btn);
            }
        });
    });
});
