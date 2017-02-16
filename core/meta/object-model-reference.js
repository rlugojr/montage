
/**
 * @module montage/core/meta/binder-reference
 * @requires core/exception
 * @requires core/promise
 * @requires core/logger
 */
var Promise = require("../promise").Promise,
    RemoteReference = require("./remote-reference").RemoteReference,
    ObjectModelModule = require("./object-model");

exports.ObjectModelReference = RemoteReference.specialize({

    constructor: {
        value: function ObjectModelReference() {
            this.superForValue("constructor")();
        }
    },

    /**
     * The identifier is the name of the object model and is used to make the
     * serialization of object models more readable.
     * @readonly
     * @type {string}
     */
    identifier: {
        get: function () {
            if (!this._reference) {
                this._reference = this.referenceFromValue(this._value);
            }
            return [
                "objectModel",
                this._reference.objectModelName.toLowerCase(),
                "reference"
            ].join("_");
        }
    },

    valueFromReference: {
        value: function (references, require) {
            var objectModelName = references.objectModelName,
                objectModelModuleId = references.objectModelModuleId,
                objectModel = ObjectModelModule.ObjectModel.group.modelForName(objectModelName);
                // deferredObjectModel,
                // targetRequire,
                // slashIndex,
                // prefix,
                // mappings;

            return objectModel ?    Promise.resolve(objectModel) :
                                    Promise.reject(new Error("Error cannot find Object Model " + objectModelModuleId));
            //         if (objectModel) {
            //             deferredObjectModel = Promise.resolve(objectModel);
            //         } else {
            //             try {
            //            // We need to be careful as the parent may be in another module
            //            targetRequire = require;
            //            slashIndex = objectModelModuleId.indexOf("/");
            //            if (slashIndex > 0) {
            //                prefix = objectModelModuleId.substring(0, slashIndex);
            //                mappings = require.mappings;
            //                if (prefix in mappings) {
            //                    objectModelModuleId = objectModelModuleId.substring(slashIndex + 1);
            //                   targetRequire = targetRequire.getPackage(mappings[prefix].location);
            //                }
            //            }
            //                 TODO: This method was not defined anywhere (getBinderWithModuleId)
            //                 deferredBinder = BinderModule.Binder.getBinderWithModuleId(binderModuleId, targetRequire);
            //             } catch (exception) {
            //                 deferredBinder = Promise.reject(new Error("Error cannot find Blueprint Binder " + binderModuleId));
            //             }
            //         }
            //         return deferredBinder;
        }
    },

    referenceFromValue: {
        value: function (value) {
            var references = {};
            references.objectModelName = value.name;
            references.objectModelModuleId = value.objectModelModuleId;
            return references;
        }
    }

});
