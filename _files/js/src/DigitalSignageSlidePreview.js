(function () {
	'use strict';

	/* global Promise, Ractive */

	var
	// find prefixed transform properties
	MATCH = getComputedStyle(document.documentElement).cssText.match(/\s-(moz|ms|webkit)-transform:/),
	// assign conditional transform property
	TRANSFORM = MATCH ? MATCH[1] + 'Transform' : 'transform';

	function DigitalSignageSlidePreview(data) {
		var self = this;

		self.data = Object.deepAssign({
			isResizing: true,
			style: {}
		}, data);
		self.templates = {};

		DigitalSignageSlidePreview.initTemplate(self).then(DigitalSignageSlidePreview.initRactive).then(DigitalSignageSlidePreview.initVideo).then(DigitalSignageSlidePreview.updateFeedSize(self));
	}

	DigitalSignageSlidePreview.initTemplate = function(self) {
		return new Promise(function(resolve, reject) {
			if (DigitalSignageSlidePreview.templates) return resolve(self);

			var path = self.data.template;

			window.request({
				src: path,
				onLoad: function(xhr) {
					// remove path and extension from file
					var key = path.replace(/^.+\/(.+?)\.[^\.]+$/, '$1');

					self.templates[key] = xhr.responseText;

					return resolve(self);
				},
				onError: reject
			});
		});
	};

	DigitalSignageSlidePreview.initRactive = function(self) {
		return new Promise(function(resolve) {
			var
			path = self.data.template,
				key = path.replace(/^.+\/(.+?)\.[^\.]+$/, '$1');

			self.ractive = new Ractive({
				el: document.querySelector('.ui-feed'),
				template: self.templates[key],
				data: self.data
			});

			self.ractive.observe({
				index: function() {
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				},
				isResizing: function() {
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				},
				location: function() {
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				},
				timestamp: function() {
					DigitalSignageSlidePreview.updateTimestampDisplay(self);
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				}
			});

			// TODO: Don’t do it this way
			if (/schedule|directory/i.test(self.data.template)) DigitalSignageSlidePreview.updateSliding(self);

			resolve(self);
		});
	};

	// Scales videos to fill the screen
	DigitalSignageSlidePreview.initVideo = function(self, item, index) {

		var videos = [].slice.call(document.querySelectorAll('video'));

		videos.forEach(function(video) {
			video.addEventListener('canplay', function() {

				var
				container_width = window.innerWidth,
					container_height = window.innerHeight,
					scale_h = container_height / video.videoHeight, // Calculate height scale
					scale_v = container_width / video.videoWidth, // Calculate width scale
					scale = (scale_h > scale_v) ? scale_h : scale_v, // Pick larger scale
					new_video_width = Math.round(scale * video.videoWidth), // Calculate new size
					new_video_height = Math.round(scale * video.videoHeight); // Calculate new size

				// Scale video
				video.style.width = new_video_width + 'px';
				video.style.height = new_video_height + 'px';

				// Center video
				video.style.marginLeft = Math.round((new_video_width - container_width) / 2 * -1) + 'px';
				video.style.marginTop = Math.round((new_video_height - container_height) / 2 * -1) + 'px';

			});
		});
	};

	// Resizes the display
	DigitalSignageSlidePreview.updateFeedSize = function(self) {

		if (window.innerWidth >= 1900) return false;

		var
		scale_x = Math.min(window.innerWidth / 1920, 1),
			scale_y = Math.min(window.innerHeight / 1080, 1),
			scale = Math.min(scale_x, scale_y),
			wrapper = document.getElementById('ui-feed');

		// Scale wrapper
		wrapper.style[TRANSFORM] = "scale(" + scale + ")";
	};

	// Scrolls the directory listing
	DigitalSignageSlidePreview.updateSliding = function(self) {
		var
		duration = self.data.duration,
		inset = self.ractive.find('.ui-slide-collection-inset');

		if (!inset) return;

		var
		outset = inset.parentNode,
		outsetHeight = inset.offsetHeight,
		columnHeight = /schedule/.test(self.data.template) ? 155 : 125,
		columnMax = 4,
		columnInterval = 2,
		columnDelay = 5,
		columns = Math.floor(inset.offsetHeight / (columnHeight * columnMax)),
		offset = 0;

		function oninterval() {
			inset.style[TRANSFORM] = 'translateY(-' + offset + 'px)';

			offset += columnHeight * columnInterval;

			if (offset > (outsetHeight - (columnHeight * columnInterval))) offset = 0;
		}

		oninterval();

		setInterval(oninterval, columnDelay * 1000);
	};

	window.DigitalSignageSlidePreview = DigitalSignageSlidePreview;
})();