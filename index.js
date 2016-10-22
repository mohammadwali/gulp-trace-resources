var through = require("through2");
var path = require("path");
var _ = require("underscore");
var rext = require("replace-ext");
var htmlparser = require("htmlparser");


module.exports = traceResources;


function traceResources(options) {
    options = options || {};

    return through.obj(buffer, end);


    /////////////
    function buffer(file, enc, cb) {
        var self = this;

        // Always error if file is a stream since gulp doesn't support a stream of streams
        if (file.isStream()) {
            this.emit('error', new Error('Streaming not supported in traceResources lib'));
            return cb();
        }

        var resources = {};
        resources.local = {};
        resources.inline = {};
        resources.external = {};

        var handler = new htmlparser.DefaultHandler(onParseEnd.bind(this));
        var parser = new htmlparser.Parser(handler);

        parser.parseComplete(file.contents);


        function onParseEnd(error, jsonDOM) {
            var that = this;


            if (error) {
                that.emit('error', error);
                return cb(error);
            }

            resources.local = getResources(jsonDOM, "local");
            resources.inline = getResources(jsonDOM, "inline");
            resources.external = getResources(jsonDOM, "external");


            file.contents = new Buffer(JSON.stringify(resources), "utf8");

            if (options.replaceExt) {
                file.path = rext(file.path, ".json");
            }

            that.push(file);
            cb();
        }
    }

    function end(flush) {
        flush();
    }
}


function getResources(data, type) {
    var localResources = {};
    if (type !== "inline") {
        localResources.images = getImages(data, type);
    }
    localResources.styleSheets = getStyleSheets(data, type);
    localResources.scripts = getScripts(data, type);

    return localResources;
}


function getImages(data, type) {
    var imageTags = search("name", "img", data);

    if (imageTags.length) {

        imageTags = _.filter(imageTags, function (child) {
            var isImage = child.type === "tag" && child.attribs && child.attribs.src;
            if (isImage) {
                var isLocal = !isUrl(child.attribs.src);
                var localOrExternal = (type === "local") ? isLocal : !isLocal;
                return (isImage && localOrExternal);
            }
        });


        imageTags = _.map(imageTags, function (child) {
            return child.attribs.src;
        });
    }

    return imageTags;
}


function getScripts(data, type) {
    var scripts = [];
    var html = _.find(data, {type: "tag", name: "html"});
    if (typeof html !== "undefined") {
        var head = _.find(html.children, {type: "tag", "name": "head"});
        var body = _.find(html.children, {type: "tag", "name": "body"});

        if (typeof head !== "undefined") {
            lookForScripts(head);
        }

        if (typeof  body !== "undefined") {
            lookForScripts(body);
        }

    }
    return scripts;

    function lookForScripts(element) {
        var foundScripts = _.filter(element.children, function (child) {
            var isScript = child.type === "script" && child.name === "script";
            var isLocal;
            var localOrExternal;

            if (type === "local" || type === "external") {
                isScript = isScript && child.attribs && child.attribs.src;
                if (isScript) {
                    isLocal = !isUrl(child.attribs.src);
                    localOrExternal = (type === "local") ? isLocal : !isLocal;
                    return (isScript && localOrExternal);
                }
            } else {
                return isScript && child.children && child.children[0].raw;
            }

            return isScript;

        });

        foundScripts = _.map(foundScripts, function (child) {
            return (type === "local" || type === "external") ? child.attribs.src : child.children[0].raw;
        });

        scripts = scripts.concat(foundScripts);
    }
}


function getStyleSheets(data, type) {
    var styleSheets = [];
    var html = _.find(data, {type: "tag", name: "html"});
    if (typeof html !== "undefined") {
        var head = _.find(html.children, {type: "tag", "name": "head"});
        if (typeof head !== "undefined") {

            styleSheets = _.filter(head.children, function (child) {
                var isStyleSheet;
                var isLocal;
                var localOrExternal;


                if (type === "local" || type === "external") {
                    isStyleSheet = child.type === "tag" && child.name === "link" && child.attribs.rel === "stylesheet";
                    if (isStyleSheet) {
                        isLocal = (child.attribs) ? !isUrl(child.attribs.href) : false;
                        localOrExternal = (type === "local") ? isLocal : !isLocal;
                        return (isStyleSheet && localOrExternal);
                    }
                } else {

                    isStyleSheet = (child.type === "style" && child.name === "style");
                }


                return isStyleSheet;
            });

            styleSheets = _.map(styleSheets, function (child) {
                return (type === "local" || type === "external") ? child.attribs.href : child.children[0].raw;
            });
        }
    }

    return styleSheets;
}


function isUrl(string) {
    var idx = string.indexOf("//");
    //  0 for "//site.com"
    //  5 for "http://site.com"
    //  6 for "https://site.com"
    return idx === 0 || idx === 5 || idx === 6;
}


function search(_for, _val, _in) {
    var r = [];
    for (var p in _in) {
        if (_in.hasOwnProperty(p)) {

            if (p === _for && _in[p] === _val) {
                r.push(_in);
            }

            if (typeof _in[p] === "object") {
                r = r.concat(search(_for, _val, _in[p]))
            }
        }
    }
    return r;
}