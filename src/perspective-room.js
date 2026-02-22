import * as THREE from 'three';

const EDGE_THICK = 0.1;
const EDGE_COLOR = 0xffdd44;

function addPlaneBorders(group, corners) {
  const mat = new THREE.MeshBasicMaterial({ color: EDGE_COLOR });
  const edges = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const len = a.distanceTo(b);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(len, EDGE_THICK, EDGE_THICK),
      mat.clone()
    );
    const mid = a.clone().add(b).multiplyScalar(0.5);
    box.position.copy(mid);
    box.lookAt(b);
    box.rotateY(-Math.PI / 2);
    group.add(box);
    edges.push(box);
  }
  return edges;
}

/**
 * Комната для захвата перспективы (wireframe бокс).
 * Вкл/выкл пол, потолок, стены. Границы плоскостей — жирными линиями.
 */
export function createPerspectiveRoom(scene, {
  w: w0 = 10,
  d: d0 = 16,
  h: h0 = 6,
  showFloor = true,
  showCeil = true,
  showWallBack = true,
  showWallFront = true,
  showWallLeft = true,
  showWallRight = true,
  showBorders = true,
  showColumns = true,
  showScreen = true,
  showStage = true,
  showTower = true,
  gridSize = 0.4,
} = {}) {
  let w = w0, d = d0, h = h0;
  const group = new THREE.Group();
  scene.add(group);

  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });

  function getHwHdHh() {
    return { hw: w / 2, hd: d / 2, hh: h / 2 };
  }
  let { hw, hd, hh } = getHwHdHh();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d, Math.max(1, w / gridSize), Math.max(1, d / gridSize)),
    mat.clone()
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d, Math.max(1, w / gridSize), Math.max(1, d / gridSize)),
    mat.clone()
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;

  const wallBack = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h, Math.max(1, w / gridSize), Math.max(1, h / gridSize)),
    mat.clone()
  );
  wallBack.position.set(0, h / 2, -d / 2);

  const wallFront = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h, Math.max(1, w / gridSize), Math.max(1, h / gridSize)),
    mat.clone()
  );
  wallFront.rotation.y = Math.PI;
  wallFront.position.set(0, h / 2, d / 2);

  const wallLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(d, h, Math.max(1, d / gridSize), Math.max(1, h / gridSize)),
    mat.clone()
  );
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(-w / 2, h / 2, 0);

  const wallRight = new THREE.Mesh(
    new THREE.PlaneGeometry(d, h, Math.max(1, d / gridSize), Math.max(1, h / gridSize)),
    mat.clone()
  );
  wallRight.rotation.y = -Math.PI / 2;
  wallRight.position.set(w / 2, h / 2, 0);

  group.add(floor, ceil, wallBack, wallFront, wallLeft, wallRight);

  /* ─── Высокие элементы для ориентации (отключаемые) ───────── */

  const columnsGroup = new THREE.Group();
  const colRad = 0.25;
  const colSegs = 8;
  let colGeom = new THREE.CylinderGeometry(colRad, colRad, h, colSegs);
  const colPositions = [
    [-hw + colRad, hh, -hd + colRad],
    [hw - colRad, hh, -hd + colRad],
    [hw - colRad, hh, hd - colRad],
    [-hw + colRad, hh, hd - colRad],
  ];
  colPositions.forEach(([x, y, z]) => {
    const col = new THREE.Mesh(colGeom, mat.clone());
    col.position.set(x, y, z);
    columnsGroup.add(col);
  });
  columnsGroup.visible = showColumns;
  group.add(columnsGroup);

  const screenW = 4, screenH = 3;
  const screenGeom = new THREE.PlaneGeometry(screenW, screenH, 4, 3);
  const screen = new THREE.Mesh(screenGeom, mat.clone());
  screen.position.set(0, hh, -hd + 0.01);
  screen.visible = showScreen;
  group.add(screen);

  const stageW = 3, stageD = 1, stageH = 0.4;
  const stageGeom = new THREE.BoxGeometry(stageW, stageH, stageD, 4, 1, 2);
  const stage = new THREE.Mesh(stageGeom, mat.clone());
  stage.position.set(0, stageH / 2, -hd + 0.5);
  stage.visible = showStage;
  group.add(stage);

  /* ─── Башня вдалеке (отключаемая) ─────────────────────────── */

  const towerGroup = new THREE.Group();
  const towerH = 18;
  const towerZ = -hd - 12;
  const towerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.5, towerH - 4, 12),
    mat.clone()
  );
  towerBase.position.set(0, (towerH - 4) / 2, towerZ);
  towerGroup.add(towerBase);
  const towerTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.2, 4, 8),
    mat.clone()
  );
  towerTop.position.set(0, towerH - 2, towerZ);
  towerGroup.add(towerTop);
  const towerSpire = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 3, 6),
    mat.clone()
  );
  towerSpire.position.set(0, towerH + 1.5, towerZ);
  towerGroup.add(towerSpire);
  towerGroup.visible = showTower;
  group.add(towerGroup);

  const floorEdges = addPlaneBorders(group, [
    new THREE.Vector3(-hw, 0, -hd), new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, 0, hd), new THREE.Vector3(-hw, 0, hd),
  ]);
  const ceilEdges = addPlaneBorders(group, [
    new THREE.Vector3(-hw, h, -hd), new THREE.Vector3(hw, h, -hd),
    new THREE.Vector3(hw, h, hd), new THREE.Vector3(-hw, h, hd),
  ]);
  const backEdges = addPlaneBorders(group, [
    new THREE.Vector3(-hw, 0, -hd), new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, h, -hd), new THREE.Vector3(-hw, h, -hd),
  ]);
  const frontEdges = addPlaneBorders(group, [
    new THREE.Vector3(hw, 0, hd), new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(-hw, h, hd), new THREE.Vector3(hw, h, hd),
  ]);
  const leftEdges = addPlaneBorders(group, [
    new THREE.Vector3(-hw, 0, hd), new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(-hw, h, -hd), new THREE.Vector3(-hw, h, hd),
  ]);
  const rightEdges = addPlaneBorders(group, [
    new THREE.Vector3(hw, 0, -hd), new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(hw, h, hd), new THREE.Vector3(hw, h, -hd),
  ]);

  function applyVisibility() {
    floor.visible = showFloor;
    ceil.visible = showCeil;
    wallBack.visible = showWallBack;
    wallFront.visible = showWallFront;
    wallLeft.visible = showWallLeft;
    wallRight.visible = showWallRight;
    columnsGroup.visible = showColumns;
    screen.visible = showScreen;
    stage.visible = showStage;
    towerGroup.visible = showTower;
    const showEdge = (plane) => showBorders && plane;
    floorEdges.forEach((e) => e.visible = showEdge(showFloor));
    ceilEdges.forEach((e) => e.visible = showEdge(showCeil));
    backEdges.forEach((e) => e.visible = showEdge(showWallBack));
    frontEdges.forEach((e) => e.visible = showEdge(showWallFront));
    leftEdges.forEach((e) => e.visible = showEdge(showWallLeft));
    rightEdges.forEach((e) => e.visible = showEdge(showWallRight));
  }
  applyVisibility();

  function updateDimensions(nw, nd, nh) {
    if (nw !== undefined) w = Math.max(4, Math.min(30, nw));
    if (nd !== undefined) d = Math.max(8, Math.min(40, nd));
    if (nh !== undefined) h = Math.max(3, Math.min(15, nh));
    ({ hw, hd, hh } = getHwHdHh());

    floor.geometry.dispose();
    floor.geometry = new THREE.PlaneGeometry(w, d, Math.max(1, w / gridSize), Math.max(1, d / gridSize));
    floor.position.y = 0;

    ceil.geometry.dispose();
    ceil.geometry = new THREE.PlaneGeometry(w, d, Math.max(1, w / gridSize), Math.max(1, d / gridSize));
    ceil.position.y = h;

    wallBack.geometry.dispose();
    wallBack.geometry = new THREE.PlaneGeometry(w, h, Math.max(1, w / gridSize), Math.max(1, h / gridSize));
    wallBack.position.set(0, hh, -hd);
    wallFront.geometry.dispose();
    wallFront.geometry = new THREE.PlaneGeometry(w, h, Math.max(1, w / gridSize), Math.max(1, h / gridSize));
    wallFront.position.set(0, hh, hd);
    wallLeft.geometry.dispose();
    wallLeft.geometry = new THREE.PlaneGeometry(d, h, Math.max(1, d / gridSize), Math.max(1, h / gridSize));
    wallLeft.position.set(-hw, hh, 0);
    wallRight.geometry.dispose();
    wallRight.geometry = new THREE.PlaneGeometry(d, h, Math.max(1, d / gridSize), Math.max(1, h / gridSize));
    wallRight.position.set(hw, hh, 0);

    colGeom.dispose();
    colGeom = new THREE.CylinderGeometry(colRad, colRad, h, colSegs);
    const newColPositions = [
      [-hw + colRad, hh, -hd + colRad],
      [hw - colRad, hh, -hd + colRad],
      [hw - colRad, hh, hd - colRad],
      [-hw + colRad, hh, hd - colRad],
    ];
    columnsGroup.children.forEach((col, i) => {
      col.geometry = colGeom;
      col.position.set(...newColPositions[i]);
    });

    screen.position.set(0, hh, -hd + 0.01);
    stage.position.set(0, stageH / 2, -hd + 0.5);

    const newTowerZ = -hd - 12;
    towerBase.position.set(0, (towerH - 4) / 2, newTowerZ);
    towerTop.position.set(0, towerH - 2, newTowerZ);
    towerSpire.position.set(0, towerH + 1.5, newTowerZ);

    [...floorEdges, ...ceilEdges, ...backEdges, ...frontEdges, ...leftEdges, ...rightEdges].forEach((e) => {
      e.geometry.dispose();
      group.remove(e);
    });
    const corners = [
      [new THREE.Vector3(-hw, 0, -hd), new THREE.Vector3(hw, 0, -hd), new THREE.Vector3(hw, 0, hd), new THREE.Vector3(-hw, 0, hd)],
      [new THREE.Vector3(-hw, h, -hd), new THREE.Vector3(hw, h, -hd), new THREE.Vector3(hw, h, hd), new THREE.Vector3(-hw, h, hd)],
      [new THREE.Vector3(-hw, 0, -hd), new THREE.Vector3(hw, 0, -hd), new THREE.Vector3(hw, h, -hd), new THREE.Vector3(-hw, h, -hd)],
      [new THREE.Vector3(hw, 0, hd), new THREE.Vector3(-hw, 0, hd), new THREE.Vector3(-hw, h, hd), new THREE.Vector3(hw, h, hd)],
      [new THREE.Vector3(-hw, 0, hd), new THREE.Vector3(-hw, 0, -hd), new THREE.Vector3(-hw, h, -hd), new THREE.Vector3(-hw, h, hd)],
      [new THREE.Vector3(hw, 0, -hd), new THREE.Vector3(hw, 0, hd), new THREE.Vector3(hw, h, hd), new THREE.Vector3(hw, h, -hd)],
    ];
    const newFloorEdges = addPlaneBorders(group, corners[0]);
    const newCeilEdges = addPlaneBorders(group, corners[1]);
    const newBackEdges = addPlaneBorders(group, corners[2]);
    const newFrontEdges = addPlaneBorders(group, corners[3]);
    const newLeftEdges = addPlaneBorders(group, corners[4]);
    const newRightEdges = addPlaneBorders(group, corners[5]);
    floorEdges.length = 0;
    floorEdges.push(...newFloorEdges);
    ceilEdges.length = 0;
    ceilEdges.push(...newCeilEdges);
    backEdges.length = 0;
    backEdges.push(...newBackEdges);
    frontEdges.length = 0;
    frontEdges.push(...newFrontEdges);
    leftEdges.length = 0;
    leftEdges.push(...newLeftEdges);
    rightEdges.length = 0;
    rightEdges.push(...newRightEdges);

    applyVisibility();
  }

  return {
    group,
    floor,
    ceil,
    walls: { back: wallBack, front: wallFront, left: wallLeft, right: wallRight },
    setDimensions(nw, nd, nh) { updateDimensions(nw, nd, nh); },
    getDimensions() { return { w, d, h }; },
    setToggles({ floor: f, ceil: c, wallBack: wb, wallFront: wf, wallLeft: wl, wallRight: wr, borders: b, columns: col, screen: sc, stage: st, tower: t } = {}) {
      if (f !== undefined) showFloor = !!f;
      if (c !== undefined) showCeil = !!c;
      if (wb !== undefined) showWallBack = !!wb;
      if (wf !== undefined) showWallFront = !!wf;
      if (wl !== undefined) showWallLeft = !!wl;
      if (wr !== undefined) showWallRight = !!wr;
      if (b !== undefined) showBorders = !!b;
      if (col !== undefined) showColumns = !!col;
      if (sc !== undefined) showScreen = !!sc;
      if (st !== undefined) showStage = !!st;
      if (t !== undefined) showTower = !!t;
      applyVisibility();
    },
  };
}
