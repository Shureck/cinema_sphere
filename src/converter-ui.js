export function setupConverterUI(container, { dome, cameraCtrl, loadPanorama, renderDomemaster }) {
  createTopBar(container, loadPanorama);
  createControlPanel(container, dome);
  createRenderPanel(container, renderDomemaster);
  initDragDrop(loadPanorama);
  createHelpText(container);

  return {};
}

/* ─── Top Bar: upload + back link ────────────────────────── */

function createTopBar(container, loadPanorama) {
  const bar = el('div', 'conv-top-bar');

  const backLink = el('a', 'conv-btn');
  backLink.href = 'index.html';
  backLink.textContent = '← Dome Viewer';
  bar.appendChild(backLink);

  const fileBtn = el('button', 'conv-btn conv-btn-primary');
  fileBtn.textContent = 'Загрузить панораму 360°';
  const fileInput = document.createElement('input');
  fileInput.type   = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  fileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadPanorama(fileInput.files[0]);
    fileInput.value = '';
  });

  bar.append(fileBtn, fileInput);
  container.appendChild(bar);
}

/* ─── Control Panel: yaw / pitch / fov sliders ───────────── */

function createControlPanel(container, dome) {
  const panel = el('div', 'conv-controls');

  const title = el('div', 'conv-controls-title');
  title.textContent = 'Управление проекцией';
  panel.appendChild(title);

  const yawGroup = sliderGroup({
    label: 'Поворот',
    min: -180, max: 180, step: 1, value: 0, suffix: '°',
    onChange(v) { dome.setYaw(v * Math.PI / 180); },
  });
  panel.appendChild(yawGroup.el);

  const pitchGroup = sliderGroup({
    label: 'Наклон',
    min: -90, max: 90, step: 1, value: 0, suffix: '°',
    onChange(v) { dome.setPitch(v * Math.PI / 180); },
  });
  panel.appendChild(pitchGroup.el);

  const fovGroup = sliderGroup({
    label: 'FOV купола',
    min: 60, max: 300, step: 1, value: 180, suffix: '°',
    onChange(v) { dome.setFov(v * Math.PI / 180); },
  });
  panel.appendChild(fovGroup.el);

  const resetBtn = el('button', 'conv-btn conv-btn-small');
  resetBtn.textContent = 'Сброс';
  resetBtn.addEventListener('click', () => {
    yawGroup.reset();
    pitchGroup.reset();
    fovGroup.reset();
    dome.setYaw(0);
    dome.setPitch(0);
    dome.setFov(Math.PI);
  });
  panel.appendChild(resetBtn);

  container.appendChild(panel);
}

/* ─── Render Panel: resolution + render button ───────────── */

function createRenderPanel(container, renderDomemaster) {
  const panel = el('div', 'conv-render-panel');

  const label = el('span', 'conv-render-label');
  label.textContent = 'Разрешение:';
  panel.appendChild(label);

  const sizes = [2048, 4096, 8192];
  let selectedSize = 4096;

  const btns = sizes.map(size => {
    const btn = el('button', 'conv-btn conv-size-btn');
    btn.textContent = size + '';
    if (size === selectedSize) btn.classList.add('active');
    btn.addEventListener('click', () => {
      selectedSize = size;
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    panel.appendChild(btn);
    return btn;
  });

  const renderBtn = el('button', 'conv-btn conv-btn-render');
  renderBtn.textContent = 'Рендер';
  renderBtn.addEventListener('click', () => {
    renderBtn.disabled = true;
    renderBtn.textContent = 'Рендеринг…';
    setTimeout(() => {
      renderDomemaster(selectedSize);
      renderBtn.disabled = false;
      renderBtn.textContent = 'Рендер';
    }, 50);
  });
  panel.appendChild(renderBtn);

  container.appendChild(panel);
}

/* ─── Drag & Drop ──────────────────────────────────────── */

function initDragDrop(loadPanorama) {
  const overlay = el('div', 'drag-overlay hidden');
  overlay.textContent = 'Перетащите панораму 360° сюда';
  document.getElementById('ui-overlay').appendChild(overlay);

  let counter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    counter++;
    if (counter === 1) overlay.classList.remove('hidden');
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    counter--;
    if (counter <= 0) { counter = 0; overlay.classList.add('hidden'); }
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    counter = 0;
    overlay.classList.add('hidden');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) loadPanorama(file);
  });
}

/* ─── Help Text ──────────────────────────────────────────── */

function createHelpText(container) {
  const div = el('div', 'help-text');
  div.innerHTML = [
    'ЛКМ + движение — вращение камеры',
    'Колесо мыши — масштаб камеры',
    'Слайдеры — настройка проекции',
  ].join('<br>');
  container.appendChild(div);
}

/* ─── Slider group helper ────────────────────────────────── */

function sliderGroup({ label, min, max, step, value, suffix, onChange }) {
  const wrap = el('div', 'conv-slider-group');

  const lbl = el('div', 'conv-slider-label');
  lbl.textContent = label;
  wrap.appendChild(lbl);

  const row = el('div', 'conv-slider-row');

  const slider = document.createElement('input');
  slider.type  = 'range';
  slider.className = 'conv-slider';
  slider.min   = min;
  slider.max   = max;
  slider.step  = step;
  slider.value = value;

  const val = el('span', 'conv-slider-value');
  val.textContent = value + suffix;

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    val.textContent = v + suffix;
    onChange(v);
  });

  row.append(slider, val);
  wrap.appendChild(row);

  return {
    el: wrap,
    reset() {
      slider.value = value;
      val.textContent = value + suffix;
    },
  };
}

/* ─── Helpers ────────────────────────────────────────────── */

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
