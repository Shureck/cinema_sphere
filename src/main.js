import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createDome } from './dome.js';
import { createRoom } from './room.js';
import { setupCamera } from './camera.js';
import { setupMedia } from './media.js';
import { setupUI } from './ui.js';


const canvas   = document.getElementById('dome-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.xr.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 200,
);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
scene.add(new THREE.HemisphereLight(0xa0a0b0, 0x404050, 0.6));

const pointLight = new THREE.PointLight(0xffeedd, 0.9, 50);
pointLight.position.set(0, 2.5, 0);
scene.add(pointLight);

const dome       = createDome(scene);
const room       = createRoom(scene);
const cameraCtrl = setupCamera(camera, canvas, room.seats);
const media      = setupMedia(dome);
const ui         = setupUI(document.getElementById('ui-overlay'), {
  dome, cameraCtrl, media, room,
});

// Показывать кнопку VR только при поддержке WebXR (иначе не показывать "VR NOT SUPPORTED")
if ('xr' in navigator) {
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) {
      document.getElementById('ui-overlay').appendChild(VRButton.createButton(renderer));
    }
  });
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
  cameraCtrl.update();
  media.update();
  ui.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
