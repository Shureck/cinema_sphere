import { BASE_RADIUS } from './dome.js';

export function setupUI(container, { cameraCtrl, media, room }) {
  createUploadPanel(container, media);
  initDragDrop(media);
  const vc = createVideoControls(container, media);
  createRightPanel(container, cameraCtrl);
  const mm = createMinimap(container, room, cameraCtrl);
  createHelpText(container);

  media.onStateChange((st) => {
    vc.el.classList.toggle('hidden', st.type !== 'video');
  });

  return {
    update() {
      vc.update();
      mm.update();
    },
  };
}

/* ─── Upload Panel ─────────────────────────────────────── */

function createUploadPanel(container, media) {
  const panel = el('div', 'upload-panel');

  const fileBtn = el('button', 'upload-btn');
  fileBtn.textContent = 'Загрузить файл';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.style.display = 'none';
  fileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) media.loadFile(fileInput.files[0]);
    fileInput.value = '';
  });

  const urlBtn = el('button', 'upload-btn');
  urlBtn.textContent = 'По URL';
  urlBtn.title = 'Вставить ссылку на фото/видео (например, из Yandex Object Storage)';
  urlBtn.addEventListener('click', () => {
    const url = prompt('Вставьте ссылку на изображение или видео:');
    if (url && url.trim()) media.loadMediaFromURL(url.trim());
  });

  const testPhotoBtn = el('button', 'upload-btn');
  testPhotoBtn.textContent = 'Тестовое фото';
  testPhotoBtn.addEventListener('click', () => {
    media.loadImageFromURL('public/test-image.png', 'test-image.png');
    testPhotoBtn.classList.add('active');
    testGridBtn.classList.remove('active');
  });

  const testGridBtn = el('button', 'upload-btn');
  testGridBtn.textContent = 'Тестовая сетка';
  testGridBtn.addEventListener('click', () => {
    media.loadImageFromURL('public/test-grid.png', 'test-grid.png');
    testGridBtn.classList.add('active');
    testPhotoBtn.classList.remove('active');
  });

  const convLink = document.createElement('a');
  convLink.href = 'converter.html';
  convLink.className = 'upload-btn';
  convLink.textContent = '360° → Dome';
  convLink.style.textDecoration = 'none';

  const publishBtn = el('button', 'upload-btn');
  publishBtn.textContent = 'Опубликовать';
  publishBtn.title = 'Загрузить на S3 и скопировать ссылку на сферу';
  publishBtn.addEventListener('click', async () => {
    const srcUrl = media.sourceUrl;
    const file = media.currentFile;

    const copyShareLink = (publicUrl) => {
      const shareUrl = location.origin + location.pathname + '?media=' + encodeURIComponent(publicUrl);
      navigator.clipboard.writeText(shareUrl).then(() => {
        const prev = publishBtn.textContent;
        publishBtn.textContent = 'Скопировано!';
        publishBtn.disabled = false;
        setTimeout(() => { publishBtn.textContent = prev; }, 1500);
      }).catch(() => {
        prompt('Ссылка на сферу (скопируйте вручную):', shareUrl);
        publishBtn.disabled = false;
      });
    };

    if (srcUrl) {
      copyShareLink(srcUrl);
      return;
    }

    if (file) {
      const presignerUrl = import.meta.env.VITE_PRESIGNER_URL;
      if (!presignerUrl) {
        publishBtn.textContent = 'Настройте VITE_PRESIGNER_URL';
        setTimeout(() => { publishBtn.textContent = 'Опубликовать'; }, 2000);
        return;
      }
      publishBtn.disabled = true;
      publishBtn.textContent = 'Загрузка...';
      try {
        const presignRes = await fetch(presignerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err.error || `Presigner: ${presignRes.status}`);
        }
        const { putUrl, publicUrl } = await presignRes.json();
        const putRes = await fetch(putUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!putRes.ok) throw new Error(`Upload: ${putRes.status}`);
        media.setSourceUrl(publicUrl);
        copyShareLink(publicUrl);
      } catch (e) {
        publishBtn.textContent = 'Ошибка: ' + (e.message || 'загрузка');
        setTimeout(() => { publishBtn.textContent = 'Опубликовать'; publishBtn.disabled = false; }, 3000);
      }
      return;
    }

    const prev = publishBtn.textContent;
    publishBtn.textContent = 'Сначала загрузите файл';
    setTimeout(() => { publishBtn.textContent = prev; }, 2500);
  });

  panel.append(fileBtn, fileInput, urlBtn, testPhotoBtn, testGridBtn, publishBtn, convLink);
  container.appendChild(panel);
}

/* ─── Drag & Drop ──────────────────────────────────────── */

function initDragDrop(media) {
  const overlay = el('div', 'drag-overlay hidden');
  overlay.textContent = 'Перетащите изображение или видео сюда';
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
    if (file) media.loadFile(file);
  });
}

/* ─── Video Controls ───────────────────────────────────── */

function createVideoControls(container, media) {
  const bar = el('div', 'video-controls hidden');

  const playBtn = el('button', 'vc-btn');
  playBtn.textContent = '\u25B6';
  playBtn.addEventListener('click', () => {
    if (media.paused) { media.play(); playBtn.textContent = '\u23F8'; }
    else              { media.pause(); playBtn.textContent = '\u25B6'; }
  });

  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'video-seek';
  seek.min = 0;
  seek.max = 1;
  seek.step = 0.01;
  seek.value = 0;
  let isSeeking = false;
  seek.addEventListener('mousedown', () => { isSeeking = true; });
  seek.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
  seek.addEventListener('input', () => { media.seek(parseFloat(seek.value)); });
  seek.addEventListener('mouseup', () => { isSeeking = false; });
  seek.addEventListener('touchend', () => { isSeeking = false; }, { passive: true });

  const time = el('span', 'video-time');
  time.textContent = '0:00 / 0:00';

  const muteBtn = el('button', 'vc-btn');
  muteBtn.textContent = '\uD83D\uDD07';
  muteBtn.addEventListener('click', () => {
    const muted = media.toggleMute();
    muteBtn.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  });

  bar.append(playBtn, seek, time, muteBtn);
  container.appendChild(bar);

  return {
    el: bar,
    update() {
      if (media.type !== 'video' || !media.video) return;
      if (!isSeeking) {
        seek.max = media.duration || 1;
        seek.value = media.currentTime;
      }
      time.textContent = fmt(media.currentTime) + ' / ' + fmt(media.duration);
      playBtn.textContent = media.paused ? '\u25B6' : '\u23F8';
    },
  };
}

/* ─── Right Panel (FOV) ────────────────────────────────── */

function createRightPanel(container, cameraCtrl) {
  const panel = el('div', 'right-panel');

  const label = el('div', 'fov-label');
  label.textContent = 'FOV';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'fov-slider';
  slider.min = 30;
  slider.max = 120;
  slider.step = 1;
  slider.value = cameraCtrl.getFov();

  const val = el('div', 'fov-label');
  val.textContent = Math.round(cameraCtrl.getFov()) + '°';

  slider.addEventListener('input', () => {
    cameraCtrl.setFov(parseFloat(slider.value));
    val.textContent = Math.round(slider.value) + '°';
  });

  cameraCtrl.onFovChange((fov) => {
    slider.value = fov;
    val.textContent = Math.round(fov) + '°';
  });

  panel.append(label, slider, val);
  container.appendChild(panel);
}

/* ─── Seat Minimap ─────────────────────────────────────── */

function createMinimap(container, room, cameraCtrl) {
  const wrap = el('div', 'seat-map');
  const cv   = document.createElement('canvas');
  cv.width = 160;
  cv.height = 160;
  wrap.appendChild(cv);

  const centerBtn = el('button', 'upload-btn minimap-center-btn');
  centerBtn.textContent = 'В центр';
  centerBtn.addEventListener('click', () => cameraCtrl.goToCenter());
  wrap.appendChild(centerBtn);

  container.appendChild(wrap);

  const ctx = cv.getContext('2d');
  const W = 160, H = 160, CX = W / 2, CY = H / 2;
  const scale = 65 / BASE_RADIUS;

  cv.addEventListener('click', (e) => {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top)  * (H / rect.height);
    const wx =  (mx - CX) / scale;
    const wz = -(my - CY) / scale;

    let best = null, bestD = Infinity;
    for (const s of room.seats) {
      const d = (s.position.x - wx) ** 2 + (s.position.z - wz) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD < 6) cameraCtrl.goToSeat(best);
    else cameraCtrl.goToCenter();
  });

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CX, CY, BASE_RADIUS * scale, 0, Math.PI * 2);
    ctx.stroke();

    for (const s of room.seats) {
      const sx = CX + s.position.x * scale;
      const sy = CY - s.position.z * scale;
      ctx.fillStyle = s.index === cameraCtrl.currentSeat
        ? 'rgba(255,180,60,0.9)'
        : 'rgba(80,160,255,0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const pos = cameraCtrl.getPosition();
    ctx.fillStyle = '#ff4455';
    ctx.beginPath();
    ctx.arc(CX + pos.x * scale, CY - pos.z * scale, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FRONT', CX, H - 4);
  }

  return { update: draw };
}

/* ─── Help Text ────────────────────────────────────────── */

function createHelpText(container) {
  const div = el('div', 'help-text');
  div.innerHTML = [
    'ЛКМ + движение — вращение',
    'Колесо мыши — масштаб',
    'Клик по креслу — переход',
  ].join('<br>');
  container.appendChild(div);
}

/* ─── Helpers ──────────────────────────────────────────── */

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function fmt(sec) {
  if (!sec || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
