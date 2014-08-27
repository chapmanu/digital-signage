(function () {
	function Interval(listener, duration, speed) {
		var self = this;

		self.duration = duration;
		self.listener = listener;
		self.speed = speed;

		self.stop();
	}

	Interval.prototype = {
		constructor: Interval,
		play: function () {
			var
			self = this,
			timeStampA = +new Date();

			function interval(timeStamp) {
				var
				timeStampB = timeStamp || +new Date(),
				intervalTime = timeStampB - timeStampA,
				duration = self.duration,
				currentTime = Math.min(self.currentTime + intervalTime, duration),
				expectedTime = Math.min(intervalTime ? self.expectedTime + self.speed : self.expectedTime, duration) || 0,
				speed = Math.max(self.speed + (expectedTime - currentTime), 0);

				timeStampA = timeStampB;

				self.currentTime = currentTime;
				self.intervalTime = intervalTime;
				self.expectedTime = expectedTime;
				self.percentage = currentTime / duration || 0;

				if (currentTime < duration) {
					self.timeout = setTimeout(interval, speed);
				}

				self.listener.call(self);
			}

			interval(timeStampA);
		},
		pause: function () {
			var self = this;

			clearTimeout(self.timeout);
		},
		stop: function () {
			var self = this;

			self.pause();

			self.currentTime = 0;
			self.expectedTime = 0;
			self.intervalTime = 0;
			self.percentage = 0;
		}
	};

	Interval.easing = {
		linear: function (t) { return t; },

		easeIn: function (t, p) { return Math.pow(t, p); },
		easeOut: function (t, p) { return 1 - Math.pow(1 - t, p); },
		easeInOut: function (t, p) { var q = Math.pow(2, p) / 2; return t < 0.5 ? q * Math.pow(t, p) : -q * Math.pow(1 - t, p) + 1; },

		elasticIn:  function (t, p) { return Math.pow(p, 6 * (t - 1)) * -Math.sin((t - 1.075) * p * Math.PI / 0.3); },
		elasticOut: function (t, p) { return Math.pow(p, -6 * t) * Math.sin((t - 0.075) * p * Math.PI / 0.3) + 1; },
		elasticInOut: function (t, p) { var q = Math.pow(2, p) / 2; return t < 0.5 ? q * Math.pow(p, 6 * (t - 1)) * -Math.sin((t - 1.075) * p * Math.PI / 0.3) : -q * Math.pow(p, -6 * t) * Math.sin((t - 0.075) * p * Math.PI / 0.3) + 1; }
	};

	window.Interval = Interval;
})();