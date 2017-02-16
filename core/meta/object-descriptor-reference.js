
/**
 * @module montage/core/meta/blueprint-reference
 * @requires core/exception
 * @requires core/promise
 * @requires core/logger
 */
var Promise = require("../promise").Promise,
    ObjectDescriptorModule = require("./object-descriptor"),
    ObjectModelModule = require("./object-model"),
    RemoteReference = require("./remote-reference").RemoteReference,
    ObjectModelReference = require("./object-model-reference").ObjectModelReference;

var logger = require("../logger").logger("blueprint");

exports.ObjectDescriptorReference = RemoteReference.specialize( {

    constructor: {
        value: function ObjectDescriptorReference() {
            this.superForValue("constructor")();
        }
    },

    /**
     * The identifier is the name of the binder and is used to make the
     * serialization of binders more readable.
     * @type {string}
     * @default this.name
     */
    identifier: {
        get: function () {
            if (!this._reference) {
                this._reference = this.referenceFromValue(this._value);
            }
            return [
                "objectDescriptor",
                (this._reference.blueprintName || "unnamed").toLowerCase(),
                "reference"
            ].join("_");
        }
    },

    valueFromReference: {
        value: function (references) {

            // TODO: references.blueprintModule && references.binderReference are deprecated.
            var objectDescriptorModule = references.objectDescriptorModule || references.blueprintModule,
                objectModelReference = references.objectModelReference || references.binderReference,
                objectModelPromise = Promise.resolve(ObjectModelModule.ObjectModel.group.defaultModel);
            if (objectModelReference) {
                objectModelPromise = ObjectModelReference.prototype.valueFromReference(objectModelReference, require);
            }

            return objectModelPromise.then(function (objectModel) {
                var ModuleObjectDescriptorModule;
                if (objectModel) {
                    ModuleObjectDescriptorModule = require("./module-object-descriptor");
                    return ModuleObjectDescriptorModule.ModuleObjectDescriptor.getObjectDescriptorWithModuleId(objectDescriptorModule.id, objectDescriptorModule.require)
                        .then(function (objectDescriptor) {
                        if (objectDescriptor) {
                            objectModel.addObjectDescriptor(objectDescriptor);
                            return objectDescriptor;
                        } else {
                            throw new Error("Error cannot find Object Descriptor " + objectDescriptorModule);
                        }
                    });
                } else {
                    return ObjectDescriptorModule.ObjectDescriptor.getObjectDescriptorWithModuleId(objectDescriptorModule, require);
                }
            });
        }
    },

    referenceFromValue: {
        value: function (value) {
            // the value is an object descriptor we need to serialize the object model and the object descriptor reference
            var references = {};
            references.objectDescriptorName = value.name;
            references.objectDescriptorModule = value.objectDescriptorInstanceModule;
            if (value.binder && !value.model.isDefault) {
                references.objectModelReference = ObjectModelReference.prototype.referenceFromValue(value.model);
            }
            return references;
        }
    }

});
