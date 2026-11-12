export class FeedbackAudio {
	constructor() {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		this.context = AudioContextClass ? new AudioContextClass() : null;
	}

	async resume() {
		if (this.context?.state === 'suspended') {
			try { await this.context.resume(); } catch { /* Audio is optional; visual feedback remains available. */ }
		}
	}

	playSuccess() {
		this.#tone(660, 0.08, 'sine', 0.045, 0);
		this.#tone(880, 0.11, 'sine', 0.035, 0.075);
	}

	playError() {
		this.#tone(190, 0.12, 'triangle', 0.025, 0);
	}

	dispose() {
		this.context?.close();
	}

	#tone(frequency, duration, waveform, volume, delay) {
		if (!this.context || this.context.state !== 'running') return;
		const start = this.context.currentTime + delay;
		const oscillator = this.context.createOscillator();
		const gain = this.context.createGain();
		oscillator.type = waveform;
		oscillator.frequency.setValueAtTime(frequency, start);
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
		oscillator.connect(gain);
		gain.connect(this.context.destination);
		oscillator.start(start);
		oscillator.stop(start + duration + 0.01);
	}
}
