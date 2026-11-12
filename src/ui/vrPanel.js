import * as THREE from 'three';
import { createHudTexture, createTextPlane, drawHud } from './canvasUi.js';

export function createVrPanel(scene, actions) {
	const group = new THREE.Group();
	const { canvas, texture } = createHudTexture();
	drawHud(canvas, actions.getState());
	const panel = new THREE.Mesh(
		new THREE.PlaneGeometry(0.72, 0.984),
		new THREE.MeshBasicMaterial({ map: texture, transparent: false, side: THREE.DoubleSide, depthWrite: true })
	);
	group.add(panel);

	const controls = [
		createControl('reset', 'RESET LAB', -0.17, 0x2f5961, actions.reset),
		createControl('exit', 'EXIT VR', 0.17, 0x73484a, actions.exit)
	];
	for (const control of controls) group.add(control.group);
	scene.add(group);

	let lastRevision = -1;
	let lastTimeSecond = -1;
	let hoveredControlId = null;
	const cameraPosition = new THREE.Vector3();
	const cameraQuaternion = new THREE.Quaternion();
	const forward = new THREE.Vector3();
	const right = new THREE.Vector3();
	const up = new THREE.Vector3();

	return {
		group,
		controls: controls.map(control => control.hitMesh),
		anchor(camera) {
			camera.updateWorldMatrix(true, false);
			camera.getWorldPosition(cameraPosition);
			camera.getWorldQuaternion(cameraQuaternion);
			forward.set(0, 0, -1).applyQuaternion(cameraQuaternion).normalize();
			right.set(1, 0, 0).applyQuaternion(cameraQuaternion).normalize();
			up.set(0, 1, 0).applyQuaternion(cameraQuaternion).normalize();
			group.position.copy(cameraPosition).addScaledVector(forward, 0.98).addScaledVector(right, -0.52).addScaledVector(up, -0.08);
			group.lookAt(cameraPosition);
		},
		update(state, now) {
			const timeSecond = Math.floor(now / 1000);
			if (lastRevision !== state.ui.revision || lastTimeSecond !== timeSecond) {
				drawHud(canvas, state, now);
				texture.needsUpdate = true;
				lastRevision = state.ui.revision;
				lastTimeSecond = timeSecond;
			}
		},
		setHovered(controlId) {
			if (hoveredControlId === controlId) return;
			hoveredControlId = controlId;
			for (const control of controls) {
				const active = control.id === controlId;
				control.hitMesh.material.color.set(active ? '#d3fff0' : control.baseColor);
				control.hitMesh.scale.setScalar(active ? 1.07 : 1);
			}
		},
		dispose() {
			scene.remove(group);
			texture.dispose();
			panel.geometry.dispose();
			panel.material.dispose();
			for (const control of controls) {
				control.hitMesh.geometry.dispose();
				control.hitMesh.material.dispose();
				control.label.geometry.dispose();
				control.label.material.map?.dispose();
				control.label.material.dispose();
			}
		}
	};
}

function createControl(id, label, x, color, action) {
	const group = new THREE.Group();
	group.position.set(x, -0.405, 0.018);
	const hitMesh = new THREE.Mesh(
		new THREE.BoxGeometry(0.30, 0.105, 0.035),
		new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.08 })
	);
	hitMesh.userData.controlId = id;
	hitMesh.userData.action = action;
	group.add(hitMesh);
	const labelPlane = createTextPlane(label, { worldWidth: 0.27, worldHeight: 0.075, width: 512, height: 128, fontSize: 40, background: 'rgba(0,0,0,0)', color: '#f6fbf8' });
	labelPlane.position.z = 0.022;
	group.add(labelPlane);
	return { id, group, hitMesh, label: labelPlane, baseColor: `#${color.toString(16).padStart(6, '0')}`, action };
}
