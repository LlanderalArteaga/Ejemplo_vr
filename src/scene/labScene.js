import * as THREE from 'three';
import { createTextPlane } from '../ui/canvasUi.js';

export const TABLETOP_Y = 0.80;
const PART_X = [-0.60, -0.30, 0, 0.30, 0.60];
const COLORS = Object.freeze({ cube: 0xe7a36d, sphere: 0x74c8dc, cone: 0xc0a0f2, cylinder: 0xf0cf76, prism: 0xf08f9a });
const PARTS = [
	{ id: 'cube', name: 'CUBE', color: COLORS.cube, centerY: TABLETOP_Y + 0.08, geometry: () => new THREE.BoxGeometry(0.15, 0.15, 0.15), targetGeometry: () => new THREE.BoxGeometry(0.19, 0.025, 0.19) },
	{ id: 'sphere', name: 'SPHERE', color: COLORS.sphere, centerY: TABLETOP_Y + 0.095, geometry: () => new THREE.SphereGeometry(0.09, 24, 16), targetGeometry: () => new THREE.TorusGeometry(0.105, 0.009, 6, 32) },
	{ id: 'cone', name: 'CONE', color: COLORS.cone, centerY: TABLETOP_Y + 0.095, geometry: () => new THREE.ConeGeometry(0.09, 0.18, 24), targetGeometry: () => new THREE.CylinderGeometry(0.12, 0.12, 0.025, 3) },
	{ id: 'cylinder', name: 'CYLINDER', color: COLORS.cylinder, centerY: TABLETOP_Y + 0.09, geometry: () => new THREE.CylinderGeometry(0.08, 0.08, 0.17, 24), targetGeometry: () => new THREE.TorusGeometry(0.10, 0.009, 6, 32) },
	{ id: 'prism', name: 'PRISM', color: COLORS.prism, centerY: TABLETOP_Y + 0.085, geometry: () => new THREE.CylinderGeometry(0.095, 0.095, 0.16, 3), targetGeometry: () => new THREE.CylinderGeometry(0.125, 0.125, 0.025, 3) }
];

export function createLabScene(previewElement) {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#0b131a');
	scene.fog = new THREE.Fog('#0b131a', 5, 12);
	const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 25);
	camera.position.set(0, 1.55, 2.25);
	camera.lookAt(0, 0.98, -0.85);

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.setSize(previewElement.clientWidth || 640, previewElement.clientHeight || 340, false);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.15;
	renderer.xr.enabled = true;
	renderer.xr.setReferenceSpaceType('local-floor');
	previewElement.appendChild(renderer.domElement);

	scene.add(new THREE.HemisphereLight(0xcde8ef, 0x28323a, 2.1));
	const keyLight = new THREE.DirectionalLight(0xffe6cb, 2.0);
	keyLight.position.set(-2.5, 4, 2.5);
	scene.add(keyLight);
	const rimLight = new THREE.DirectionalLight(0x76c8d5, 1.0);
	rimLight.position.set(2, 2.5, -3);
	scene.add(rimLight);

	createRoom(scene);
	createTable(scene);
	const targets = createTargets(scene);
	const pieces = createPieces(scene);

	const resizeObserver = new ResizeObserver(() => {
		const width = Math.max(1, previewElement.clientWidth);
		const height = Math.max(1, previewElement.clientHeight);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	});
	resizeObserver.observe(previewElement);

	return { scene, camera, renderer, pieces, targets, disposeLayout: () => resizeObserver.disconnect() };
}

function createRoom(scene) {
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(5.5, 5.5),
		new THREE.MeshStandardMaterial({ color: '#18252d', roughness: 0.95, metalness: 0 })
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.set(0, -0.015, -0.9);
	scene.add(floor);
	const grid = new THREE.GridHelper(4, 20, '#49616a', '#263943');
	grid.position.set(0, 0.002, -0.9);
	grid.material.transparent = true;
	grid.material.opacity = 0.22;
	scene.add(grid);
	const backWall = new THREE.Mesh(
		new THREE.PlaneGeometry(5.5, 3.5),
		new THREE.MeshBasicMaterial({ color: '#101b22' })
	);
	backWall.position.set(0, 1.75, -2.9);
	scene.add(backWall);
}

function createTable(scene) {
	const top = new THREE.Mesh(
		new THREE.BoxGeometry(1.72, 0.075, 1.38),
		new THREE.MeshStandardMaterial({ color: '#293941', roughness: 0.68, metalness: 0.12 })
	);
	top.position.set(0, TABLETOP_Y - 0.0375, -0.88);
	scene.add(top);
	const edge = new THREE.Mesh(
		new THREE.BoxGeometry(1.74, 0.018, 1.40),
		new THREE.MeshStandardMaterial({ color: '#6c9c92', roughness: 0.55, metalness: 0.15 })
	);
	edge.position.set(0, TABLETOP_Y - 0.075, -0.88);
	scene.add(edge);
	for (const x of [-0.72, 0.72]) {
		for (const z of [-1.43, -0.33]) {
			const leg = new THREE.Mesh(
				new THREE.BoxGeometry(0.075, 0.72, 0.075),
				new THREE.MeshStandardMaterial({ color: '#26343a', roughness: 0.8 })
			);
			leg.position.set(x, 0.36, z);
			scene.add(leg);
		}
	}
	const centerLine = new THREE.Mesh(
		new THREE.BoxGeometry(1.45, 0.004, 0.008),
		new THREE.MeshBasicMaterial({ color: '#53716e' })
	);
	centerLine.position.set(0, TABLETOP_Y + 0.004, -0.88);
	scene.add(centerLine);
}

function createTargets(scene) {
	return PARTS.map((spec, index) => {
		const x = PART_X[index];
		const z = -1.17;
		const group = new THREE.Group();
		group.position.set(x, TABLETOP_Y + 0.012, z);
		const targetMaterial = new THREE.MeshStandardMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.16, transparent: true, opacity: 0.66, roughness: 0.6, metalness: 0.08 });
		const plate = new THREE.Mesh(spec.targetGeometry(), targetMaterial);
		plate.position.y = 0;
		if (spec.id === 'sphere' || spec.id === 'cylinder') plate.rotation.x = -Math.PI / 2;
		group.add(plate);
		const center = new THREE.Mesh(
			new THREE.CircleGeometry(0.035, 24),
			new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
		);
		center.rotation.x = -Math.PI / 2;
		center.position.y = 0.014;
		group.add(center);
		scene.add(group);
		const label = createTextPlane(`${String.fromCharCode(65 + index)} · ${spec.name}`, { worldWidth: 0.25, worldHeight: 0.045, height: 100, fontSize: 42, background: 'rgba(12, 20, 26, 0.96)', color: '#e8efeb' });
		label.position.set(x, TABLETOP_Y + 0.09, z + 0.18);
		scene.add(label);
		return {
			id: spec.id,
			name: spec.name,
			group,
			plate,
			center,
			label,
			position: new THREE.Vector3(x, spec.centerY, z),
			quaternion: new THREE.Quaternion(),
			baseColor: spec.color,
			status: 'available'
		};
	});
}

function createPieces(scene) {
	return PARTS.map((spec, index) => {
		const root = new THREE.Group();
		root.position.set(PART_X[index], spec.centerY, -0.49);
		root.userData.pieceId = spec.id;
		const material = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.34, metalness: 0.08, emissive: '#000000', emissiveIntensity: 0.4 });
		const mesh = new THREE.Mesh(spec.geometry(), material);
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		mesh.userData.pieceId = spec.id;
		root.add(mesh);
		const label = createTextPlane(`${String.fromCharCode(65 + index)} · ${spec.name}`, { worldWidth: 0.25, worldHeight: 0.045, height: 100, fontSize: 42, background: 'rgba(12, 20, 26, 0.96)', color: '#f4efe6' });
		label.position.set(0, 0.16, 0.10);
		root.add(label);
		scene.add(root);
		return {
			id: spec.id,
			name: spec.name,
			status: 'available',
			root,
			mesh,
			material,
			color: spec.color,
			startPosition: root.position.clone(),
			startQuaternion: root.quaternion.clone(),
			targetId: spec.id
		};
	});
}

export function setTargetStatus(target, status) {
	target.status = status;
	if (status === 'placed') {
		target.plate.material.color.set('#74e0a2');
		target.plate.material.emissive.set('#3aa96b');
		target.plate.material.emissiveIntensity = 0.75;
		target.plate.material.opacity = 0.95;
		target.center.material.color.set('#b7ffd0');
	} else if (status === 'error') {
		target.plate.material.color.set('#ff7774');
		target.plate.material.emissive.set('#c93544');
		target.plate.material.emissiveIntensity = 0.8;
		target.plate.material.opacity = 0.94;
		target.center.material.color.set('#ffc0b7');
	} else {
		target.plate.material.color.set(target.baseColor);
		target.plate.material.emissive.set(target.baseColor);
		target.plate.material.emissiveIntensity = 0.16;
		target.plate.material.opacity = 0.66;
		target.center.material.color.set(target.baseColor);
	}
}
