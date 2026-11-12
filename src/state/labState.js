export const LAB_CONFIG = Object.freeze({
	assemblyTolerance: 0.13,
	grabDistanceMin: 0.45,
	grabDistanceMax: 1.7,
	moveBounds: Object.freeze({ minX: -0.78, maxX: 0.78, minY: 0.875, maxY: 1.65, minZ: -1.5, maxZ: -0.32 }),
	messageDurationMs: 2400
});

export function createLabState() {
	return {
		phase: 'ready',
		pieces: [],
		targets: [],
		selectedPieceId: null,
		selectedBy: null,
		dragDistance: 0,
		xr: { session: null, supported: false, supportChecked: false },
		hands: { left: false, right: false, count: 0 },
		timer: { elapsedMs: 0, running: false, lastTick: 0 },
		ui: { message: 'Enter VR and show your hands to begin.', kind: 'info', revision: 0, errorTargetId: null, errorPieceId: null, errorUntil: 0 }
	};
}

export function getProgress(state) {
	return state.pieces.reduce((total, piece) => total + (piece.status === 'placed' ? 1 : 0), 0);
}

export function getElapsedMs(state, now = performance.now()) {
	if (!state.timer.running) return state.timer.elapsedMs;
	return state.timer.elapsedMs + Math.max(0, now - state.timer.lastTick);
}

export function formatTime(milliseconds) {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
	const seconds = (totalSeconds % 60).toString().padStart(2, '0');
	return `${minutes}:${seconds}`;
}

export function setMessage(state, message, kind = 'info', now = performance.now()) {
	state.ui.message = message;
	state.ui.kind = kind;
	state.ui.revision += 1;
	if (kind === 'error') {
		state.ui.errorUntil = now + LAB_CONFIG.messageDurationMs;
	} else {
		state.ui.errorUntil = 0;
	}
}

export function updateMessageExpiry(state, now = performance.now()) {
	if (state.ui.kind === 'error' && now >= state.ui.errorUntil) {
		state.ui.kind = state.phase === 'complete' ? 'success' : 'info';
		state.ui.message = state.phase === 'complete' ? 'Laboratory complete. Reset to try again.' : 'Release a part near its matching socket.';
		state.ui.revision += 1;
	}
}
