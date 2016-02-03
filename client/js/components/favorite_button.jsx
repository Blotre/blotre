"use strict";
import React from 'react';
import ReactFavoriteButton from 'react-color';
import Picker from './color_picker/color_picker.jsx';
import * as models from '../models.js'

const FavoriteStatus = Object.freeze({
    Unknown: 0,
    No: 1,
    Yes: 2,
    Hierarchical: 3
});

/**
 */
const addFavorite = (targetStreamId, childId, f) => {
    $.ajax({
        type: "PUT",
        url: jsRoutes.controllers.StreamApiController.apiCreateChild(targetStreamId, childId).url,
        error: error => {
            f(FavoriteStatus.Unknown);
        }
    }).then(result => {
        f(FavoriteStatus.Yes);
    });
};

const removeFavorite = (targetStreamId, childId, f) => {
    $.ajax({
        type: "DELETE",
        url: jsRoutes.controllers.StreamApiController.apiDeleteChild(targetStreamId, childId).url,
        error: error => {
            f(FavoriteStatus.Unknown);
        }
    }).then(result => {
        f(FavoriteStatus.No);
    });
};


export const FavoriteButton = React.createClass({
    checkFavorite(user, stream) {
        if (!user.userName())
            return;

        // If the current stream is the user's root stream of a direct child, it cannot be favorited.
        if (stream.id() === user.rootStream() || models.isHierarchical(user.userName(), stream.uri())) {
            this.setState({ isDisabled: true, favorite: FavoriteStatus.Hierarchical });
        } else {
            $.ajax({
                type: "GET",
                url: jsRoutes.controllers.StreamApiController.apiGetChild(user.rootStream(), stream.id()).url,
                error: e => {
                    if (e.status === 404) {
                        this.setState({ isDisabled: false, favorite: FavoriteStatus.No });
                    }
                }
            }).then(() => {
                this.setState({ isDisabled: false, favorite: FavoriteStatus.Yes });
            });
        }
    },

    componentWillMount() {
        const user = this.props.user;
        const stream = this.props.stream;

        this.setState({
            user: user,
            stream: stream,
            favorite: FavoriteStatus.Unknown,
            isDisabled: true
        });

        this.props.manager.subscribe(stream.uri(), {
            ParentAdded: msg => {
                if (!this.state.user)
                    return;

                if (msg.from === this.state.stream.uri() && msg.parent.uri === this.state.user.userName())
                    this.setState({ favorite : FavoriteStatus.Yes });
            },
            ParentRemoved: msg => {
                if (!this.state.user)
                    return;

                if (msg.from === this.state.stream.uri() && msg.parent === this.state.user.userName())
                    this.setState({ favorite : FavoriteStatus.No });
            },
        });
        this.checkFavorite(user, stream);
    },

    handleClick() {
        this.setState({ isDisabled: true });

        const onComplete = (status) => {
            this.setState({ isDisabled: false, favorite: status });
        };
        switch (this.state.favorite) {
        case FavoriteStatus.Yes:
            return removeFavorite(this.state.user.rootStream(), this.state.stream.id(), onComplete);
        case FavoriteStatus.No:
            return addFavorite(this.state.user.rootStream(), this.state.stream.id(), onComplete);
        }
    },

    getTitle() {
        switch (this.state.favorite) {
        case FavoriteStatus.Yes:
            return "Remove Favorite";
        case FavoriteStatus.No:
            return "Add Favorite";
        default:
            return "";
        }
    },

    isEnabled() {
        if (this.state.isDisabled)
            return false;

        switch (this.state.favorite) {
        case FavoriteStatus.Yes:
        case FavoriteStatus.No:
            return true
        default:
            return false;
        }
    },

    render() {
        return (
            <button className={"stream-control-button stream-favorite btn-lg " +
                    (this.state.favorite === FavoriteStatus.Yes || this.state.favorite == FavoriteStatus.Hierarchical ? 'active' : '')}
                title={this.getTitle()}
                disabled={!this.isEnabled()}
                onClick={this.handleClick}>
                <span className="glyphicon glyphicon-star"></span>
            </button>
        );
    },
});

export default FavoriteButton;
