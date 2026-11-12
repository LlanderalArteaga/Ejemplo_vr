import { VRButton } from 'three/addons/webxr/VRButton.js';

export function createSessionControls(renderer, state, elements, callbacks) {
	const sessionInit = {
		requiredFeatures: ['hand-tracking'],
		optionalFeatures: ['local-floor']
	};
	const button = VRButton.createButton(renderer, sessionInit);
	button.id = 'enter-vr-button';
	button.classList.add('btn', 'btn-light', 'btn-lg');
	elements.entrySlot.replaceChildren(button);
	const originalPosition = button.style.position;
	button.style.position = 'static';
	button.style.display = 'inline-flex';
	button.style.width = 'auto';
	button.style.minWidth = '12rem';
	button.style.minHeight = '3.15rem';
	button.style.padding = '.85rem 1.35rem';
	button.style.borderRadius = '999px';
	button.style.fontWeight = '800';
	button.style.margin = '0';

	const onSessionStart = () => {
		state.xr.session = renderer.xr.getSession();
		callbacks.onStart?.(state.xr.session);
		elements.compatibilityStatus.textContent = 'VR session active. Show one or both hands to begin.';
	};
	const onSessionEnd = () => {
		callbacks.onEnd?.();
		state.xr.session = null;
		elements.compatibilityStatus.textContent = 'VR session ended. Enter again to continue or reset the challenge.';
	};
	renderer.xr.addEventListener('sessionstart', onSessionStart);
	renderer.xr.addEventListener('sessionend', onSessionEnd);

	const buttonObserver = new MutationObserver(() => {
		const label = button.textContent.trim();
		if (/NOT SUPPORTED|NOT ALLOWED|UNAVAILABLE|ERROR/i.test(label)) {
			elements.compatibilityStatus.textContent = 'This browser cannot start immersive VR. Try Meta Quest Browser on a secure connection.';
		}
	});
	buttonObserver.observe(button, { childList: true, characterData: true, subtree: true });

	const supportPromise = checkImmersiveSupport(state, elements);
	return {
		button,
		supportPromise,
		dispose() {
			buttonObserver.disconnect();
			renderer.xr.removeEventListener('sessionstart', onSessionStart);
			renderer.xr.removeEventListener('sessionend', onSessionEnd);
			elements.entrySlot.replaceChildren();
			button.style.position = originalPosition;
		}
	};
}

async function checkImmersiveSupport(state, elements) {
	if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') {
		state.xr.supportChecked = true;
		state.xr.supported = false;
		elements.compatibilityStatus.textContent = 'WebXR immersive VR is not available in this browser. The preview is not an immersive session.';
		elements.browserMessage.textContent = 'Open this page in Meta Quest Browser over HTTPS to use hand tracking and immersive VR.';
		elements.browserMessage.classList.remove('d-none');
		return false;
	}
	try {
		const supported = await navigator.xr.isSessionSupported('immersive-vr');
		state.xr.supportChecked = true;
		state.xr.supported = supported;
		if (supported) {
			elements.compatibilityStatus.textContent = 'Immersive VR is supported. Hand tracking is required to enter the activity.';
			return true;
		}
		elements.compatibilityStatus.textContent = 'This browser reports that immersive VR is unavailable.';
		elements.browserMessage.textContent = 'Use Meta Quest Browser on Meta Quest 3, allow immersive VR, and enable hand tracking in headset settings.';
		elements.browserMessage.classList.remove('d-none');
		return false;
	} catch (error) {
		state.xr.supportChecked = true;
		state.xr.supported = false;
		elements.compatibilityStatus.textContent = `Could not check WebXR support: ${error.message}`;
		elements.browserMessage.textContent = 'Check the browser permissions and connection, then reload the page.';
		elements.browserMessage.classList.remove('d-none');
		return false;
	}
}
