import * as THREE from 'three';
import { formatTime, getElapsedMs, getProgress } from '../state/labState.js';

export function createTextPlane(text, options = {}) {
	const width = options.width ?? 512;
	const height = options.height ?? 128;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	context.clearRect(0, 0, width, height);
	context.fillStyle = options.background ?? 'rgba(10, 18, 26, 0.94)';
	context.fillRect(0, 0, width, height);
	context.fillStyle = options.color ?? '#f2f1eb';
	context.font = `700 ${options.fontSize ?? 42}px system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(text, width / 2, height / 2, width - 28);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(options.worldWidth ?? 0.22, options.worldHeight ?? 0.055), material);
	mesh.userData.canvas = canvas;
	mesh.userData.texture = texture;
	return mesh;
}

export function createHudTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 1400;
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return { canvas, texture };
}

export function drawHud(canvas, state, now = performance.now()) {
	const context = canvas.getContext('2d');
	const width = canvas.width;
	const height = canvas.height;
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, '#14242d');
	gradient.addColorStop(1, '#0c151d');
	context.clearRect(0, 0, width, height);
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
	context.strokeStyle = 'rgba(190, 224, 215, .25)';
	context.lineWidth = 4;
	context.strokeRect(14, 14, width - 28, height - 28);

	context.textAlign = 'left';
	context.fillStyle = '#a9f0d1';
	context.font = '700 34px system-ui, sans-serif';
	context.fillText('IMMERSIVE ASSEMBLY LAB', 54, 82);
	context.fillStyle = '#f2f1eb';
	context.font = '700 58px system-ui, sans-serif';
	context.fillText(`${getProgress(state)} / 5`, 54, 190);
	context.fillStyle = '#aab9bc';
	context.font = '500 28px system-ui, sans-serif';
	context.fillText('PARTS ASSEMBLED', 54, 236);
	context.textAlign = 'right';
	context.fillStyle = '#f2f1eb';
	context.font = '700 46px ui-monospace, monospace';
	context.fillText(formatTime(getElapsedMs(state, now)), width - 54, 190);
	context.fillStyle = '#aab9bc';
	context.font = '500 26px system-ui, sans-serif';
	context.fillText('TIME', width - 54, 236);

	context.textAlign = 'left';
	context.fillStyle = '#d9e4df';
	context.font = '600 28px system-ui, sans-serif';
	context.fillText('Point with a hand ray. Pinch to hold.', 54, 345);
	context.fillText('Release at the socket with the same label.', 54, 390);

	const leftTracked = state.hands.left;
	const rightTracked = state.hands.right;
	context.fillStyle = leftTracked ? '#a9f0d1' : '#f0c875';
	context.font = '700 24px system-ui, sans-serif';
	context.fillText(`LEFT HAND  ${leftTracked ? 'TRACKED' : 'NOT SEEN'}`, 54, 490);
	context.fillStyle = rightTracked ? '#a9f0d1' : '#f0c875';
	context.fillText(`RIGHT HAND  ${rightTracked ? 'TRACKED' : 'NOT SEEN'}`, 54, 534);

	const messageColor = state.ui.kind === 'error' ? '#ff8d88' : state.ui.kind === 'success' ? '#a9f0d1' : '#dce6e3';
	context.fillStyle = messageColor;
	context.font = '700 27px system-ui, sans-serif';
	wrapText(context, state.ui.message, 54, 630, width - 108, 38, 3);

	if (state.phase === 'complete') {
		context.fillStyle = '#a9f0d1';
		context.font = '700 27px system-ui, sans-serif';
		context.fillText(`FINAL TIME  ${formatTime(getElapsedMs(state, now))}`, 54, 820);
	}

	return true;
}

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines) {
	const words = String(text).split(/\s+/);
	let line = '';
	let lineCount = 0;
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (context.measureText(next).width > maxWidth && line) {
			context.fillText(line, x, y + lineCount * lineHeight);
			line = word;
			lineCount += 1;
			if (lineCount >= maxLines) return;
		} else {
			line = next;
		}
	}
	if (line && lineCount < maxLines) context.fillText(line, x, y + lineCount * lineHeight);
}
