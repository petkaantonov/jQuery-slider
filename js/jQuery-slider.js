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

    var INSTANCE_KEY = "range-slider-instance";

    var hook = (function(){
        function defineHook( hookKind, hookKey, fnType, fn ) {
            var hooks = $[hookKind],
                hook = hooks[hookKey],
                undef,
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
                        retOrig = orig( elem, value );    
                    }
                    ret = fn( elem, value );
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
    
    var clearSelection = function() {
    
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
            }
        }
    
    }();
    
    var Slider = (function() {
        var method = Slider.prototype;
        
        function Slider( element, options ) {
            this.element = element;
            this.options = options;
            init.call( this );
        }

        Slider.prototype = {

            //Deprecated
            disabled: function( disabled ) {
               this._setDisabled( !!disabled );
            },

            destroy: function() {
                $( this.slider ).remove();
                $( this.element )
                    .off( ".rangeslider" )
                    .removeData( INSTANCE_KEY );
            },
            
            _setDisabled: function( disabled ) {
                this.isDisabled = disabled;
                $( this.slider )[ disabled ? "addClass" : "removeClass" ]( "disabled" );
                this.element.disabled = disabled;

                if( !disabled ) {
                    unbindMousemove.call( this );
                }
            },

            constructor: Slider
        };

        function init() {
            //The options are initially most likely strings because they are read from the element attributes
            this.step = +this.options.step;
            this.min = +this.options.min;
            this.max = +this.options.max;
            this.isRtl = $(this.element).css('direction').toLowerCase() === 'rtl' || !!this.options.rtl;


            if( !this.step || this.step < 0 ) {
                this.step = 1;
            }

            if( this.min > this.max ) {
                this.max = this.min;
            }

            if( this.min === this.max ) {
                this.max += 1;
            }
            var val = numberOrDefault( this.element.value, this.min );

            //Determine the number of decimal precision required by looking at the precision of step size
            var decimalIndex = this.step.toString().indexOf(".");

            if( !!~decimalIndex ) {
                this.decimals = this.step.toString().length - ( decimalIndex + 1 );
            }

            this.slider = $( this.options.template ).appendTo( this.options.slider ).get( 0 );

            if ( this.options.focusable ) {
                var tabIndex = $( this.element ).prop( "tabIndex" );
                this.slider.tabIndex = tabIndex > 0 ? tabIndex : 0;
            }
            
            this._setDisabled( this.element.disabled );

            $( this.element ).on( {
                "change.rangeslider": $.proxy( onchange, this ),
                "keydown.rangeslider": $.proxy( onkeydown, this ),
                "mousewheel.rangeslider": $.proxy( onmousewheel, this ),
                "DOMMouseScroll.rangeslider": $.proxy( onmousewheel, this )
            });

            $( this.slider ).on( {
                "focusin.rangeslider": $.proxy( focused, this ),
                "focus.rangeslider": $.proxy( focused, this ),
                "focusout.rangeslider": $.proxy( blurred, this ),
                "blur.rangeslider": $.proxy( blurred, this ),
                "mousedown.rangeslider": $.proxy( onmousedown, this ),
                "mousewheel.rangeslider": $.proxy( onmousewheel, this ),
                "keydown.rangeslider": $.proxy( onkeydown, this ),
                "DOMMouseScroll.rangeslider": $.proxy( onmousewheel, this )
            }); 

            if( "step" in this.element ) { //Number inputs have a step property
                this.element.step = this.step;
            }


            calculateBox.call( this );  //Need to calculate some coordinates before we can set the initial slider position
            calculateDragStartOffset.call( this, {});
            setValue.call( this, snap( Math.max( Math.min( val, this.max ), this.min ), this.step ) );

            $( this.element ).on( "destroy.rangeslider", $.proxy( this.destroy, this ) );
        }
        
        function blurred() {
            $( this.slider ).removeClass( "focused" );
        }
        
        function focused() {
            if( this.isDisabled ) {
                return;
            }
            $( this.slider ).addClass( "focused" );
        }

        function calculateBox() {
            var $slider = $( this.slider ),
                $knob = $( this.slider.firstChild ),
                width = $slider.width(),
                height = $slider.height();

            this.box = $slider.offset();

            this.knobBox = {
                width: $knob.width(),
                height: $knob.height()
            };

            this.box.right = width + this.box.left;
            this.box.bottom = height + this.box.top;
            this.box.isHorizontal = width >= height;
        }

        function calculateDragStartOffset(e) {
            var offset;

            if( e.target === this.slider.firstChild ) { //The drag started on the knob
                offset = $( this.slider.firstChild ).offset();
                if( this.box.isHorizontal ) {
                    this.dragOffset = e.pageX - offset.left;
                }
                else {
                    this.dragOffset = this.knobBox.height - (e.pageY - offset.top);
                }            
            }
            else { //The drag was started somewhere not on the knob - assume middle 
                this.dragOffset = this.box.isHorizontal ? this.knobBox.width / 2 : this.knobBox.height / 2;
            }
        }

        //React to change events on the original input
        function onchange(e) {
            var val = numberOrDefault( this.element.value, this.min );
            if( val === this.min && e.type=="input" ) { //Allow input to be invalid while typing and coerce when blurred ("change")
                return;
            }

            setValue.call( this, snap( Math.max( Math.min( val, this.max ), this.min ), this.step ) );
        }

        function onkeydown( e ) {
            var val = numberOrDefault( this.element.value, this.min );

            if( this.isDisabled ) {
                return;
            }

            switch( e.which ) {

                case 38: // up
                    e.preventDefault();
                    setValue.call( this, Math.min( this.max, val += this.step ) );
                    $( this.element ).trigger( "slide" );

                break;

                case 40: //down
                    e.preventDefault();
                    setValue.call( this, Math.max( this.min, val -= this.step ) );
                    $( this.element ).trigger( "slide" );
                break;

                case 37: //left
                case 39: //right
                    if (e.currentTarget == this.slider) {  // catch right/left only on slider, not input
                        
                        e.preventDefault();
                        setValue.call( this, Math.max( this.min, val += (e.which - 38) * this.step ) );
                        $( this.element ).trigger( "slide" );
                    }
                    break;

                case 13: //esc or enter
                case 27:
                    e.preventDefault(); //Prevent submits when pressing enter/esc on a manual slider input
                    e.currentTarget.blur();
                break;    
            }
        }

        function onmousewheel( e ) {

            if( this.isDisabled ) {
                return;
            }

            var evt = e.originalEvent,
                val = numberOrDefault( this.element.value, this.min ),
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
                    setValue.call( this, Math.min( this.max, val += this.step ) );          
                }
                else {
                    setValue.call( this, Math.max( this.min, val -= this.step ) );           
                }
                $( this.element ).trigger( "slide" );
            }
        }



        //Begin the slider drag process
        function onmousedown( e ) {            
            if( e.which === 1 && !this.isDisabled ) {
                var slideEvt = $.Event( "slidestart");
                $( this.element ).trigger( slideEvt );

                if( slideEvt.isDefaultPrevented() ) {
                    e.preventDefault();
                    return;
                }

                calculateBox.call( this );
                calculateDragStartOffset.call( this, e );

                clearSelection();

                $( document ).on( {
                    "mousemove.rangeslider": $.proxy( onmousemove, this ),
                    //in case mouse is released while holding perfectly still and e.which !== 1 in mousemove handler isn't detected   
                    "mouseup.rangeslider": $.proxy( unbindMousemove, this ),
                    "selectstart.rangeslider": preventDefault, //Remove all this crap while dragging
                    "dragstart.rangeslider": preventDefault
                });

                $( this.slider ).addClass( "focused" );
                this.isSliding = true;


                onmousemove.call( this, e );            
            }
        }

        function unbindMousemove() {
            if( this.isSliding ) {
                $( document ).off( ".rangeslider" );
                $( this.slider ).removeClass( "focused" );
                this.isSliding = false;
                $( this.element ).trigger( "slideend" );
            }

        }

        function onmousemove( e ) {
            if( e.which !== 1 ) { //in case mouse is released and mouseup event wasn't detected
                unbindMousemove.call( this );
                return;
            }

            var box = this.box,
                position,
                value, mod, pxOffset;

            if( box.isHorizontal ) {
                pxOffset = ( Math.max( Math.min( e.pageX, box.right ), box.left ) - box.left );
                position = pxOffset / ( box.right - box.left );
                if (this.isRtl) {
                    position = 1 - position;
                }
            }
            else {
                pxOffset = ( Math.max( Math.min( e.pageY, box.bottom ), box.top ) - box.top );
                position = ( 1 - ( pxOffset / ( box.bottom - box.top ) ) );
            }

            value = ( this.max - this.min ) * position + this.min;
            mod = value % this.step;

            if( mod !== 0 ) {
                value = snap( value, this.step );
            }

            setValue.call( this, normalize(value) );
            $( this.element ).trigger( "slide" );

        }

        function setValue( value ) {
            var offset, progress,
                span;

            value = Math.max( Math.min( normalize( value ), this.max ), this.min );
            this.element.value = this.decimals ? value.toFixed(this.decimals) : value;
            progress = ( value - this.min ) / ( this.max - this.min );

            if( this.box.isHorizontal ) {
                span = this.box.right - this.box.left; //Settle the knob 2 pixels over edges
                offset =  Math.max( -2, Math.min( progress * span - (this.dragOffset), span - (this.knobBox.width) + 2) ) + "px";
            }
            else {
                span = this.box.bottom - this.box.top;
                offset =  Math.max( -2, Math.min( progress * span - (this.dragOffset), span - (this.knobBox.height) + 2 ) ) + "px";
            }


            $( this.slider.firstChild ).css( this.box.isHorizontal ? (this.isRtl?"right":"left") : "bottom", offset );
        }

        function valueSetter( elem, value ) {
            var instance = $.data( elem, INSTANCE_KEY );
            if( !instance ) {
                return;
            }
            setValue.call( instance, value );
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

    $.fn.slider = function( option ) {
        
        return this.filter( "input" ).each( function() {
            
            var $this = $( this ),
                data = $this.data( INSTANCE_KEY ),
                options = typeof option == 'object' && option || {};
                
            if( !data ) {
                options = $.extend( {}, $.fn.slider.defaults, $this.data(), options );
                $this.data( INSTANCE_KEY, ( data = new Slider( this, options ) ) );
            }
            if( typeof option == 'string' && option.charAt(0) !== "_" && data[option].apply ) {
                data[option].apply( data, arguments.length > 1 ? [].slice.call( arguments, 1 ) : [] );
            }
        });
    };

    $.fn.slider.Constructor = Slider;
    
    $.fn.slider.defaults = {
        min: 1,
        max: 100,
        step: 1,
        focusable: true,
        rtl: false,
        slider: "body",
        template: '<div class="input-slider"><div class="input-slider-knob"></div></div>'
    };
    
    $.fn.slider.refresh = function() {
        $( "input[data-slider]" ).slider();
    };
    
    $( $.fn.slider.refresh );
    
})( this.jQuery, this, this.document );