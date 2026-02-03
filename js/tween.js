const TWEEN = {
    tweens: [],
    Easing: {
        Linear: { None: k => k },
        Quadratic: { Out: k => k * (2 - k) },
        Cubic: { Out: k => --k * k * k + 1 },
        Back: { Out: k => --k * k * ((1.70158 + 1) * k + 1.70158) + 1 },
        Bounce: { Out: k => {
            if (k < (1 / 2.75)) return 7.5625 * k * k;
            else if (k < (2 / 2.75)) return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
            else if (k < (2.5 / 2.75)) return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
            else return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
        }}
    },
    update: function(time) {
        this.tweens = this.tweens.filter(tween => tween.update(time));
    },
    Tween: class {
        constructor(object) {
            this.object = object;
            this.target = {};
            this.duration = 1000;
            this.easingFunction = k => k;
            this.startTime = null;
            this.onCompleteCallback = null;
            this.onUpdateCallback = null;
            this.chainedTween = null;
        }
        to(target, duration) {
            this.target = target;
            this.duration = duration;
            return this;
        }
        easing(easing) {
            this.easingFunction = easing;
            return this;
        }
        onComplete(callback) {
            this.onCompleteCallback = callback;
            return this;
        }
        onUpdate(callback) {
            this.onUpdateCallback = callback;
            return this;
        }
        chain(tween) {
            this.chainedTween = tween;
            return this;
        }
        start() {
            this.startTime = performance.now();
            this.startValues = {};
            for (let key in this.target) this.startValues[key] = this.object[key];
            TWEEN.tweens.push(this);
            return this;
        }
        update(time) {
            let elapsed = time - this.startTime;
            let progress = Math.min(elapsed / this.duration, 1);
            let value = this.easingFunction(progress);

            for (let key in this.target) {
                this.object[key] = this.startValues[key] + (this.target[key] - this.startValues[key]) * value;
            }

            if (this.onUpdateCallback) this.onUpdateCallback();

            if (progress === 1) {
                if (this.onCompleteCallback) this.onCompleteCallback();
                if (this.chainedTween) this.chainedTween.start();
                return false;
            }
            return true;
        }
    }
};

export default TWEEN;
