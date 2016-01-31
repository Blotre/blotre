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
            'StatusUpdated': msg => {
                var removed = self.removeFavorite(msg.from);
                if (removed) {
                    removed.status(models.StatusModel.fromJson(msg.status));
                    self.addFavorite(removed);
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
            favorites: [child].concat(this.state.favorites)
        });
    },
    removeFavorite(childUri) {
        const removed = this.state.favorites.filter(x => x.uri() === childUri);
        this.setState({ favorites: this.state.favorites.filter(x => x.uri() !== childUri) });
        return removed[0];
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
