// ~1700 bytes gzipped
(function () {
	'use strict';

	/* global cancelAnimationFrame, Promise, Ractive, requestAnimationFrame */

	function DigitalSignage(src) {
		var self = this;

		self.data = {
			index: 0,
			isResizing: true,
			style: {}
		};
		self.templates = {};
		self.src = src;

		DigitalSignage.initData(self)
		         .then(DigitalSignage.initTemplates)
		         .then(DigitalSignage.initRactive)
		         .then(DigitalSignage.initPolling)
		         .then(DigitalSignage.initDrawing)
		         .then(DigitalSignage.initResizing)
		         .then(DigitalSignage.initVideo);
	}

	// initializes all template functionality
	DigitalSignage.initTemplates = function (self) {
		return new Promise(function (resolve, reject) {
			var templates = [self.data.template];

			self.data.collection.forEach(function (item) {
				templates.push(item.template);
			});

			templates = templates.filter(function (path) {
				var key = path.replace(/^.+\/(.+?)\.[^\.]+$/, '$1');

				return !self.templates[key];				
			});

			if (!templates.length) resolve(self);
			else window.request({
				src: templates,
				onLoad: function (xhrs) {
					templates.forEach(function (path, index) {
						// remove path and extension from file
						var key = path.replace(/^.+\/(.+?)\.[^\.]+$/, '$1');

						self.templates[key] = xhrs[index].responseText;

						if (self.ractive) self.ractive.partials = self.templates;
					});

					return resolve(self);
				},
				onError: reject
			});
		});
	};

	// initializes all Ractive functionality
	DigitalSignage.initRactive = function (self) {
		return new Promise(function (resolve) {
			self.ractive = new Ractive({
				el: document.body,
				template: self.templates['default'],
				data: self.data,
				partials: self.templates
			});

			self.ractive.observe({
				index: function () {
					DigitalSignage.updateMenuDisplay(self);
				},
				isResizing: function () {
					DigitalSignage.updateMenuDisplay(self);
				},
				location: function () {
					DigitalSignage.updateMenuDisplay(self);
				},
				timestamp: function () {
					DigitalSignage.updateTimestampDisplay(self);
					DigitalSignage.updateMenuDisplay(self);
				},
				'collection.*.background': function (newValue, oldValue, keypath) {
					var
					index = keypath.replace(/^[^\.]+\.|\.[^\.]+$/g, ''),
					item  = self.data.collection[index];

					if (item.canvas) {
						cancelAnimationFrame(item.backgroundFrame);

						delete item.backgroundMedia;
					}

					// setTimeout(function () {
					// 	DigitalSignage.initVideo(self, item, index);
					// }, 0);
				}
			});

			resolve(self);
		});
	};

	// initializes data
	DigitalSignage.initData = function (self) {
		// return new promise
		return new Promise(function (resolve, reject) {
			window.request({
				src: self.src,
				onLoad: function (xhr) {
					// get server data
					var serverData = JSON.parse(xhr.responseText);

					// if server data contains time, set offset
					if (serverData.serverTime) {
						serverData.timestampOffset = Date.now() - serverData.serverTime;
					}
					// otherwise use current time, set no offset
					else {
						serverData.serverTime = Date.now();
						serverData.timestampOffset = 0;
					}

					self.data = Object.extend(self.data, serverData);

					// resolve promise
					resolve(self);
				},
				onError: reject
			});
		});
	};

	// initializes all polling functionality
	DigitalSignage.initPolling = function (self) {
		var data = self.data;

		// return new promise
		return new Promise(function (resolve, reject) {
			window.longpoll({
				src: self.src,
				maxInterval: 200,
				onLoad: function (xhr) {
					// get server data
					var serverData = JSON.parse(xhr.responseText);

					// if server data contains time, set offset
					if (serverData.serverTime) {
						serverData.timestampOffset = Date.now() - serverData.serverTime;
					}
					// otherwise use current time, set no offset
					else {
						serverData.serverTime = Date.now();
						serverData.timestampOffset = 0;
					}

					Object.extend(data, serverData);

					DigitalSignage.initTemplates(self).then(function () {
						self.ractive.update();

						// resolve promise
						resolve(self);
					});
				},
				onError: reject
			});
		});
	};

	// initializes all drawing functionality
	DigitalSignage.initDrawing = function (self) {
		return new Promise(function (resolve) {
			var data = self.data, ractive = self.ractive, last = 0;

			function ondraw() {
				var
				thisIndex = data.index || 0,
				duration  = 0;

				data.collection.forEach(function (slide) {
					duration += slide.duration;
				});

				duration *= 1000;

				var
				now = Date.now() - data.timestampOffset,
				length = data.collection.length,
				nextIndex = Math.floor((now / duration) % length);

				if (thisIndex !== nextIndex) ractive.set('index', nextIndex);

				if (now - 1000 >= last) {
					ractive.set('timestamp', new Date(now));

					last = now;
				}

				requestAnimationFrame(ondraw);
			}

			requestAnimationFrame(ondraw);

			resolve(self);
		});
	};

	// initializes all resizing functionality
	DigitalSignage.initResizing = function (self) {
		var ractive = self.ractive, resizeTimeout;

		return new Promise(function (resolve) {
			function onresize() {
				resizeTimeout = clearTimeout(resizeTimeout);

				resizeTimeout = setTimeout(function () {
					resizeTimeout = clearTimeout(resizeTimeout);

					ractive.set('isResizing', false);
				}, 20);

				ractive.set('isResizing', true);
			}

			window.addEventListener('resize', onresize);

			onresize();

			resolve(self);
		});
	};

	// Scales videos to fill the screen
	DigitalSignage.initVideo = function (self, item, index) {

		var videos = [].slice.call(document.querySelectorAll('video'));

		videos.forEach(function (video) {
			video.addEventListener('canplay', function () {

				var 
				container_width  	= 1920,
				container_height 	= 1080,
				scale_h 			= container_height / video.videoHeight, 	// Calculate height scale
				scale_v 			= container_width / video.videoWidth,		// Calculate width scale
				scale 				= (scale_h > scale_v) ? scale_h : scale_v, 	// Pick larger scale
				new_video_width 	= Math.round(scale * video.videoWidth), 	// Calculate new size
				new_video_height 	= Math.round(scale * video.videoHeight);	// Calculate new size

				// Scale video
				video.style.width  = new_video_width + 'px';
				video.style.height = new_video_height + 'px';

				// Center video
				video.style.marginLeft = Math.round((new_video_width - container_width) / 2 * -1) + 'px';
				video.style.marginTop  = Math.round((new_video_height - container_height) / 2 * -1) + 'px';

			});
		});
	};

	DigitalSignage.updateMenuDisplay = function (self) {
		var
		data        = self.data,
		ractive     = self.ractive,
		nextIndex   = data.index,
		lastOffset  = data.style.lastMenuOffset || 0,
		menu        = document.querySelector('.ui-menu-list'),
		parentRect  = menu.parentNode.getBoundingClientRect(),
		nextRect    = menu.querySelectorAll('.ui-menu-item')[nextIndex].getBoundingClientRect(),
		menuOffset  = Math.max(Math.floor(parentRect.left - nextRect.left + lastOffset), 0),
		caretOffset = -Math.min(Math.floor(parentRect.left - nextRect.left + lastOffset), 0),
		caretWidth  = Math.floor(nextRect.width);

		// set style properties
		ractive.set('style.menuOffset', menuOffset);
		ractive.set('style.caretOffset', caretOffset);
		ractive.set('style.caretWidth', caretWidth);
		ractive.set('style.lastMenuOffset', menuOffset);
	};

	DigitalSignage.updateTimestampDisplay = function (self) {
		var
		time   = new Date(self.data.timestamp),
		month  = 'January February March April May June July August September October November December'.split(' ')[time.getMonth()],
		date   = time.getDate(),
		hour   = (time.getHours() % 12) || 12,
		minute = ('0' + time.getMinutes()).slice(-2),
		period = time.getHours() > 11 ? 'p.m.' : 'a.m.';

		self.ractive.set('datetime', month + ' ' + date + ', ' + hour + ':' + minute + ' ' + period);
	};

	window.DigitalSignage = DigitalSignage;
})();