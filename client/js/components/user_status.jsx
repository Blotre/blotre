'use strict';
import React from 'react';

/**
    Header bar component that displays the user's current status.
*/
export const UserStatus = React.createClass({
    componentWillMount() {
        const user = this.props.user;
        const manager = this.props.manager;
        this.setState({
            user: user,
            color: user ? user.color() : 'transparent',
            manger: manager
        });

        if (user) {
            manager.subscribe(user.userName(), {
                StatusUpdated: msg => {
                    this.setState({ color: msg.status.color });
                }
            });
        }
    },

    render() {
        const statusStyle = {
            background: this.state.color,
            color: 'red'
        };
        return (
            <a className={"status user-status " + (this.state.user ? '' : 'hidden')}
                style={statusStyle}
                href={this.state.user ? jsRoutes.controllers.Stream.getStream(this.state.user.userName()).url : ''}>
            </a>
        );
    }
});

export default UserStatus;
