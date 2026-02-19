import * as THREE from 'three';
import { createDome } from './dome.js';
import { createRoom } from './room.js';
import { setupCamera } from './camera.js';
import { setupMedia } from './media.js';
import { setupUI } from './ui.js';


const canvas   = document.getElementById('dome-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x050508);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 200,
);

scene.add(new THREE.AmbientLight(0xffffff, 0.08));
scene.add(new THREE.HemisphereLight(0x8888aa, 0x222222, 0.15));

const pointLight = new THREE.PointLight(0xffeedd, 0.3, 30);
pointLight.position.set(0, 2.5, 0);
scene.add(pointLight);

const dome       = createDome(scene);
const room       = createRoom(scene);
const cameraCtrl = setupCamera(camera, canvas, room.seats);
const media      = setupMedia(dome);
const ui         = setupUI(document.getElementById('ui-overlay'), {
  dome, cameraCtrl, media, room,
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(function animate() {
  requestAnimationFrame(animate);
  cameraCtrl.update();
  media.update();
  ui.update();
  renderer.render(scene, camera);
})();
