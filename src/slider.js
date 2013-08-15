var Slider = (function() {
var method = Slider.prototype;

function Slider( element, options ) {
    this._element = $( element );
    this._options = options;
    //The options are initially most likely strings
    //because they are read from the element attributes
    this._step = +this._options.step;
    this._min = +this._options.min;
    this._max = +this._options.max;
    this._defaultValue = 0;
    this._decimals = +this._options.decimals;
    this._box = null;
    this._knobBox = null;
    this._isRtl = false;
    this._dragOffset = 0;
    this._isDisabled = false;
    this._isSliding = false;
    this._sliderElement = null;
    this._sliderKnobElement = null;
    this._sensitivity = +this._options.sensitivity;
    this._lastMousewheel = now();
    this._$changed = $.proxy( this._changed, this );
    this._$keyDowned = $.proxy( this._keyDowned, this );
    this._$mouseWheeled = $.proxy( this._mouseWheeled, this );
    this._$mouseDowned = $.proxy( this._mouseDowned, this );
    this._$mouseMoved = $.proxy( this._mouseMoved, this );
    this._$mouseReleased = $.proxy( this._mouseReleased, this );
    this._$keyPressed = $.proxy( this._keyPressed, this );
    this._$blurred = $.proxy( this._blurred, this );
    this._$focused = $.proxy( this._focused, this );
    this._$input = debounce( this._input, 35, this );
    seal( this );
    this._init();
}

//Deprecated
method.disabled = function( disabled ) {
   this._setDisabled( !!disabled );
};

method.destroy = function() {
    this._sliderElement.remove();
    this._element
        .off( ".rangeslider" )
        .removeData( INSTANCE_KEY );

    this._element =
        this._sliderElement =
        this._sliderKnobElement = null;
};

method._setDisabled = function( disabled ) {
    this._isDisabled = disabled;
    if( this._isDisabled ) {
        this._sliderElement.addClass( "disabled" );
    }
    else {
        this._sliderElement.removeClass( "disabled" );
    }
    this._element.prop( "disabled", this._isDisabled );

    if( !disabled ) {
        this._mouseReleased();
    }
};

//SliderOnly means the value is only applied to the slider
//not to the input element
//to avoid flicker on the input element
//when the value originates from the input element typing
method._applyValue = function( val, sliderOnly ) {
    var value = snap( clamp( val, this._min, this._max ), this._step );
    this._setValue( value, sliderOnly );
};

method._init = function() {
    if( !this._step || this._step < 0 ) {
        this._step = 1;
    }

    if( this._min > this._max ) {
        this._max = this._min;
    }

    if( this._min === this._max ) {
        this._max += 1;
    }

    if( !isFinite( this._decimals ) ) {
        this._decimals = -1;
    }

    this._defaultValue = numberOrDefault( this._element[0].value,
            numberOrDefault( this._element[0].defaultValue, this._min )
    );

    this._isRtl = this._element
        .css( "direction" )
        .toLowerCase() === "rtl" || !!this._options.rtl;

    var val = numberOrDefault(
        this._element.val(),
        this._defaultValue
    );

    if( !isValidDecimalCount( this._decimals ) ) {
        //Determine the number of decimal precision
        //required by looking at the precision of step size
        var decimalIndex = this._step.toString().indexOf(".");

        if( decimalIndex > -1 ) {
            this._decimals =
                this._step.toString().length - ( decimalIndex + 1 );
        }

        if( !isValidDecimalCount( this._decimals ) ) {
            this._decimals =
                clamp( this._decimals, MIN_DECIMALS, MAX_DECIMALS );
        }
    }

    this._sliderElement = $( this._options.template );
    var target = $( this._options.slider );
    if( !target.length ) {
        this._sliderElement.insertBefore( this._element );
    }
    else {
        this._sliderElement.appendTo( this._options.slider );
    }



    this._sliderKnobElement = this._sliderElement
        .find( ".js-slider-knob" );

    if ( this._options.focusable ) {
        var tabIndex = this._element.prop( "tabIndex" );
        this._sliderElement.prop( "tabIndex",
            tabIndex > 0 ? tabIndex : 0 );
    }

    this._setDisabled( this._element.prop( "disabled" ) );

    this._element.on( {
        "keypress.rangeslider": this._$keyPressed,
        "change.rangeslider": this._$changed,
        "keydown.rangeslider": this._$keyDowned,
        "mousewheel.rangeslider": this._$mouseWheeled,
        "DOMMouseScroll.rangeslider": this._$mouseWheeled
    }).on(
        "cut.rangeslider input.rangeslider paste.rangeslider " +
        "mouseup.rangeslider keydown.rangeslider keyup.rangeslider " +
        "keypress.rangeslider mousewheel.rangeslider " +
        "DOMMouseScroll.rangeslider",
        this._$input
    );

    this._sliderElement.on( {
        "focusin.rangeslider": this._$focused,
        "focus.rangeslider": this._$focused,
        "focusout.rangeslider": this._$blurred,
        "blur.rangeslider": this._$blurred,
        "mousedown.rangeslider": this._$mouseDowned,
        "mousewheel.rangeslider": this._$mouseWheeled,
        "keydown.rangeslider": this._$keyDowned,
        "DOMMouseScroll.rangeslider":this._$mouseWheeled
    });

    if( "step" in this._element[0] ) {
        //Number inputs have a step property
        this._element[0].step = this._step;
    }

    this._calculateBox();

     //Need to calculate some coordinates before
    //we can set the initial slider position

    this._calculateDragStartOffset( {} );
    this._applyValue( val, false );

    this._element.on( "destroy.rangeslider",
        $.proxy( this.destroy, this ) );
};

method._input = function() {
    var val = numberOrDefault( this._element.val(), 0/0 );
    if( isFinite( val ) ) {
        this._applyValue( val, true );
    }
};

method._keyPressed = function(e) {
    var ch = String.fromCharCode(e.which);
    if( !/[0-9.,\s]/.test( ch ) ) {
        e.preventDefault();
    }
};

method._blurred = function() {
    this._sliderElement.removeClass( "focused" );
};

method._focused = function() {
    if( this._isDisabled ) {
        return;
    }
    this._sliderElement.addClass( "focused" );
};

method._calculateBox = function() {
    this._box = new Box( this._sliderElement );
    this._knobBox = new Box( this._sliderKnobElement );
};

method._calculateDragStartOffset = function( e ) {
    var offset;

    //The drag started on the knob
    if( e.target === this._sliderKnobElement[0] ) {
        offset = this._sliderKnobElement.offset();
        if( this._box.isHorizontal ) {
            this._dragOffset = e.pageX - offset.left;
        }
        else {
            this._dragOffset =
                this._knobBox.height - (e.pageY - offset.top);
        }
    }
    else { //The drag was started somewhere
            //not on the knob - assume middle
        this._dragOffset = this._box.isHorizontal
            ? this._knobBox.width / 2
            : this._knobBox.height / 2;
    }
};
//onchange
method._changed = function() {
    var val = numberOrDefault(
        this._element.val(),
        this._defaultValue
    );
    this._applyValue( val, false );
};

//onkeydown
method._keyDowned = function( e ) {
   var val = numberOrDefault( this._element.val(), this._defaultValue );

    if( this._isDisabled ) {
        return;
    }

    switch( e.which ) {

        case 38: // up
            e.preventDefault();
            this._setValue( fMin( this._max, val + this._step ) );
            this._element
                .trigger( "slide" )
                .trigger( "input" );

        break;

        case 40: //down
            e.preventDefault();
            this._setValue( fMax( this._min, val - this._step ) );
            this._element
                .trigger( "slide" )
                .trigger( "input" );
        break;

        case 37: //left
        case 39: //right
            // catch right/left only on slider, not input
            if ( e.currentTarget === this._sliderElement[0] ) {
                e.preventDefault();
                if( e.which === 37 ) {
                    this._setValue(
                        fMax( this._min, val - this._step )
                    );
                }
                else if( e.which === 39 ) {
                    this._setValue(
                        fMin( this._max, val + this._step )
                    );
                }
                this._element
                    .trigger( "slide" )
                    .trigger( "input" );
            }
            break;

        case 13: //esc or enter
        case 27:
            //Prevent submits when pressing
            //enter/esc on a manual slider input
            e.preventDefault();
            e.currentTarget.blur();
        break;
    }
};

//Onmousewheel
method._mouseWheeled = function( e ) {
    if( this._isDisabled ) {
        return;
    }

    var evt = e.originalEvent,
        time = e.timeStamp,
        elapsed = time - this._lastMousewheel,
        val = this._getValue(),
        delta;
    //Scrollwheel doing multiple things at once is always bad
    e.preventDefault();
    e.stopImmediatePropagation();

    if( evt.wheelDelta ) {
        delta = normalize( evt.wheelDelta / 120 );
    }
    else if( evt.detail ) {
        delta = -1 * normalize( evt.detail / 3 );
    }

    if( delta != null ) {
        var sensitivity = plugin.options.sensitivity / 100;

        var step = elapsed > 300
            ? this._step //Minimal sensitivity when slowly scrolling
            : fMax( //Normal sensitivity when normally/fastly scrolling
                fAbs( this._max - this._min ) * sensitivity,
                this._step
            );

        if( delta > 0 ) {
            this._setValue(
                snap(
                    fMin( this._max, val + step ),
                    this._step
                )
            );
        }
        else {
            this._setValue(
                snap(
                    fMax( this._min, val - step ),
                    this._step
                )
            );
        }
        this._element
            .trigger( "slide" )
            .trigger( "input" );
    }
    this._lastMousewheel = time;
};

//Begin the slider drag process
method._mouseDowned = function( e ) {
    if( e.which === 1 && !this._isDisabled ) {
        e.preventDefault();
        var slideEvt = $.Event( "slidestart");
        this._element.trigger( slideEvt );

        if( slideEvt.isDefaultPrevented() ) {
            return;
        }


        this._calculateBox();
        this._calculateDragStartOffset( e );


        clearSelection();


        $( document ).on( {
            "mousemove.rangeslider": this._$mouseMoved,
            //in case mouse is released while holding
            //perfectly still and e.which !== 1
            //in mousemove handler isn't detected
            "mouseup.rangeslider": this._$mouseReleased,
            //Prevent this crap while dragging
            "selectstart.rangeslider": preventDefault,
            "dragstart.rangeslider": preventDefault
        });

        this._sliderElement.addClass( "focused" );
        this._isSliding = true;

        this._mouseMoved( e );
    }
};

method._mouseReleased = function() {
    if( this._isSliding ) {
        $( document ).off( ".rangeslider" );
        this._sliderElement.removeClass( "focused" );
        this._isSliding = false;
        this._element.trigger( "slideend" );
    }
};

method._mouseMoved = function( e ) {
    if( e.which !== 1 ) {
        //in case mouse is released and mouseup event wasn't detected
        this._mouseReleased();
        return;
    }
    var curValue = this._getValue();

    var box = this._box,
        position,
        value, mod, pxOffset;

    if( box.isHorizontal ) {
        pxOffset = clamp( e.pageX, box.left, box.right ) - box.left;
        position = pxOffset / ( box.right - box.left );
        if (this._isRtl) {
            position = 1 - position;
        }
    }
    else {
        pxOffset = clamp( e.pageY, box.top, box.bottom ) - box.top;
        position = ( 1 - ( pxOffset / ( box.bottom - box.top ) ) );
    }

    value = ( this._max - this._min ) * position + this._min;
    mod = value % this._step;

    if( mod !== 0 ) {
        value = snap( value, this._step );
    }
    this._setValue( normalize( value ) );
    if( curValue !== this._getValue() ){
        this._element
            .trigger( "slide" )
            .trigger( "input" );
    }
};

method._getValue = function() {
    var ret = numberOrDefault(
        this._element[0].value,
        this._defaultValue
    );
    return snap(
        clamp(
            normalize( ret ),
            this._min,
            this._max
        ),
        this._step
    );
};

method._setValue = function( value, sliderOnly ) {
    var offset, progress,
        span;

    value = clamp( normalize( value ), this._min, this._max );

    if( !sliderOnly ) {
        this._element[0].value = numberToString(
            value,
            this._decimals
        );
    }

    progress = ( value - this._min ) / ( this._max - this._min );

    if( this._box.isHorizontal ) {
        span = this._box.right - this._box.left;
        //Settle the knob 2 pixels over edges
        offset =  fMax(
            -2,
            fMin(
                progress * span - this._dragOffset,
                span - this._knobBox.width + 2
            )
        );
    }
    else {
        span = this._box.bottom - this._box.top;
        offset =  fMax(
            -2,
            fMin(
                progress * span - this._dragOffset,
                span - this._knobBox.height + 2
            )
        );
    }


    this._sliderKnobElement.css(
        this._box.isHorizontal
            ? ( this._isRtl
                ? "right"
                : "left" )
            : "bottom",
        offset
    );
};

function valueSetter( elem, value ) {
    var instance = $.data( elem, INSTANCE_KEY );
    if( !instance ) {
        return;
    }
    instance._setValue( value, false );
}

function disabledSetter( elem, value ) {
    var instance = $.data( elem, INSTANCE_KEY );
    if( !instance ) {
        return;
    }
    instance._setDisabled( !!value );
    return true;
}

hook.define( hook.VAL, "text", hook.SETTER, valueSetter );
hook.define( hook.PROP, "disabled", hook.SETTER, disabledSetter );
hook.define( hook.ATTR, "disabled", hook.SETTER, disabledSetter );

return Slider;})();