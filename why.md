

Why I created this plugin? Well, I guarantee that every other slider out there has at least one the following bugs or unacceptable quality issues:

1. Start dragging the slider with your mouse, move outside the document viewport and release the mouse outside.
Now come back and the slider is still moving even if you are not holding the left mouse button down. Sometimes
you don't even need to move outside viewport. This is especially problematic with iframes because of the higher 
chance of triggering it.

2. As you drag a slider, the text and other stuff on the page gets the ugly and distracting selection highlight.

3. The slider requires you to sniper-hit the slider knob - it's not possbile to just start dragging anywhere on the slider.

4. No significant consideration for alternative input methods like mousewheel and keyboard.

5. Is not actually a [slider](http://en.wikipedia.org/wiki/Slider_\(computing\)) but a carousel.

Why I didn't just fork a repo and fix the issues?

The repo absolutely must be jQuery. There is just no other way.

The UX is not just poor on the user side, but on the developer side too. jQuery offers great tools:

usage of hooks such as Val and hooks on input element with .val()
isPrevaultPrevented

data api




###Sensitivity

Configurable

Double thumbs

Finish this