// ~900 bytes gzipped
(function () {
	'use strict';

	// return class name of any value
	Object.getClass = Object.getClass || function (value) {
		return value === undefined ? 'Undefined' : value === null ? 'Null' : Object.prototype.toString.call(value).slice(8, -1);
	};

	// return whether value is object
	Object.isObject = Object.isObject || function (value) {
		return Object.getClass(value) === 'Object';
	};

	// return first object extended by any number of additional objects
	Object.extend = Object.extend || function () {
		var
		// move all objects into collection
		objects = [].slice.call(arguments),
		// separate first object
		object = objects.shift();

		// for each object in collection
		objects.forEach(function (nextObject) {
			// set or extend its keys to first object
			Object.keys(nextObject).forEach(function (key) {
				object[key] = Object.isObject(object[key]) && Object.isObject(nextObject[key]) ? Object.extend(object[key], nextObject[key]) : nextObject[key];
			});
		}, Object);

		// return first object
		return object;
	};

	// return new object extended by any number of additional objects
	Object.concat = Object.concat || function () {
		var
		// move all objects into collection
		objects = [].slice.call(arguments),
		// set new object
		object = {};

		// for each object in collection
		objects.forEach(function (nextObject) {
			// set or concat its keys to new object
			Object.keys(nextObject).forEach(function (key) {
				object[key] = Object.isObject(nextObject[key]) ? Object.concat(Object.isObject(object[key]) ? object[key] : {}, nextObject[key]) : Array.isArray(nextObject[key]) ? [].concat(nextObject[key]) : nextObject[key];
			});
		}, Object);

		// return new object
		return object;
	};

	// request one or more files
	window.request = function (opts) {
		var
		allOpts = Object.extend({
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
			xhr = Object.extend(
				// new request
				new XMLHttpRequest(),
				// append default options
				allOpts,
				// append request options 
				Object.isObject(request) ? request : { src: request },
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
					if (/^[45]/.test(xhr.status)) xhr.onerror();
					// otherwise
					else {
						// reduce countdown
						--countdown;

						// conditionally run request load event
						if (xhrOnLoad) xhrOnLoad(xhr);

						// if countdown is empty, conditionally run global load event with request collection
						if (!countdown && allOpts.onLoad) allOpts.onLoad(isSingle ? xhr : xhrs);
					}
				}
			};

			// on request error
			xhr.onerror = function () {
				// conditionally run request error event with request
				if (xhrOnError) xhrOnError(xhr);

				// conditionally run global error event with request
				if (allOpts.onError) allOpts.onError(xhr);
			};

			// add request to request collection
			xhrs.push(xhr);

			// send request
			xhr.send(Object.isObject(xhr.data) ? JSON.stringify(xhr.data) : xhr.data);
		});
	};

	// longpoll a file
	window.longpoll = function (opts) {
		opts = Object.extend({
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
			/* jshint validthis: true */
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

			if (!timeout && method !== 'post') exec();

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
})();