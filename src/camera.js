import * as THREE from 'three';

const EYE_HEIGHT   = 1.2;
const SENSITIVITY  = 0.003;
const FRONT_YAW    = 0;
const DEFAULT_YAW  = Math.PI;
const MIN_FOV = 30;
const MAX_FOV = 120;
const LERP_SPEED  = 0.07;

export function setupCamera(camera, canvas, seats) {
  const row6 = seats.filter((s) => s.row === 1);
  const centerSeat = row6.length === 6 ? row6[2] : seats[0];
  const startX = centerSeat ? centerSeat.position.x : 0;
  const startZ = centerSeat ? centerSeat.position.z : 0;
  const startY = centerSeat && centerSeat.position.y != null ? centerSeat.position.y + EYE_HEIGHT : EYE_HEIGHT;
  const startIdx = centerSeat ? centerSeat.index : -1;

  let yaw   = DEFAULT_YAW;
  let pitch = 0.5;
  const targetPos  = new THREE.Vector3(startX, startY, startZ);
  const currentPos = new THREE.Vector3(startX, startY, startZ);

  let currentSeatIdx = startIdx;

  camera.position.copy(currentPos);
  camera.rotation.order = 'YXZ';

  let isDragging   = false;
  let dragDistance  = 0;
  const prev = { x: 0, y: 0 };

  let fovCb  = null;
  let seatCb = null;
  let hoveredSeat = null;

  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2();

  const allHitMeshes = seats.flatMap(s => s.hitMeshes);

  function findSeatByMesh(mesh) {
    return seats.find(s => s.hitMeshes.includes(mesh));
  }

  function highlight(seat) {
    seat.materials.forEach(m => m.emissive.setHex(0x224466));
  }
  function unhighlight(seat) {
    seat.materials.forEach(m => m.emissive.setHex(0x000000));
  }

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging  = true;
    dragDistance = 0;
    prev.x = e.clientX;
    prev.y = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      yaw   -= dx * SENSITIVITY;
      pitch -= dy * SENSITIVITY;
      pitch  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
      prev.x = e.clientX;
      prev.y = e.clientY;
      canvas.style.cursor = 'grabbing';
      return;
    }

    pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(allHitMeshes);
    const seat = hits.length > 0 ? findSeatByMesh(hits[0].object) : null;

    if (seat !== hoveredSeat) {
      if (hoveredSeat) unhighlight(hoveredSeat);
      hoveredSeat = seat;
      if (seat) highlight(seat);
      canvas.style.cursor = seat ? 'pointer' : 'grab';
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = hoveredSeat ? 'pointer' : 'grab';
  });

  canvas.addEventListener('click', (e) => {
    if (dragDistance > 5) return;
    pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(allHitMeshes);
    if (hits.length > 0) {
      const seat = findSeatByMesh(hits[0].object);
      if (seat) goToSeat(seat);
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.fov = clamp(camera.fov + e.deltaY * 0.05, MIN_FOV, MAX_FOV);
    camera.updateProjectionMatrix();
    if (fovCb) fovCb(camera.fov);
  }, { passive: false });

  // --- touch support ---
  let touchId = null;
  let pinchDist = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragDistance = 0;
      prev.x = e.touches[0].clientX;
      prev.y = e.touches[0].clientY;
      touchId = e.touches[0].identifier;
    } else if (e.touches.length === 2) {
      isDragging = false;
      pinchDist = touchDist(e.touches);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      const dx = t.clientX - prev.x;
      const dy = t.clientY - prev.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      yaw   -= dx * SENSITIVITY;
      pitch -= dy * SENSITIVITY;
      pitch  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
      prev.x = t.clientX;
      prev.y = t.clientY;
    } else if (e.touches.length === 2) {
      const d = touchDist(e.touches);
      const scale = pinchDist / d;
      camera.fov = clamp(camera.fov * scale, MIN_FOV, MAX_FOV);
      camera.updateProjectionMatrix();
      if (fovCb) fovCb(camera.fov);
      pinchDist = d;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      if (isDragging && dragDistance < 15) {
        const t = e.changedTouches[0];
        pointer.x =  (t.clientX / window.innerWidth)  * 2 - 1;
        pointer.y = -(t.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(allHitMeshes);
        if (hits.length > 0) {
          const seat = findSeatByMesh(hits[0].object);
          if (seat) goToSeat(seat);
        }
      }
      isDragging = false;
    }
  }, { passive: true });

  function goToSeat(seat) {
    const eyeY = (seat.position.y ?? 0) + EYE_HEIGHT;
    targetPos.set(seat.position.x, eyeY, seat.position.z);
    currentSeatIdx = seat.index;
    if (seatCb) seatCb(seat.index);
  }

  function goToCenter() {
    targetPos.set(0, EYE_HEIGHT, 0);
    currentSeatIdx = -1;
    yaw   = FRONT_YAW;
    pitch = 0.5;
    if (seatCb) seatCb(-1);
  }

  function update() {
    currentPos.lerp(targetPos, LERP_SPEED);
    camera.position.copy(currentPos);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  return {
    update,
    goToSeat,
    goToCenter,
    setFov(fov) {
      camera.fov = clamp(fov, MIN_FOV, MAX_FOV);
      camera.updateProjectionMatrix();
    },
    getFov()        { return camera.fov; },
    getPosition()   { return { x: currentPos.x, z: currentPos.z }; },
    get currentSeat() { return currentSeatIdx; },
    onFovChange(cb)  { fovCb  = cb; },
    onSeatChange(cb) { seatCb = cb; },
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
