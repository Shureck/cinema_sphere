import * as THREE from 'three';
import { createEquirectDome, DOME_FIT_SCALE } from './dome.js';
import { createRoom } from './room.js';
import { setupCamera } from './camera.js';
import { setupConverterUI } from './converter-ui.js';

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

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
scene.add(new THREE.HemisphereLight(0xa0a0b0, 0x404050, 0.6));

const pointLight = new THREE.PointLight(0xffeedd, 0.9, 50);
pointLight.position.set(0, 2.5, 0);
scene.add(pointLight);

const dome       = createEquirectDome(scene);
const room       = createRoom(scene);
const cameraCtrl = setupCamera(camera, canvas, room.seats);

let panoramaTexture = null;

function loadPanorama(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (panoramaTexture) panoramaTexture.dispose();
    panoramaTexture = new THREE.Texture(img);
    panoramaTexture.needsUpdate = true;
    panoramaTexture.wrapS = THREE.RepeatWrapping;
    panoramaTexture.wrapT = THREE.ClampToEdgeWrapping;
    panoramaTexture.minFilter = THREE.LinearFilter;
    panoramaTexture.magFilter = THREE.LinearFilter;
    dome.setTexture(panoramaTexture);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/* ─── Domemaster render & export ─────────────────────────── */

const RENDER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RENDER_FRAG = /* glsl */ `
  #define PI 3.14159265359
  uniform sampler2D panorama;
  uniform float yaw;
  uniform float pitch;
  uniform float domeFov;
  uniform float fitScale;
  varying vec2 vUv;

  mat3 rotY(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }
  mat3 rotX(float a) {
    float s = sin(a), c = cos(a);
    return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
  }

  void main() {
    vec2 pos = (1.0 - vUv) * 2.0 - 1.0;
    float r = length(pos);

    if (r > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float r_tex = r * fitScale;

    if (r_tex > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float theta = r_tex * domeFov;
    float phi   = atan(pos.x, -pos.y) + PI;

    vec3 d = vec3(
      sin(theta) * sin(phi),
      cos(theta),
      -sin(theta) * cos(phi)
    );

    vec3 rd = rotY(yaw) * rotX(pitch) * d;

    float ePhi   = atan(rd.x, -rd.z);
    float eTheta = acos(clamp(rd.y, -1.0, 1.0));
    vec2 uv = vec2(ePhi / (2.0 * PI) + 0.5, 1.0 - eTheta / PI);

    gl_FragColor = texture2D(panorama, uv);
  }
`;

function renderDomemaster(size) {
  if (!panoramaTexture) return;

  const rt = new THREE.WebGLRenderTarget(size, size);
  const exportCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const exportScene  = new THREE.Scene();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      panorama: { value: panoramaTexture },
      yaw:      { value: dome.getYaw() },
      pitch:    { value: dome.getPitch() },
      domeFov:  { value: dome.getFov() },
      fitScale: { value: dome.getFitScale?.() ?? DOME_FIT_SCALE },
    },
    vertexShader:   RENDER_VERT,
    fragmentShader: RENDER_FRAG,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  exportScene.add(quad);

  renderer.setRenderTarget(rt);
  renderer.render(exportScene, exportCamera);
  renderer.setRenderTarget(null);

  const pixels = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);

  const cv  = document.createElement('canvas');
  cv.width  = size;
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
    const a   = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'domemaster.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');

  rt.dispose();
  material.dispose();
  quad.geometry.dispose();
}

/* ─── UI ─────────────────────────────────────────────────── */

const ui = setupConverterUI(document.getElementById('ui-overlay'), {
  dome,
  cameraCtrl,
  loadPanorama,
  renderDomemaster,
});

/* ─── Resize & loop ──────────────────────────────────────── */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(function animate() {
  requestAnimationFrame(animate);
  cameraCtrl.update();
  renderer.render(scene, camera);
})();
