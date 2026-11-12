import * as THREE from 'three';

const JOINT_NAMES = [
	'wrist',
	'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
	'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
	'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
	'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
	'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
];

const BONES = [
	['wrist', 'thumb-metacarpal'], ['thumb-metacarpal', 'thumb-phalanx-proximal'], ['thumb-phalanx-proximal', 'thumb-phalanx-distal'], ['thumb-phalanx-distal', 'thumb-tip'],
	...['index', 'middle', 'ring', 'pinky'].flatMap(finger => {
		const prefix = `${finger}-finger`;
		return [
			['wrist', `${prefix}-metacarpal`],
			...['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal'].map((joint, index) => {
				const next = ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'][index];
				return [`${prefix}-${joint}`, `${prefix}-${next}`];
			})
		];
	})
];

const PINCH_START_METERS = 0.023;
const PINCH_RELEASE_METERS = 0.042;
const MAX_RAY_DISTANCE = 2.1;

export class HandTracking {
	constructor(scene, state, onTrackingLost = null) {
		this.scene = scene;
		this.state = state;
		this.onTrackingLost = onTrackingLost;
		this.visuals = new Map([
			['left', createHandVisual(scene, '#74d8cf')],
			['right', createHandVisual(scene, '#c8a7f4')]
		]);
		this.previous = new Map();
		this.snapshots = [];
	}

	update(xrFrame, renderer) {
		this.snapshots = [];
		const session = renderer.xr.getSession();
		const referenceSpace = renderer.xr.getReferenceSpace();
		if (!xrFrame || !session || !referenceSpace) {
			this.#loseAllHands();
			return this.snapshots;
		}

		const seen = new Set();
		for (const inputSource of session.inputSources) {
			if (!inputSource.hand) continue;
			const side = inputSource.handedness;
			if (side !== 'left' && side !== 'right') continue;
			const jointData = readJoints(xrFrame, inputSource.hand, referenceSpace);
			const wrist = jointData.positions.get('wrist');
			const thumbTip = jointData.positions.get('thumb-tip');
			const indexTip = jointData.positions.get('index-finger-tip');
			const indexDistal = jointData.positions.get('index-finger-phalanx-distal');
			const tracked = Boolean(wrist && thumbTip && indexTip);
			seen.add(side);
			const previous = this.previous.get(side) ?? { pinching: false, source: null, tracked: false };
			if (!tracked) {
				this.#hideVisual(side);
				if (previous.tracked) this.onTrackingLost?.(side);
				this.previous.set(side, { pinching: false, source: inputSource, tracked: false });
				continue;
			}

			const visual = this.visuals.get(side);
			updateJointVisual(visual, jointData.positions);
			const rayPose = inputSource.targetRaySpace ? xrFrame.getPose(inputSource.targetRaySpace, referenceSpace) : null;
			const rayOrigin = new THREE.Vector3();
			const rayDirection = new THREE.Vector3();
			let rayValid = false;
			if (rayPose) {
				rayOrigin.set(rayPose.transform.position.x, rayPose.transform.position.y, rayPose.transform.position.z);
				const orientation = new THREE.Quaternion(rayPose.transform.orientation.x, rayPose.transform.orientation.y, rayPose.transform.orientation.z, rayPose.transform.orientation.w);
				rayDirection.set(0, 0, -1).applyQuaternion(orientation).normalize();
				visual.ray.quaternion.copy(orientation);
				visual.ray.position.copy(rayOrigin);
				rayValid = true;
			} else if (indexTip && indexDistal) {
				rayOrigin.copy(indexTip);
				rayDirection.copy(indexTip).sub(indexDistal).normalize();
				visual.ray.position.copy(rayOrigin);
				visual.ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), rayDirection);
				rayValid = rayDirection.lengthSq() > 0.5;
			}
			visual.ray.visible = rayValid;
			visual.rayTip.visible = rayValid;
			if (rayValid) visual.rayTip.position.copy(rayOrigin).addScaledVector(rayDirection, MAX_RAY_DISTANCE);

			const pinchGap = thumbTip.distanceTo(indexTip);
			let pinching = previous.pinching;
			if (!pinching && pinchGap <= PINCH_START_METERS) pinching = true;
			else if (pinching && pinchGap >= PINCH_RELEASE_METERS) pinching = false;
			const sourceChanged = previous.source && previous.source !== inputSource;
			if (sourceChanged && previous.pinching) this.onTrackingLost?.(side);
			const snapshot = {
				side,
				source: inputSource,
				tracked: true,
				rayValid,
				ray: new THREE.Ray(rayOrigin.clone(), rayDirection.clone()),
				pinching,
				pinchStarted: !previous.pinching && pinching,
				pinchEnded: previous.pinching && !pinching,
				pinchGap
			};
			this.snapshots.push(snapshot);
			this.previous.set(side, { pinching, source: inputSource, tracked: true });
		}

		for (const side of ['left', 'right']) {
			if (!seen.has(side)) {
				const previous = this.previous.get(side);
				this.#hideVisual(side);
				if (previous?.tracked || previous?.pinching) this.onTrackingLost?.(side);
				this.previous.set(side, { pinching: false, source: null, tracked: false });
			}
		}

		this.state.hands.left = this.snapshots.some(hand => hand.side === 'left' && hand.tracked);
		this.state.hands.right = this.snapshots.some(hand => hand.side === 'right' && hand.tracked);
		this.state.hands.count = Number(this.state.hands.left) + Number(this.state.hands.right);
		return this.snapshots;
	}

	dispose() {
		for (const visual of this.visuals.values()) {
			this.scene.remove(visual.joints);
			this.scene.remove(visual.bones);
			this.scene.remove(visual.ray);
			this.scene.remove(visual.rayTip);
			visual.joints.geometry.dispose();
			visual.joints.material.dispose();
			visual.bones.geometry.dispose();
			visual.bones.material.dispose();
			visual.ray.geometry.dispose();
			visual.ray.material.dispose();
			visual.rayTip.geometry.dispose();
			visual.rayTip.material.dispose();
		}
	}

	#hideVisual(side) {
		const visual = this.visuals.get(side);
		visual.joints.visible = false;
		visual.bones.visible = false;
		visual.ray.visible = false;
		visual.rayTip.visible = false;
		if (this.state.hands[side]) this.state.hands[side] = false;
	}

	#loseAllHands() {
		for (const side of ['left', 'right']) {
			const previous = this.previous.get(side);
			this.#hideVisual(side);
			if (previous?.tracked || previous?.pinching) this.onTrackingLost?.(side);
			this.previous.set(side, { pinching: false, source: null, tracked: false });
		}
		this.state.hands.left = false;
		this.state.hands.right = false;
		this.state.hands.count = 0;
	}
}

function createHandVisual(scene, color) {
	const geometry = new THREE.SphereGeometry(0.007, 8, 6);
	const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
	const joints = new THREE.InstancedMesh(geometry, material, JOINT_NAMES.length);
	joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	joints.frustumCulled = false;
	scene.add(joints);

	const boneGeometry = new THREE.BufferGeometry();
	boneGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BONES.length * 6), 3).setUsage(THREE.DynamicDrawUsage));
	const bones = new THREE.LineSegments(boneGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.52 }));
	bones.frustumCulled = false;
	scene.add(bones);

	const ray = new THREE.Line(
		new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -MAX_RAY_DISTANCE)]),
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false })
	);
	ray.frustumCulled = false;
	ray.visible = false;
	scene.add(ray);
	const rayTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color }));
	rayTip.visible = false;
	scene.add(rayTip);
	return { joints, bones, ray, rayTip, dummy: new THREE.Object3D() };
}

function readJoints(xrFrame, hand, referenceSpace) {
	const positions = new Map();
	for (const jointName of JOINT_NAMES) {
		const jointSpace = hand.get(jointName);
		if (!jointSpace) continue;
		const pose = xrFrame.getJointPose(jointSpace, referenceSpace);
		if (!pose) continue;
		const point = pose.transform.position;
		positions.set(jointName, new THREE.Vector3(point.x, point.y, point.z));
	}
	return { positions };
}

function updateJointVisual(visual, positions) {
	const dummy = visual.dummy;
	for (let index = 0; index < JOINT_NAMES.length; index += 1) {
		const point = positions.get(JOINT_NAMES[index]);
		if (point) {
			dummy.position.copy(point);
			dummy.scale.setScalar(1);
		} else {
			dummy.position.set(0, -20, 0);
			dummy.scale.setScalar(0.001);
		}
		dummy.updateMatrix();
		visual.joints.setMatrixAt(index, dummy.matrix);
	}
	visual.joints.instanceMatrix.needsUpdate = true;
	const attribute = visual.bones.geometry.getAttribute('position');
	let offset = 0;
	for (const [fromName, toName] of BONES) {
		const from = positions.get(fromName);
		const to = positions.get(toName);
		for (const point of [from, to]) {
			attribute.array[offset++] = point?.x ?? 0;
			attribute.array[offset++] = point?.y ?? -20;
			attribute.array[offset++] = point?.z ?? 0;
		}
	}
	attribute.needsUpdate = true;
	visual.bones.geometry.computeBoundingSphere();
	visual.joints.visible = true;
	visual.bones.visible = true;
}
