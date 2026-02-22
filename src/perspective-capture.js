import * as THREE from 'three';

const DM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = 1.0 - uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const CUBEMAP_TO_DOME_FRAG = /* glsl */ `
  #define PI 3.14159265359
  precision highp float;

  uniform samplerCube envMap;
  uniform float fov;
  uniform float fitScale;
  uniform float rimWidth;
  varying vec2 vUv;

  void main() {
    vec2 pos = (1.0 - vUv) * 2.0 - 1.0;
    pos.y = -pos.y;
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

    float theta = r_tex * (fov * 0.5);
    float phi = atan(pos.x, -pos.y) + PI;

    vec3 dir = vec3(
      sin(theta) * sin(phi),
      cos(theta),
      -sin(theta) * cos(phi)
    );

    vec4 c = textureCube(envMap, normalize(dir));

    float drawRim = (rimWidth > 0.0 && r >= 1.0 - rimWidth) ? 1.0 : 0.0;
    gl_FragColor = mix(vec4(c.rgb, 1.0), vec4(1.0, 1.0, 1.0, 1.0), drawRim);
  }
`;

/**
 * CubeCamera: рендерит сцену в cubemap из заданной позиции/ориентации.
 */
export function createRoomCapture(renderer, roomScene, {
  cubeSize = 1024,
  near = 0.05,
  far = 200,
} = {}) {
  const cubeRT = new THREE.WebGLCubeRenderTarget(cubeSize, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });

  const cubeCam = new THREE.CubeCamera(near, far, cubeRT);
  roomScene.add(cubeCam);

  return {
    cubeRT,
    cubeCam,
    update() {
      cubeCam.update(renderer, roomScene);
    },
    setPosition(x, y, z) {
      cubeCam.position.set(x, y, z);
    },
    setRotation(x, y, z) {
      cubeCam.rotation.set(x, y, z);
    },
  };
}

/**
 * Кубмап → Domemaster (180°) в RenderTarget.
 */
export function createCubemapToDomemaster(renderer, { size = 2048 } = {}) {
  const rt = new THREE.WebGLRenderTarget(size, size);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const mat = new THREE.ShaderMaterial({
    vertexShader: DM_VERT,
    fragmentShader: CUBEMAP_TO_DOME_FRAG,
    uniforms: {
      envMap: { value: null },
      fov: { value: Math.PI },
      fitScale: { value: 1.0 },
      rimWidth: { value: 0.008 },
    },
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);

  return {
    rt,
    material: mat,
    renderFromCubemap(cubeTexture) {
      mat.uniforms.envMap.value = cubeTexture;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      return rt.texture;
    },
    setFov(v) { mat.uniforms.fov.value = v; },
    setFitScale(v) { mat.uniforms.fitScale.value = v; },
    setRimWidth(v) { mat.uniforms.rimWidth.value = v; },
  };
}
