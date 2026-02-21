import * as THREE from 'three';
import { BASE_RADIUS } from './dome.js';

const SEAT_COLOR = 0x4a8acc;
const SEAT_FRAME_COLOR = 0x353540;

const ROW_COUNT = 8;
const ROW_Z_START = -10;
const ROW_Z_END = 10;
const ROW_Y_BACK = 0;      // нижние кресла
const ROW_Y_FRONT = 3.5;     // верхний ряд (3.5 м)
const SEATS_PER_ROW_FRONT = 5;
const SEATS_PER_ROW_BACK = 13;
const SEAT_SPACING_X = 0.65;

export function createRoom(scene) {
  const floorGeom = new THREE.CircleGeometry(BASE_RADIUS + 3, 64);
  floorGeom.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    floorGeom,
    new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.85 }),
  );
  scene.add(floor);

  const wallHeight = 4;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(BASE_RADIUS + 2, BASE_RADIUS + 2, wallHeight, 64, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x38384a,
      roughness: 0.9,
      side: THREE.BackSide,
    }),
  );
  wall.position.y = wallHeight * 0.5;
  scene.add(wall);

  const rimGeom = new THREE.TorusGeometry(BASE_RADIUS + 2, 0.04, 8, 64);
  rimGeom.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(
    rimGeom,
    new THREE.MeshStandardMaterial({ color: 0x505065, roughness: 0.6 }),
  );
  rim.position.y = wallHeight;
  scene.add(rim);

  const cushionGeom = new THREE.BoxGeometry(0.52, 0.07, 0.46);
  const frameGeom   = new THREE.BoxGeometry(0.48, 0.34, 0.44);
  const backGeom    = new THREE.BoxGeometry(0.48, 0.32, 0.05);

  const seats = [];
  let idx = 0;

  for (let ri = 0; ri < ROW_COUNT; ri++) {
    const t = ri / (ROW_COUNT - 1);
    const z = ROW_Z_START + t * (ROW_Z_END - ROW_Z_START);
    const y = ROW_Y_FRONT + t * (ROW_Y_BACK - ROW_Y_FRONT);
    const count = Math.round(SEATS_PER_ROW_FRONT + t * (SEATS_PER_ROW_BACK - SEATS_PER_ROW_FRONT));

    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const x = (u - 0.5) * (count - 1) * SEAT_SPACING_X;

      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.lookAt(0, 0, -50);

      const frameMat = new THREE.MeshStandardMaterial({
        color: SEAT_FRAME_COLOR, roughness: 0.85,
      });
      const frame = new THREE.Mesh(frameGeom, frameMat);
      frame.position.y = 0.17;
      group.add(frame);

      const cushionMat = new THREE.MeshStandardMaterial({
        color: SEAT_COLOR, roughness: 0.55,
      });
      const cushion = new THREE.Mesh(cushionGeom, cushionMat);
      cushion.position.y = 0.375;
      group.add(cushion);

      const backMat = new THREE.MeshStandardMaterial({
        color: SEAT_COLOR, roughness: 0.55,
      });
      const back = new THREE.Mesh(backGeom, backMat);
      back.position.set(0, 0.52, 0.20);
      group.add(back);

      scene.add(group);

      seats.push({
        group,
        hitMeshes: [frame, cushion, back],
        materials: [cushionMat, backMat],
        position: { x, y, z },
        row: ri,
        index: idx,
      });
      idx++;
    }
  }

  return { seats };
}
