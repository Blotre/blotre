"use strict";
import * as application_model from './application_model';
import * as models from './models';
import StreamManager from './stream_manager';
import UserStatus from './components/user_status.jsx';
import React from 'react';
import ReactDOM from 'react-dom';

$(() => {
    const user = application_model.initialUser();
    const manager = StreamManager.getInstance();

    if (user && user.rootStream()) {
        ReactDOM.render(
            <UserStatus user={user} manager={manager} />,
            document.getElementById('user-status-component'));
    }
});
