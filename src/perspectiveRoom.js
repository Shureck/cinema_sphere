import * as THREE from 'three';

const W = 12;
const D = 8;
const H = 6;
const WIRE_COLOR = 0xffffff;

export function createPerspectiveRoom(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const mat = new THREE.MeshBasicMaterial({
    color: WIRE_COLOR,
    wireframe: true,
    side: THREE.DoubleSide,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D, 8, 6),
    mat.clone(),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D, 8, 6),
    mat.clone(),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, 0);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H, 8, 6),
    mat.clone(),
  );
  back.position.set(0, H / 2, -D / 2);

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H, 8, 6),
    mat.clone(),
  );
  front.position.set(0, H / 2, D / 2);
  front.rotation.y = Math.PI;

  const left = new THREE.Mesh(
    new THREE.PlaneGeometry(D, H, 6, 6),
    mat.clone(),
  );
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, H / 2, 0);

  const right = new THREE.Mesh(
    new THREE.PlaneGeometry(D, H, 6, 6),
    mat.clone(),
  );
  right.rotation.y = -Math.PI / 2;
  right.position.set(W / 2, H / 2, 0);

  scene.add(floor);
  scene.add(ceiling);
  scene.add(back);
  scene.add(front);
  scene.add(left);
  scene.add(right);

  const camera = new THREE.PerspectiveCamera(170, 1, 0.1, 100);
  camera.position.set(0, H / 2, 0);
  camera.rotation.order = 'YXZ';
  camera.rotation.x = -Math.PI / 2 + 0.25;

  const size = 2048;
  const renderTarget = new THREE.WebGLRenderTarget(size, size);

  function setVisible(floorOn, wallsOn, ceilingOn) {
    floor.visible = floorOn;
    ceiling.visible = ceilingOn;
    back.visible = wallsOn;
    front.visible = wallsOn;
    left.visible = wallsOn;
    right.visible = wallsOn;
  }

  function setPosition(x, y, z) {
    camera.position.set(x, y, z);
  }

  function setRotation(yaw, pitch) {
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  function getPosition() {
    return {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };
  }

  function getRotation() {
    return {
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
    };
  }

  function update() {
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  function getTexture() {
    return renderTarget.texture;
  }

  function exportToPNG(webglRenderer, filename = 'domemaster.png') {
    const w = renderTarget.width;
    const h = renderTarget.height;
    const pixels = new Uint8Array(w * h * 4);
    webglRenderer.readRenderTargetPixels(renderTarget, 0, 0, w, h, pixels);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < h; i++) {
      const srcRow = (h - 1 - i) * w * 4;
      const dstRow = i * w * 4;
      for (let j = 0; j < w * 4; j++) imgData.data[dstRow + j] = pixels[srcRow + j];
    }
    ctx.putImageData(imgData, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    a.click();
  }

  function dispose() {
    renderTarget.dispose();
  }

  return {
    scene,
    camera,
    renderTarget,
    setVisible,
    setPosition,
    setRotation,
    getPosition,
    getRotation,
    getTexture,
    exportToPNG,
    update,
    dispose,
    bounds: { w: W, d: D, h: H },
  };
}
