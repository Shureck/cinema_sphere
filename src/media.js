import * as THREE from 'three';

export function setupMedia(dome) {
  let currentType = null;
  let videoEl     = null;
  let videoTex    = null;
  let stateCb     = null;

  function cleanup() {
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
      videoEl = null;
    }
    if (videoTex) {
      videoTex.dispose();
      videoTex = null;
    }
  }

  function loadImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      cleanup();
      dome.setTexture(tex);
      dome.setBrightness(1.0);
      dome.setGamma(1.0);
      currentType = 'image';
      if (stateCb) stateCb({ type: 'image', name: file.name });
    };
    img.src = url;
  }

  function loadImageFromURL(url, name) {
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      cleanup();
      dome.setTexture(tex);
      dome.setBrightness(1.0);
      dome.setGamma(1.0);
      currentType = 'image';
      if (stateCb) stateCb({ type: 'image', name: name || url.split('/').pop() });
    });
  }

  function loadVideo(file) {
    cleanup();
    const url = URL.createObjectURL(file);
    videoEl = document.createElement('video');
    videoEl.src = url;
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.muted = true;

    videoTex = new THREE.VideoTexture(videoEl);
    dome.setTexture(videoTex);
    dome.setBrightness(1.0);
    dome.setGamma(1.0);

    currentType = 'video';
    videoEl.play().catch(() => {});
    if (stateCb) stateCb({ type: 'video', name: file.name });
  }

  function loadFile(file) {
    if (!file) return;
    if (file.type.startsWith('image/')) loadImage(file);
    else if (file.type.startsWith('video/')) loadVideo(file);
  }

  return {
    loadFile,
    loadImageFromURL,
    get type()        { return currentType; },
    get video()       { return videoEl; },
    get paused()      { return videoEl ? videoEl.paused : true; },
    get currentTime() { return videoEl ? videoEl.currentTime : 0; },
    get duration()    { return videoEl ? videoEl.duration || 0 : 0; },
    play()   { videoEl?.play().catch(() => {}); },
    pause()  { videoEl?.pause(); },
    seek(t)  { if (videoEl) videoEl.currentTime = t; },
    toggleMute() {
      if (videoEl) videoEl.muted = !videoEl.muted;
      return videoEl ? videoEl.muted : true;
    },
    update() { /* VideoTexture auto-updates */ },
    onStateChange(cb) { stateCb = cb; },
  };
}
