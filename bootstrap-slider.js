!function ( $, window, document, undefined ) {

    //Store possible hooks
    var disabledPropHooks = $.propHooks.disabled,
        disabledAttrHooks = $.attrHooks.disabled,
        textValHooks = $.valHooks.text,
        disabledPropSetter = disabledPropHooks && disabledPropHooks.set,
        disabledAttrSetter = disabledAttrHooks && disabledAttrHooks.set,
        textValSetter = textValHooks && textValHooks.set;


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
    
    //Constructor
    function Slider( element, options ) {
        this.element = element;
        this.options = options;
        init.call( this );
    }
    //Public methods
    Slider.prototype = {

        //Deprecated
        disabled: setDisabled,
   
        destroy: function() {
            $( this.slider ).remove();
            $( this.element ).unbind( ".slider" ).removeData( "slider-instance" );
        },

        constructor: Slider
    };
    
    //Private methods
        
    function init() {
        var val,
            decimalIndex;
            
        //The options are initially most likely strings because they are read from the element attributes
        this.step = +this.options.step;
        this.min = +this.options.min;
        this.max = +this.options.max;
        
        //Sanitize.. why not
        if( !this.step || this.step < 0 ) {
            this.step = 1;
        }
        
        if( this.min > this.max ) {
            this.max = this.min;
        }
        
        if( this.min === this.max ) {
            this.max += 1;
        }
        val = numberOrDefault( this.element.value, this.min );
        
        //Determine the number of decimal precision required by looking at the precision of step size
        decimalIndex = this.step.toString().indexOf(".");
        
        if( !!~decimalIndex ) {
            this.decimals = this.step.toString().length - ( decimalIndex + 1 );
        }
                
        this.slider = $( this.options.template ).appendTo( this.options.slider ).get( 0 );
        this.disabled( this.element.disabled );
                
        $( this.element ).bind( {
            "change.slider": $.proxy( onchange, this ),
            "input.slider": $.proxy( onchange, this ),
            "keydown.slider": $.proxy( onkeydown, this ),
            "mousewheel.slider": $.proxy( onmousewheel, this ),
            "DOMMouseScroll.slider": $.proxy( onmousewheel, this )
        });
        
        $( this.slider ).bind( {
            "mousedown.slider": $.proxy( onmousedown, this ),
            "mousewheel.slider": $.proxy( onmousewheel, this ),
            "DOMMouseScroll.slider": $.proxy( onmousewheel, this )
        }); 
        
        if( "step" in this.element ) { //Number inputs have a step property
            this.element.step = this.step;
        }

        
        calculateBox.call( this );  //Need to calculate some coordinates before we can set the initial slider position
        calculateDragStartOffset.call( this, {});
        setValue.call( this, snap( Math.max( Math.min( val, this.max ), this.min ), this.step ) );
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
            
            $( document ).bind( {
                "mousemove.slider": $.proxy( onmousemove, this ),
                //in case mouse is released while holding perfectly still and e.which !== 1 in mousemove handler isn't detected   
                "mouseup.slider": $.proxy( unbindmousemove, this ),
                "selectstart.slider": preventDefault, //Remove all this crap while dragging
                "dragstart.slider": preventDefault
            });

            $( this.slider ).addClass( "focused" );
            this.isSliding = true;
            
            
            onmousemove.call( this, e );            
        }
    }
    
    function unbindmousemove() {
        if( this.isSliding ) {
            $( document ).unbind( ".slider" );
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
        

        $( this.slider.firstChild ).css( this.box.isHorizontal ? "left" : "bottom", offset );
    }

    function setDisabled( val ) {
        val = !!val;
        this.isDisabled = val;
        $( this.slider )[ val ? "addClass" : "removeClass" ]( "disabled" );
        this.element.disabled = val;

        if( !val ) {
            unbindmousemove.call( this );
        }    
    }

    
    //jquery plugin

    $.fn.slider = function( option ) {
        return this.filter("input").each( function() {
            
            var $this = $( this ),
                data = $this.data( "slider-instance" ),
                options = typeof option == 'object' && option || {};
                
            if( !data ) {
                options = $.extend( {}, $.fn.slider.defaults, $this.data(), options );
                $this.data( "slider-instance", ( data = new Slider( this, options ) ) );
            }
            if( typeof option == 'string' ) {
                data[option].apply( data, arguments.length > 1 ? [].slice.call( arguments, 1 ) : [] );
            }
        });
    };

    //TODO refactor repetitivity
    function sliderTextValHook( elem, value ) {
            var data = jQuery.data( elem, "slider-instance" );
            if( data ) {
                setValue.call( data, value );
                return true;
            }   
    }

    function sliderDisabledPropHook( elem, value, name ) {
            var data = jQuery.data( elem, "slider-instance" );
            if( data ) {
                setDisabled.call( data, value );
                return true;
            }   
    }
    
    function sliderDisabledAttrHook( elem, value, name ) {
            var data = jQuery.data( elem, "slider-instance" );
            if( data ) {
                setDisabled.call( data, value );
                return true;
            }  
    }
    
    $.fn.slider.Constructor = Slider;
    
    $.fn.slider.defaults = {
        min: 1,
        max: 100,
        step: 1,
        slider: "body",
        
        template: '<div class="input-slider"><div class="input-slider-knob"></div></div>'
    };
    
    /* set up hooks */
    //TODO refactor repetitivity    
    $.valHooks.text = $.extend( textValHooks || {}, {
        set: function() {
            if( textValSetter ) {
                return function( elem, value, name ) {
                    textValSetter( elem, value, name );
                    return sliderTextValHook( elem, value, name );
                }
            }
            else {
                return sliderTextValHook;
            }
        }()
    });
    
    $.propHooks.disabled = $.extend( disabledPropHooks || {}, {
        set: function() {
            if( disabledPropSetter ) {
                return function( elem, value, name ) {
                    disabledPropSetter( elem, value, name );
                    return sliderDisabledPropHook( elem, value, name );
                }
            }
            else {
                return sliderDisabledPropHook;
            }
        }()
    });

    $.attrHooks.disabled = $.extend( disabledAttrHooks || {}, {
        set: function() {
            if( disabledAttrSetter ) {
                return function( elem, value, name ) {
                    disabledAttrSetter( elem, value, name );
                    return sliderDisabledAttrHook( elem, value, name );
                }
            }
            else {
                return sliderDisabledAttrHook;
            }
        }()
    });    

    
    //data api
    
    $( function() {
        $( "input[data-slider]" ).slider();
    });
    

}( jQuery, window, document );