//micro library to define unobtrusive jQuery hooks
var hook = (function(){
    function defineHook( hookKind, hookKey, fnType, fn ) {
        var hooks = $[hookKind],
            hook = hooks[hookKey],
            orig = null;

        if( hook ) {
            orig = hook[fnType];
        }
        else {
            hook = hooks[hookKey] = {};
        }

        if( fnType === "set" ) {
            hook[fnType] = function( elem, value, name ) {
                var ret;
                if( orig ) {
                    ret = orig( elem, value, name );
                }

                return fn( elem, value, name ) || ret;
            };
        }
        else {
            hook[fnType] = function( elem, name ) {
                var retOrig, ret;
                if( orig ) {
                    retOrig = orig( elem, name );
                }
                ret = fn( elem, name );
                return ret === null ? retOrig : ret;
            };
        }

    }

    return {
        define: defineHook,

        GETTER: "get",
        SETTER: "set",

        ATTR: "attrHooks",
        PROP: "propHooks",
        VAL: "valHooks"
    };
})();