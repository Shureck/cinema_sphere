import * as THREE from 'three';

// Купол: диаметр 29.4 м, высота 10 м
export const BASE_RADIUS = 29.4 / 2;  // 14.7 м — радиус по основанию
export const DOME_HEIGHT = 10;
export const CURVE_RADIUS =
  (BASE_RADIUS * BASE_RADIUS + DOME_HEIGHT * DOME_HEIGHT) / (2 * DOME_HEIGHT);
export const HALF_ANGLE = Math.asin(BASE_RADIUS / CURVE_RADIUS);
export const TILT_DEG = 5;
export const SPRING_LINE_Y = DOME_HEIGHT - CURVE_RADIUS;  // база купола на уровне пола

const VERT = /* glsl */ `
  varying vec3 vLocalPos;
  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  #define PI 3.14159265359
  uniform sampler2D domeTexture;
  uniform float brightness;
  uniform float gamma;
  varying vec3 vLocalPos;

  void main() {
    vec3 dir = normalize(vLocalPos);
    float theta = acos(clamp(dir.y, -1.0, 1.0));
    float phi   = atan(dir.x, -dir.z);

    float r = clamp(theta / (PI * 0.5), 0.0, 1.0);

    vec2 uv = vec2(
      0.5 - r * 0.5 * sin(phi),
      0.5 + r * 0.5 * cos(phi)
    );

    vec4 c = texture2D(domeTexture, uv);
    vec3 rgb = clamp(c.rgb * brightness, 0.0, 1.0);
    rgb = pow(rgb, vec3(1.0 / gamma));
    gl_FragColor = vec4(rgb, c.a);
  }
`;

export function createDome(scene) {
  const phiMax = Math.acos((CURVE_RADIUS - DOME_HEIGHT) / CURVE_RADIUS);
  const geom = new THREE.SphereGeometry(
    CURVE_RADIUS, 128, 64,
    0, Math.PI * 2,
    0, phiMax
  );

  const material = new THREE.ShaderMaterial({
    uniforms: {
      domeTexture: { value: generateDefaultGrid() },
      brightness:  { value: 1.2 },
      gamma:       { value: 1.15 },
    },
    vertexShader:   VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
  });

  const mesh = new THREE.Mesh(geom, material);

  const pivot = new THREE.Group();
  pivot.position.set(0, SPRING_LINE_Y, 0);
  pivot.rotation.x = TILT_DEG * Math.PI / 180;
  pivot.add(mesh);
  scene.add(pivot);

  return {
    mesh,
    pivot,
    setTexture(texture) {
      material.uniforms.domeTexture.value = texture;
    },
    setBrightness(v) {
      material.uniforms.brightness.value = v;
    },
    setGamma(v) {
      material.uniforms.gamma.value = v;
    },
  };
}

/* ─── Equirectangular → Domemaster shader ───────────────── */

const EQUIRECT_FRAG = /* glsl */ `
  #define PI 3.14159265359
  uniform sampler2D panorama;
  uniform float yaw;
  uniform float pitch;
  uniform float domeFov;
  uniform float brightness;
  uniform float gamma;
  varying vec3 vLocalPos;

  mat3 rotY(float a) {
    float s = sin(a), c = cos(a);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }
  mat3 rotX(float a) {
    float s = sin(a), c = cos(a);
    return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
  }

  void main() {
    vec3 dir = normalize(vLocalPos);
    float theta = acos(clamp(dir.y, -1.0, 1.0));
    float phi   = atan(dir.x, -dir.z) + PI;

    float scaledTheta = theta * domeFov / PI;

    vec3 d = vec3(
      sin(scaledTheta) * sin(phi),
      cos(scaledTheta),
      -sin(scaledTheta) * cos(phi)
    );

    vec3 rd = rotY(yaw) * rotX(pitch) * d;

    float ePhi   = atan(rd.x, -rd.z);
    float eTheta = acos(clamp(rd.y, -1.0, 1.0));
    vec2 uv = vec2(ePhi / (2.0 * PI) + 0.5, 1.0 - eTheta / PI);

    vec4 c = texture2D(panorama, uv);
    vec3 rgb = clamp(c.rgb * brightness, 0.0, 1.0);
    rgb = pow(rgb, vec3(1.0 / gamma));
    gl_FragColor = vec4(rgb, c.a);
  }
`;

function generateEquirectDefault() {
  const w = 2048;
  const h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a2a4a');
  grad.addColorStop(0.5, '#4a6a8a');
  grad.addColorStop(1, '#2a3a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 12) * w, 0);
    ctx.lineTo((i / 12) * w, h);
    ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i / 6) * h);
    ctx.lineTo(w, (i / 6) * h);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FRONT', cx, h * 0.5);
  ctx.fillText('PANORAMA 360°', cx, h * 0.3);
  ctx.fillText('Загрузите панораму', cx, h * 0.7);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createEquirectDome(scene) {
  const geom = new THREE.SphereGeometry(
    BASE_RADIUS, 128, 64,
    0, Math.PI * 2,
    0, Math.PI * 0.5
  );

  const material = new THREE.ShaderMaterial({
    uniforms: {
      panorama:   { value: generateEquirectDefault() },
      yaw:        { value: 0.0 },
      pitch:      { value: 0.0 },
      domeFov:    { value: Math.PI },
      brightness: { value: 1.0 },
      gamma:      { value: 1.0 },
    },
    vertexShader:   VERT,
    fragmentShader: EQUIRECT_FRAG,
    side: THREE.BackSide,
  });

  const mesh = new THREE.Mesh(geom, material);

  const pivot = new THREE.Group();
  pivot.position.set(0, SPRING_LINE_Y, 0);
  pivot.rotation.x = TILT_DEG * Math.PI / 180;
  pivot.add(mesh);
  scene.add(pivot);

  return {
    mesh,
    pivot,
    setTexture(tex)  { material.uniforms.panorama.value = tex; },
    setYaw(v)        { material.uniforms.yaw.value = v; },
    setPitch(v)      { material.uniforms.pitch.value = v; },
    setFov(v)        { material.uniforms.domeFov.value = v; },
    getYaw()         { return material.uniforms.yaw.value; },
    getPitch()       { return material.uniforms.pitch.value; },
    getFov()         { return material.uniforms.domeFov.value; },
    setBrightness(v) { material.uniforms.brightness.value = v; },
    setGamma(v)      { material.uniforms.gamma.value = v; },
  };
}

function generateDefaultGrid() {
  const s = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const cx = s / 2, cy = s / 2, maxR = s * 0.48;

  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, s, s);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 9; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (maxR * i) / 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < Math.PI; a += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(cx + maxR * Math.cos(a), cy + maxR * Math.sin(a));
    ctx.lineTo(cx - maxR * Math.cos(a), cy - maxR * Math.sin(a));
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `bold ${s / 28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FRONT', cx, cy + maxR * 0.88);
  ctx.save();
  ctx.translate(cx, cy - maxR * 0.88);
  ctx.rotate(Math.PI);
  ctx.fillText('BACK', 0, 0);
  ctx.restore();
  ctx.fillText('LEFT',  cx - maxR * 0.88, cy);
  ctx.fillText('RIGHT', cx + maxR * 0.88, cy);

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cv);
  return tex;
}
