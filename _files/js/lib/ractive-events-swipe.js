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
}(typeof window !== 'undefined' ? window : this, function (Ractive) {
	var
	supportsPointer = 'PointerEvent' in window,
	supportsTouch = 'ontouchstart' in window,

	pointerdown   = supportsPointer ? 'pointerdown'   : supportsTouch ? 'touchstart'  : 'mousedown',
	pointermove   = supportsPointer ? 'pointermove'   : supportsTouch ? 'touchmove'   : 'mousemove',
	pointerup     = supportsPointer ? 'pointerup'     : supportsTouch ? 'touchend'    : 'mouseup',
	pointercancel = supportsPointer ? 'pointercancel' : supportsTouch ? 'touchcancel' : 'pointercancel';

	var makeSwipeDefinition = function (direction) {
		return function (node, fire) {
			var chinna = function (event) {
				var sx, sy, ex, ey;

				// event.preventDefault();

				if (!event.touches) {
					event.touches = [event];
				}

				var touch = event.touches && event.touches[0] || event;

				sx = touch.pageX;
				sy = touch.pageY;

				function move(event) {
					if (!event.touches) {
						event.touches = [event];
					}

					var touch = event.touches[0];

					ex = touch.pageX;
					ey = touch.pageY;

					var dx = ex - sx;
					var dy = ey - sy;
					var ax = Math.abs(dx);
					var ay = Math.abs(dy);

					var swipeDirection = ax > ay ? (dx < 0 ? 'swipeleft' : 'swiperight') : (dy < 0 ? 'swipeup' : 'swipedown');

					if (/swipe(left|right)/.test(swipeDirection)) {
						event.preventDefault();
					}
					
				}

				function end(event) {
					

					var dx = ex - sx;
					var dy = ey - sy;
					var ax = Math.abs(dx);
					var ay = Math.abs(dy);

					if (Math.max(ax, ay) > 20) {
						var swipeDirection = ax > ay ? (dx < 0 ? 'swipeleft' : 'swiperight') : (dy < 0 ? 'swipeup' : 'swipedown');

						if (/swipe(left|right)/.test(swipeDirection)) {
							event.preventDefault();
						}

						if (swipeDirection === direction) {
							fire({
								node: node,
								original: event,
								direction: swipeDirection,
							});
						}
					}

					cancel();
				}

				function cancel() {
					document.removeEventListener(pointerup, end, false);

					document.removeEventListener(pointermove, move, false);

					document.removeEventListener(pointercancel, cancel, false);
				}

				document.addEventListener(pointermove, move, false);

				document.addEventListener(pointerup, end, false);

				document.addEventListener(pointercancel, cancel, false);
			};

			node.addEventListener(pointerdown, chinna, false);

			return {
				teardown: function () {
					node.removeEventListener(pointerdown, chinna, false);
				}
			};
		};
	};

	var events = Ractive.events;

	events.swipeleft = makeSwipeDefinition('swipeleft');
	events.swiperight = makeSwipeDefinition('swiperight');
	events.swipeup = makeSwipeDefinition('swipeup');
	events.swipedown = makeSwipeDefinition('swipedown');
}));
