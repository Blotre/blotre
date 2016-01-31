"use strict";
import * as models from './models';
import StreamManager from './stream_manager';
import * as application_model from './application_model';
import React from 'react';
import ReactDOM from 'react-dom';

/**
    List of favorites displayed on the side of webpage.
*/
var SideBar = React.createClass({
    getInitialState() {
        return { favorites: [] };
    },
    componentDidMount() {
        if (!this.props.rootStreamId)
            return;

        const self = this;

        // Request initial state
        $.ajax({
            type: "GET",
            url: jsRoutes.controllers.StreamApiController.apiGetChildren(this.props.rootStreamId).url,
            headers: {
                accept: "application/json"
            },
            error: function(e) {
                console.error(e);
            }
        }).done(result => {
            this.setState({ favorites: result.map(models.StreamModel.fromJson) });
        });

        // subscribe to updates
        this.props.manager.subscribeCollection(this.props.rootStreamUrl, {
            'StatusUpdated': function(msg) {
                var existingChild = self.removeFavorite(msg.from);
                if (existingChild.length) {
                    existingChild[0].status(models.StatusModel.fromJson(msg.status));
                    self.addFavorite(existingChild[0]);
                }
            },
            'ChildAdded': msg => {
                self.addFavorite(models.StreamModel.fromJson(msg.child));
            },
            'ChildRemoved': msg => {
                self.removeFavorite(msg.child);
            }
        });
    },
    addFavorite(child) {
        this.setState({
            favorites: this.state.favorites.unshift(child)
        });
    },
    removeFavorite(childUri) {
        this.setState({
            favorites: this.state.favorites.filter(x => x.uri === childUri)
        });
    },
    render() {
        const childNodes = this.state.favorites.map(stream => {
            const style = { background: stream.color() };
            return (
                <li key={stream.url()} className="blotre-bar-stream">
                    <a className="stream" href={stream.url()}>
                        <span className="status" style={style}></span>
                        <span className="stream-name">{stream.name()}</span>
                    </a>
                </li>
            );
        });

        return (
            <ul>{childNodes}</ul>
        );
    }
});

$(() => {
    const user = application_model.initialUser();
    const manager = StreamManager.getInstance();

    if (user && user.rootStream()) {
        ReactDOM.render(
            <SideBar rootStreamId={user.rootStream()} rootStreamUrl={user.userName()} manager={manager} />,
            document.getElementById('blotre-bar'));
    }
});
