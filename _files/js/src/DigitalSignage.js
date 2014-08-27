// ~1700 bytes gzipped
(function () {
	'use strict';

	/* global cancelAnimationFrame, Promise, Ractive, requestAnimationFrame */

	var
	// find prefixed transform properties
	MATCH = getComputedStyle(document.documentElement).cssText.match(/\s-(moz|ms|webkit)-transform:/),
	// assign conditional transform property
	TRANSFORM = MATCH ? MATCH[1] + 'Transform' : 'transform';

	function DigitalSignage(src) {
		var self = this;

		self.data = {
			lastIndex: null,
			index: 0,
			isResizing: true,
			style: {},
			timeout: null,
			notOnMenu: []
		};

		self.templates = {};
		self.src = src;

		self.getDiffSlideIndex = function (pendingIndex) {
			var
			collection = self.data.collection,
			length = collection.length,
			index = ((pendingIndex % length) + length) % length,
			isForward = self.data.index < index;

			self.data.direction = isForward ? 'forward' : 'backward';

			return /directory/i.test(collection[index].template) ? self.getDiffSlideIndex(isForward ? index + 1 : index - 1) : index;
		};

		self.getNextSlideIndex = function () {
			return self.getDiffSlideIndex(self.data.index + 1);
		};

		self.getPreviousSlideIndex = function () {
			return self.getDiffSlideIndex(self.data.index - 1);
		};

		DigitalSignage
			.initData(self)
			.then(DigitalSignage.initTemplates)
			.then(DigitalSignage.initRactive)
			.then(DigitalSignage.initPantherAlert)
			.then(DigitalSignage.initPolling)
			.then(DigitalSignage.initDrawing)
			.then(DigitalSignage.initResizing)
			.then(DigitalSignage.initVideo)
			.then(DigitalSignage.initMousing)
			.then(DigitalSignage.initDirectories);
	}

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

					serverData.serverTime = new Date(xhr.getResponseHeader('Date')).getTime();

					if (serverData.serverTime) {
						serverData.timestampOffset = Date.now() - serverData.serverTime;
					}
					// otherwise use current time, set no offset
					else {
						serverData.serverTime = Date.now();
						serverData.timestampOffset = 0;
					}
					
					self.data = Object.extend(self.data, serverData);

					// Add flags to the directory slides
					var hiddenSlideIds = []
					self.data.collection.forEach(function(slide, index) {
						if (/directory/i.test(slide.template)) {
							slide.onMenu = false;
							hiddenSlideIds.push(index);
						} else {
							slide.onMenu = true;
						}
					});
					self.data.notOnMenu = hiddenSlideIds;

					// resolve promise
					resolve(self);
				},
				onError: reject
			});
		});
	};

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

			self.ractive.on({
				selectSlide: function(event, index) {
					self.ractive.set({
						lastIndex: self.data.index,
						index: index
					});

					DigitalSignage.initDrawing(self);
				},
				swipeLeft: function (e) {
					self.ractive.set({
						lastIndex: self.data.index,
						index: self.getNextSlideIndex()
					});

					DigitalSignage.initDrawing(self);
				},
				swipeRight: function (e) {
					self.ractive.set({
						lastIndex: self.data.index,
						index: self.getPreviousSlideIndex()
					});

					DigitalSignage.initDrawing(self);
				}
			});

			self.ractive.observe({
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
					// Stop playing a video if the background changes.
					if (item.canvas) {
						cancelAnimationFrame(item.backgroundFrame);
						delete item.backgroundMedia;
					}
				}
			});

			resolve(self);
		});
	};

	// initializes panther alerts
	DigitalSignage.initPantherAlert = function (self) {
		// return new promise
		return new Promise(function (resolve, reject) {
			//
			var
			src = '//blogs.chapman.edu/panther-alert?',
			interval = 1000,
			data = {};

			function pantherAlert(items) {
				if (items && items.length) {
					var item = items[0];

					data.emergency = item.title;
					data.emergencyMessage = item.description;
				} else {
					delete data.emergency;
					delete data.emergencyMessage;
				}
			}

			// Ping blogs panther alert link every 1 second.
			function loadScript() {
				var
				script = document.head.appendChild(document.createElement('script')),
				timestamp = +new Date();

				script.onload = function () {
					document.head.removeChild(script);

					setTimeout(loadScript, interval);
				};

				script.src = src + timestamp;
			}

			window.pantherAlert = pantherAlert;
			window.pantherAlert.data = data;

			loadScript();

			resolve(self);
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

					Object.extend(data, serverData, pantherAlert.data);

					// Add flags to the directory slides
					var hiddenSlideIds = [];
					self.data.collection.forEach(function(slide, index) {
						if (/directory/i.test(slide.template)) {
							slide.onMenu = false;
							hiddenSlideIds.push(index);
						} else {
							slide.onMenu = true;
						}
					});
					self.data.notOnMenu = hiddenSlideIds;

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
			
			clearTimeout(data.timeout);

			// ractive.set('lastIndex', data.index);
			// ractive.set('index', data.index);
			ractive.set('timestamp', new Date());
			
			function nextSlide() {
				ractive.set({
					lastIndex: self.data.index,
					index: self.getNextSlideIndex()
				});

				var duration = data.collection[data.index].duration * 1000;

				data.timeout = setTimeout(nextSlide, duration);
			}

			var duration = data.collection[data.index || 0].duration * 1000;
			data.timeout = setTimeout(nextSlide, duration);

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

					DigitalSignage.updatePreviewScaling(self);

					ractive.set('isResizing', false);
				}, 100);

				ractive.set('isResizing', true);
			}

			window.addEventListener('resize', onresize);

			onresize();

			resolve(self);
		});
	};

	// Resizes the display
	DigitalSignage.updatePreviewScaling = function(self) {

		var
		v = document.createElement('video'),
		preview_notice = !Boolean(v.canPlayType && v.canPlayType('video/mp4').replace(/no/, '')),
		scale_x = Math.min(window.innerWidth / 1920, 1),
		scale_y = Math.min(window.innerHeight / 1080, 1),
		scale   = Math.min(scale_x, scale_y),
		wrapper = document.getElementById('ui-feed');

		if (window.innerWidth >= 1920) {
			scale = 1;
		} else {
			preview_notice = true;
		}

		self.data.scale = scale;
		self.ractive.set('previewNotice', preview_notice);

		// Scale wrapper
		wrapper.style[TRANSFORM] = 'scale('+scale+')';
	};

	DigitalSignage.initMousing = function (self) {
		return new Promise(function (resolve) {
			var ractive = self.ractive, delay = 200, timeout;

			window.addEventListener('mousemove', function () {
				clearTimeout(timeout);

				ractive.set('isMousing', true);

				timeout = setTimeout(function () {
					ractive.set('isMousing', false);
				}, delay);
			});

			resolve(self);
		});
	};

	// Scales videos to fill the screen
	DigitalSignage.initVideo = function (self) {
		return new Promise(function (resolve) {
			var videos = [].slice.call(document.querySelectorAll('video'));

			videos.forEach(function (video) {
				video.addEventListener('canplay', function () {

					var
					container_width  = 1920,
					container_height = 1080,
					scale_h          = container_height / video.videoHeight,    // Calculate height scale
					scale_v          = container_width / video.videoWidth,      // Calculate width scale
					scale            = (scale_h > scale_v) ? scale_h : scale_v, // Pick larger scale
					new_video_width  = Math.round(scale * video.videoWidth),    // Calculate new size
					new_video_height = Math.round(scale * video.videoHeight);   // Calculate new size

					// Scale video
					video.style.width  = new_video_width + 'px';
					video.style.height = new_video_height + 'px';

					// Center video
					video.style.marginLeft = Math.round((new_video_width - container_width) / 2 * -1) + 'px';
					video.style.marginTop  = Math.round((new_video_height - container_height) / 2 * -1) + 'px';

				});
			});

			resolve(self);
		});
	};

	DigitalSignage.updateMenuDisplay = function (self) {

		if (document.querySelectorAll('.ui-menu-item--active').length <= 0) {
			self.ractive.set('style.caretOpacity',  0);
			return;
		} else {
			self.ractive.set('style.caretOpacity', 1);
		}
		
		/* SET UP VARIABLES */
		var
		data             = self.data,
		ractive          = self.ractive,
		menu             = document.querySelector('.ui-menu-list'),
		menuArea         = menu.getBoundingClientRect(),
		containerArea    = menu.parentNode.getBoundingClientRect(),
		activeItemArea   = menu.querySelector('.ui-menu-item--active').getBoundingClientRect(),
		activeLeftEdge   = activeItemArea.left - menuArea.left,
		minMenuOffset    = 0,
		maxMenuOffset    = menuArea.width - containerArea.width,
		astheticOffset   = 100,
		scale            = self.data.scale || 1;

		/* MAIN STYLE VARIABLES */
		var 
 		// The width of the carrot (cursor/highlighter)
		caretWidth       = Math.floor(activeItemArea.width),
		
		// Distance from the right edge of the container to the right edge of the menu
		menuOffset       = menuArea.width - containerArea.width - activeLeftEdge + astheticOffset,
		
		// Distance from the left edge of the container (viewbox) to the left edge of the carrot 
		caretOffset      = astheticOffset;

		// Adjust based on min and max limits
		if (menuOffset < minMenuOffset) { 
			// Menu is beyond the end
			caretOffset += (minMenuOffset - menuOffset);
			menuOffset   = minMenuOffset;
		
		} else if (menuOffset > maxMenuOffset) { 
			// Menu is beyond the beginning
			caretOffset -= (menuOffset - maxMenuOffset);
			menuOffset   = maxMenuOffset;
		}

		// Set style properties & correct for scaling
		ractive.set('style.menuOffset',  menuOffset  * (1/scale));
		ractive.set('style.caretOffset', caretOffset * (1/scale));
		ractive.set('style.caretWidth',  caretWidth  * (1/scale));
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

	DigitalSignage.initDirectories = function (self) {
		return new Promise(function (resolve) {
			self.data.collection.forEach(function (slide, index) {
				if (/directory|schedule/i.test(slide.template)) {
					DigitalSignage.updateSliding(self, index, slide);
				}
			});

			resolve(self);
		});
	};

	// Scrolls the directory listing
	DigitalSignage.updateSliding = function(self, index, slide) {
		var
		inset = self.ractive.find('.ui-slide:nth-child(' + (index + 1) + ') .ui-slide-collection-inset');

		if (!inset) return;

		var
		outsetHeight = inset.offsetHeight,
		columnHeight = /schedule/.test(slide.template) ? 155 : 125,
		columnInterval = 2,
		columnDelay = 5,
		offset = 0;

		function oninterval() {
			inset.style[TRANSFORM] = 'translateY(-' + offset + 'px)';

			offset += columnHeight * columnInterval;

			if (offset > (outsetHeight - (columnHeight * columnInterval))) offset = 0;
		}

		oninterval();

		setInterval(oninterval, columnDelay * 1000);
	};

	window.DigitalSignage = DigitalSignage;
})();