"use strict";
import React from 'react';
import ReactColorPicker from 'react-color';

/**
    Stream status color picker component.
*/
export default React.createClass({
    componentWillMount() {
        this.setState({
            displayColorPicker: false,
            color: this.props.color
        });
    },

    handleClick() {
        this.setState({
            displayColorPicker: !this.state.displayColorPicker
        });
    },

    render() {
        var  buttonStyle = {
            background: this.state.color,
            width: '100%',
            height: '100%',
            padding: '0',
            'border-radius': '100px',
            border: 'none',
        };

        return (
            <div style={{position: 'relative', width: '100%', height: '100%'}}>
                <button
                    className="status-picker"
                    style={buttonStyle}
                    onClick={this.handleClick} />
                <ReactColorPicker
                    color={ this.state.color }
                    type="chrome"
                    position="bottom"
                    display={this.state.displayColorPicker}  />
            </div>
        );
    },

})
