import * as THREE from 'three';

export const BASE_RADIUS = 18;
export const DOME_HEIGHT = 8;
export const CURVE_RADIUS =
  (BASE_RADIUS * BASE_RADIUS + DOME_HEIGHT * DOME_HEIGHT) / (2 * DOME_HEIGHT);
export const HALF_ANGLE = Math.asin(BASE_RADIUS / CURVE_RADIUS);
export const TILT_DEG = 5;
export const SPRING_LINE_Y = 4;

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
  const geom = new THREE.SphereGeometry(
    BASE_RADIUS, 128, 64,
    0, Math.PI * 2,
    0, Math.PI * 0.5
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
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
