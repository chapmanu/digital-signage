(function () {
	'use strict';

	/* global Promise, Ractive */

	function DigitalSignageSlidePreview(data) {
		var self = this;

		self.data = Object.extend({
			isResizing: true,
			style: {}
		}, data);
		self.templates = {};

		DigitalSignageSlidePreview.initTemplate(self).then(DigitalSignageSlidePreview.initRactive).then(DigitalSignageSlidePreview.initVideo);
	}

	DigitalSignageSlidePreview.initTemplate = function (self) {
		return new Promise(function (resolve, reject) {
			if (DigitalSignageSlidePreview.templates) return resolve(self);

			var path = self.data.template;

			window.request({
				src: path,
				onLoad: function (xhr) {
					// remove path and extension from file
					var key = path.replace(/^.+\/(.+?)\.[^\.]+$/, '$1');

					self.templates[key] = xhr.responseText;

					return resolve(self);
				},
				onError: reject
			});
		});
	};

	DigitalSignageSlidePreview.initRactive = function (self) {
		return new Promise(function (resolve) {
			var 
			path = self.data.template,
			key = path.replace(/^.+\/(.+?)\.[^\.]+$/, '$1');

			self.ractive = new Ractive({
				el: document.querySelector('.ui-feed'),
				template: self.templates[key],
				data: self.data
			});

			self.ractive.observe({
				index: function () {
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				},
				isResizing: function () {
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				},
				location: function () {
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				},
				timestamp: function () {
					DigitalSignageSlidePreview.updateTimestampDisplay(self);
					DigitalSignageSlidePreview.updateMenuDisplay(self);
				}
			});

			DigitalSignageSlidePreview.updateDirectory(self);

			resolve(self);
		});
	};

	// Scales videos to fill the screen
	DigitalSignageSlidePreview.initVideo = function (self, item, index) {

		var videos = [].slice.call(document.querySelectorAll('video'));

		videos.forEach(function (video) {
			video.addEventListener('canplay', function () {

				var 
				container_width  	= window.innerWidth,
				container_height 	= window.innerHeight,
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

	DigitalSignageSlidePreview.updateDirectory = function (self) {
		var
		duration = self.ractive.data.duration,
		inset    = self.ractive.find('.ui-slide-collection-inset'),
		outset   = inset.parentNode,
		outsetHeight = inset.offsetHeight,
		column   = 125 * 5,
		columns  = Math.floor(inset.offsetHeight / column),
		offset   = 0;

		function oninterval() {
			inset.style.webkitTransform = 'translateY(-' + offset + 'px)';

			offset += (column / 5 * 2);

			if (offset > outsetHeight) offset = 0;
		}

		oninterval();

		setInterval(oninterval, 5 * 1000);
	};

	window.DigitalSignageSlidePreview = DigitalSignageSlidePreview;
})();