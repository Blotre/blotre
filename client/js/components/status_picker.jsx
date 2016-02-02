"use strict";
import React from 'react';
import ReactColorPicker from 'react-color';
import Picker from './color_picker/color_picker.jsx';

const componentToHex = c => {
    const hex = c.toString(16);
    return hex.length == 1 ? '0' + hex : hex;
};

const rgbToHex = function(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

/**
    Stream status color picker component.
*/
export const ColorPicker = React.createClass({
    componentWillMount() {
        this.setState({
            displayColorPicker: false,
            color: this.props.color,
            selectedColor: this.props.color
        });
    },

    handleClick() {
        this.setState({
            displayColorPicker: !this.state.displayColorPicker
        });
    },

    onChange(color) {
        const hex = rgbToHex(color.rgb.r, color.rgb.g, color.rgb.b);
        this.setState({ color: hex });
        this.props.onChange(hex);
        this.setState({});
    },

    onSelect(color) {
        const hex = rgbToHex(color.rgb.r, color.rgb.g, color.rgb.b);
        this.setState({ selectedColor: hex, color: hex, displayColorPicker: false });
        this.props.onSelect && this.props.onSelect(hex);
    },

    onCancel() {
        this.setState({ color: this.state.selectedColor, displayColorPicker: false });
        this.props.onCancel(this.state.selectedColor);
    },

    render() {
        var buttonStyle = {
            background: this.state.color,
            width: '100%',
            height: '100%',
            padding: '0',
            borderRadius: '100px',
            border: 'none',
        };

        return (
            <div style={{position: 'relative', width: '100%', height: '100%'}}>
                <button
                    className="status-picker"
                    style={buttonStyle}
                    onClick={this.handleClick} />

                <Picker
                    color={this.state.color}
                    position="bottom"
                    onChange={this.onChange}
                    onAccept={this.onSelect}
                    onCancel={this.onCancel}
                    display={this.state.displayColorPicker} />
            </div>
        );
    },
});

export default ColorPicker;
