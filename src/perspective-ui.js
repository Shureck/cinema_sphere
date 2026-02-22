export function setupPerspectiveUI(container, {
  dome,
  room,
  cubemapToDomemaster,
  exportDomemaster,
  getCameraState,
  setCameraState,
}) {
  createTopBar(container);
  createControlPanel(container, { room, cubemapToDomemaster, exportDomemaster, getCameraState, setCameraState });
  createHelpText(container);
  return {};
}

function createTopBar(container) {
  const bar = document.createElement('div');
  bar.className = 'conv-top-bar';

  const backLink = document.createElement('a');
  backLink.href = 'index.html';
  backLink.className = 'conv-btn';
  backLink.textContent = '← Dome Viewer';
  bar.appendChild(backLink);

  const title = document.createElement('span');
  title.className = 'conv-btn';
  title.textContent = 'Перспектива';
  title.style.opacity = '0.8';
  bar.appendChild(title);

  container.appendChild(bar);
}

function sliderGroup({ label, min, max, step, value, suffix, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'conv-slider-group';

  const lbl = document.createElement('div');
  lbl.className = 'conv-slider-label';
  lbl.textContent = label;
  wrap.appendChild(lbl);

  const row = document.createElement('div');
  row.className = 'conv-slider-row';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'conv-slider';
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;

  const val = document.createElement('span');
  val.className = 'conv-slider-value';
  val.textContent = value + suffix;

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    val.textContent = v + suffix;
    onChange(v);
  });

  row.append(slider, val);
  wrap.appendChild(row);

  return { el: wrap, slider, val, value };
}

function createControlPanel(container, { room, cubemapToDomemaster, exportDomemaster, getCameraState, setCameraState }) {
  const panel = document.createElement('div');
  panel.className = 'conv-controls';

  const title = document.createElement('div');
  title.className = 'conv-controls-title';
  title.textContent = 'Управление';
  panel.appendChild(title);

  const floorToggle = createToggle('Пол', true, (v) => room.setToggles({ floor: v }));
  panel.appendChild(floorToggle);

  const ceilToggle = createToggle('Потолок', true, (v) => room.setToggles({ ceil: v }));
  panel.appendChild(ceilToggle);

  const wallBackToggle = createToggle('Стена задняя', true, (v) => room.setToggles({ wallBack: v }));
  panel.appendChild(wallBackToggle);

  const wallFrontToggle = createToggle('Стена передняя', true, (v) => room.setToggles({ wallFront: v }));
  panel.appendChild(wallFrontToggle);

  const wallLeftToggle = createToggle('Стена левая', true, (v) => room.setToggles({ wallLeft: v }));
  panel.appendChild(wallLeftToggle);

  const wallRightToggle = createToggle('Стена правая', true, (v) => room.setToggles({ wallRight: v }));
  panel.appendChild(wallRightToggle);

  const bordersToggle = createToggle('Жирное обрамление', true, (v) => room.setToggles({ borders: v }));
  panel.appendChild(bordersToggle);

  const rimToggle = createToggle('Белый ободок domemaster', true, (v) => {
    if (cubemapToDomemaster) cubemapToDomemaster.setRimWidth(v ? 0.008 : 0);
  });
  panel.appendChild(rimToggle);

  const towerToggle = createToggle('Башня вдалеке', true, (v) => room.setToggles({ tower: v }));
  panel.appendChild(towerToggle);

  const columnsToggle = createToggle('Колонны', true, (v) => room.setToggles({ columns: v }));
  panel.appendChild(columnsToggle);

  const screenToggle = createToggle('Экран', true, (v) => room.setToggles({ screen: v }));
  panel.appendChild(screenToggle);

  const stageToggle = createToggle('Сцена', true, (v) => room.setToggles({ stage: v }));
  panel.appendChild(stageToggle);

  const dims = room.getDimensions ? room.getDimensions() : { w: 10, d: 16, h: 6 };
  const depthSlider = sliderGroup({
    label: 'Глубина комнаты',
    min: 8, max: 40, step: 1, value: dims.d, suffix: ' м',
    onChange(v) { room.setDimensions?.(undefined, v, undefined); },
  });
  panel.appendChild(depthSlider.el);

  const heightSlider = sliderGroup({
    label: 'Высота потолка',
    min: 3, max: 15, step: 0.5, value: dims.h, suffix: ' м',
    onChange(v) { room.setDimensions?.(undefined, undefined, v); },
  });
  panel.appendChild(heightSlider.el);

  const posX = sliderGroup({
    label: 'Позиция X',
    min: -10, max: 10, step: 0.5, value: 0, suffix: '',
    onChange(v) { setCameraState({ cameraPos: { ...getCameraState().cameraPos, x: v } }); },
  });
  panel.appendChild(posX.el);

  const posY = sliderGroup({
    label: 'Позиция Y',
    min: 0, max: 6, step: 0.2, value: 3, suffix: '',
    onChange(v) { setCameraState({ cameraPos: { ...getCameraState().cameraPos, y: v } }); },
  });
  panel.appendChild(posY.el);

  const posZ = sliderGroup({
    label: 'Позиция Z',
    min: -8, max: 8, step: 0.5, value: 4, suffix: '',
    onChange(v) { setCameraState({ cameraPos: { ...getCameraState().cameraPos, z: v } }); },
  });
  panel.appendChild(posZ.el);

  const yaw = sliderGroup({
    label: 'Поворот',
    min: -180, max: 180, step: 1, value: 0, suffix: '°',
    onChange(v) { setCameraState({ cameraYaw: (v * Math.PI) / 180 }); },
  });
  panel.appendChild(yaw.el);

  const pitch = sliderGroup({
    label: 'Наклон',
    min: -90, max: 90, step: 1, value: 11, suffix: '°',
    onChange(v) { setCameraState({ cameraPitch: (v * Math.PI) / 180 }); },
  });
  panel.appendChild(pitch.el);

  const fov = sliderGroup({
    label: 'Перспектива',
    min: 60, max: 180, step: 1, value: 180, suffix: '°',
    onChange(v) { setCameraState({ domeFov: (v * Math.PI) / 180 }); },
  });
  panel.appendChild(fov.el);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'conv-btn conv-btn-small';
  resetBtn.textContent = 'Сброс камеры';
  resetBtn.addEventListener('click', () => {
    setCameraState({
      cameraPos: { x: 0, y: 3, z: 4 },
      cameraYaw: 0,
      cameraPitch: 0.2,
      domeFov: Math.PI,
    });
    posX.slider.value = 0;
    posX.val.textContent = '0';
    posY.slider.value = 3;
    posY.val.textContent = '3';
    posZ.slider.value = 4;
    posZ.val.textContent = '4';
    yaw.slider.value = 0;
    yaw.val.textContent = '0°';
    pitch.slider.value = 11;
    pitch.val.textContent = '11°';
    fov.slider.value = 180;
    fov.val.textContent = '180°';
  });
  panel.appendChild(resetBtn);

  const renderBtn = document.createElement('button');
  renderBtn.className = 'conv-btn conv-btn-render';
  renderBtn.textContent = 'Рендер domemaster';
  renderBtn.style.marginTop = '8px';
  renderBtn.addEventListener('click', () => {
    renderBtn.disabled = true;
    renderBtn.textContent = 'Рендеринг…';
    setTimeout(() => {
      exportDomemaster();
      renderBtn.disabled = false;
      renderBtn.textContent = 'Рендер domemaster';
    }, 100);
  });
  panel.appendChild(renderBtn);

  container.appendChild(panel);
}

function createToggle(label, initial, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'conv-slider-group';
  wrap.style.marginBottom = '4px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';

  const lbl = document.createElement('span');
  lbl.className = 'conv-slider-label';
  lbl.textContent = label;
  lbl.style.minWidth = '70px';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initial;
  input.addEventListener('change', () => onChange(input.checked));

  row.appendChild(lbl);
  row.appendChild(input);
  wrap.appendChild(row);
  return wrap;
}

function createHelpText(container) {
  const div = document.createElement('div');
  div.className = 'help-text';
  div.innerHTML = [
    'ЛКМ + движение — вращение камеры в зале (орбита вокруг купола)',
    'Колесо мыши — приближение/удаление',
    'Слайдеры — позиция и поворот камеры захвата комнаты',
  ].join('<br>');
  container.appendChild(div);
}
