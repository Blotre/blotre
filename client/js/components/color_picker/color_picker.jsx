'use strict';/* @flow */

import React from 'react';
import ReactCSS from 'reactcss';
import merge from 'merge';
import isPlainObject from 'lodash.isplainobject';
import debounce from 'lodash.debounce';
import color from 'react-color/lib/helpers/color.js';

import Chrome from './picker.jsx';

class ColorPicker extends ReactCSS.Component {

    constructor(props) {
        super();

        this.state = merge(color.toState(props.color, 0), {visible: props.display});

        this.debounce = debounce(function(fn, data) {
            fn(data);
        }, 100);

        this.handleChange = this.handleChange.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleAccept = this.handleAccept.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    classes() {
        return {
            'show': {
                wrap: {
                    zIndex: '999',
                    position: 'absolute',
                    display: 'block',
                    marginLeft: '-91.5px',
                    left: '0',
                    top: '100%',
                    marginTop: '20px'
                },
                picker: {
                    zIndex: '2',
                    position: 'relative'
                },
                cover: {
                    position: 'fixed',
                    top: '0',
                    bottom: '0',
                    left: '0',
                    right: '0'
                }
            },
            'hide': {
                wrap: {
                    zIndex: '999',
                    position: 'absolute',
                    display: 'none'
                }
            }
        };
    }

    styles() {
        return this.css({
            'show': this.state.visible === true,
            'hide': this.state.visible === false
        });
    }

    handleHide() {
        if (this.state.visible) {
            this.setState({visible: false});
            this.props.onClose && this.props.onClose({hex: this.state.hex, hsl: this.state.hsl, rgb: this.state.rgb});
        }
    }

    handleAccept() {
        this.handleHide();
        this.props.onAccept && this.props.onAccept({hex: this.state.hex, hsl: this.state.hsl, rgb: this.state.rgb});
    }

    handleCancel() {
        if (this.state.visible) {
            this.props.onCancel && this.props.onCancel();
            this.setState({visible: false});
        }
    }

    handleChange(data) {
        data = color.simpleCheckForValidColor(data);
        if (data) {
            var colors = color.toState(data, data.h || this.state.oldHue);
            this.setState(colors);
            this.props.onChangeComplete && this.debounce(this.props.onChangeComplete, colors);
            this.props.onChange && this.props.onChange(colors);
        }
    }

    componentWillReceiveProps(nextProps) {
        this.setState(merge(color.toState(nextProps.color, this.state.oldHue), {visible: nextProps.display}));
    }

    render(){
        return (
            <div is="wrap">
                <div is="picker">
                    <Chrome {...this.props} {...this.state} onChange={this.handleChange} onAccept={this.handleAccept} onCancel={this.handleCancel}/>
                </div>
                <div is="cover" onClick={this.handleAccept}/>
            </div>
        );
    }
}

export default ColorPicker;
