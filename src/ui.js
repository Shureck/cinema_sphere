import { BASE_RADIUS } from './dome.js';

export function setupUI(container, { cameraCtrl, media, room }) {
  const { updatePublishBtn } = createUploadPanel(container, media);
  initDragDrop(media);
  const vc = createVideoControls(container, media);
  createRightPanel(container, cameraCtrl);
  createFullscreenButton(container);
  const mm = createMinimap(container, room, cameraCtrl);
  createHelpText(container);

  media.onStateChange((st) => {
    vc.el.classList.toggle('hidden', st.type !== 'video');
    updatePublishBtn();
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
  const wrap = el('div', 'upload-panel-wrap');
  const toggleBtn = el('button', 'upload-panel-toggle');
  toggleBtn.innerHTML = '&#9776;';
  toggleBtn.title = 'Меню';
  toggleBtn.setAttribute('aria-label', 'Меню');

  const panel = el('div', 'upload-panel');
  panel.classList.add('upload-panel-dropdown');

  let open = false;
  const toggle = () => {
    open = !open;
    panel.classList.toggle('open', open);
  };
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });
  document.addEventListener('click', () => {
    if (open) { open = false; panel.classList.remove('open'); }
  });
  panel.addEventListener('click', (e) => e.stopPropagation());

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
      const done = () => {
        const prev = publishBtn.textContent;
        publishBtn.textContent = 'Скопировано!';
        publishBtn.disabled = false;
        setTimeout(() => { publishBtn.textContent = prev; updatePublishBtn(); }, 1500);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareUrl).then(done).catch(tryExecCommand);
      } else {
        tryExecCommand();
      }

      function tryExecCommand() {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        try {
          if (document.execCommand('copy')) done();
          else prompt('Ссылка (скопируйте вручную):', shareUrl);
        } catch {
          prompt('Ссылка (скопируйте вручную):', shareUrl);
        }
        ta.remove();
        publishBtn.disabled = false;
      }
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
      const prog = showUploadProgress();
      try {
        const { putUrl, publicUrl } = await presignWithRetry(presignerUrl, file.name, file.type || 'application/octet-stream', prog.setText);
        prog.setText('Загрузка на S3...');
        prog.setPercent(0);
        let uploaded = false;
        for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
          try {
            await uploadWithProgress(putUrl, file, file.type || 'application/octet-stream', prog.setPercent);
            uploaded = true;
          } catch (e) {
            if (attempt === 2) throw new Error('S3: ' + (e.message || 'CORS или сеть'));
            prog.setText(`Повтор загрузки ${attempt + 2}/3...`);
            prog.setPercent(0);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
        prog.hide();
        media.setSourceUrl(publicUrl);
        updatePublishBtn();
        copyShareLink(publicUrl);
      } catch (e) {
        prog.hide();
        publishBtn.textContent = 'Ошибка: ' + (e.message || 'загрузка');
        setTimeout(() => { publishBtn.textContent = 'Опубликовать'; publishBtn.disabled = false; }, 3000);
      }
      return;
    }

    const prev = publishBtn.textContent;
    publishBtn.textContent = 'Сначала загрузите файл';
    setTimeout(() => { publishBtn.textContent = prev; }, 2500);
  });

  const updatePublishBtn = () => {
    if (media.sourceUrl) {
      publishBtn.textContent = 'Скопировать ссылку';
      publishBtn.title = 'Скопировать ссылку на сферу с контентом';
    } else {
      publishBtn.textContent = 'Опубликовать';
      publishBtn.title = 'Загрузить на S3 и скопировать ссылку на сферу';
    }
  };

  panel.append(fileBtn, fileInput, urlBtn, testPhotoBtn, testGridBtn, publishBtn, convLink);
  wrap.append(toggleBtn, panel);
  container.appendChild(wrap);
  updatePublishBtn();
  return { updatePublishBtn };
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

/* ─── Fullscreen (mobile) ───────────────────────────────── */

function createFullscreenButton(container) {
  const btn = el('button', 'fullscreen-btn');
  btn.innerHTML = '&#x26F6;';
  btn.title = 'На весь экран';
  btn.setAttribute('aria-label', 'На весь экран');

  const updateIcon = () => {
    const isFs = !!document.fullscreenElement;
    document.body.classList.toggle('fullscreen-active', isFs);
    btn.innerHTML = isFs ? '&#10005;' : '&#x26F6;';
    btn.title = isFs ? 'Выйти' : 'На весь экран';
  };

  btn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', updateIcon);

  container.appendChild(btn);
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

/* ─── Presign (XHR для стабильности при QUIC сбоях) ─────── */

function presignWithRetry(url, filename, contentType, setStatus) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ filename, contentType });
    const tryReq = (attempt) => {
      setStatus(attempt ? `Повтор ${attempt}/3...` : 'Подготовка...');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.putUrl && data.publicUrl) resolve(data);
            else reject(new Error(data.error || 'Нет putUrl'));
          } catch {
            reject(new Error('Неверный ответ'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Presigner: ${xhr.status}`));
          } catch {
            reject(new Error(`Presigner: ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => {
        if (attempt < 3) setTimeout(() => tryReq(attempt + 1), 1200);
        else reject(new Error('Сеть не отвечает (connection reset)'));
      };
      xhr.ontimeout = () => {
        if (attempt < 3) setTimeout(() => tryReq(attempt + 1), 1200);
        else reject(new Error('Таймаут'));
      };
      xhr.timeout = 15000;
      xhr.send(body);
    };
    tryReq(1);
  });
}

/* ─── Upload Progress ──────────────────────────────────── */

function showUploadProgress() {
  const overlay = el('div', 'upload-progress-overlay');
  const label = el('div', 'upload-progress-label');
  label.textContent = 'Подготовка...';
  const bar = document.createElement('div');
  bar.className = 'upload-progress-bar';
  const fill = document.createElement('div');
  fill.className = 'upload-progress-fill';
  bar.appendChild(fill);
  overlay.append(label, bar);
  document.getElementById('ui-overlay').appendChild(overlay);

  return {
    setText(t) { label.textContent = t; },
    setPercent(p) { fill.style.width = Math.min(100, Math.max(0, p)) + '%'; },
    hide() { overlay.remove(); },
  };
}

function uploadWithProgress(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
      else onProgress(50);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
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
