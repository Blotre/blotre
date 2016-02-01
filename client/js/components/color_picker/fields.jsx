'use strict';
import React from 'react';
import ReactCSS from 'reactcss';
import color from 'react-color/lib/helpers/color.js';
import EditableInput from 'react-color/lib/components/common/EditableInput.js';

/**
    Convert `text` to only hex characters.
*/
const cleanHex = text =>
    text.trim().replace(/[^\da-f]/ig, '').slice(0, 6);

/**
    Hex value input field.
*/
const HexInput = React.createClass({
    componentWillMount() {
        this.setState({
            value: this.props.value,
            hex: '#' + this.props.value
        });
    },

    onChange(e) {
        let value = e.target.value;
        if (color.isValidHex(value)) {
            this.setState({
                value: value,
                hex: '#' + value
            });
            this.props.onChange('#' + value);
        } else {
            value = cleanHex(value);
            this.setState({
                value: value
            });
        }
    },

    render() {
        return (
            <div className="input-group">
                <div className="input-group-addon">{'#'}</div>
                <input type="text" className="form-control" value={ this.state.value } onChange={this.onChange}></input>
            </div>
        );
    }
});


export class ChromeaFields extends ReactCSS.Component {
  constructor(props) {
    super();

    this.state = {
      view: '',
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.hideHighlight = this.hideHighlight.bind(this);
    this.showHighlight = this.showHighlight.bind(this);
  }

  classes() {
    return {
      'default': {
        wrap: {
          paddingTop: '16px',
          display: 'flex',
        },
        fields: {
          flex: '1',
          display: 'flex',
          marginLeft: '-6px',
        },
        field: {
          paddingLeft: '6px',
          width: '100%',
        },
        toggle: {
          width: '32px',
          textAlign: 'right',
          position: 'relative',
        },
        icon: {
          marginRight: '-4px',
          marginTop: '12px',
          cursor: 'pointer',
          position: 'relative',
          zIndex: '2',
        },
        iconHighlight: {
          position: 'absolute',
          width: '24px',
          height: '28px',
          background: '#eee',
          borderRadius: '4px',
          top: '10px',
          left: '12px',
          display: 'none',
        },
        Input: {
          style: {
            input: {
              fontSize: '11px',
              color: '#333',
              width: '100%',
              borderRadius: '2px',
              border: 'none',
              boxShadow: 'inset 0 0 0 1px #dadada',
              height: '21px',
              textAlign: 'center',
            },
            label: {
              textTransform: 'uppercase',
              fontSize: '11px',
              lineHeight: '11px',
              color: '#969696',
              textAlign: 'center',
              display: 'block',
              marginTop: '12px',
            },
          },
        },
      },
    };
  }

  componentDidMount() {
    if (this.props.hsl.a === 1 && this.state.view !== 'hex') {
      this.setState({ view: 'hex' });
    } else if (this.state.view !== 'rgb' && this.state.view !== 'hsl') {
      this.setState({ view: 'rgb' });
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.hsl.a !== 1 && this.state.view === 'hex') {
      this.setState({ view: 'rgb' });
    }
  }

  handleChange(hex) {
      color.isValidHex(hex) && this.props.onChange(hex);
  }

  showHighlight() {
    this.refs.iconHighlight.style.display = 'block';
  }

  hideHighlight() {
    this.refs.iconHighlight.style.display = 'none';
  }

  render() {
    return (
      <div is="wrap" className="flexbox-fix">
          <div is="fields" className="flexbox-fix">
            <div is="field">
                <HexInput value={this.props.hex} onChange={this.handleChange} />
            </div>
          </div>
      </div>
    );
  }

}

export default ChromeaFields;
