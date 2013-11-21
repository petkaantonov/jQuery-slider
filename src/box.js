var Box = (function() {



/**
 * Represents a bounding box calculated
 * from the given jQuery element in the constructor
 *
 * Should this be called rectangle?
 */
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
    seal( this ); //Catch property typos early
}




return Box;})();