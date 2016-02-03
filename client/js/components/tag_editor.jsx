"use strict";
import React from 'react';
import ReactColorPicker from 'react-color';
import * as models from '../models.js'

/**
    Convert a list of tags to a editable string representation.
*/
var tagsToString = (tags) =>
    Array.prototype.map.call(tags, x => x.value())
        .join(', ');

/**
    Convert a string to a list of tags.
*/
var stringToTags = (tags) => {
    const tagValues = (tags.match(/([a-zA-Z0-9_\-$]+)/ig) || [])
        .map(x => x.toLowerCase())
        .filter((x, i, self) => self.indexOf(x) == i);

    return tagValues.map(tag =>
        new models.TagModel(tag));
};

/**
 */
var updateStreamTags = (stream, tags, f) => {
    $.ajax({
        type: "POST",
        url: jsRoutes.controllers.StreamApiController.setTags(stream.id()).url,
        contentType: 'application/json',
        data: JSON.stringify(tags.map(function(x) {
            return {
                "tag": x.value()
            };
        })),
        headers: {
            accept: "application/json"
        },
        error: e => {
            f(null);
        }
    }).done(function(result) {
        f(result.map(tag =>
            new models.TagModel(tag.tag)));
    });
};

/**
    Stream status color picker component.
*/
export const ColorPicker = React.createClass({
    componentWillMount() {
        this.setState({
            editing: false,
            tags: this.props.stream.tags()
        });
    },

    onEditTagsButtonClick() {
        this.setState({ editing: true });
        this.props.onBeginEdit && this.props.onBeginEdit();
    },

    onSaveTagsButtonClick() {
        this.setState({ editing: false });

        if (this._tagInputField) {
            const tagData = stringToTags($(this._tagInputField).val());
            updateStreamTags(this.props.stream, tagData, tags => {
                if (tags) {
                    $(this._tagInputField).val(tagsToString(tags));
                    this.setState({ tags: tags });
                } else {
                    // restore old values
                    $(this._tagInputField).val(tagsToString(this.state.tags));
                    return;
                }
            });
        }
    },

    onTagKeyDown(e) {
        if (e.keyCode === 13 /*enter*/ ) {
            this.onSaveTagsButtonClick();
        }
    },

    render() {
        const tagElements = this.state.tags.map(tag => (
            <li className="tag" key={tag.url()}>
                <a href={tag.url()}>{tag.value()}</a>
            </li>
        ));

        const tagValues = tagsToString(this.state.tags);
        const canEdit = models.isOwner(this.props.user, this.props.stream.uri());

        return (
            <div className="tags">
                <div id="tag-editor" className={canEdit ? '' : 'hidden'}>
                    <div id="tag-input" className={"input-group " + (this.state.editing ? '' : 'hidden')}>
                        <span className="input-group-btn">
                            <button id="save-tags-button" className="btn btn-default" onClick={this.onSaveTagsButtonClick} type="button">Save</button>
                        </span>
                        <input type="text"
                            className="form-control"
                            ref={(c) => this._tagInputField = c}
                            defaultValue={tagValues}
                            onKeyDown={this.onTagKeyDown} />
                    </div>
                    <button id="edit-tags-button" title="Edit Tags" onClick={this.onEditTagsButtonClick} className={this.state.editing ? 'hidden' : ''}>
                        <span className="glyphicon glyphicon-tag"></span>
                    </button>
                </div>
                <ul className={"tag-list " + (this.state.editing ? 'hidden' : '')}>{tagElements}</ul>
            </div>
        );
    },
});

export default ColorPicker;
