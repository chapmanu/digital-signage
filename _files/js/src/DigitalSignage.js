// ~1700 bytes gzipped
(function () {
	'use strict';

	/* global cancelAnimationFrame, Promise, Ractive, requestAnimationFrame */

	var
	// find prefixed transform properties
	MATCH = getComputedStyle(document.documentElement).cssText.match(/\s-(moz|ms|webkit)-transform:/),
	// assign conditional transform property
	TRANSFORM = MATCH ? MATCH[1] + 'Transform' : 'transform';

	function DigitalSignage(src, touchSupport, googleAnalyticsID) {
		var self = this;

		self.data = {
			lastIndex: null,
			index: null,
			isResizing: true,
			style: {},
			notOnMenu: []
		};

		self.touchSupport = touchSupport;

		self.templates = {};
		self.src = src;
		self.autoScrollIntervals = [];
		self.rotationTimeout = null;
		self.intervals = {};

		self.getDiffSlideIndex = function (pendingIndex) {
			var
			collection = self.data.collection,
			length = collection.length,
			index = ((pendingIndex % length) + length) % length,
			isForward = index !== 0 && self.data.index < index;

			return (self.touchSupport && /directory/i.test(collection[index].template)) ? self.getDiffSlideIndex(isForward ? index + 1 : index - 1) : index;
		};

		self.getNextSlideIndex = function () {
			if (self.data.collection && self.data.collection.length === 1) return 0;
			return self.getDiffSlideIndex(self.data.index + 1);
		};

		self.getPreviousSlideIndex = function () {
			if (self.data.collection && self.data.collection.length === 1) return 0;
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

		// Google Analytics
		if (googleAnalyticsID) {
			(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
			(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
			m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
			})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

			ga('create', googleAnalyticsID, 'auto');

			setTimeout(function() {
				ga('send', 'pageview', {
					'title': 'Digital Signage Initialized: ' + self.data.location
				});
			}, 1000);
		}

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

					Object.deepAssign(self.data, serverData);

					// Add flags to the directory slides
						var hiddenSlideIds = [];
						self.data.collection.forEach(function(slide, index) {
							if (self.touchSupport && /directory/i.test(slide.template)) {
								slide.doNotShow = true;
								hiddenSlideIds.push(index);
							} else {
								slide.doNotShow = false;
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

			var timestamp = (new Date()).getTime();

			// Prevent caching
			templates = templates.map(function(item) {
				return item + '?ver=' + timestamp;
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
					if (!self.touchSupport) return;

					if (self.data.index == index) return;

					self.ractive.set({
						direction: '',
						lastIndex: self.data.index,
						index: index
					});

					DigitalSignage.initDrawing(self);

					var slideTitle = self.data.collection[index].menuName;

					if (typeof(ga) !== 'undefined') ga('send', 'event', 'Touch Interaction', 'Menu Tap', slideTitle);
				},
				swipeLeft: function (e) {
					if (!self.touchSupport) return;

					self.ractive.set({
						direction: 'forward',
						lastIndex: self.data.index,
						index: self.getNextSlideIndex()
					});

					DigitalSignage.initDrawing(self);

					if (typeof(ga) !== 'undefined') ga('send', 'event', 'Touch Interaction', 'Swipe Left');
				},
				swipeRight: function (e) {
					if (!self.touchSupport) return;

					self.ractive.set({
						direction: 'backward',
						lastIndex: self.data.index,
						index: self.getPreviousSlideIndex()
					});

					DigitalSignage.initDrawing(self);

					if (typeof(ga) !== 'undefined') ga('send', 'event', 'Touch Interaction', 'Swipe Right');
				},
				delayAutoScroll: function (event) {
					var delay = 15000;

					clearTimeout(self.delayTimeout);
					clearTimeout(self.rotationTimeout);
					self.autoScrollIntervals.forEach(function(id) {clearInterval(id);});
					self.autoScrollIntervals = [];

					if (self.intervals[self.data.index]) {
						self.intervals[self.data.index].stop();
					}

					self.delayTimeout = setTimeout(function () {
						DigitalSignage.initDirectories(self);
						DigitalSignage.initDrawing(self);
					}, delay);
				}
			});

			self.ractive.observe({
				isDodgeSlide: function() {
					setTimeout(function() {
						DigitalSignage.updateMenuDisplay(self);
					},1);
				},
				isResizing: function () {
					DigitalSignage.updateMenuDisplay(self);
				},
				location: function () {
					DigitalSignage.updateMenuDisplay(self);
				},
				timestamp: function () {
					DigitalSignage.updateTimestampDisplay(self);
				},
				index: function(newIndex) {
					DigitalSignage.updateMenuDisplay(self);

					// Pause all the videos, play only the one on this slide
					setTimeout(function() {
						var allVideos = document.getElementsByTagName('video');
						var thisVideo = self.ractive.find('.ui-slide--active video');

						for (var i = 0; i < allVideos.length; ++i) {
							if (allVideos[i].isSameNode(thisVideo)) continue;
							allVideos[i].pause();
							allVideos[i].currentTime = 0;
							allVideos[i].load();
						}

						if (thisVideo) {
							thisVideo.play();
						}
					}, 500);  // Run this after the slide has transitioned


					if (newIndex != undefined) {
						var
						slide_id   = self.data.collection[newIndex].id,
						slideTitle = self.data.collection[newIndex].menuName,
						slug       = slideTitle.replace(/ /g,'-').replace(/[^\w-]+/g,''),
						location   = window.location.pathname + '?slide=' + slug;

						self.ractive.set('isDodgeSlide', (/dodge\-college/).test(slide_id));


						// Track pageview on each slide display
						if (typeof(ga) !== 'undefined') ga('send', 'pageview', {
							'page': location,
							'title': slideTitle + ' | ' + self.data.collection[newIndex].heading
						});
					}

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
				},
				'collection.length': function () {
					// Reset the menu everytime we get a new number of slides.
					setTimeout(function(){
						self.ractive.set('index', 0);
					}, 1000);
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
				maxInterval: 5000,
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

					Object.deepAssign(data, serverData, pantherAlert.data);

					// Add flags to the directory slides
					if (self.touchSupport) {
						var hiddenSlideIds = [];
						self.data.collection.forEach(function(slide, index) {
							if (/directory/i.test(slide.template)) {
								slide.doNotShow = true;
								hiddenSlideIds.push(index);
							} else {
								slide.doNotShow = false;
							}
						});
						self.data.notOnMenu = hiddenSlideIds;
					}

					DigitalSignage.initTemplates(self).then(function () {
						self.ractive.update();

						// resolve promise
						resolve(self);
					});
				},
				onError: function () {
					// Restart polling in 5 minutes
					setTimeout(function() {
						DigitalSignage.initPolling(self);
					},300000);
				}
			});
		});
	};

	// initializes all drawing functionality
	DigitalSignage.initDrawing = function (self) {
		return new Promise(function (resolve) {
			var data = self.data, ractive = self.ractive, last = 0;

			clearTimeout(self.rotationTimeout);
			ractive.set('timestamp', new Date());

			function nextSlide() {

				ractive.set({
					timestamp: new Date(),
					direction: '',
					lastIndex: self.data.index,
					index: self.getNextSlideIndex()
				});

				var duration = data.collection[data.index].duration * 1000;

				self.rotationTimeout = setTimeout(nextSlide, duration);
			}

			var duration = data.collection[data.index || 0].duration * 1000;
			self.rotationTimeout = setTimeout(nextSlide, duration);

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

		if (document.querySelectorAll('.ui-menu-item-'+self.data.index).length <= 0) {
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
		activeItemArea   = menu.querySelector('.ui-menu-item-'+data.index).getBoundingClientRect(),
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
		// The viewbox is the container, the slider is the thing that needs to scroll
		var
		viewbox = self.ractive.find('.ui-slide:nth-child(' + (index + 1) + ') .ui-slide-collection'),
		slider = viewbox.children[0];

		if (!(viewbox && slider)) return;  // Check yo'self

		var // Configuration settings
		rowHeight        = /schedule/.test(slide.template) ? 175 : 125,
		currentScrollTop = 0,
		nextScrollTop    = 0,
		difference       = 0,
		scrollDelay      = 6000;

		// Create an Interval object for the easing scroll effect
		var autoScrollInterval = new Interval(function () {}, 2000, 1000 / 60);
		autoScrollInterval.listener = function () {
		 	// Performs the easing
		 	viewbox.scrollTop = currentScrollTop + (Interval.easing.easeInOut(this.percentage, 2) * difference);
		 	if (this.percentage === 1) this.stop();
		};

		// Run this function every x seconds (configured using the scrollDelay above)
		function oninterval() {
			var threshold = (slider.clientHeight - viewbox.clientHeight);
			currentScrollTop = viewbox.scrollTop;

			if ( currentScrollTop < threshold) {
				nextScrollTop = currentScrollTop + (rowHeight * 2);  // We scroll two rows at a time
				if (nextScrollTop > threshold) nextScrollTop = threshold;  // Make sure we don't off the edge
			}
			else {
				// Take us back to the top
				nextScrollTop = 0;
			}
			// Calculate the difference for the easing function
			difference = nextScrollTop - currentScrollTop;
			autoScrollInterval.play();
		};

		// Save the interval so that you can stop the autoscroll later
		self.intervals[index] = autoScrollInterval;
		// Initiate the autoscroll
		self.autoScrollIntervals.push(setInterval(oninterval, scrollDelay));
	};

	window.DigitalSignage = DigitalSignage;
})();