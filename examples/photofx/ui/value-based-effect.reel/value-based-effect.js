/* <copyright>
Copyright (c) 2012, Motorola Mobility, Inc
All Rights Reserved.
BSD License.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  - Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer.
  - Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.
  - Neither the name of Motorola Mobility nor the names of its contributors
    may be used to endorse or promote products derived from this software
    without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
</copyright> */
var Montage = require("montage").Montage;
var Component = require("montage/ui/component").Component;
var undoManager = require("montage/core/undo-manager").defaultUndoManager;

exports.ValueBasedEffect = Montage.create(Component, {

    name: {
        value: null
    },

    enabled: {
        value: false
    },

    defaultValue: {
        value: null
    },

    _value: {value: 0},
    value: {
        value: 0
    },

    _originalSliderValue: {
        value: null
    },


    handleValueSliderMontage_range_interaction_start: {
        value: function() {
            this._originalSliderValue = this.sliderValue;
        }
    },

    handleValueSliderMontage_range_interaction_end: {
        value: function() {
            this._commitSliderValue();
            this._originalSliderValue = null;
        }
    },


    _commitSliderValue: {
        value: function(value) {
            var undoneValue = this._originalSliderValue ? this._originalSliderValue : this.sliderValue;
            if (this.sliderValue !== this._originalSliderValue) {
                undoManager.add(this.name.toLowerCase() + " change", this._commitSliderValue, this, undoneValue);
            }

            if (typeof value !== "undefined") {
                this.sliderValue = value;
            }
        }
    },

    sliderValue: {
        dependencies: ["value"],
        get: function() {
            return this.value;
        },
        set: function(value) {
            if (value === this._value) {
                return;
            }

            this.value = value;

        }
    },

    minValue: {
        value: 0
    },

    maxValue: {
        value: 100
    },

    reset: {
        value: function() {
            this.value = this.defaultValue;
        }
    }

});

var Converter = require("montage/core/converter/converter").Converter;

exports.ResetAvailableConverter = Montage.create(Converter, {

    defaultValue: {
        value: null
    },

    convert: {
        value: function(value) {
            if (null == this.defaultValue) {
                return false;
            } else {
                return (value !== this.defaultValue);
            }
        }
    }

});
