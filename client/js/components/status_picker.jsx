"use strict";
import React from 'react';
import ReactCSS from 'reactcss';
import Chrome from './color_picker/picker.jsx';
import merge from 'merge';
import color from 'react-color/lib/helpers/color.js';

/**
    Stream status color picker component.
*/
export const ColorPicker = React.createClass({
    mixins: [ ReactCSS.mixin ],

    componentWillMount() {
        const c = color.toState(this.props.color, 0);
        this.setState({
            visible: false,
            selectedColor: c,

            // Track to make sure the user changes the state before submitting
            hasChanged: false
        });
        this.setColor(c);
    },

    setColor(color) {
        this.setState(color);
    },

    handleClick() {
        this.setState({
            visible: !this.state.visible,
            hasChanged: this.state.hasChanged && !this.state.visible
        });
    },

    classes() {
        return {
            'show': {
                wrap: {
                    zIndex: '1500',
                    position: 'absolute',
                    display: 'block',
                    marginLeft: '-88px',
                    left: '0',
                    top: '100%'
                },
                picker: {
                    zIndex: '2',
                    position: 'relative'
                }
            },
            'hide': {
                wrap: {
                    zIndex: '999',
                    position: 'absolute',
                    display: 'none'
                },
                cover: {
                    display: 'none'
                }
            }
        };
    },

    styles() {
        return this.css({
            'show': this.state.visible,
            'hide': !this.state.visible
        });
    },

    handleHide() {
        if (this.state.visible) {
            this.setState({visible: false});
            this.props.onClose && this.props.onClose({hex: this.state.hex, hsl: this.state.hsl, rgb: this.state.rgb});
        }
    },

    handleAccept() {
        this.handleHide();

        const c = color.toState(this.state.hex, this.state.oldHue);

        this.setState({ selectedColor: c, visible: false });
        const hex = '#' + this.state.hex;
        this.props.onSelect && this.props.onSelect(hex);
    },

    handleCancel() {
        if (this.state.visible) {
            this.setState({ visible: false });
            this.setColor(this.state.selectedColor);
            this.props.onCancel('#' + this.state.selectedColor.hex);
        }
    },

    handleChange(data) {
        data = color.simpleCheckForValidColor(data);
        if (data) {
            var colors = color.toState(data, data.h || this.state.oldHue);
            this.setColor(colors);
            if (this.state.hasChanged)
                this.props.onChange && this.props.onChange('#' + colors.hex);
            else
                this.setState({ hasChanged: true });
        }
    },

    render() {
        var buttonStyle = {
            background: '#' + this.state.hex,
            position: 'relative',
            zIndex: '998'
        };

        return (
            <div class-name="status-picker-control" style={{position: 'relative', width: '100%', height: '100%'}}>
                <button
                    className="stream-control-button status-picker"
                    style={buttonStyle}
                    onClick={this.handleClick} />
                <div className="cover" is="cover" onClick={this.handleAccept}/>
                <div is="wrap">
                    <div is="picker">
                        <Chrome hex={this.state.hex} rgb={this.state.rgb} hsv={this.state.hsv} hsl={this.state.hsl}
                            onChange={this.handleChange}
                            onCancel={this.handleCancel} />
                    </div>
                </div>
            </div>
        );
    },
});

export default ColorPicker;
