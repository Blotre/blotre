'use strict';/* @flow */

import React from 'react';
var ReactCSS = require('reactcss');

import {Saturation, Hue, Alpha, Checkboard} from 'react-color/lib/components/common/index.js';
import ChromeFields from './fields.jsx';
import ChromePointer from './pointer.jsx';
import ChromePointerCircle from './pointer_circle.jsx';

export class Chrome extends ReactCSS.Component {

    constructor() {
        super();

        this.handleChange = this.handleChange.bind(this);
    }

    classes() {
        return {
            'default': {
                picker: {
                    background: '#fff',
                    borderRadius: '2px',
                    boxSizing: 'initial',
                    width: '225px',
                    boxShadow: '0 0 2px rgba(0,0,0,.3), 0 4px 8px rgba(0,0,0,.3)',
                },
                triangle: {
                    borderBottomColor: this.props ? '#' + this.props.hex : 'transparent'
                },
                saturation: {
                    width: '100%',
                    paddingBottom: '55%',
                    position: 'relative',
                    borderRadius: '2px 2px 0 0',
                    overflow: 'hidden'
                },
                Saturation: {
                    radius: '2px 2px 0 0'
                },
                body: {
                    padding: '16px 16px 12px'
                },
                color: {
                    width: '32px'
                },
                swatch: {
                    marginTop: '6px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    position: 'relative',
                    overflow: 'hidden'
                },
                hue: {
                    height: '10px',
                    position: 'relative',
                    marginBottom: '8px'
                },
                Hue: {
                    radius: '2px'
                },
                alpha: {
                    height: '10px',
                    position: 'relative'
                },
                Alpha: {
                    radius: '2px'
                }
            }
        };
    }

    handleChange(data) {
        this.props.onChange(data);
    }

    handleCancel() {
        this.props.onCancel();
    }

    render() {
        return (
            <div is="picker" className="color-picker">
                <div className="triangle" is="triangle" />
                <div is="saturation">
                    <Saturation is="Saturation" {...this.props} pointer={ChromePointerCircle} onChange={this.handleChange} />
                </div>
                <div is="body">
                    <div is="toggles">
                        <div is="hue">
                            <Hue is="Hue" {...this.props} pointer={ChromePointer} onChange={this.handleChange} />
                        </div>
                    </div>
                    <ChromeFields {...this.props} onChange={this.handleChange}/>
                    <button type="button" className="btn btn-danger" onClick={this.handleCancel.bind(this)}>Cancel</button>
                </div>
            </div>
        );
    }

}

export default Chrome;
