/* jshint -W014 */
/**
 * @preserve Copyright (c) 2012 Petka Antonov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(function ( $, window, document, undefined ) {
    "use strict";

    var seal = %_PRODUCTION ||
        typeof Object.seal !== "function"
            ? function( obj ) { return obj; }
            : Object.seal;


    var INSTANCE_KEY = "range-slider-instance";
    var fMax = function( a, b ){ return Math.max( a, b ); };
    var fMin = function( a, b ){ return Math.min( a, b ); };

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


    //Helpers

    function preventDefault(e) {
        e.preventDefault();
    }

    function numberOrDefault( str, fallback ) {
        str = (str + "").replace( ",", "." );

        if( isNaN( str ) ) {
            return fallback;
        }
        return +str;
    }

    function normalize( value ) {
        return ( Math.round( value * 100000000 ) / 100000000 ) || 0;
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

    var Box = (function() {
        function Box( $elem ) {
            var jQOffset = $elem.offset(),
                width = $elem.width(),
                height = $elem.height();

            this.top = jQOffset.top;
            this.left = jQOffset.left;
            this.bottom = height + this.top;
            this.right = width + this.left;
            this.width = width;
            this.height = height;
            this.isHorizontal = width >= height;
            seal( this );
        }
        return Box;
    })();


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
            this._decimals = 0;
            this._box = null;
            this._knobBox = null;
            this._isRtl = false;
            this._dragOffset = 0;
            this._isDisabled = false;
            this._isSliding = false;
            this._sliderElement = null;
            this._sliderKnobElement = null;
            this._$changed = $.proxy( this._changed, this );
            this._$keyDowned = $.proxy( this._keyDowned, this );
            this._$mouseWheeled = $.proxy( this._mouseWheeled, this );
            this._$mouseDowned = $.proxy( this._mouseDowned, this );
            this._$mouseMoved = $.proxy( this._mouseMoved, this );
            this._$mouseReleased = $.proxy( this._mouseReleased, this );
            this._$blurred = $.proxy( this._blurred, this );
            this._$focused = $.proxy( this._focused, this );
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

        method._applyValue = function( val ) {
            var value = snap( clamp( val, this._min, this._max ), this._step );
            this._setValue( value );
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

            this._isRtl = this._element
                .css( "direction" )
                .toLowerCase() === "rtl" || !!this._options.rtl;

            var val = numberOrDefault( this._element.val(), this._min );

            //Determine the number of decimal precision
            //required by looking at the precision of step size
            var decimalIndex = this._step.toString().indexOf(".");

            if( decimalIndex > -1 ) {
                this._decimals =
                    this._step.toString().length - ( decimalIndex + 1 );
            }

            this._sliderElement = $( this._options.template )
                .appendTo( this._options.slider );

            this._sliderKnobElement = this._sliderElement
                .find( ".js-slider-knob" );

            if ( this._options.focusable ) {
                var tabIndex = this._element.prop( "tabIndex" );
                this._sliderElement.prop( "tabIndex",
                    tabIndex > 0 ? tabIndex : 0 );
            }

            this._setDisabled( this._element.prop( "disabled" ) );

            this._element.on( {
                "change.rangeslider": this._$changed,
                "keydown.rangeslider": this._$keyDowned,
                "mousewheel.rangeslider": this._$mouseWheeled,
                "DOMMouseScroll.rangeslider": this._$mouseWheeled
            });

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
            this._applyValue( val );

            this._element.on( "destroy.rangeslider",
                $.proxy( this.destroy, this ) );
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
        method._changed = function( e ) {
            var val = numberOrDefault( this._element.val(), this._min );
            if( val === this._min && e.type === "input" ) {
                //Allow input to be invalid while typing
                //and coerce when blurred ("change")
                return;
            }
            this._applyValue( val );
        };

        //onkeydown
        method._keyDowned = function( e ) {
           var val = numberOrDefault( this._element.val(), this._min );

            if( this._isDisabled ) {
                return;
            }

            switch( e.which ) {

                case 38: // up
                    e.preventDefault();
                    this._setValue( fMin( this._max, val + this._step ) );
                    this._element.trigger( "slide" );

                break;

                case 40: //down
                    e.preventDefault();
                    this._setValue( fMax( this._min, val - this._step ) );
                    this._element.trigger( "slide" );
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
                        this._element.trigger( "slide" );
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
                val = numberOrDefault( this._element.val(), this._min ),
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
                if( delta > 0 ) {
                    this._setValue( fMin( this._max, val + this._step ) );
                }
                else {
                    this._setValue( fMax( this._min, val - this._step ) );
                }
                this._element.trigger( "slide" );
            }
        };

        //Begin the slider drag process
        method._mouseDowned = function( e ) {
            if( e.which === 1 && !this._isDisabled ) {
                var slideEvt = $.Event( "slidestart");
                this._element.trigger( slideEvt );

                if( slideEvt.isDefaultPrevented() ) {
                    e.preventDefault();
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
                    //Remove all this crap while dragging
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
            this._element.trigger( "slide" );
        };

        method._setValue = function( value ) {
            var offset, progress,
                span;

            value = clamp( normalize( value ), this._min, this._max );

            this._element[0].value = this._decimals
                ? value.toFixed(this._decimals)
                : value;

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
            instance._setValue( value );
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

        return Slider;
    })();
    var plugin;
    plugin = $.fn.slider = function( option ) {
        var args = [].slice.call( arguments, 1 );
        return this.filter( "input" ).each( function() {

            if( !( /^(?:text)$/i.test( this.type ) ) ) {
                return;
            }

            var $this = $( this ),
                instance = $this.data( INSTANCE_KEY ),
                options = typeof option === "object" && option || {};

            if( !instance ) {
                options = $.extend(
                    {},
                    plugin.defaults,
                    $this.data(),
                    options
                );
                instance = new Slider( this, options );
                $this.data( INSTANCE_KEY, instance );
            }
            if( typeof option === "string" &&
                option.charAt(0) !== "_" &&
                typeof instance[option] === "function" ) {
                instance[option].apply( instance, args );
            }
        });
    };

    plugin.Constructor = Slider;

    plugin.defaults = {
        min: 1,
        max: 100,
        step: 1,
        focusable: true,
        rtl: false,
        slider: "body",
        template: "<div class='input-slider'>" +
            "<div class='input-slider-knob js-slider-knob'></div>" +
            "</div>"
    };

    plugin.refresh = function() {
        $( "input[data-slider]" ).slider();
    };

    $( plugin.refresh );

    $.ajaxPrefilter( function( o, oo, jqxhr ) {
        (jqxhr.complete || jqxhr.always)( plugin.refresh );
    });

})( this.jQuery, this, this.document );