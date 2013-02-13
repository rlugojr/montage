var Montage = require("montage").Montage,
    Deserializer = require("core/serialization").Deserializer,
    DocumentPart = require("ui/document-part").DocumentPart,
    DocumentResources = require("ui/document-resources").DocumentResources,
    Promise = require("q"),
    logger = require("core/logger").logger("template"),
    defaultEventManager = require("core/event/event-manager").defaultEventManager,
    defaultApplication;

var Template = Montage.create(Montage, {
    _SERIALIZATON_SCRIPT_TYPE: {value: "text/montage-serialization"},
    _ELEMENT_ID_ATTRIBUTE: {value: "data-montage-id"},

    _require: {value: null},
    _resources: {value: null},
    document: {value: null},
    _baseUrl: {value: null},
    _instances: {value: null},

    _objectsString: {value: null},
    objectsString: {
        get: function() {
            return this._objectsString;
        },
        set: function(value) {
            this._objectsString = value;
            // Invalidate the deserializer cache since there's a new
            // serialization in town.
            this.__deserializer = null;
        }
    },

    // Deserializer cache
    __deserializer: {value: null},
    _deserializer: {
        get: function() {
            var deserializer = this.__deserializer;
            if (!deserializer) {
                deserializer = Deserializer.create()
                    .initWithSerializationStringAndRequire(
                        this.objectsString, this._require);
                this.__deserializer = deserializer;
            }

            return deserializer;
        }
    },
    getDeserializer: {
        value: function() {
            return this._deserializer;
        }
    },

    _templateCache: {
        value: {
            moduleId: Object.create(null)
        }
    },
    _getTemplateCacheKey: {
        value: function(moduleId, _require) {
            return _require.location + "#" + moduleId;
        }
    },
    getTemplateWithModuleId: {
        value: function(moduleId, _require) {
            var cacheKey,
                template;

            cacheKey = this._getTemplateCacheKey(moduleId, _require);
            template = this._templateCache.moduleId[cacheKey];

            if (!template) {
                template = Template.create()
                .initWithModuleId(moduleId, _require);

                this._templateCache.moduleId[cacheKey] = template;
            }

            return template;
        }
    },

    /**
     * Initializes the Template with an empty document.
     *
     * @function
     * @param {require} _require The require function used to load modules when
     *                           a template is instantiated.
     */
    initWithRequire: {
        value: function(_require) {
            this._require = _require;
            this.document = this.createHtmlDocumentWithHtml("");
            this.objectsString = "";

            return this;
        }
    },

    /**
     * Initializes the Template with a document.
     *
     * @function
     * @param {HTMLDocument} _document The document to be used as a template.
     * @param {require} _require The require function used to load modules when
     *                           a template is instantiated.
     * @returns {Promise} A promise for the proper initialization of the
     *                    template.
     */
    initWithDocument: {
        value: function(_document, _require) {
            var self = this;

            this._require = _require;
            this.setDocument(_document);

            return this.getObjectsString(_document)
            .then(function(objectsString) {
                self.objectsString = objectsString;
            });
        }
    },

    /**
     * Initializes the Template with an HTML string.
     *
     * @function
     * @param {HTMLDocument} html The HTML string to be used as a template.
     * @param {require} _require The require function used to load modules when
     *                           a template is instantiated.
     * @returns {Promise} A promise for the proper initialization of the
     *                    template.
     */
    initWithHtml: {
        value: function(html, _require) {
            var self = this;

            this._require = _require;
            this.document = this.createHtmlDocumentWithHtml(html);

            return this.getObjectsString(this.document)
            .then(function(objectsString) {
                self.objectsString = objectsString;
            });
        }
    },

    /**
     * Initializes the Template with Objects and a DocumentFragment to be
     * used as the body of the document.
     *
     * @function
     * @param {Object} objects A JSON'able representation of the objects of the
     *                         template.
     * @param {DocumentFragment} html The HTML string to be used as the body.
     * @param {require} _require The require function used to load modules when
     *                           a template is instantiated.
     * @returns {Promise} A promise for the proper initialization of the
     *                    template.
     */
    initWithObjectsAndDocumentFragment: {
        value: function(objects, documentFragment, _require) {
            var self = this;

            this._require = _require;
            this.document = this.createHtmlDocumentWithHtml("");
            this.document.body.appendChild(
                this.document.importNode(documentFragment)
            );
            this.setObjects(objects);
        }
    },

    /**
     * Initializes the Template with the HTML document at the module id.
     *
     * @function
     * @param {String} moduleId The module id of the HTML page to load.
     * @param {require} _require The require function used to load modules when
     *                           a template is instantiated.
     * @returns {Promise} A promise for the proper initialization of the
     *                    template.
     */
    initWithModuleId: {
        value: function(moduleId, _require) {
            var self = this;

            this._require = _require;

            return this.createHtmlDocumentWithModuleId(moduleId, _require)
            .then(function(_document) {
                var baseUrl = _require(moduleId).directory;

                self.document = _document;
                self.setBaseUrl(baseUrl);

                return self.getObjectsString(_document)
                .then(function(objectsString) {
                    self.objectsString = objectsString;

                    return self;
                });
            });
        }
    },

    instantiate: {
        value: function(targetDocument) {
            return this.instantiateWithInstances(null, targetDocument);
        }
    },

    instantiateWithInstances: {
        value: function(instances, targetDocument) {
            var self = this,
                fragment,
                part = DocumentPart.create(),
                templateObjects;

            instances = instances || this._instances;

            fragment = this._createMarkupDocumentFragment(targetDocument);
            templateObjects = this._createTemplateObjects(instances);

            part.initWithTemplateAndFragment(this, fragment);

            return this._instantiateObjects(templateObjects, fragment)
            .then(function(objects) {
                part.objects = objects;
                self._invokeDelegates(part, instances);

                return self.getResources().loadResources(targetDocument)
                .then(function() {
                    return part;
                });
            });
        }
    },

    setBaseUrl: {
        value: function(baseUrl) {
            this._baseUrl = baseUrl;
        }
    },

    getBaseUrl: {
        value: function() {
            return this._baseUrl;
        }
    },

    getResources: {
        value: function() {
            var resources = this._resources;

            if (!resources) {
                resources = this._resources = TemplateResources.create();
                resources.initWithTemplate(this);
            }

            return resources;
        }
    },

    /**
     * Creates the object instances to be passed to the deserialization.
     * It takes instances and augments it with "application" and "template".
     *
     * @param {Object} instances The instances object.
     * @returns {Object} The object with instances and application and template.
     */
    _createTemplateObjects: {
        value: function(instances) {
            var templateObjects = Object.create(instances || null);

            if (typeof defaultApplication === "undefined") {
                defaultApplication = require("ui/application").application;
            }

            templateObjects.application = defaultApplication;
            templateObjects.template = this;

            return templateObjects;
        }
    },

    /**
     * Receives two objects with labels as property names and returns an array
     * with labels that existed in the first object but not on the second one.
     *
     * @function
     * @param {Object} objects The objects of the deserialization.
     * @param {Object} instances The instances given by the user.
     * @returns {Array} The array with the labels that were filtered.
     */
    _filterObjectLabels: {
        value: function(objects, instances) {
            var labels;

            if (instances) {
                labels = [];
                for (var label in objects) {
                    if (!(label in instances)) {
                        labels.push(label);
                    }
                }
            } else {
                labels = Object.keys(objects);
            }

            return labels;
        }
    },

    _instantiateObjects: {
        value: function(instances, fragment) {
            return this._deserializer.deserializeWithElement(instances, fragment);
        }
    },

    _createMarkupDocumentFragment: {
        value: function(targetDocument) {
            var fragment = targetDocument.createDocumentFragment(),
                nodes = this.document.body.childNodes;

            for (var i = 0, ii = nodes.length; i < ii; i++) {
                fragment.appendChild(
                    targetDocument.importNode(nodes[i])
                );
            }

            return fragment;
        }
    },

    _invokeDelegates: {
        value: function(documentPart, instances) {
            var objects = documentPart.objects,
                object,
                labels,
                owner = objects.owner;

            // array with the object labels that were created during the
            // deserialization and not passed in the instances object, only
            // those will have deserializedFromTemplate called.
            labels = this._filterObjectLabels(objects, instances);

            for (var i = 0, label; (label = labels[i]); i++) {
                object = objects[label];

                if (typeof object._deserializedFromTemplate === "function") {
                    object._deserializedFromTemplate(owner, documentPart);
                }
                if (typeof object.deserializedFromTemplate === "function") {
                    object.deserializedFromTemplate(owner, documentPart);
                }
            }

            if (owner) {
                if (typeof owner._templateDidLoad === "function") {
                    owner._templateDidLoad(documentPart);
                }
                if (typeof owner.templateDidLoad === "function") {
                    owner.templateDidLoad(documentPart);
                }
            }
        }
    },

    /**
     * Sets the instances to use when instantiating the objects of the template.
     * These instances will always be used when instantiating the template
     * unless a different set of instances is passed in
     * instantiateWithInstances().
     *
     * @function
     * @param {Object} instances The objects' instances.
     */
    setInstances: {
        value: function(instances) {
            this._instances = instances;
        }
    },

    setObjects: {
        value: function(objects) {
            // TODO: use Serializer.formatSerialization(object|string)
            this.objectsString = JSON.stringify(objects, null, 4);
        }
    },

    /**
     * Uses the document markup as the base of the template markup.
     *
     * @function
     * @param {HTMLDocument} doc The document.
     * @returns {Promise} A promise for the proper initialization of the
     *                    document.
     */
    setDocument: {
        value: function(_document) {
            var html = _document.documentElement.innerHTML;

            this.document = this.createHtmlDocumentWithHtml(html);
        }
    },

    /**
     * Searches for objects in the document.
     * The objects string can live as an inline script in the document or as an
     * external resource that needs to be loaded.
     *
     * @function
     * @param {HTMLDocument} doc The document with the objects string.
     * @returns {Promise} A promise for the objects string, null if not
     *                    found.
     */
    getObjectsString: {
        value: function(doc) {
            var objectsString;

            objectsString = this.getInlineObjectsString(doc);

            if (objectsString === null) {
                return this.getExternalObjectsString(doc);
            } else {
                return Promise.resolve(objectsString);
            }
        }
    },

    /**
     * Searches for an inline objects string in a document and returns it if
     * found.
     * @function
     * @param {HTMLDocument} doc The document with the objects string.
     * @returns {(String|null)} The objects string or null if not found.
     */
    getInlineObjectsString: {
        value: function(doc) {
            var selector = "script[type='" + this._SERIALIZATON_SCRIPT_TYPE + "']",
                script = doc.querySelector(selector);

            if (script) {
                return script.textContent;
            } else {
                return null;
            }
        }
    },

    /**
     * Searches for an external objects file in a document and returns its
     * contents if found.
     *
     * @function
     * @param {String} doc The document to search.
     * @returns {Promise} A promise to the contents of the objects file or null
     *                    if none found.
     */
    getExternalObjectsString: {
        value: function(doc) {
            var link = doc.querySelector('link[rel="serialization"]'),
                req,
                url,
                rootUrl,
                deferred;

            if (link) {
                req = new XMLHttpRequest();
                url = link.getAttribute("href");
                rootUrl = this._documentRootUrl || "";

                if (! /^https?:\/\/|^\//.test(url)) {
                    url = rootUrl + url;
                } else {
                    return Promise.reject(
                        new Error("Relative link found for the objects file but the document URL is unknown: '" + url + "'.")
                    );
                }

                deferred = Promise.defer();

                req.open("GET", url);
                req.addEventListener("load", function() {
                    if (req.status == 200) {
                        deferred.resolve(req.responseText);
                    } else {
                        deferred.reject(
                            new Error("Unable to retrive '" + url + "', code status: " + req.status)
                        );
                    }
                }, false);
                req.addEventListener("error", function(event) {
                    deferred.reject(
                        new Error("Unable to retrive '" + url + "' with error: " + event.error + ".")
                    );
                }, false);
                req.send();

                return deferred.promise;
            } else {
                return Promise.resolve(null);
            }
        }
    },

    createHtmlDocumentWithHtml: {
        value: function(html) {
            var htmlDocument = document.implementation.createHTMLDocument("");

            htmlDocument.documentElement.innerHTML = html;

            return htmlDocument;
        }
    },

    createHtmlDocumentWithModuleId: {
        value: function(moduleId, _require) {
            var self = this;

            if (typeof _require !== "function") {
                return Promise.reject(
                    new Error("Missing 'require' function to load module '" + moduleId + "'.")
                );
            }

            return _require.async(moduleId).then(function(exports) {
                return self.createHtmlDocumentWithHtml(exports.content);
            });
        }
    },

    /**
     * Removes all artifacts related to objects string
     */
    _removeObjects: {
        value: function(doc) {
            var elements,
                selector = "script[type='" + this._SERIALIZATON_SCRIPT_TYPE + "'], link[rel='serialization']";

            Array.prototype.forEach.call(
                doc.querySelectorAll(selector),
                function (element) {
                   element.parentNode.removeChild(element);
                }
            );
        }
    },

    _addObjects: {
        value: function(doc, objectsString) {
            var script = doc.createElement("script");

            script.setAttribute("type", this._SERIALIZATON_SCRIPT_TYPE);
            script.textContent = JSON.stringify(JSON.parse(objectsString), null, 4);
            doc.head.appendChild(script);
        }
    },

    createTemplateFromElementContents: {
        value: function(elementId) {
            var element,
                elementIds,
                deserializer = this._deserializer,
                labels,
                fragment,
                objectsString,
                template,
                externalObjects,
                range;

            element = this.getElementById(elementId);
            elementIds = this._findElementIdsInDomTree(element);

            labels = deserializer.findMontageObjectLabelsWithElements(elementIds);

            objectsString = deserializer.extractSerialization(labels, ["owner"]);

            range = this.document.createRange();
            range.selectNodeContents(element);
            fragment = range.cloneContents();

            template = Template.create();
            template.initWithObjectsAndDocumentFragment(null, fragment, this._require);
            template.objectsString = objectsString;
            template._resources = this.getResources();

            return template;
        }
    },

    getElementById: {
        value: function(elementId) {
            var selector = "*[" + this._ELEMENT_ID_ATTRIBUTE + "='" + elementId + "']";

            return this.document.querySelector(selector);
        }
    },

    _findElementIdsInDomTree: {
        value: function(rootNode, elementIds) {
            var children = rootNode.children;

            elementIds = elementIds || [];

            for (var i = 0, child; (child = children[i]); i++) {
                if (child.hasAttribute(this._ELEMENT_ID_ATTRIBUTE)) {
                    elementIds.push(
                        child.getAttribute(this._ELEMENT_ID_ATTRIBUTE)
                    );
                }
                this._findElementIdsInDomTree(child, elementIds);
            }

            return elementIds;
        }
    },

    html: {
        get: function() {
            var _document = this.document;

            this._removeObjects(_document);
            this._addObjects(_document, this.objectsString);

            return _document.documentElement.outerHTML;
        }
    }
});

var TemplateResources = Montage.create(Montage, {
    _resources: {value: null},
    template: {value: null},
    rootUrl: {value: ""},

    didCreate: {
        value: function() {
            this._resources = Object.create(null);
        }
    },

    initWithTemplate: {
        value: function(template) {
            this.template = template;
        }
    },

    loadResources: {
        value: function(targetDocument) {
            return Promise.all([
                this.loadScripts(targetDocument),
                this.loadStyles(targetDocument)
            ]);
        }
    },

    getScripts: {
        value: function() {
            var scripts = this._resources.scripts,
                script,
                type,
                template,
                templateScripts;

            if (!scripts) {
                template = this.template;

                scripts = this._resources.scripts = [];
                templateScripts = template.document.querySelectorAll("script");

                for (var i = 0, ii = templateScripts.length; i < ii; i++) {
                    script = templateScripts[i];

                    if (script.type !== this.template._SERIALIZATON_SCRIPT_TYPE) {
                        scripts.push(script);
                    }
                }
            }

            return scripts;
        }
    },

    loadScripts: {
        value: function(targetDocument) {
            var scripts,
                promises = [];

            scripts = this.getScripts();

            for (var i = 0, ii = scripts.length; i < ii; i++) {
                promises.push(
                    this.loadScript(scripts[i], targetDocument)
                );
            }

            return Promise.all(promises);
        }
    },

    loadScript: {
        value: function(script, targetDocument) {
            var url,
                documentResources,
                newScript;

            documentResources = DocumentResources.getInstanceForDocument(targetDocument);
            // Firefox isn't able to load a script that we reuse, we need to
            // create a new one :(.
            //newScript = targetDocument.importNode(script);
            newScript = this._cloneScriptElement(script, targetDocument);

            return documentResources.addScript(newScript);
        }
    },

    _cloneScriptElement: {
        value: function(scriptTemplate, _document) {
            var script = _document.createElement("script"),
                attributes = scriptTemplate.attributes,
                attribute;

            for (var i = 0, ii = attributes.length; i < ii; i++) {
                attribute = attributes[i];

                script.setAttribute(attribute.name, attribute.value);
            }

            return script;
        }
    },

    getStyles: {
        value: function() {
            var styles = this._resources.styles,
                template,
                templateStyles,
                styleSelector;

            if (!styles) {
                styleSelector = 'link[rel="stylesheet"], style';
                template = this.template;

                templateStyles = template.document.querySelectorAll(styleSelector);

                styles = Array.prototype.slice.call(templateStyles, 0);
                this._resources.styles = styles;
            }

            return styles;
        }
    },

    loadStyles: {
        value: function(targetDocument) {
            var promises = [],
                styles;

            styles = this.getStyles();

            for (var i = 0, ii = styles.length; i < ii; i++) {
                promises.push(
                    this.loadStyle(styles[i], targetDocument)
                );
            }

            return Promise.all(promises);
        }
    },

    loadStyle: {
        value: function(element, targetDocument) {
            var url,
                documentResources,
                baseUrl = this.template.getBaseUrl();

            url = element.getAttribute("href");

            if (url) {
                documentResources = DocumentResources.getInstanceForDocument(targetDocument);

                url = documentResources.normalizeUrl(url, baseUrl);

                return documentResources.preloadResource(url);
            } else {
                return Promise.resolve();
            }
        }
    },

    createStylesForDocument: {
        value: function(targetDocument) {
            var styles = this.getStyles(),
                style,
                newStyle,
                stylesForDocument = [],
                baseUrl = this.template.getBaseUrl(),
                documentResources,
                url,
                normalizedUrl;

            documentResources = DocumentResources.getInstanceForDocument(targetDocument);

            for (var i = 0, style; (style = styles[i]); i++) {
                url = style.getAttribute("href");

                newStyle = targetDocument.importNode(style);
                stylesForDocument.push(newStyle);

                if (url) {
                    normalizedUrl = documentResources.normalizeUrl(url, baseUrl);
                    newStyle.setAttribute("href", normalizedUrl);
                }
            }

            return stylesForDocument;
        }
    }
});

// Used to create a DocumentPart from a document without a Template
function instantiateDocument(_document, _require) {
    var self = this,
        template = Template.create(),
        html = _document.documentElement.outerHTML,
        part = DocumentPart.create(),
        clonedDocument,
        templateObjects,
        rootElement = _document.documentElement;

    // Setup a template just like we'd do for a document in a template
    clonedDocument = Template.createHtmlDocumentWithHtml(html);

    return template.initWithDocument(clonedDocument, _require)
    .then(function() {
        // Instantiate it using the document given since we don't want to clone
        // the document markup
        templateObjects = template._createTemplateObjects();
        part.initWithTemplateAndFragment(template);

        return template._instantiateObjects(templateObjects, rootElement)
        .then(function(objects) {
            part.objects = objects;
            template._invokeDelegates(part);

            return part;
        });
    });
}

exports.Template = Template;
exports.TemplateResources = TemplateResources;
exports.instantiateDocument = instantiateDocument;
