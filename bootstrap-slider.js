!function ( $, window, document, undefined ) {
    //Helpers
    
    function returnFalse(e) {
        e.preventDefault();
        return false;
    }
    
    function numberOrDefault( str, fallback ) {
        if( isNaN( str ) ) {
            return fallback;
        }
        return +str;
    }

    function normalize( value ) {
        return Math.round( value * 100000000 ) / 100000000;
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
    
    //Constructor
    //addon append ja prepend juttu ;)
    //Test scroll .offset()
    function Slider( element, options ) {
        this.element = element;
        if( element.nodeName.toLowerCase() !== "input" ) {
            $.error( "Slider can only enhance elements of type 'input'" );
        }
        this.options = options;
        init.call( this );
    }
    //Public methods
    Slider.prototype = {
    
        disabled: function( val ) {
            val = !!val;
            this.isDisabled = val;
            $( this.slider )[ val ? "addClass" : "removeClass" ]( "disabled" );
            this.element.disabled = val;
            
            if( !val ) {
                unbindmousemove.call( this );
            }
        },
   
        destroy: function() {
            $( this.slider ).remove();
            $( this.element ).removeData( "slider" );
        },

        constructor: Slider
    };
    
    //Private methods
    
    function init() {
        var val,
            decimalIndex;
            
        this.step = +this.options.step;
        
        this.min = +this.options.min;
        this.max = +this.options.max;
        
        if( !( this.step > 0 ) ) {
            this.step = 1;
        }
        
        if( this.min > this.max ) {
            this.max = this.min;
        }
        
        if( this.min === this.max ) {
            this.max += 1;
        }
        val = numberOrDefault( this.element.value, this.min );
        decimalIndex = this.step.toString().indexOf(".");
        
        if( !!~decimalIndex ) {
            this.decimals = this.step.toString().length - ( decimalIndex + 1 );
        }
                
        this.slider = $( this.options.template ).appendTo( $( this.element ).siblings( ".slider" ) ).get( 0 );
        this.disabled( this.element.disabled );
        
        $( this.element ).bind( {
            "change.slider": $.proxy( onchange, this ),
            "keydown.slider": $.proxy( onkeydown, this )
        });
        
        $( this.slider ).bind( "mousedown.slider", $.proxy( onmousedown, this ) );

        calculateBox.call( this );
        setValue.call( this, snap( Math.max( Math.min( val, this.max ), this.min ), this.step ) );
    }
    
    function onkeydown(e) { //Prevent submits when pressing enter/esc on a manual slider input
        if( e.which === 13 || e.which === 27 ) {
            e.preventDefault();
            e.currentTarget.blur();
        }
    }
    
    function calculateBox() {
        var $slider = $( this.slider ),
            $knob = $( this.slider.firstChild ),
            width = $slider.width(),
            height = $slider.height();
            
        this.box = $slider.offset();
        this.box.right = width + this.box.left;
        this.box.bottom = height + this.box.top;
        this.box.isHorizontal = width >= height;
        
        this.knobBox = {
            width: ($knob.width() / 2 | 0 ) + 2, //Dunno why but pretending the knob is 2px larger settles it better at start and end of sliders
            height: ($knob.height() / 2 | 0 ) + 2
        };
    }
    //React to change events on the original input
    function onchange(e) {
        var val = numberOrDefault( e.currentTarget.value, this.min );
        setValue.call( this, snap( Math.max( Math.min( val, this.max ), this.min ), this.step ) );
    }
    
    
    //Begin the slider drag process
    function onmousedown( e ) {
        
            
        if( e.which === 1 && !this.isDisabled ) {
            calculateBox.call( this );
            
            
            clearSelection();
            
            $( document ).bind( {
                "mousemove.slider": $.proxy( onmousemove, this ),
                //in case mouse is released while holding perfectly still and e.which !== 1 in mousemove handler isn't detected   
                "mouseup.slider": $.proxy( unbindmousemove, this ),
                "selectstart.slider": returnFalse, //Remove all this crap while dragging
                "dragstart.slider": returnFalse
            });

            $( this.slider ).addClass( "focused" );
            this.isSliding = true;
            
            $( this.element ).trigger( "slidestart" );
            onmousemove.call( this, e );
            
        }
    }
    
    function unbindmousemove() {
        if( this.isSliding ) {
            $( document ).unbind( "mousemove.slider selectstart.slider dragstart.slider mouseup.slider" );
            $( this.slider ).removeClass( "focused" );
            this.isSliding = false;
            $( this.element ).trigger( "slideend" );
        }
    
    }
    
    function onmousemove( e ) {
        if( e.which !== 1 ) { //in case mouse is released and mouseup event wasn't detected
            unbindmousemove.call( this );
            return;
        }
        
        var box = this.box,
            position,
            value, mod, pxOffset;
        
        if( box.isHorizontal ) {
            pxOffset = ( Math.max( Math.min( e.pageX, box.right ), box.left ) - box.left );
            position = pxOffset / ( box.right - box.left );
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
        var offset;

        this.element.value = this.decimals ? value.toFixed(this.decimals) : value;
       
        if( this.box.isHorizontal ) {
            offset = ( ( value - this.min ) / ( this.max - this.min ) * ( this.box.right - this.box.left ) - this.knobBox.width ) + "px";
        }
        else {
            offset = ( ( value - this.min ) / ( this.max - this.min ) * ( this.box.bottom - this.box.top ) - this.knobBox.height ) + "px";
        }
        

        $( this.slider.firstChild ).css( this.box.isHorizontal ? "left" : "bottom", offset );
    }

    $.fn.slider = function( option ) {
        return this.each( function() {
            
            var $this = $( this ),
                data = $this.data( "slider" ),
                options = typeof option == 'object' && option || {};
                
            if( !data ) {
                options = $.extend( {}, $.fn.slider.defaults, $this.data(), options );
                $this.data( "slider", ( data = new Slider( this, options ) ) );
            }
            if( typeof option == 'string' ) {
                data[option].apply( data, arguments.length > 1 ? [].slice.call( arguments, 1 ) : [] );
            }
        });
    };
    
    $.fn.slider.Constructor = Slider;
    
    $.fn.slider.defaults = {
        min: 1,
        max: 100,
        step: 1,
        template: '<div class="input-slider"><div class="input-slider-knob"></div></div>'
    };
    
    $( function() {
        $( "[data-enhancement='slider']" ).slider();
    });
    

}( jQuery, window, document );