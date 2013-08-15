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
    decimals: -1,
    rtl: false,
    slider: "body",
    template: "<div class='input-slider'>" +
        "<div class='input-slider-knob js-slider-knob'></div>" +
        "</div>"
};

plugin.options = {
    decimalPoint: ".",
    sensitivity: 4
};

plugin.refresh = function() {
    $( "input[data-slider]" ).slider();
};

$( plugin.refresh );

$.ajaxPrefilter( function( o, oo, jqxhr ) {
    (jqxhr.complete || jqxhr.always)( plugin.refresh );
});