var SliderKnob = (function() {

/**
 * Represent a knob on a slider
 *
 *
 */
var method = SliderKnob.prototype;

function SliderKnob( elem, options ) {
    this._knobElem = null;
    this._elem = $( elem );
    this._options = options;
    this._min = +this._options.min;
    this._max = +this._options.max;
    this._box = null;
    this._init();
    seal( this );
}

method._init = function() {
    var tmpl = this._options.template;
    var elem = this._knobElem = $( tmpl )
        .find( ".js-slider-knob" )
        .eq( 0 )
        .detach();
};

method.destroy = function() {

};

method.setBoundaries = function( min, max ) {
    this._min = min;
    this._max = max;
};

method.getRoot = function() {
    return this._knobElem;
};







return SliderKnob;})();
