(function (global, splice, hasOwnProperty) {
	// Call a function before the next browser repaint
	// https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame
	function requestAnimationFrame(callback) {
		return setTimeout(callback, 1000 / 60);
	}

	// Clear an animation set by requestAnimationFrame
	// https://developer.mozilla.org/en-US/docs/Web/API/window.cancelAnimationFrame
	function cancelAnimationFrame(requestID) {
		return clearTimeout(requestID);
	}

	// Copy shallow enumerable values from source objects to a target object
	// http://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.assign
	function assign(target, source) {
		for (var index = 1, key; index in arguments; ++index) {
			source = arguments[index];

			for (key in source) {
				if (hasOwnProperty.call(source, key)) {
					target[key] = source[key];
				}
			}
		}

		return target;
	}

	// Copy deep enumerable values from source objects to a target object
	function deepAssign(target, source) {
		for (var index = 1, key; index in arguments; ++index) {
			source = arguments[index];

			for (key in source) {
				if (hasOwnProperty.call(source, key)) {
					if (target[key] && Array.isArray(target[key]) && Array.isArray(source[key])) {
						target[key].length = source[key].length;

						deepAssign(target[key], source[key]);
					}
					else if (target[key] && Object(target[key]) === target[key] && Object(source[key]) === source[key]) {
						deepAssign(target[key], source[key]);
					} else {
						target[key] = source[key];
					}
				}
			}
		}

		return target;
	}

	if (!global.requestAnimationFrame) {
		global.requestAnimationFrame = global.mozRequestAnimationFrame || global.webkitRequestAnimationFrame || requestAnimationFrame;
	}

	if (!global.cancelAnimationFrame) {
		global.cancelAnimationFrame = global.mozCancelAnimationFrame || global.webkitCancelAnimationFrame || cancelAnimationFrame;
	}

	if (!Object.assign) {
		Object.assign = assign;
	}

	if (!Object.deepAssign) {
		Object.deepAssign = deepAssign;
	}

	// request one or more files
	window.request = function (opts) {
		var
		allOpts = Object.deepAssign({
			async: true,
			data: null,
			header: {},
			method: 'GET',
			password: null,
			src: location.href,
			username: null
		}, opts),
		isSingle  = !Array.isArray(opts.src),
		requests  = isSingle ? [opts.src] : opts.src,
		countdown = requests.length,
		xhrs = [];

		requests.forEach(function (request) {
			var
			xhr = Object.deepAssign(
				// new request
				new XMLHttpRequest(),
				// append default options
				allOpts,
				// append request options 
				Object(request) === request ? request : { src: request },
				// remove events from request
				{ onLoad: null, onError: null }
			),
			// cache events
			xhrOnLoad  = request.onLoad,
			xhrOnError = request.onError;

			// open request
			xhr.open(xhr.method, xhr.src, xhr.async, xhr.username, xhr.password);

			// append headers to request
			Object.keys(xhr.header).forEach(function (key) {
				xhr.setRequestHeader(key, xhr.header[key]);
			});

			// on request readyState change
			xhr.onreadystatechange = function () {
				// check if request finished
				if (xhr.readyState === 4 && xhr.status) {
					// if status returns error, goto error
					if (/^[45]/.test(xhr.status)) {
						xhr.onerror();
					}
					// otherwise
					else {
						// reduce countdown
						--countdown;

						// conditionally run request load event
						if (xhrOnLoad) {
							xhrOnLoad(xhr);
						}

						// if countdown is empty, conditionally run global load event with request collection
						if (!countdown && allOpts.onLoad) {
							allOpts.onLoad(isSingle ? xhr : xhrs);
						}
					}
				}
			};

			// on request error
			xhr.onerror = function () {
				// conditionally run request error event with request
				if (xhrOnError) {
					xhrOnError(xhr);
				}

				// conditionally run global error event with request
				if (allOpts.onError) {
					allOpts.onError(xhr);
				}
			};

			// add request to request collection
			xhrs.push(xhr);

			// send request
			xhr.send(Object(xhr.data) === xhr.data ? JSON.stringify(xhr.data) : xhr.data);
		});
	};

	// longpoll a file
	window.longpoll = function (opts) {
		opts = Object.deepAssign({
			header: {},
			maxInterval: 1000,
			method: 'POST'
		}, opts);

		var optsOnLoad = opts.onLoad;

		opts.onLoad = function (xhr) {
			optsOnLoad(xhr);

			opts.header['If-Modified-Since'] = xhr.getResponseHeader('Last-Modified');

			setTimeout(function () {
				thisTime = Date.now();

				window.request(opts);
			}, opts.maxInterval - (Date.now() - thisTime));
		};

		var
		thisTime = Date.now();

		window.request(opts);
	};

	// return a configurable debounced function
	window.debounce = function (listener, interval, method) {
		function debounced() {
			var
			self = this,
			args = arguments,
			method = debounced.method;

			function wait() {
				timeout = null;
			}

			function exec() {
				result = debounced.listener.apply(self, args);

				wait();
			}

			if (!timeout && method !== 'post') {
				exec();
			}

			clearTimeout(timeout);

			timeout = setTimeout(method === 'post' || (timeout && method !== 'pre') ? exec : wait, debounced.interval);

			return result;
		}

		var
		timeout, result;

		debounced.listener = listener;
		debounced.interval = interval;
		debounced.method = method;

		return debounced;
	};
})(this, Array.prototype.splice, Object.prototype.hasOwnProperty);