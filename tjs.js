/**
 * TODO: Document
 *
 * TODO: Variable defn unclear. Should probably add literals?
 *       Switch treats args as string literals, this SHOULD be changed.
 */

// Production steps of ECMA-262, Edition 5, 15.4.4.19  
// Reference: http://es5.github.com/#x15.4.4.19  
/// BEGIN ///
if (!Array.prototype.map) {  
    Array.prototype.map = function(callback, thisArg) {  
        var T, A, k;  
        if (this == null) throw new TypeError(" this is null or not defined");  
        var O = Object(this);  
        var len = O.length >>> 0;  
        if ({}.toString.call(callback) != "[object Function]") throw new TypeError(callback + " is not a function");  
        if (thisArg) T = thisArg;
        A = new Array(len);  
        k = 0;  
        while(k < len) {  
            var kValue, mappedValue;  
            if (k in O) {  
                kValue = O[ k ];  
                mappedValue = callback.call(T, kValue, k, O);  
                A[ k ] = mappedValue;  
            }  
            k++;  
        }  
        return A;  
    };        
}
/// END ///

(function() {
    "use strict";

    var registeredTags = {};
    var registeredFilters = {};

    var trim = function(s) {
        return s.trim ? s.trim() : s.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    var extend = function(A, B) {
        for (var key in B) {
            A[key] = B[key];
        }
        return A;
    };

    var clone = function(obj) {
        return extend({}, obj);
    };

    // Taken from backbone.js
    //     Backbone.js 0.9.2

    //     (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
    //     Backbone may be freely distributed under the MIT license.
    //     For all details and documentation:
    //     http://backbonejs.org
    /// BEGIN ///
    var ctor = function(){};
    var inherits = function(parent, protoProps, staticProps) {
        var child;
        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function(){ parent.apply(this, arguments); };
        }
        extend(child, parent);
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        if (staticProps) extend(child, staticProps);
        if (protoProps) extend(child.prototype, protoProps);
        child.prototype.constructor = child;
        child.__super__ = parent.prototype;

        return child;
    };
    /// END ///

    var defaults = function(obj, defaults) {
        for (var k in defaults) {
            if (!obj.hasOwnProperty(k)) obj[k] = defaults[k];
        }
        return obj;
    }

    // Tokenize the template and strip comments
    var tokenize = function(string) {
        var pieces = string.split(/{%\s*(.*?)\s*%}/); // Splits on matching {%, %} while ignoring contained quoted strings.
        var tokens = [];
        for (var i = 0; i < pieces.length; i++) {
            var piece = pieces[i];
            if (i % 2 === 0) {
                piece = piece.replace(/{#.*?#}/g, ''); // Strip comments
                if (piece === "") continue;
                tokens.push({type:"text", value:piece});
            } else {
                if (piece.slice(0,3) === "end") {
                    tokens.push({type: "end", value: piece.slice(3)});
                } else {
                    var parts = piece.split(/\s+/);
                    var cmd = parts[0];
                    var args = Array.prototype.splice.call(parts, 1);
                    tokens.push({type: "tag", value: {fn: cmd, args: args}});
                }
            }
        }
        return tokens;
    }

    // Parse the tokens and generate a template tree.
    var parse = function(tokens) {
        var root = new Block();
        var frame = root;
        var stack = [];
        for (var i=0; i < tokens.length; i++) {
            var token = tokens[i];
            switch(token.type) {
                case "text":
                    frame.addChild(new Text(frame, [token.value]));
                    break;
                case "end":
                    if (frame.tag !== token.value) {
                        throw new Error("Misplaced end tag: 'end"+token.value+"'.");
                    }
                    frame = stack.pop();
                    break;
                case "tag":
                    var tag = token.value.fn;
                    var args =token.value.args;
                    var element = registeredTags[token.value.fn];
                    if (element.frame && element.frame !== frame.tag) {
                        throw new Error("Tag '"+tag+"' not valid in tag '"+frame.tag+"'.");
                    }
                    var element_instance = new element(frame, args);
                    element_instance.tag = tag;
                    frame.addChild(element_instance);

                    if (element.block) {
                        stack.push(frame);
                        frame = element_instance;
                    }
                    break;
                default:
                    throw new Error("Internal Error: Invalid token '"+token.type+"'.");
            }
        }
        if (frame !== root) throw new Error("Missing end of '"+frame.tag+"' block.");
        return root;
    }

    var Tjs = {
        defaultContext : {
            "eq": function(a, b) { return (a == b); },
            "lt": function(a, b) { return (a < b); },
            "gt": function(a, b) { return (a > b); },
            "gte": function(a, b) { return (a >= b); },
            "lte": function(a, b) { return (a <= b); },
            "ne": function(a, b) { return (a != b); },
            "special": {
                newline: "\n",
            },
            "templatetag": {
                openblock: "{%",
                closeblock: "%}",
                openvariable: "{{",
                closevariable: "}}",
                openbrace: "{",
                closebrace: "}",
                opencomment: "{#",
                closecomment: "#}"
            }
        },
        elements : {},
        registerTags : function(tags) {
            extend(registeredTags, tags);
        },
        unregisterTags : function() {
            for (var i = 0; i < arguments.length; i++) {
                var tag = arguments[i];
                delete registeredTags[tag];
            }
        },
        registerFilters : function(filters) {
            extend(registeredFilters, filters);
        },
        unregisterFilters : function() {
            for (var i = 0; i < arguments.length; i++) {
                var filter = arguments[i];
                delete registeredFilters[filter];
            }
        },
        lookup : function(context, name) {
            var parts = name.split('.');
            var value = context;
            var name;
            while (name = parts.shift()) {
                value = value[name];
            }
            return value;
        },
        compile : function(string) {
            return parse(tokenize(string));
        },
        template : function(string, def) {
            def = clone(def);
            defaults(def, Tjs.defaultContext);
            var tree = Tjs.compile(string);
            var fn = function(context) {
                context = clone(context);
                defaults(context, def);
                return tree.exec(context);
            }
            fn.tree = tree;
            fn.defaults = def;
            return fn;
        }
    };

    // The basic element.

    var Element = Tjs.Element = function(parentElement, args) {
        this.parentElement = parentElement;
        this.initialize.apply(this, args);
    };
    Element.extend = function(protoProps, classProps) {
        var child = inherits(this, protoProps, classProps);
        child.extend = this.extend;
        return child;
    }
    Element.prototype = {
        // Called when the element is created
        initialize: function() {},
        // Called when the template is evaluated.
        exec: function() {return "";},
    };

    // The text element (...{{...}}...)
    var Text = Tjs.Text = Element.extend({
        initialize: function(value) {
            this.value = value;
        },
        exec: function(context) {
            return this.value.replace(/{{\s*(.*?)\s*}}/g, function(match, contents) {
                var pieces = contents.split(/\s*\|\s*/);
                var val = Tjs.lookup(context, pieces[0]);
                for (var i = 1; i < pieces.length; i++) {
                    val = registeredFilters[pieces[i]](val, context);
                }
                return val || "";
            });
        }
    });

    // The tag element ({%...%})
    var Tag = Tjs.Tag = Element.extend({ });

    // A tag that can contain other elements.
    var Block = Tjs.Block = Tag.extend({
        exec: function(context) {
            return this.execChildren(clone(context));
        },
        execChildren : function(context, first, last) {
            var text = "";
            if (last) {
                for (var child = (first || this.firstChild); child && child != last; child = child.next) {
                    text += child.exec(context);
                }
            } else {
                for (var child = (first || this.firstChild); child; child = child.next) {
                    text += child.exec(context);
                }
            }
            return text;
        },
        addChild: function(child) {
            if (this.lastChild) {
                this.lastChild.next = child;
            } else {
                this.firstChild = child;
            }
            this.lastChild = child;
        }
    }, {block: true});

    var If = Tjs.elements.If = Block.extend({
        initialize: function() {
            this.fnName = arguments[0];
            this.argsNames = Array.prototype.splice.call(arguments, 1);
        },
        registerElse: function(elseTag) {
            if (this.elseTag) throw new Error("An if statement can only have one else statement.");
            this.elseTag = elseTag;
        },
        exec: function(context) {
            var first, last;
            var v = context[this.fnName];
            if (v instanceof Function) {
                v = v.apply(this, this.argsNames.map(function(n) { return Tjs.lookup(context, n)}));
            }

            if (v) {
                first = this.firstChild;
                last = this.elseTag;
            } else if (this.elseTag) {
                first = this.elseTag;
            } else {
                return "";
            }
            return this.execChildren(clone(context), first, last);
        }
    });

    var Else = Tjs.elements.Else = Tag.extend({
        initialize: function() {
            this.parentElement.registerElse(this);
        },
    }, { frame: "if" });

    var For = Tjs.elements.For = Block.extend({
        initialize: function() {
            var i = Array.prototype.indexOf.call(arguments, 'in');
            switch(i) {
                case 1:
                    if (arguments.length != 3) throw new Error("Invalid for arguments.");
                    this.valueName = arguments[0];
                    this.iterName = arguments[2];
                    break;
                case 2:
                    if (arguments.length != 4) throw new Error("Invalid for arguments.");
                    this.valueName = arguments[0];
                    this.keyName  = arguments[1];
                    this.iterName = arguments[3];
                    break;
                default:
                    throw new Error("Invalid for arguments.");
            }
        },
        registerEmpty : function(tag) {
            this.emptyTag = tag;
        },
        exec: function(context) {
            var iterable = Tjs.lookup(context, this.iterName);
            if (!iterable) {
                return this.execChildren(context, this.empytTag);
            }
            var text = "";
            var index = 0;
            for (var key in iterable) {
                var value = iterable[key];
                context = clone(context);
                context.forloop = {};
                context.forloop.index = index;
                context[this.valueName] = iterable[key];
                if (key) context[this.keyName] = key;
                text += this.execChildren(context, this.firstChild, this.emptyTag);
                index++;
            }
            return text;
        },
    });
    
    var Empty = Tjs.elements.Empty = Tag.extend({
        initialize: function() {
            this.parentElement.registerEmpty(this);
        },
    });

    var Switch = Tjs.elements.Switch = Block.extend({
        initialize: function(varName) {
            this.varName = varName;
            this.cases = {};
        },
        registerCase: function(myCase) {
            // Register cases in map and keep linked list;
            this.cases[myCase.value] = myCase;
            if (this.lastCase) {
                this.lastCase.nextCase = myCase;
            }
            this.lastCase = myCase;
        },
        registerDefault: function(myCase) {
            // Register cases in map and keep linked list;
            if (this.defaultCase) throw new Error("A switch can have only one default.");
            this.defaultCase = myCase;
            if (this.lastCase) {
                this.lastCase.nextCase = myCase;
            }
            this.lastCase = myCase;
        },
        getCase: function(value) {
            return this.cases[value] || this.defaultCase
        },
        exec: function(context) {
            var myCase = this.getCase(Tjs.lookup(context, this.varName));
            if (!myCase) return "";
            return this.execChildren(clone(context), myCase, myCase.nextCase);
        }
    });
    
    var Case = Tjs.elements.Case = Tag.extend({
        initialize: function(value) {
            this.value = value;
            this.parentElement.registerCase(this);
        }
    }, {
        frame: "switch"
    });

    var Default = Tjs.elements.Case = Case.extend({
        initialize: function() {
            this.parentElement.registerDefault(this);
        }
    });

    var Include = Tjs.elements.Include = Tag.extend({
        initialize: function(templateName) {
            this.templateName = templateName;
        },
        exec: function(context) {
            var template = Tjs.lookup(context, this.templateName);
            if (!template) throw new Error("Included template not in context: '"+this.templateName+"'.");
            return template(context);
        }
    });

    var Let = Tjs.elements.Let = Block.extend({
        exec: function(context) {
            var str = "{" + this.execChildren(context) + "}";
            extend(context, JSON.parse(str));
            return "";
        }
    });

    var Json = Tjs.elements.Json = Tag.extend({
        initialize: function(varName) {
            this.varName = varName;
        },
        exec: function(context) {
            return JSON.stringify(Tjs.lookup(context, this.varName));
        }
    });


    Tjs.registerTags({
        "if": If,
        "else": Else,
        "for": For,
        "case": Case,
        "switch": Switch,
        "default": Default,
        "include": Include,
        "let": Let,
        "block": Block,
        "json": Json
    });

    var escapeChars = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quote;'
    };

    var escapeRegex = (function() {
        var str = "[";
        for (var key in escapeChars) {
            str += "\\x" + key.charCodeAt(0).toString(16);
        }
        str += "]";
        return new RegExp(str, "g");
    })();

    var escapeReplaceFn = function(ch) {
        console.log(ch);
        return escapeChars[ch];
    };


    Tjs.registerFilters({
        "escape": function(o) {
            return o.replace(escapeRegex, escapeReplaceFn);
        }
    });
    window.Tjs = Tjs;
})();
