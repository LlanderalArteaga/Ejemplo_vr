import { LAB_CONFIG } from '../state/labState.js';

export function validateDrop(piece, targets, tolerance = LAB_CONFIG.assemblyTolerance) {
	if (!piece || piece.status === 'placed') return { accepted: false, reason: 'locked', target: null, distance: Infinity };
	let nearestTarget = null;
	let nearestDistance = Infinity;
	for (const target of targets) {
		const distance = piece.root.position.distanceTo(target.position);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestTarget = target;
		}
	}
	if (!nearestTarget || nearestDistance > tolerance) {
		return { accepted: false, reason: 'too-far', target: nearestTarget, distance: nearestDistance };
	}
	if (nearestTarget.id !== piece.targetId) {
		return { accepted: false, reason: 'wrong-target', target: nearestTarget, distance: nearestDistance };
	}
	return { accepted: true, reason: 'correct', target: nearestTarget, distance: nearestDistance };
}
