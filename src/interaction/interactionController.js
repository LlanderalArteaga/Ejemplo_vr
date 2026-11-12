import * as THREE from 'three';
import { validateDrop } from '../lab/assemblyRules.js';
import { LAB_CONFIG, formatTime, getProgress, setMessage, updateMessageExpiry } from '../state/labState.js';
import { setTargetStatus } from '../scene/labScene.js';

export class InteractionController {
	constructor(state, panel, audio) {
		this.state = state;
		this.panel = panel;
		this.audio = audio;
		this.raycaster = new THREE.Raycaster();
		this.raycaster.near = 0;
		this.raycaster.far = 2.1;
		this.grabOffset = new THREE.Vector3();
		this.grabPoint = new THREE.Vector3();
		this.nextPosition = new THREE.Vector3();
		this.hoveredPieceId = null;
	}

	update(handSnapshots, now) {
		updateMessageExpiry(this.state, now);
		this.#expireTargetFeedback(now);
		let hoveredControl = null;
		let hoveredPiece = null;
		let actionHandled = false;

		for (const hand of handSnapshots) {
			if (!hand.tracked) continue;
			if (this.state.selectedBy === hand.side) {
				if (hand.rayValid && hand.pinching) this.#moveSelected(hand);
				if (hand.pinchEnded) this.#releaseSelected(now);
				continue;
			}
			if (!hand.rayValid) continue;
			this.raycaster.ray.copy(hand.ray);
			const controlHit = this.raycaster.intersectObjects(this.panel.controls, false)[0];
			if (controlHit) {
				const control = controlHit.object;
				hoveredControl ??= control.userData.controlId;
				if (hand.pinchStarted && !actionHandled) {
					control.userData.action?.();
					actionHandled = true;
				}
				continue;
			}

			const pieceHit = this.#findPieceHit();
			if (!pieceHit) continue;
			hoveredPiece ??= pieceHit.piece.id;
			if (hand.pinchStarted && this.state.selectedPieceId === null && pieceHit.piece.status === 'available') {
				this.#beginGrab(pieceHit.piece, hand, pieceHit.hit);
			}
			if (this.state.selectedBy === hand.side && hand.pinching) this.#moveSelected(hand);
			if (this.state.selectedBy === hand.side && hand.pinchEnded) this.#releaseSelected(now);
		}

		this.#setHoverState(hoveredControl, hoveredPiece);
	}

	startSession(now) {
		this.state.phase = this.state.phase === 'complete' ? 'complete' : 'active';
		if (this.state.phase !== 'complete') {
			this.state.timer.running = true;
			this.state.timer.lastTick = now;
			setMessage(this.state, this.state.hands.count ? 'Pinch a part and place it in its matching socket.' : 'Show your hands to begin.', 'info', now);
		}
	}

	endSession(now) {
		this.#pauseTimer(now);
		this.#clearTargetError();
		if (this.state.selectedPieceId) {
			const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
			if (piece?.status === 'selected') piece.status = 'available';
			piece?.material.emissive.set('#000000');
		}
		this.state.selectedPieceId = null;
		this.state.selectedBy = null;
		if (this.state.phase !== 'complete') {
			this.state.phase = 'active';
			setMessage(this.state, 'Session paused. Re-enter VR to continue.', 'info', now);
		}
		this.#setHoverState(null, null);
	}

	onTrackingLost(side) {
		if (this.state.selectedBy !== side) return;
		const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
		if (piece?.status === 'selected') piece.status = 'available';
		piece?.material.emissive.set('#000000');
		this.state.selectedPieceId = null;
		this.state.selectedBy = null;
		setMessage(this.state, 'Hand tracking was lost. The part was released safely; try again.', 'error');
	}

	reset(now = performance.now()) {
		this.state.selectedPieceId = null;
		this.state.selectedBy = null;
		for (const target of this.state.targets) setTargetStatus(target, 'available');
		for (const piece of this.state.pieces) {
			piece.status = 'available';
			piece.root.position.copy(piece.startPosition);
			piece.root.quaternion.copy(piece.startQuaternion);
			piece.material.color.set(piece.color);
			piece.material.emissive.set('#000000');
		}
		this.state.phase = this.state.xr.session ? 'active' : 'ready';
		this.state.timer.elapsedMs = 0;
		this.state.timer.running = Boolean(this.state.xr.session);
		this.state.timer.lastTick = now;
		this.state.ui.errorTargetId = null;
		this.state.ui.errorPieceId = null;
		this.state.ui.errorUntil = 0;
		setMessage(this.state, this.state.xr.session ? 'Challenge reset. Place each part in its matching socket.' : 'Challenge reset. Enter VR to begin.', 'info', now);
		this.#setHoverState(null, null);
	}

	advanceTimer(now) {
		if (!this.state.timer.running) return;
		const delta = Math.max(0, now - this.state.timer.lastTick);
		this.state.timer.elapsedMs += delta;
		this.state.timer.lastTick = now;
	}

	#findPieceHit() {
		let closest = null;
		for (const piece of this.state.pieces) {
			if (piece.status === 'placed') continue;
			const hit = this.raycaster.intersectObject(piece.mesh, false)[0];
			if (hit && (!closest || hit.distance < closest.hit.distance)) closest = { piece, hit };
		}
		return closest;
	}

	#beginGrab(piece, hand, hit) {
		if (piece.status === 'placed' || this.state.selectedPieceId !== null) return;
		this.state.selectedPieceId = piece.id;
		this.state.selectedBy = hand.side;
		piece.status = 'selected';
		piece.root.updateWorldMatrix(true, false);
		this.state.dragDistance = THREE.MathUtils.clamp(hit.distance, LAB_CONFIG.grabDistanceMin, LAB_CONFIG.grabDistanceMax);
		hand.ray.at(this.state.dragDistance, this.grabPoint);
		this.grabOffset.copy(piece.root.position).sub(this.grabPoint);
		piece.material.emissive.set('#718d62');
		this.#clearTargetError();
		setMessage(this.state, `${piece.name} selected. Move your hand and release near its matching socket.`, 'info');
	}

	#moveSelected(hand) {
		const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
		if (!piece || piece.status !== 'selected') return;
		hand.ray.at(this.#getGrabDistance(), this.nextPosition).add(this.grabOffset);
		const bounds = LAB_CONFIG.moveBounds;
		this.nextPosition.x = THREE.MathUtils.clamp(this.nextPosition.x, bounds.minX, bounds.maxX);
		this.nextPosition.y = THREE.MathUtils.clamp(this.nextPosition.y, bounds.minY, bounds.maxY);
		this.nextPosition.z = THREE.MathUtils.clamp(this.nextPosition.z, bounds.minZ, bounds.maxZ);
		piece.root.position.copy(this.nextPosition);
	}

	#getGrabDistance() {
		const distance = this.state.dragDistance;
		if (Number.isFinite(distance)) return distance;
		return LAB_CONFIG.grabDistanceMin;
	}

	#releaseSelected(now) {
		const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
		if (!piece || piece.status !== 'selected') {
			this.state.selectedPieceId = null;
			this.state.selectedBy = null;
			return;
		}
		this.#clearTargetError();
		const result = validateDrop(piece, this.state.targets, LAB_CONFIG.assemblyTolerance);
		this.state.selectedPieceId = null;
		this.state.selectedBy = null;
		if (result.accepted) {
			piece.status = 'placed';
			piece.root.position.copy(result.target.position);
			piece.root.quaternion.copy(result.target.quaternion);
			piece.material.emissive.set('#000000');
			setTargetStatus(result.target, 'placed');
			this.#clearTargetError();
			this.audio.playSuccess();
			const progress = getProgress(this.state);
			if (progress === this.state.pieces.length) {
				this.advanceTimer(now);
				this.state.phase = 'complete';
				this.state.timer.running = false;
				setMessage(this.state, `All five parts assembled in ${formatTime(this.state.timer.elapsedMs)}. Excellent work!`, 'success', now);
			} else {
				this.state.phase = 'active';
				setMessage(this.state, `${piece.name} assembled correctly. ${progress} of 5 complete.`, 'success', now);
			}
			return;
		}

		piece.status = 'available';
		piece.material.emissive.set('#000000');
		if (result.target && result.target.status !== 'placed') {
			setTargetStatus(result.target, 'error');
			this.state.ui.errorTargetId = result.target.id;
		}
		piece.material.emissive.set('#b64245');
		this.state.ui.errorPieceId = piece.id;
		this.audio.playError();
		if (result.reason === 'wrong-target') {
			setMessage(this.state, `Wrong socket for ${piece.name}. Match the letter and shape.`, 'error', now);
		} else {
			setMessage(this.state, `Too far from the matching socket. Move closer before releasing.`, 'error', now);
		}
	}

	#pauseTimer(now) {
		this.advanceTimer(now);
		this.state.timer.running = false;
	}

	#expireTargetFeedback(now) {
		if (now < this.state.ui.errorUntil) return;
		const target = this.state.targets.find(item => item.id === this.state.ui.errorTargetId);
		if (target && target.status === 'error') setTargetStatus(target, 'available');
		const piece = this.state.pieces.find(item => item.id === this.state.ui.errorPieceId);
		if (piece && piece.status !== 'placed') piece.material.emissive.set('#000000');
		this.state.ui.errorTargetId = null;
		this.state.ui.errorPieceId = null;
	}

	#clearTargetError() {
		const target = this.state.targets.find(item => item.id === this.state.ui.errorTargetId);
		if (target?.status === 'error') setTargetStatus(target, 'available');
		const piece = this.state.pieces.find(item => item.id === this.state.ui.errorPieceId);
		if (piece && piece.status !== 'placed') piece.material.emissive.set('#000000');
		this.state.ui.errorTargetId = null;
		this.state.ui.errorPieceId = null;
		this.state.ui.errorUntil = 0;
	}

	#setHoverState(controlId, pieceId) {
		this.panel.setHovered(controlId);
		if (this.hoveredPieceId && this.hoveredPieceId !== this.state.selectedPieceId) {
			const previous = this.state.pieces.find(item => item.id === this.hoveredPieceId);
			if (previous && previous.status === 'available') previous.material.emissive.set('#000000');
		}
		if (pieceId && pieceId !== this.state.selectedPieceId) {
			const current = this.state.pieces.find(item => item.id === pieceId);
			if (current && current.status === 'available') current.material.emissive.set('#384b42');
		}
		this.hoveredPieceId = pieceId;
	}
}
