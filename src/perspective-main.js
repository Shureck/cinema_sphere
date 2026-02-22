import * as THREE from 'three';
import { createDome } from './dome.js';
import { createPerspectiveRoom } from './perspective-room.js';
import { createRoomCapture, createCubemapToDomemaster } from './perspective-capture.js';
import { setupPerspectiveUI } from './perspective-ui.js';

const canvas = document.getElementById('dome-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

/* ─── Основная сцена (купол + предпросмотр) ───────────────── */

const mainScene = new THREE.Scene();
mainScene.background = new THREE.Color(0x050508);

const mainCamera = new THREE.PerspectiveCamera(
  80, window.innerWidth / window.innerHeight, 0.1, 200,
);

const orbitTarget = new THREE.Vector3(0, 4, 0);
let orbitYaw = 0;
let orbitPitch = 0.4;
let orbitRadius = 22;
const SENSITIVITY = 0.003;

function updateMainCamera() {
  const x = orbitTarget.x + orbitRadius * Math.sin(orbitPitch) * Math.sin(orbitYaw);
  const y = orbitTarget.y + orbitRadius * Math.cos(orbitPitch);
  const z = orbitTarget.z + orbitRadius * Math.sin(orbitPitch) * Math.cos(orbitYaw);
  mainCamera.position.set(x, y, z);
  mainCamera.lookAt(orbitTarget);
}

mainScene.add(new THREE.AmbientLight(0xffffff, 0.45));
mainScene.add(new THREE.HemisphereLight(0xa0a0b0, 0x404050, 0.6));

const pointLight = new THREE.PointLight(0xffeedd, 0.9, 50);
pointLight.position.set(0, 2.5, 0);
mainScene.add(pointLight);

const dome = createDome(mainScene);

/* ─── Сцена комнаты для захвата ───────────────────────────── */

const roomScene = new THREE.Scene();
roomScene.background = new THREE.Color(0x111118);

roomScene.add(new THREE.AmbientLight(0xffffff, 0.6));
roomScene.add(new THREE.DirectionalLight(0xffffff, 0.8));

const room = createPerspectiveRoom(roomScene, {
  w: 10, d: 16, h: 6,
  showFloor: true, showCeil: true, showBorders: true,
  gridSize: 0.4,
});

const roomCapture = createRoomCapture(renderer, roomScene, { cubeSize: 1024 });
const cubemapToDomemaster = createCubemapToDomemaster(renderer, { size: 2048 });

/* ─── Камера захвата комнаты (управляется слайдерами) ──────── */

let cameraYaw = 0;
let cameraPitch = 0.2;
let cameraPos = { x: 0, y: 3, z: 4 };
let domeFov = Math.PI;

function syncRoomCamera() {
  roomCapture.setPosition(cameraPos.x, cameraPos.y, cameraPos.z);
  roomCapture.cubeCam.rotation.order = 'YXZ';
  roomCapture.cubeCam.rotation.set(cameraPitch, cameraYaw, 0);
  cubemapToDomemaster.setFov(domeFov);
}

/* ─── Перетаскивание — вращение камеры в зале (орбита вокруг купола) ── */

let isDragging = false;
const prev = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  prev.x = e.clientX;
  prev.y = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  orbitYaw -= dx * SENSITIVITY;
  orbitPitch -= dy * SENSITIVITY;
  orbitPitch = Math.max(0.1, Math.min(Math.PI - 0.1, orbitPitch));
  prev.x = e.clientX;
  prev.y = e.clientY;
  updateMainCamera();
});

window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbitRadius = Math.max(8, Math.min(50, orbitRadius - e.deltaY * 0.02));
  updateMainCamera();
}, { passive: false });

updateMainCamera();

/* ─── Экспорт domemaster в PNG ─────────────────────────────── */

function exportDomemasterPNG(size = 2048, filename = 'perspective_domemaster.png') {
  roomCapture.update();
  cubemapToDomemaster.renderFromCubemap(roomCapture.cubeRT.texture);

  const dmRt = cubemapToDomemaster.rt;
  const pixels = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(dmRt, 0, 0, size, size, pixels);

  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4;
    const dst = y * size * 4;
    img.data.set(pixels.subarray(src, src + size * 4), dst);
  }
  ctx.putImageData(img, 0, 0);

  cv.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

/* ─── UI ──────────────────────────────────────────────────── */

setupPerspectiveUI(document.getElementById('ui-overlay'), {
  dome,
  room,
  cubemapToDomemaster,
  exportDomemaster: () => exportDomemasterPNG(),
  getCameraState: () => ({ cameraPos, cameraYaw, cameraPitch, domeFov }),
  setCameraState: (s) => {
    if (s.cameraPos) cameraPos = { ...cameraPos, ...s.cameraPos };
    if (s.cameraYaw !== undefined) cameraYaw = s.cameraYaw;
    if (s.cameraPitch !== undefined) cameraPitch = s.cameraPitch;
    if (s.domeFov !== undefined) domeFov = s.domeFov;
  },
});

/* ─── Resize ──────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  mainCamera.aspect = window.innerWidth / window.innerHeight;
  mainCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ─── Render loop ─────────────────────────────────────────── */

function animate() {
  requestAnimationFrame(animate);
  syncRoomCamera();
  roomCapture.update();
  const domeMasterTex = cubemapToDomemaster.renderFromCubemap(roomCapture.cubeRT.texture);
  dome.setTexture(domeMasterTex);
  renderer.render(mainScene, mainCamera);
}
animate();
