import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createDome } from './dome.js';
import { createRoom } from './room.js';
import { setupCamera } from './camera.js';
import { setupMedia } from './media.js';
import { setupUI } from './ui.js';

/** Высота глаз сидящего человека (м) — для камеры и смещения VR */
const EYE_HEIGHT_SITTING = 1.2;
/** Вертикальный FOV, близкий к человеческому (~60°) */
const HUMAN_VERTICAL_FOV = 60;

const canvas   = document.getElementById('dome-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.xr.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(
  HUMAN_VERTICAL_FOV, window.innerWidth / window.innerHeight, 0.1, 200,
);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
scene.add(new THREE.HemisphereLight(0xa0a0b0, 0x404050, 0.6));

const pointLight = new THREE.PointLight(0xffeedd, 0.9, 50);
pointLight.position.set(0, 2.5, 0);
scene.add(pointLight);

const xrRig = new THREE.Group();
scene.add(xrRig);

const dome       = createDome(xrRig);
const room       = createRoom(xrRig);

renderer.xr.addEventListener('sessionstart', async () => {
  xrRig.rotation.y = Math.PI;
  const baseRef = renderer.xr.getReferenceSpace();
  if (baseRef && typeof baseRef.getOffsetReferenceSpace === 'function') {
    const offset = new XRRigidTransform({ x: 0, y: -EYE_HEIGHT_SITTING, z: 0 });
    renderer.xr.setReferenceSpace(baseRef.getOffsetReferenceSpace(offset));
  }
});
renderer.xr.addEventListener('sessionend', () => {
  xrRig.rotation.y = 0;
  renderer.xr.setReferenceSpace(null);
});
const cameraCtrl = setupCamera(camera, canvas, room.seats);
const media      = setupMedia(dome);
const ui         = setupUI(document.getElementById('ui-overlay'), {
  dome, cameraCtrl, media, room,
});

// Кнопка XR/VR — всегда показываем (на десктопе VRButton изначально ставит display:none)
const vrSlot = document.querySelector('.vr-button-slot');
if (vrSlot) {
  vrSlot.appendChild(VRButton.createButton(renderer));
  // VRButton скрывает кнопку до ответа isSessionSupported; принудительно показываем
  const showVrButton = () => {
    const el = vrSlot.querySelector('#VRButton') || vrSlot.querySelector('a');
    if (el) el.style.display = '';
  };
  if ('xr' in navigator) {
    navigator.xr.isSessionSupported('immersive-vr').then(showVrButton).catch(showVrButton);
  } else {
    showVrButton();
  }
  setTimeout(showVrButton, 500);
}

const params = new URLSearchParams(location.search);
const mediaUrl = params.get('media');
if (mediaUrl) {
  try {
    media.loadMediaFromURL(decodeURIComponent(mediaUrl));
  } catch (_) {}
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  dome.update?.();
  cameraCtrl.update();
  media.update();
  ui.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
