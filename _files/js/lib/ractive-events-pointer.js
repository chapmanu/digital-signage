(function (global, factory) {
	if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
		factory(require('Ractive'));
	} else if (typeof define === 'function' && define.amd) {
		define(['Ractive'], factory);
	} else if (global.Ractive) {
		factory(global.Ractive);
	} else {
		throw new Error('Could not find Ractive! It must be loaded before the Ractive.events.swipe plugin');
	}
})(typeof window !== 'undefined' ? window : this, function (Ractive) {
	var
	supportsPointer = 'PointerEvent' in window,
	supportsTouch = 'ontouchstart' in window,

	events = {
		pointerdown:   supportsPointer ? 'pointerdown'   : supportsTouch ? 'touchstart'  : 'mousedown',
		pointermove:   supportsPointer ? 'pointermove'   : supportsTouch ? 'touchmove'   : 'mousemove',
		pointerup:     supportsPointer ? 'pointerup'     : supportsTouch ? 'touchend'    : 'mouseup',
		pointercancel: supportsPointer ? 'pointercancel' : supportsTouch ? 'touchcancel' : 'pointercancel'
	},

	key;

	function createPointerEvent(type) {
		return function (node, fire) {
			function onevent(event) {
				fire({
					node: node,
					original: event,
					type: type
				});
			}

			node.addEventListener(events[type], onevent, false);

			return {
				teardown: function () {
					node.removeEventListener(events[type], onevent, false);
				}
			};
		};
	}

	for (key in events) {
		Ractive.events[key] = createPointerEvent(key);
	}
});