var AssertionError = function(message) {
    this.name = "AssertionError";
    this.message = message || "Assertion Failed";
};

AssertionError.prototype = new Error();
AssertionError.prototype.constructor = AssertionError;


var assert = function(v, msg) {
    if (!v) throw new AssertionError(msg);
};

var assertEquals = function(a, b) {
    if (a !== b) throw new AssertionError(JSON.stringify(a)+"!=="+JSON.stringify(b));
};

var tests = {
    testIf: function() {
        var s = "abc{% if test %}d{% else %}e{%endif%}";
        var t = Tjs.template(s);
        assertEquals(t({test: true}), "abcd");
        assertEquals(t({test: false}), "abce");
    },
    testFor: function() {
        var s = "abc{% for a as %}{{a}}{% if test %}this{%endif%}{%endfor%}";
        var t = Tjs.template(s);
        assertEquals(t({as: [1,2,3]}), "abc123");
    },
    testComment: function() {
        var s = "asdf {#comment#}{{test}} {% if myVariable %}{#test#} {{test2}} {% endif %}";
        var t = Tjs.template(s);
        assertEquals(t({myVariable: true, test: "next"}), "asdf next   ");
    },
    testSwitch: function() {
        // TODO
    },
    testInclude: function() {
        var s1 = "asdf {% if test %} {% include other %} {% endif %}end";
        var s2 = "asdf {{ myVal }}";
        var t1 = Tjs.template(s1);
        var t2 = Tjs.template(s2);
        assertEquals(t1({test: true, other: t2, myVal: "worked"}), "asdf  asdf worked end");
        assertEquals(t1({test: false, other: t2, myVal: "worked"}), "asdf end");
        assertEquals(t1({test: true, other: t2}), "asdf  asdf  end");
    }
};

var runTests = function() {
    for (var test in tests) {
        tests[test]()
        console.log(test, "... pass");
    }
};

