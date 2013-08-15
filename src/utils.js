var seal = %_PRODUCTION ||
    typeof Object.seal !== "function"
        ? function( obj ) { return obj; }
        : Object.seal;

var clearTimeout = window.clearTimeout;
var setTimeout = window.setTimeout;
var INSTANCE_KEY = "range-slider-instance";
var isFinite = window.isFinite;
var fMax = function( a, b ) { return Math.max( a, b ); };
var fMin = function( a, b ) { return Math.min( a, b ); };
var fAbs = function( a ) { return Math.abs( a ); };

var MIN_DECIMALS = 0;
var MAX_DECIMALS = 8;
var FLOAT_PRECISION = Math.pow( 10, MAX_DECIMALS );

var now = typeof Date.now === "function"
    ? Date.now
    : function(){return +new Date(); };

function preventDefault(e) {
    e.preventDefault();
}

function isInteger( num ) {
    return ( num | 0 ) === num;
}

function isValidDecimalCount( num ) {
    return isInteger( num ) &&
        ( MIN_DECIMALS <= num && num <= MAX_DECIMALS );
}

function numberToString( num, decimals ) {
    num = +num;
    var str = decimals
        ? num.toFixed( decimals )
        : "" + num;

    return str.replace( ".", plugin.options.decimalPoint );
}

function numberOrDefault( str, fallback ) {
    str = (str + "")
        .replace( plugin.options.decimalPoint, "." )
        .replace( /\s/g, "");

    if( !isFinite( str ) ||
        //whitespace is considered 0 by js
        /^\s*$/.test(str) ) {
        return fallback;
    }
    return +str;
}

function normalize( value ) {
    return ( Math.round( value * FLOAT_PRECISION ) / FLOAT_PRECISION ) ||
        0;
}

function snap( value, step ) {
    var mod = normalize( value % step ),
        mod2 = normalize( step - mod );

    value = mod2 <= mod ? value + mod2 : value - mod;
    return value;
}

function clamp( val, min, max ) {
    return fMax( fMin( val, max ), min );
}

function debounce( fn, timeout, ctx ) {
    var id = -1;
    return function() {
        if( id > -1 ) {
            clearTimeout( id );
        }
        var args = [].slice.call( arguments );
        id = setTimeout( function() {
            fn.apply( ctx, args );
            id = -1;
        }, timeout );
    };
}

var clearSelection = (function() {

    if( window.getSelection ) {

        if( window.getSelection().empty ) {
            return function() {
                window.getSelection().empty();
            };
        }
        else if( window.getSelection().removeAllRanges ) {
            return function() {
                window.getSelection().removeAllRanges();
            };
        }

    }
    else if( document.selection && document.selection.empty ) {
        return function() {
            document.selection.empty();
        };
    }

})();