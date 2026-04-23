// =================== CODE CŨ (giữ nguyên) ===================
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const audio = document.getElementById("audio-player");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const playPauseImg = playPauseBtn.querySelector("img");
  const repeatBtn = document.getElementById("repeat-btn");
  const repeatImg = repeatBtn.querySelector("img");
  const progress = document.getElementById("progress-slider");
  const volume = document.getElementById("volume-slider");
  const timeDisplay = document.getElementById("time-display");
  const songTitle = document.getElementById("song-title");
  const playlistBtn = document.getElementById("playlist-btn");
  const songSelector = document.getElementById("song-selector");
  let objectUrl = null;

  const state = {
    playing: false,
    repeating: false,
    dragging: false,
    rafId: null,
    hiddenTicker: null,
    lastDisplayedSecond: -1,
  };

  function formatTime(sec) {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  function updateTimeText(current, duration) {
    timeDisplay.textContent = `${formatTime(current)} / ${formatTime(
      duration || 0
    )}`;
  }
  function updateProgressVisual(current, duration) {
    if (!Number.isFinite(duration) || duration <= 0) {
      progress.style.setProperty("--value-percent", "0%");
      return;
    }
    const percent = (current / duration) * 100;
    progress.style.setProperty("--value-percent", `${percent}%`);
  }
  function updateProgressUI(current, duration, forceText = false) {
    progress.value = current || 0;
    updateProgressVisual(current || 0, duration || 0);
    const sec = Math.floor(current || 0);
    if (forceText || sec !== state.lastDisplayedSecond) {
      updateTimeText(current || 0, duration || 0);
      state.lastDisplayedSecond = sec;
    }
  }

  function loop() {
    if (!state.dragging && audio.duration) {
      updateProgressUI(audio.currentTime, audio.duration, false);
    }
    state.rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (!state.rafId) state.rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden" && state.playing) {
      stopLoop();
      if (!state.hiddenTicker) {
        state.hiddenTicker = setInterval(() => {
          if (!state.dragging && audio.duration) {
            updateProgressUI(audio.currentTime, audio.duration, false);
          }
        }, 200);
      }
    } else {
      if (state.hiddenTicker) {
        clearInterval(state.hiddenTicker);
        state.hiddenTicker = null;
      }
      if (state.playing) startLoop();
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  async function togglePlayPause() {
    if (
      (audio.paused && !Number.isFinite(audio.duration)) ||
      (!audio.src && audio.paused)
    ) {
      songSelector.click();
      return;
    }
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (e) {
      console.error("Play failed:", e);
    }
  }

  function toggleRepeat() {
    state.repeating = !state.repeating;
    audio.loop = state.repeating;
    repeatImg.src = state.repeating ? "img/repeat1.png" : "img/repeat.png";
    repeatImg.alt = state.repeating ? "Repeat One" : "Repeat Off";
  }

  playPauseBtn.addEventListener("click", togglePlayPause);
  repeatBtn.addEventListener("click", toggleRepeat);
  playlistBtn.addEventListener("click", () => songSelector.click()); // GIỮ NGUYÊN

  songSelector.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    songTitle.textContent = file.name.replace(/\.[^/.]+$/, "");

    const progressEl = document.getElementById("progress-slider");
    progressEl.value = 0;
    progressEl.max = 0;
    state.lastDisplayedSecond = -1;
    updateProgressVisual(0, 1);
    updateTimeText(0, 0);

    try {
      await audio.play();
    } catch (err) {
      console.error(err);
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
    progress.max = dur > 0 ? dur : 1;
    updateProgressUI(audio.currentTime || 0, dur || 0, true);
  });
  audio.addEventListener("play", () => {
    state.playing = true;
    playPauseImg.src = "img/pause.png";
    playPauseImg.alt = "Pause";
    startLoop();
  });
  audio.addEventListener("pause", () => {
    state.playing = false;
    playPauseImg.src = "img/play.png";
    playPauseImg.alt = "Play";
    stopLoop();
    updateProgressUI(audio.currentTime || 0, audio.duration || 0, true);
  });
  audio.addEventListener("ended", () => {
    if (!state.repeating) {
      state.playing = false;
      playPauseImg.src = "img/play.png";
      playPauseImg.alt = "Play";
      stopLoop();
      audio.currentTime = 0;
      updateProgressUI(0, audio.duration || progress.max || 0, true);
    }
  });
  audio.addEventListener("timeupdate", () => {
    if (!state.rafId && !state.dragging)
      updateProgressUI(audio.currentTime || 0, audio.duration || 0, false);
  });

  function updateVolumeProgress() {
    const progressPct = (volume.value / volume.max) * 100;
    volume.style.setProperty("--progress", progressPct + "%");
  }

  progress.addEventListener("pointerdown", (e) => {
    state.dragging = true;
    progress.setPointerCapture?.(e.pointerId);
  });
  progress.addEventListener("input", () => {
    const target = Number(progress.value) || 0;
    const duration = audio.duration || progress.max || 0;
    updateProgressVisual(target, duration);
    updateTimeText(target, duration);
  });
  function commitSeek() {
    const target = Number(progress.value) || 0;
    if (Number.isFinite(target)) {
      if (typeof audio.fastSeek === "function") audio.fastSeek(target);
      else audio.currentTime = target;
    }
    state.dragging = false;
    if (!state.playing)
      updateProgressUI(
        audio.currentTime || target,
        audio.duration || progress.max || 0,
        true
      );
  }
  progress.addEventListener("pointerup", commitSeek);
  progress.addEventListener("pointercancel", () => (state.dragging = false));
  progress.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") commitSeek();
  });

  updateProgressVisual(0, 1);
  updateTimeText(0, 0);
});
// =================== HẾT CODE CŨ ===================

// =================== BỔ SUNG: Library / Playlist Overlay (đã dọn trùng lặp) ===================
document.addEventListener("DOMContentLoaded", () => {
  // DOM refs
  const playlistBtn = document.getElementById("playlist-btn");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const audio = document.getElementById("audio-player");
  const songTitle = document.getElementById("song-title");

  const overlay = document.getElementById("library-overlay");
  const backdrop = document.getElementById("lib-backdrop");
  const btnClose = document.getElementById("library-close-btn");
  const btnAdd = document.getElementById("library-add-btn");
  const btnNewAlbum = document.getElementById("library-new-album-btn");
  const searchInput = document.getElementById("library-search-input");
  const albumListEl = document.getElementById("album-list");
  const songListEl = document.getElementById("song-list");
  const fileInput = document.getElementById("library-file-input");

  const songCtxMenu = document.getElementById("library-context-menu");
  const ctxRemoveFromPlaylist = songCtxMenu.querySelector(
    '[data-action="remove-from-playlist"]'
  );
  const albumPicker = document.getElementById("library-album-picker");

  const albumCtxMenu = document.getElementById("album-context-menu");

  const albumModal = document.getElementById("album-modal");
  const modalArtist = document.getElementById("modal-artist");
  const modalAlbum = document.getElementById("modal-album");
  const btnCreateAlbum = document.getElementById("album-create");
  const btnCancelAlbum = document.getElementById("album-cancel");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsOverlay = document.getElementById("settings-overlay");
  const settingsBackdrop = document.getElementById("settings-backdrop");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsContent = document.getElementById("settings-content");
  const settingsBackBtn = document.getElementById("settings-back-btn");
  const rail = document.getElementById("settings-rail");
  const railBtns = Array.from(rail?.querySelectorAll(".rail-btn") || []);
  const railIndicator = document.getElementById("rail-indicator");
  const settingSections = Array.from(
    document.querySelectorAll(".settings-section")
  );
  const panelEl = document.querySelector(".center-panel");
  const panelPlayBtn = panelEl?.querySelector("#play-pause-btn");
  const panelPlaylistBtn = panelEl?.querySelector("#playlist-btn");
  const panelSettingsBtn = panelEl?.querySelector("#settings-btn");

  // Lấy 3 nút gốc trên thanh player (nằm trong #player-container)
  const originPlayBtn = document.querySelector(
    "#player-container #play-pause-btn"
  );
  const originPlaylistBtn = document.querySelector(
    "#player-container #playlist-btn"
  );
  const originSettingsBtn = document.querySelector(
    "#player-container #settings-btn"
  );

  // Đồng bộ chữ Play/Pause trên panel theo trạng thái audio
  function syncPanelPlayLabel() {
    if (!panelPlayBtn) return;
    panelPlayBtn.textContent = audio && !audio.paused ? "Pause" : "Play";
  }
  syncPanelPlayLabel();
  audio?.addEventListener("play", syncPanelPlayLabel);
  audio?.addEventListener("pause", syncPanelPlayLabel);

  // Forward click từ panel -> nút gốc (không sửa CODE CŨ)
  panelPlayBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    originPlayBtn?.click(); // dùng logic cũ
    // Nếu muốn đóng panel sau khi bấm:
    // closePanel();
  });
  panelPlaylistBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    originPlaylistBtn?.click(); // mở phần chọn bài cũ của bạn
    // closePanel();
  });
  panelSettingsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    originSettingsBtn?.click(); // mở settings overlay
    // closePanel();
  });
  // Shield vô hình chặn pointer khi mở context menu
  let ctxShield = document.getElementById("ctx-shield");
  if (!ctxShield) {
    ctxShield = document.createElement("div");
    ctxShield.id = "ctx-shield";
    ctxShield.className = "ctx-shield";
    overlay.appendChild(ctxShield);
  }
  ctxShield.addEventListener("click", closeMenus);
  ctxShield.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    closeMenus();
  });
  let playQueue = []; // mảng songId
  let playQueueAlbumId = "all"; // album/playlist đang dùng làm queue
  let playQueueIndex = -1; // index hiện tại trong queue
  let currentSongId = null; // songId đang phát

  function buildQueueForAlbum(albumId) {
    // lấy danh sách bài trong album (không áp filter search)
    return filterSongs("", albumId).map((s) => s.id);
  }

  async function playByQueueIndex(idx) {
    if (idx < 0 || idx >= playQueue.length) return false;
    const sid = playQueue[idx];
    currentSongId = sid;
    await playSong(sid);
    return true;
  }

  async function startQueueFromSong(songId, albumId) {
    playQueueAlbumId = albumId || currentAlbumId || "all";
    playQueue = buildQueueForAlbum(playQueueAlbumId);
    let idx = playQueue.indexOf(songId);
    if (idx === -1) {
      // bảo hiểm: bài không có trong danh sách (do filter nào đó)
      playQueue.unshift(songId);
      idx = 0;
    }
    playQueueIndex = idx;
    await playByQueueIndex(playQueueIndex);
  }

  function ensureQueueFromCurrent() {
    if (playQueue.length && currentSongId) return true;

    // cố tìm bài đang phát trong store theo currentSrc
    const nowSrc = document.getElementById("audio-player").currentSrc;
    const hit = Object.values(store.songs).find(
      (s) => s.objectUrl && nowSrc && s.objectUrl === nowSrc
    );
    if (!hit) return false;

    // nếu chưa có queue, mặc định từ album đang chọn hoặc All
    if (!playQueueAlbumId) playQueueAlbumId = "all";
    playQueue = buildQueueForAlbum(playQueueAlbumId);
    let idx = playQueue.indexOf(hit.id);
    if (idx === -1) {
      playQueue.unshift(hit.id);
      idx = 0;
    }
    playQueueIndex = idx;
    currentSongId = hit.id;
    return true;
  }

  async function nextTrack() {
  if (!ensureQueueFromCurrent() || !playQueue.length) return false;
  playQueueIndex = (playQueueIndex + 1) % playQueue.length;
  await playByQueueIndex(playQueueIndex);
  return true;
}

async function prevTrack() {
  if (!ensureQueueFromCurrent() || !playQueue.length) return false;
  playQueueIndex = (playQueueIndex - 1 + playQueue.length) % playQueue.length;
  await playByQueueIndex(playQueueIndex);
  return true;
}

// Gán nút Prev/Next (giữ nguyên nếu bạn đã có)
prevBtn.addEventListener("click", () => { prevTrack(); });
nextBtn.addEventListener("click", () => { nextTrack(); });

// Đang có sẵn:
// audio.addEventListener("ended", () => { if (!audio.loop) nextTrack(); });

  // Tự động phát bài kế tiếp khi bài hiện tại kết thúc (nếu không bật repeat one)
  audio.addEventListener("ended", () => {
    if (!audio.loop) nextTrack();
  });
  // Mở overlay thay vì input cũ (capture-phase, không sửa code cũ)
  playlistBtn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openOverlay();
    },
    true
  );

  // Nút Play: nếu chưa có bài -> mở overlay
  playPauseBtn.addEventListener(
    "click",
    (e) => {
      const noTrack =
        !audio.currentSrc ||
        audio.currentSrc === "" ||
        !Number.isFinite(audio.duration) ||
        audio.duration <= 0;
      if (noTrack) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openOverlay();
      }
    },
    true
  );

  // ---------- IndexedDB ----------
  const natColl = new Intl.Collator("vi", {
    numeric: true,
    sensitivity: "base",
  });
  const DB_NAME = "mp_library_idb_v2";
  const STORE_HANDLES = "handles";
  const STORE_BLOBS = "blobs";
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!("indexedDB" in window)) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_HANDLES))
          db.createObjectStore(STORE_HANDLES, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_BLOBS))
          db.createObjectStore(STORE_BLOBS, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }
  async function saveHandle(id, handle) {
    const db = await openDB();
    if (!db) return;
    await new Promise((res) => {
      const tx = db.transaction(STORE_HANDLES, "readwrite");
      tx.objectStore(STORE_HANDLES).put({ id, handle });
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
  async function getHandle(id) {
    const db = await openDB();
    if (!db) return null;
    return await new Promise((res) => {
      const tx = db.transaction(STORE_HANDLES, "readonly");
      const req = tx.objectStore(STORE_HANDLES).get(id);
      req.onsuccess = () => res(req.result?.handle || null);
      req.onerror = () => res(null);
    });
  }
  async function deleteHandle(id) {
    const db = await openDB();
    if (!db) return;
    await new Promise((res) => {
      const tx = db.transaction(STORE_HANDLES, "readwrite");
      tx.objectStore(STORE_HANDLES).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
  async function putBlob(id, blob) {
    const db = await openDB();
    if (!db) return;
    await new Promise((res) => {
      const tx = db.transaction(STORE_BLOBS, "readwrite");
      tx.objectStore(STORE_BLOBS).put({ id, blob });
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
  async function getBlob(id) {
    const db = await openDB();
    if (!db) return null;
    return await new Promise((res) => {
      const tx = db.transaction(STORE_BLOBS, "readonly");
      const req = tx.objectStore(STORE_BLOBS).get(id);
      req.onsuccess = () => res(req.result?.blob || null);
      req.onerror = () => res(null);
    });
  }
  async function deleteBlob(id) {
    const db = await openDB();
    if (!db) return;
    await new Promise((res) => {
      const tx = db.transaction(STORE_BLOBS, "readwrite");
      tx.objectStore(STORE_BLOBS).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }

  // ---------- Store ----------
  const STORE_KEY = "mp_library_store_v1";
  let store = loadStore();
  let currentAlbumId = "all";
  let lastContextSongId = null;
  let lastContextAlbumId = null;

  const uid = () =>
    crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);

  function saveStore() {
    try {
      const copy = { songs: {}, albums: {} };
      for (const [id, s] of Object.entries(store.songs)) {
        const { objectUrl, ...rest } = s;
        copy.songs[id] = rest;
      }
      copy.albums = store.albums;
      localStorage.setItem(STORE_KEY, JSON.stringify(copy));
    } catch {}
  }
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const st = JSON.parse(raw);
        for (const s of Object.values(st.songs || {})) s.objectUrl = null;
        return st;
      }
    } catch {}
    return { songs: {}, albums: {} };
  }
  function albumKeyOf(artist, album) {
    return `${(artist || "none").trim().toLowerCase()}||${(album || "none")
      .trim()
      .toLowerCase()}`;
  }

  // ---------- Render ----------
  function renderAlbums() {
    albumListEl.innerHTML = "";

    const allItem = document.createElement("div");
    allItem.className =
      "album-item" + (currentAlbumId === "all" ? " active" : "");
    allItem.dataset.albumId = "all";
    allItem.innerHTML = `
      <div class="album-cover">ALL</div>
      <div>
        <div class="album-title">All Songs</div>
        <div class="album-sub">${Object.keys(store.songs).length} bài</div>
      </div>
    `;
    albumListEl.appendChild(allItem);

    const entries = Object.values(store.albums);
    entries.sort(
      (a, b) =>
        a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album)
    );
    for (const alb of entries) {
      const coverHtml = alb.cover
        ? `<img class="album-cover" src="${alb.cover}" alt="cover" />`
        : `<div class="album-cover">none</div>`;
      const el = document.createElement("div");
      el.className =
        "album-item" + (currentAlbumId === alb.id ? " active" : "");
      el.dataset.albumId = alb.id;
      el.innerHTML = `
        ${coverHtml}
        <div>
          <div class="album-title">${alb.artist || "none"}</div>
          <div class="album-sub">${alb.album || "none"} • ${
        alb.songIds.length
      } bài</div>
        </div>
      `;
      albumListEl.appendChild(el);
    }
  }

  function filterSongs(searchVal, albumId) {
    const q = (searchVal || "").trim().toLowerCase();
    let list = Object.values(store.songs);
    if (albumId !== "all") {
      const alb = store.albums[albumId];
      list = alb
        ? alb.songIds.map((id) => store.songs[id]).filter(Boolean)
        : [];
    }
    if (q) {
      list = list.filter(
        (s) =>
          (s.title || "").toLowerCase().includes(q) ||
          (s.artist || "").toLowerCase().includes(q) ||
          (s.album || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ta = (a.title || a.fileName || "").trim();
      const tb = (b.title || b.fileName || "").trim();
      return natColl.compare(ta, tb);
    });
    return list;
  }

  function renderSongs() {
    songListEl.innerHTML = "";
    const rows = filterSongs(searchInput.value, currentAlbumId);

    for (const s of rows) {
      const cover = s.cover
        ? `<img class="song-cover" src="${s.cover}" alt="cover" />`
        : `<div class="song-cover">none</div>`;
      const artist = s.artist || "none";
      const album = s.album || "none";

      const row = document.createElement("div");
      row.className = "song-row";
      row.dataset.songId = s.id;
      row.innerHTML = `
        <div class="col cover">${cover}</div>
        <div class="col title"><div class="song-title">${
          s.title || s.fileName || "Untitled"
        }</div></div>
        <div class="col artist"><div class="song-artist">${artist}</div></div>
        <div class="col album"><div class="song-album">${album}</div></div>
      `;

      // Left click -> play và đóng overlay khi phát OK
      row.addEventListener("click", async () => {
        try {
          await startQueueFromSong(s.id, currentAlbumId);
          setTimeout(() => closeOverlay(), 120);
        } catch {
          // relink bị hủy/lỗi -> giữ overlay để xử lý tiếp
        }
      });

      // Right click -> context menu (song)
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        lastContextSongId = s.id;
        openSongContextMenu(e.clientX, e.clientY);
      });

      songListEl.appendChild(row);
    }
  }

  function rerender() {
    renderAlbums();
    renderSongs();
  }

  // ---------- Overlay open/close ----------
  function openOverlay() {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    closeMenus();
    rerender();
  }
  function closeOverlay() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    closeMenus();
  }

  // Close bằng nút Close, nền mờ (backdrop), ESC
  btnClose.addEventListener("click", closeOverlay);
  backdrop.addEventListener("click", closeOverlay);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (albumModal.classList.contains("open")) closeAlbumModal();
      else if (
        songCtxMenu.classList.contains("open") ||
        albumPicker.classList.contains("open") ||
        albumCtxMenu.classList.contains("open")
      )
        closeMenus();
      else closeOverlay();
    }
  });

  // Click album để xem
  albumListEl.addEventListener("click", (e) => {
    const item = e.target.closest(".album-item");
    if (!item) return;
    currentAlbumId = item.dataset.albumId || "all";
    rerender();
  });

  // Context menu cho album (Delete)
  albumListEl.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".album-item");
    if (!item) return;
    e.preventDefault();
    const albumId = item.dataset.albumId || "all";
    if (albumId === "all") return; // không xóa All
    lastContextAlbumId = albumId;
    openAlbumContextMenu(e.clientX, e.clientY);
  });

  searchInput.addEventListener("input", () => renderSongs());

  // ---------- Add songs ----------
  btnAdd.addEventListener("click", async () => {
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: "Audio",
              accept: {
                "audio/*": [".mp3", ".m4a", ".flac", ".wav", ".ogg", ".*"],
              },
            },
          ],
        });
        for (const h of handles) {
          const file = await h.getFile();
          await addSongFromFile(file, h);
        }
        rerender();
        return;
      } catch {}
    }
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) await addSongFromFile(f, null);
    rerender();
  });

  // ---------- Album ----------
  btnNewAlbum.addEventListener("click", openAlbumModal);
  btnCreateAlbum.replaceWith(btnCreateAlbum.cloneNode(true));
const btnCreateAlbumNew = document.getElementById("album-create");
btnCreateAlbumNew.addEventListener("click", () => {
  const artistIn = (modalArtist.value || "").trim();
  const albumIn  = (modalAlbum.value  || "").trim();

  if (!artistIn && !albumIn) {
    alert("Vui lòng nhập ít nhất Artist hoặc Album");
    return;
  }
  createAlbumSmart(artistIn, albumIn);
  closeAlbumModal();
  rerender();
});
  btnCancelAlbum.addEventListener("click", closeAlbumModal);
  function openAlbumModal() {
    modalArtist.value = "";
    modalAlbum.value = "";
    albumModal.classList.add("open");
    albumModal.setAttribute("aria-hidden", "false");
    setTimeout(() => modalArtist.focus(), 0);
  }
  function closeAlbumModal() {
    albumModal.classList.remove("open");
    albumModal.setAttribute("aria-hidden", "true");
  }

  // ---------- Context menu & Shield ----------
  function openShield() {
    ctxShield.classList.add("open");
  }
  function closeShield() {
    ctxShield.classList.remove("open");
  }

  function openSongContextMenu(x, y) {
    openShield();
    ctxRemoveFromPlaylist.hidden = currentAlbumId === "all";
    positionPopup(songCtxMenu, x, y);
    songCtxMenu.classList.add("open");
    albumPicker.classList.remove("open");
    albumCtxMenu.classList.remove("open");
  }

  function openAlbumContextMenu(x, y) {
    openShield();
    positionPopup(albumCtxMenu, x, y);
    albumCtxMenu.classList.add("open");
    songCtxMenu.classList.remove("open");
    albumPicker.classList.remove("open");
  }

  function closeMenus() {
    songCtxMenu.classList.remove("open");
    albumPicker.classList.remove("open");
    albumCtxMenu.classList.remove("open");
    closeShield();
  }

  // Click ngoài menu/submenu -> đóng menu
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".ctx-menu") && !e.target.closest(".ctx-submenu"))
      closeMenus();
  });
  function showConfirm({ 
  title = 'Delete this song?', 
  okText = 'Delete',
  cancelText = "Don’t delete"
} = {}) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return Promise.resolve(window.confirm(title)); // fallback

  const okBtn = modal.querySelector('#confirm-ok');
  const cancelBtn = modal.querySelector('#confirm-cancel');
  modal.querySelector('.modal-title').textContent = title;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  return new Promise((resolve) => {
    const cleanup = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey, true);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onBackdrop = (e) => { if (e.target === modal) onCancel(); };
    const onKey = (e) => {
      // chặn ESC nổi bọt làm đóng Library
      e.stopPropagation(); e.stopImmediatePropagation();
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onOk();
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey, true);

    setTimeout(()=> okBtn.focus(), 0);
  });
}
  songCtxMenu.addEventListener("click", async (e) => {
  const action = e.target.closest(".ctx-item")?.dataset?.action;
  if (!action || !lastContextSongId) return;

  if (action === "move") {
    const moveItem = e.target.closest('.ctx-item[data-action="move"]');
    openAlbumPickerNear(moveItem);
  } else if (action === "delete") {
    closeMenus(); // đóng menu trước
    const ok = await showConfirm({
      title: "Delete this song?",
      message: "This will remove the song from Library. The file on your disk won’t be deleted.",
      okText: "Delete",
      cancelText: "Don’t delete",
    });
    if (ok) {
      deleteSong(lastContextSongId);
      rerender();
    }
    // không cần closeMenus() nữa vì đã đóng ở trên
  } else if (action === "remove-from-playlist") {
    const alb = store.albums[currentAlbumId];
    if (alb) {
      alb.songIds = alb.songIds.filter((id) => id !== lastContextSongId);
      saveStore();
      rerender();
    }
    closeMenus();
  }
});
  let hoverCloseTimer = null;

  function cancelCloseAlbumPicker() {
    if (hoverCloseTimer) {
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }
  function scheduleCloseAlbumPicker() {
    cancelCloseAlbumPicker();
    hoverCloseTimer = setTimeout(() => {
      albumPicker.classList.remove("open");
    }, 160); // delay nhỏ để di chuột sang submenu không bị sập
  }

  // Mở submenu khi hover vào item "Move"
  songCtxMenu.addEventListener("pointerover", (e) => {
    const moveItem = e.target.closest('.ctx-item[data-action="move"]');
    if (moveItem) {
      cancelCloseAlbumPicker();
      openAlbumPickerNear(moveItem); // bám theo item Move
    } else {
      // nếu rê ra khỏi item Move (và không nằm trong submenu) thì chuẩn bị đóng
      if (!e.target.closest(".ctx-submenu")) scheduleCloseAlbumPicker();
    }
  });

  // Khi rê vào submenu -> giữ mở; rời khỏi -> đóng sau một nhịp
  albumPicker.addEventListener("pointerenter", cancelCloseAlbumPicker);
  albumPicker.addEventListener("pointerleave", scheduleCloseAlbumPicker);
  function openAlbumPickerNear(anchorEl) {
    albumPicker.innerHTML = "";
    const albums = Object.values(store.albums).sort(
      (a, b) =>
        a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album)
    );
    if (albums.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ctx-item";
      empty.textContent = "Chưa có album";
      albumPicker.appendChild(empty);
    } else {
      for (const alb of albums) {
        const item = document.createElement("div");
        item.className = "ctx-item";
        item.textContent = `${alb.artist || "none"} • ${alb.album || "none"}`;
        item.addEventListener("click", () => {
          moveSongToAlbum(lastContextSongId, alb.id);
          closeMenus();
          rerender();
        });
        albumPicker.appendChild(item);
      }
    }
    const rect = anchorEl.getBoundingClientRect();
    positionPopup(albumPicker, rect.right + 8, rect.top);
    albumPicker.classList.add("open");
  }

  albumCtxMenu.addEventListener("click", (e) => {
    const action = e.target.closest(".ctx-item")?.dataset?.action;
    if (action === "delete-album" && lastContextAlbumId) {
      const alb = store.albums[lastContextAlbumId];
      if (!alb) return;
      if (
        confirm(
          `Xóa album "${alb.artist || "none"} • ${
            alb.album || "none"
          }"? Bài hát vẫn được giữ trong All Songs.`
        )
      ) {
        delete store.albums[lastContextAlbumId];
        if (currentAlbumId === lastContextAlbumId) currentAlbumId = "all";
        saveStore();
        rerender();
      }
      closeMenus();
    }
  });

  function positionPopup(el, x, y) {
    const vw = window.innerWidth,
      vh = window.innerHeight;
    el.style.left = x + "px";
    el.style.top = y + "px";
    requestAnimationFrame(() => {
      const clampedX = Math.min(x, vw - el.offsetWidth - 8);
      const clampedY = Math.min(y, vh - el.offsetHeight - 8);
      el.style.left = clampedX + "px";
      el.style.top = clampedY + "px";

      const originX = clampedX < x ? "right" : "left";
      const originY = clampedY < y ? "bottom" : "top";
      el.style.setProperty("--origin-x", originX);
      el.style.setProperty("--origin-y", originY);
    });
  }

  // ---------- Core actions ----------
  async function addSongFromFile(file, handle) {
    const exists = Object.values(store.songs).some(
      (s) => s.fileName === file.name && s.fileSize === file.size
    );
    if (exists) return;

    const meta = await readMeta(file);
    const id = uid();
    const objectUrl = URL.createObjectURL(file);

    const title = meta.title || file.name.replace(/\.[^/.]+$/, "");
    const artist = meta.artist || "none";
    const album = meta.album || "none";

    const song = {
      id,
      title,
      artist,
      album,
      cover: meta.pictureDataUrl || null,
      objectUrl,
      fileName: file.name,
      fileSize: file.size,
    };
    store.songs[id] = song;

    if (handle) {
      try {
        await saveHandle(id, handle);
      } catch {}
    }
    try {
      await putBlob(id, file);
    } catch {}

    const key = albumKeyOf(artist, album);
    const alb = store.albums[key];
    if (alb) {
      if (!alb.songIds.includes(id)) alb.songIds.push(id);
      if (!alb.cover && song.cover) alb.cover = song.cover;
    }
    saveStore();
  }

  function deleteSong(songId) {
    const song = store.songs[songId];
    if (!song) return;
    try {
      song.objectUrl && URL.revokeObjectURL(song.objectUrl);
    } catch {}
    for (const alb of Object.values(store.albums))
      alb.songIds = alb.songIds.filter((id) => id !== songId);

    if (audio.src && song.objectUrl && audio.src === song.objectUrl) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      songTitle.textContent = "Chưa có bài hát nào được chọn";
    }
    delete store.songs[songId];
    saveStore();
    deleteHandle(songId).catch(() => {});
    deleteBlob(songId).catch(() => {});
  }

  function moveSongToAlbum(songId, albumId) {
    const song = store.songs[songId];
    const alb = store.albums[albumId];
    if (!song || !alb) return;
    if (!alb.songIds.includes(songId)) alb.songIds.push(songId);
    if (!alb.cover && song.cover) alb.cover = song.cover;
    saveStore();
  }
  // Bỏ dấu + lower + gọn khoảng trắng
function norm(s) {
  return (s || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Tách multi-artist theo các dấu: , & x / ft/feat vs
function splitArtists(s) {
  const n = norm(s);
  if (!n) return [];
  return n.split(/(?:\s*&\s*|\s*x\s*|\s*,\s*|\s*\/\s*|\s+ft\.?\s+|\s+feat\.?\s+|\s+vs\.?\s*)/)
          .filter(Boolean);
}

// match artist: chỉ cần 1 token của bài “chứa” từ bạn nhập
function matchArtist(songArtist, filterArtist) {
  const f = norm(filterArtist);
  if (!f) return false;
  const tokens = splitArtists(songArtist);
  if (!tokens.length) return false;
  return tokens.some(t => t.includes(f));
}

// match album: substring, bỏ dấu
function matchAlbum(songAlbum, filterAlbum) {
  const f = norm(filterAlbum);
  if (!f) return false;
  return norm(songAlbum).includes(f);
}
  function createAlbumSmart(artistIn, albumIn) {
  const hasArtist = !!artistIn.trim();
  const hasAlbum  = !!albumIn.trim();

  // Lọc bài: nếu có cả 2 => AND, nếu chỉ 1 => theo 1 cái đó
  const matched = Object.values(store.songs).filter(s => {
    const okArtist = hasArtist ? matchArtist(s.artist || "", artistIn) : true;
    const okAlbum  = hasAlbum  ? matchAlbum(s.album  || "", albumIn)  : true;
    return okArtist && okAlbum;
  });

  const songIds = matched.map(s => s.id);

  // Cover lấy bài đầu có ảnh
  let cover = null;
  for (const s of matched) {
    if (s.cover) { cover = s.cover; break; }
  }

  // Album ID: dựa trên input; nếu thiếu thì “none”
  const id = albumKeyOf(hasArtist ? artistIn : "none", hasAlbum ? albumIn : "none");

  // Tên hiển thị
  const displayName = hasArtist && hasAlbum
    ? `${artistIn} • ${albumIn}`
    : (hasArtist ? artistIn : albumIn);

  if (store.albums[id]) {
    const alb = store.albums[id];
    const set = new Set([...(alb.songIds || []), ...songIds]);
    alb.songIds = Array.from(set);
    if (!alb.cover && cover) alb.cover = cover;
    // Cập nhật nhãn cho rõ
    alb.artist = hasArtist ? artistIn : (alb.artist || "none");
    alb.album  = hasAlbum  ? albumIn  : (alb.album  || "none");
    if (!alb.name) alb.name = displayName;
  } else {
    store.albums[id] = {
      id,
      artist: hasArtist ? artistIn : "none",
      album:  hasAlbum  ? albumIn  : "none",
      name:   displayName,
      cover,
      songIds,
    };
  }
  saveStore();
  currentAlbumId = id;
}
  async function playSong(songId) {
    const song = store.songs[songId];
    if (!song) return;
    await ensureSongObjectUrl(song);
    audio.src = song.objectUrl;
    songTitle.textContent = song.title || song.fileName || "Untitled";
    await audio.play();
  }

  async function ensureSongObjectUrl(song) {
    if (song.objectUrl) return;

    let handle = await getHandle(song.id);
    if (handle && handle.getFile) {
      try {
        const q = await handle.queryPermission?.({ mode: "read" });
        if (q !== "granted") {
          const r = await handle.requestPermission?.({ mode: "read" });
          if (r !== "granted") throw new Error("Permission denied");
        }
        const f = await handle.getFile();
        song.objectUrl = URL.createObjectURL(f);
        return;
      } catch {}
    }
    const blob = await getBlob(song.id);
    if (blob) {
      song.objectUrl = URL.createObjectURL(blob);
      return;
    }

    await relinkSong(song);
  }

  async function relinkSong(song) {
    if (window.showOpenFilePicker) {
      const [h] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Audio",
            accept: {
              "audio/*": [".mp3", ".m4a", ".flac", ".wav", ".ogg", ".*"],
            },
          },
        ],
      });
      const file = await h.getFile();
      if (song.objectUrl) {
        try {
          URL.revokeObjectURL(song.objectUrl);
        } catch {}
      }
      song.objectUrl = URL.createObjectURL(file);
      await saveHandle(song.id, h).catch(() => {});
      await putBlob(song.id, file).catch(() => {});
      const meta = await readMeta(file);
      if (!song.title)
        song.title = meta.title || file.name.replace(/\.[^/.]+$/, "");
      if (!song.artist) song.artist = meta.artist || "none";
      if (!song.album) song.album = meta.album || "none";
      if (!song.cover && meta.pictureDataUrl) song.cover = meta.pictureDataUrl;
      saveStore();
      return;
    }
    const f = await pickSingleFileViaInput();
    if (!f) throw new Error("cancel");
    if (song.objectUrl) {
      try {
        URL.revokeObjectURL(song.objectUrl);
      } catch {}
    }
    song.objectUrl = URL.createObjectURL(f);
    await putBlob(song.id, f).catch(() => {});
  }

  function pickSingleFileViaInput() {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "audio/*";
      inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener(
        "change",
        () => {
          const file = inp.files?.[0] || null;
          document.body.removeChild(inp);
          resolve(file);
        },
        { once: true }
      );
      inp.click();
    });
  }

  async function readMeta(file) {
    const lib = await ensureJsMediaTags();
    if (!lib) return { title: "", artist: "", album: "", pictureDataUrl: null };
    return new Promise((resolve) => {
      lib.read(file, {
        onSuccess: (tag) => {
          const t = tag.tags || {};
          const res = {
            title: t.title || "",
            artist: t.artist || "",
            album: t.album || "",
            pictureDataUrl: null,
          };
          if (t.picture && t.picture.data && t.picture.format) {
            const byteArray = new Uint8Array(t.picture.data);
            const blob = new Blob([byteArray], { type: t.picture.format });
            const fr = new FileReader();
            fr.onload = () => resolve({ ...res, pictureDataUrl: fr.result });
            fr.onerror = () => resolve(res);
            fr.readAsDataURL(blob);
          } else resolve(res);
        },
        onError: () =>
          resolve({ title: "", artist: "", album: "", pictureDataUrl: null }),
      });
    });
  }
  function openSettings() {
    settingsOverlay.classList.add("open");
    settingsOverlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(updateActiveFromScroll); // sync thanh hồng
  }
  function closeSettings() {
    settingsOverlay.classList.remove("open");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }
  const settingsBackRail = document.getElementById("settings-back-rail");
  settingsBackRail?.addEventListener("click", closeSettings);
  settingsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSettings();
  });
  settingsBackdrop?.addEventListener("click", closeSettings);
  settingsBackBtn?.addEventListener("click", closeSettings);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && settingsOverlay.classList.contains("open"))
      closeSettings();
  });

  // Click icon trên rail -> scroll tới section tương ứng
  railBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.target;
      const sec = settingSections.find((s) => s.dataset.section === key);
      if (sec)
        settingsContent.scrollTo({
          top: sec.offsetTop - 270,
          behavior: "smooth",
        });
    });
  });

  // Thanh hồng chạy theo section đang thấy
  function setActiveByKey(key) {
    const btn = railBtns.find((b) => b.dataset.target === key);
    if (!btn) return;
    railBtns.forEach((b) => b.classList.toggle("active", b === btn));
    const railRect = rail.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    railIndicator.style.top = `${btnRect.top - railRect.top-1}px`;
    railIndicator.style.height = `${btnRect.height}px`;
  }
  function updateActiveFromScroll() {
    const scrollY = settingsContent.scrollTop; // vị trí cuộn hiện tại
  let activeSection = settingSections[0];

  for (const sec of settingSections) {
    if (scrollY >= sec.offsetTop - 300) {
      activeSection = sec;
    } else {
      break; // các section sau chưa tới
    }
  }

  if (activeSection) {
    setActiveByKey(activeSection.dataset.section);
  }
}
  const throttled = (fn, wait = 60) => {
    let t = 0;
    return (...args) => {
      const now = Date.now();
      if (now - t > wait) {
        t = now;
        fn(...args);
      }
    };
  };
  settingsContent?.addEventListener(
    "scroll",
    throttled(updateActiveFromScroll, 60)
  );
  function ensureJsMediaTags() {
    if (window.jsmediatags) return Promise.resolve(window.jsmediatags);
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js";
      s.onload = () => resolve(window.jsmediatags || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  // Chặn contextmenu mặc định ở vùng trống, nhưng cho phép ở bài/album/menu
  overlay.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".song-row, .album-item, .ctx-menu, .ctx-submenu"))
      return;
    e.preventDefault();
  });
  const themeBgBtn = document.getElementById("theme-bg-btn");
  const themeCircleBtn = document.getElementById("theme-circle-btn");
  const themeL2dBtn = document.getElementById("theme-l2d-btn");
  const themeL2dToggle = document.getElementById("theme-l2d-toggle");

  // Video L2D element (tạo nếu chưa có)
  let l2dVideo = document.getElementById("l2d-video");
  if (!l2dVideo) {
    l2dVideo = document.createElement("video");
    l2dVideo.id = "l2d-video";
    l2dVideo.autoplay = true;
    l2dVideo.loop = true;
    l2dVideo.muted = true;
    l2dVideo.playsInline = true;
    document.body.appendChild(l2dVideo);
  }

  // Runtime state
  let bgUrl = null;
  let circleImg = null; // ảnh dùng để vẽ hình tròn
  let l2dUrl = null;

  // Lưu toggle + override vào localStorage
  const THEME_STATE_KEY = "mp_theme_state_v1";
  function loadThemeState() {
    try {
      return (
        JSON.parse(localStorage.getItem(THEME_STATE_KEY)) || {
          circleOverride: false,
          l2dEnabled: false,
        }
      );
    } catch {
      return { circleOverride: false, l2dEnabled: false };
    }
  }
  function saveThemeState() {
    try {
      localStorage.setItem(THEME_STATE_KEY, JSON.stringify(themeState));
    } catch {}
  }
  let themeState = loadThemeState();

  // IndexedDB cho blob theme
  const THEME_DB_NAME = "mp_theme_idb_v1";
  const THEME_STORE = "assets";
  const THEME_BG_KEY = "bgImage";
  const THEME_CIRCLE_KEY = "circleImage";
  const THEME_L2D_KEY = "l2dVideo";
  let themeDbPromise = null;
  // ===== Default assets (đặt sau khi đã có l2dVideo, themeState, ... ) =====
const DEFAULT_BG_URL  = 'img/UI.png';      // đổi đường dẫn nếu cần
const DEFAULT_L2D_URL = 'img/output.mp4';   // đổi đường dẫn nếu cần

let usingDefaultBg = false;
let usingDefaultL2D = false;

// Áp background mặc định
function applyDefaultBackground() {
  usingDefaultBg = true;
  // body background + seed cho lớp nền tĩnh
  document.body.style.background = `#000 url("${DEFAULT_BG_URL}") center/cover no-repeat fixed`;
  document.documentElement.style.setProperty('--bg-img', `url("${DEFAULT_BG_URL}")`);
}

// Áp L2D mặc định (bật nếu toggle đang cho phép)
async function applyDefaultL2D() {
  if (!l2dVideo) return;
  usingDefaultL2D = true;
  l2dVideo.src = DEFAULT_L2D_URL;
  // Mặc định bật L2D khi lần đầu (nếu trước đó chưa có state)
  if (themeState.l2dEnabled !== false) {
    themeState.l2dEnabled = true;
    try { saveThemeState?.(); } catch {}
    l2dVideo.classList.add('on');
    try { await l2dVideo.play(); } catch {}
  }
}

// Sửa loadThemeAssets để fallback mặc định khi chưa có blob người dùng
// Tìm IIFE loadThemeAssets đang có và thay nội dung tương ứng:
(async function loadThemeAssets() {
  const [bgB, circleB, l2dB] = await Promise.all([
    themeGetBlob(THEME_BG_KEY),
    themeGetBlob(THEME_CIRCLE_KEY),
    themeGetBlob(THEME_L2D_KEY),
  ]);

  if (bgB) {
    applyBackgroundFromBlob(bgB);
    usingDefaultBg = false;
  } else {
    applyDefaultBackground();
  }

  if (circleB) {
    themeState.circleOverride = true;
    saveThemeState?.();
    applyCircleFromBlob(circleB);
  }

  if (l2dB) {
    applyL2DFromBlob(l2dB);
    usingDefaultL2D = false;
  } else {
    // Nếu chưa có video người dùng, dùng mặc định (và mặc định bật)
    applyDefaultL2D();
  }
})();

// Khi người dùng CHỌN file mới → mặc định sẽ “mất” (bị override)
// 1) Background
if (themeBgBtn) {
  themeBgBtn.addEventListener('click', async () => {
    const f = await pickFile('image/*');
    if (!f) return;
    usingDefaultBg = false;                    // không dùng mặc định nữa
    await themePutBlob(THEME_BG_KEY, f);
    applyBackgroundFromBlob(f);
  });
}

// 2) L2D
if (themeL2dBtn) {
  themeL2dBtn.addEventListener('click', async () => {
    const f = await pickFile('video/*');
    if (!f) return;
    usingDefaultL2D = false;                   // không dùng mặc định nữa
    await themePutBlob(THEME_L2D_KEY, f);
    applyL2DFromBlob(f);
  });
}

// 3) Toggle L2D: nếu bật mà chưa có video người dùng, tự dùng mặc định
if (themeL2dToggle && l2dVideo) {
  themeL2dToggle.addEventListener('change', async (e) => {
    const on = !!e.target.checked;
    themeState.l2dEnabled = on;
    saveThemeState?.();

    if (on) {
      // Nếu chưa có blob user và cũng không đang dùng mặc định → áp mặc định
      const hasUserBlob = !!(await themeGetBlob(THEME_L2D_KEY));
      if (!hasUserBlob && !usingDefaultL2D) {
        await applyDefaultL2D();
      } else {
        l2dVideo.classList.add('on');
        try { await l2dVideo.play(); } catch {}
      }
    } else {
      l2dVideo.classList.remove('on');
      l2dVideo.pause();
    }
  });
}
  function openThemeDB() {
    if (themeDbPromise) return themeDbPromise;
    themeDbPromise = new Promise((resolve) => {
      const req = indexedDB.open(THEME_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(THEME_STORE))
          db.createObjectStore(THEME_STORE, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return themeDbPromise;
  }
  async function themePutBlob(key, blob) {
    const db = await openThemeDB();
    if (!db) return;
    await new Promise((res) => {
      const tx = db.transaction(THEME_STORE, "readwrite");
      tx.objectStore(THEME_STORE).put({ key, blob, mime: blob?.type || "" });
      tx.oncomplete = res;
      tx.onerror = res;
    });
  }
  async function themeGetBlob(key) {
    const db = await openThemeDB();
    if (!db) return null;
    return await new Promise((res) => {
      const tx = db.transaction(THEME_STORE, "readonly");
      const rq = tx.objectStore(THEME_STORE).get(key);
      rq.onsuccess = () => res(rq.result?.blob || null);
      rq.onerror = () => res(null);
    });
  }
  async function themeDelete(key) {
    const db = await openThemeDB();
    if (!db) return;
    await new Promise((res) => {
      const tx = db.transaction(THEME_STORE, "readwrite");
      tx.objectStore(THEME_STORE).delete(key);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  }

  // Helper chọn file
  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = accept;
      inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener(
        "change",
        () => {
          const f = inp.files && inp.files[0] ? inp.files[0] : null;
          document.body.removeChild(inp);
          resolve(f);
        },
        { once: true }
      );
      inp.click();
    });
  }
  // Tạo lớp nền tĩnh + overlay blur và set fallback nếu cần
function ensureBgSurfaces(){
  // 1) backdrop-filter support?
  const supportsBDF =
    CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  document.documentElement.classList.toggle('no-bdf', !supportsBDF);

  // 2) layer ảnh nền tĩnh (tồn tại kể cả khi có backdrop, dùng làm nền/seed)
  let bgLayer = document.getElementById('theme-bg-layer');
  if (!bgLayer){
    bgLayer = document.createElement('div');
    bgLayer.id = 'theme-bg-layer';
    document.body.prepend(bgLayer); // dưới mọi thứ
  }

  // 3) overlay blur (chỉ có tác dụng khi supportsBDF)
  let blurOverlay = document.getElementById('bg-blur-overlay');
  if (!blurOverlay){
    blurOverlay = document.createElement('div');
    blurOverlay.id = 'bg-blur-overlay';
    document.body.prepend(blurOverlay); // trên bgLayer, dưới UI
  }

  // 4) seed ảnh nền vào --bg-img nếu đang dùng body background
  const root = document.documentElement;
  const curVar = getComputedStyle(root).getPropertyValue('--bg-img').trim();
  if (!curVar || curVar === 'none'){
    const bodyBg = getComputedStyle(document.body).backgroundImage;
    if (bodyBg && bodyBg !== 'none'){
      root.style.setProperty('--bg-img', bodyBg);
    }
  }
}

// Slider blur (dùng chung updateSlider/bubble của bạn)
function initThemeBlurSlider(){
  ensureBgSurfaces();

  const root = document.documentElement;
  const range = document.getElementById('bg-blur');
  if (!range) return;

  const LS_KEY = 'mp_theme_blur_px_v1';
  let init = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
  if (!Number.isFinite(init)) init = 0;

  range.value = String(init);
  root.style.setProperty('--bg-blur', init + 'px');

  // Vẽ UI lần đầu (bubble + track accent)
  if (typeof updateSlider === 'function') updateSlider(range);

  const wrap = range.closest('.range-wrap');
  const show = () => { if (typeof updateSlider==='function') updateSlider(range); wrap.classList.add('show'); };
  const hide = () => wrap.classList.remove('show');

  range.addEventListener('input', () => {
    const v = range.valueAsNumber | 0;
    root.style.setProperty('--bg-blur', v + 'px');
    localStorage.setItem(LS_KEY, String(v));
    if (typeof updateSlider === 'function') updateSlider(range);
  });

  range.addEventListener('pointerenter', show);
  range.addEventListener('pointerleave', hide);
  range.addEventListener('pointerdown', show);
  range.addEventListener('pointerup', hide);
  range.addEventListener('blur', hide);
  window.addEventListener('resize', () => { if (wrap.classList.contains('show')) show(); });
}

// Gọi sau khi Settings đã sẵn sàng
initThemeBlurSlider();
  // Apply từ blob
  async function applyBackgroundFromBlob(blob) {
  if (!blob) return;
  if (bgUrl) try{ URL.revokeObjectURL(bgUrl); }catch{}
  bgUrl = URL.createObjectURL(blob);

  // Body background
  document.body.style.background = `#000 url("${bgUrl}") center/cover no-repeat fixed`;

  // Seed cho fallback + nền tĩnh
  ensureBgSurfaces();
  document.documentElement.style.setProperty('--bg-img', `url("${bgUrl}")`);
}
  async function applyCircleFromBlob(blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      circleImg = img;
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }
  async function applyL2DFromBlob(blob) {
    if (!blob) return;
    if (l2dUrl)
      try {
        URL.revokeObjectURL(l2dUrl);
      } catch {}
    l2dUrl = URL.createObjectURL(blob);
    l2dVideo.src = l2dUrl;
    if (themeState.l2dEnabled) {
      l2dVideo.classList.add("on");
      try {
        await l2dVideo.play();
      } catch {}
    }
  }

  // Load assets sau F5
  (async function loadThemeAssets() {
    const [bgB, circleB, l2dB] = await Promise.all([
      themeGetBlob(THEME_BG_KEY),
      themeGetBlob(THEME_CIRCLE_KEY),
      themeGetBlob(THEME_L2D_KEY),
    ]);
    if (bgB) applyBackgroundFromBlob(bgB);
    if (circleB) {
      themeState.circleOverride = true;
      saveThemeState();
      applyCircleFromBlob(circleB);
    }
    if (l2dB) applyL2DFromBlob(l2dB);
    if (themeState.l2dEnabled) l2dVideo.classList.add("on");
  })();

  // 1) Background image
  if (themeBgBtn)
    themeBgBtn.addEventListener("click", async () => {
      const f = await pickFile("image/*");
      if (!f) return;
      await themePutBlob(THEME_BG_KEY, f);
      applyBackgroundFromBlob(f);
    });

  // 2) Circle image (override)
  if (themeCircleBtn)
    themeCircleBtn.addEventListener("click", async () => {
      const f = await pickFile("image/*");
      if (!f) return;
      themeState.circleOverride = true;
      saveThemeState();
      await themePutBlob(THEME_CIRCLE_KEY, f);
      applyCircleFromBlob(f);
    });

  // 3) L2D video
  if (themeL2dBtn)
    themeL2dBtn.addEventListener("click", async () => {
      const f = await pickFile("video/*");
      if (!f) return;
      await themePutBlob(THEME_L2D_KEY, f);
      applyL2DFromBlob(f);
    });

  // 4) Toggle L2D
  if (themeL2dToggle) {
    themeL2dToggle.checked = !!themeState.l2dEnabled;
    themeL2dToggle.addEventListener("change", async (e) => {
      themeState.l2dEnabled = !!e.target.checked;
      saveThemeState();
      if (themeState.l2dEnabled) {
        l2dVideo.classList.add("on");
        try {
          await l2dVideo.play();
        } catch {}
      } else {
        l2dVideo.classList.remove("on");
        l2dVideo.pause();
      }
    });
  }

  // AUTO dùng cover bài đang phát nếu KHÔNG override
  function setCircleFromTrackCoverIfAvailable() {
    if (!store || !store.songs || themeState.circleOverride) return;
    const nowSrc = audio.currentSrc;
    if (!nowSrc) return;
    const song = Object.values(store.songs).find(
      (s) => s && s.objectUrl && s.objectUrl === nowSrc
    );
    if (song && song.cover) {
      const img = new Image();
      img.onload = () => {
        circleImg = img;
      };
      img.src = song.cover; // dataURL
    } else {
      // không có cover -> bỏ ảnh để vẽ màu trắng
      // circleImg = null; // (tùy, nếu muốn giữ ảnh cũ thì bỏ dòng này)
    }
  }
  audio.addEventListener("play", setCircleFromTrackCoverIfAvailable);

  // (tuỳ chọn) Thêm nút "Use track cover" để hủy override:
  // document.getElementById('theme-circle-auto-btn')?.addEventListener('click', () => {
  //   themeState.circleOverride = false; saveThemeState();
  //   circleImg = null;
  //   setCircleFromTrackCoverIfAvailable();
  // });
  const sc = document.getElementById("settings-content");

  // Tạo overlay nếu chưa có
  let rowHL = sc?.querySelector(".settings-row-highlight");
  if (!rowHL && sc) {
    rowHL = document.createElement("div");
    rowHL.className = "settings-row-highlight";
    sc.prepend(rowHL);
  }

  const HOVER_TARGETS = [
    ".setting-item",
    ".theme-actions .lib-btn",
    ".theme-actions .action-btn",
    ".lib-btn",
    ".theme-toggle",
  ].join(",");

  // Container bao FULL ngang (ưu tiên data-outline-scope)
  const OUTLINE_CONTAINER_SEL = [
    "[data-outline-scope]",
    ".settings-section",
    ".theme-actions",
    ".panel-actions",
  ].join(",");

  let lastTarget = null;

  function getContainer(el) {
    return el.closest(OUTLINE_CONTAINER_SEL) || sc;
  }

  function moveHLTo(el) {
    if (!sc || !rowHL || !el) return;

    const cont = getContainer(el);
    const scR = sc.getBoundingClientRect();
    const cR = cont.getBoundingClientRect();
    const eR = el.getBoundingClientRect();

    const left = cR.left - scR.left + sc.scrollLeft;
    const topEl = eR.top - scR.top + sc.scrollTop;
    const width = cR.width;

    // có thể đọc theo scope (section) trước, rồi fallback root
    const scopeH = parseFloat(
      getComputedStyle(cont).getPropertyValue("--setting-row-h")
    );
    const rootH = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--setting-row-h"
      )
    );
    const fixedH =
      isFinite(scopeH) && scopeH > 0
        ? scopeH
        : isFinite(rootH) && rootH > 0
        ? rootH
        : 37.6;

    const centeredTop = topEl + (eR.height - fixedH) / 2;

    rowHL.style.left = left + "px";
    rowHL.style.top = centeredTop + "px"; // căn giữa theo hàng
    rowHL.style.width = width + "px";
    rowHL.style.height = fixedH + "px"; // CHỈ SỬA HEIGHT

    rowHL.classList.add("active");
    lastTarget = el;
  }
  function setHovered(on) {
    if (!rowHL) return;
    if (on) rowHL.classList.add("hovered"); // hiện vệt trắng trái
    else rowHL.classList.remove("hovered"); // ẩn vệt trắng, giữ thanh đen
  }
  // Hover/move: bám theo item; rời “vùng trống” thì chỉ tắt vệt trắng
  sc?.addEventListener("pointermove", (e) => {
    const t = e.target.closest(HOVER_TARGETS);
    if (t && sc.contains(t)) {
      moveHLTo(t);
      setHovered(true);
    } else {
      setHovered(false); // không xóa .active → thanh đen vẫn giữ vị trí cuối
    }
  });

  // Rời hẳn content -> tắt vệt trắng, vẫn giữ thanh đen
  sc?.addEventListener("pointerleave", () => setHovered(false));

  // Cuộn/resize -> bám lại mục cuối cùng nếu còn trong DOM
  function repositionLast() {
    if (lastTarget && lastTarget.isConnected) moveHLTo(lastTarget);
  }
  sc?.addEventListener("scroll", repositionLast);
  window.addEventListener("resize", repositionLast);
  //===========================================================================//
  // ===== Opacity controls in General =====
  (function () {
    const root = document.documentElement;

    const sliders = [
      {
        id: "op-lib",
        bubble: "op-lib-bubble",
        cssVar: "--op-lib-backdrop",
        lsKey: "lib",
      },
      {
        id: "op-player",
        bubble: "op-player-bubble",
        cssVar: "--op-player-bg",
        lsKey: "player",
      },
      {
        id: "op-settings",
        bubble: "op-settings-bubble",
        cssVar: "--op-settings-panel-bg",
        lsKey: "settings",
      },
    ];

    const LS_KEY = "mp_opacity_prefs_v1";
    function loadLS() {
      try {
        return JSON.parse(localStorage.getItem(LS_KEY)) || {};
      } catch {
        return {};
      }
    }
    function saveLS(obj) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(obj));
      } catch {}
    }
    const state = loadLS();

    function setVarFromPct(varName, pct) {
      const v = Math.max(0, Math.min(100, pct)) / 100;
      root.style.setProperty(varName, v.toString());
    }

    function bindSlider({ id, bubble, cssVar, lsKey }) {
      const el = document.getElementById(id);
      const bub = document.getElementById(bubble);
      if (!el || !bub) return;

      // init từ LS hoặc từ var hiện có (nếu không có LS)
      let initPct = typeof state[lsKey] === "number" ? state[lsKey] : null;
      if (initPct == null) {
        // lấy từ var CSS (0..1) -> 0..100
        const raw = getComputedStyle(root).getPropertyValue(cssVar).trim();
        const f = parseFloat(raw);
        if (!isNaN(f)) initPct = Math.round(f * 100);
        else initPct = 50;
      }
      el.value = initPct;
      bub.textContent = initPct;
      setVarFromPct(cssVar, initPct);

      function showBubble() {
        const pct = parseFloat(el.value) || 0;
        bub.textContent = Math.round(pct);
        const x = (pct / 100) * el.clientWidth;
        bub.style.left = x + "px";
        el.parentElement.classList.add("show");
      }
      function hideBubble() {
        el.parentElement.classList.remove("show");
      }

      el.addEventListener("input", () => {
        const pct = parseFloat(el.value) || 0;
        setVarFromPct(cssVar, pct);
        state[lsKey] = pct;
        saveLS(state);
        showBubble();
      });
      el.addEventListener("pointerenter", showBubble);
      el.addEventListener("pointerleave", hideBubble);
      // nếu nội dung resize, cập nhật vị trí bubble khi đang show
      window.addEventListener("resize", () => {
        if (el.parentElement.classList.contains("show")) showBubble();
      });
    }

    sliders.forEach(bindSlider);
  })();
  function updateSlider(range) {
    const wrap = range.closest(".range-wrap");
    const bubble = wrap.querySelector(".value-bubble");

    const min = Number(range.min || 0);
    const max = Number(range.max || 100);
    const val = Number(range.value);

    const percent = (val - min) / (max - min);

    // Lấy kích thước thật để tính tâm thumb theo px
    const styles = getComputedStyle(range);
    const thumbSize = parseFloat(styles.getPropertyValue("--thumb-size")) || 16;
    const trackH = parseFloat(styles.getPropertyValue("--track-h")) || 2;

    const w = range.clientWidth; // chiều rộng slider
    // Vị trí tâm thumb (px) từ mép trái
    const pos = percent * (w - thumbSize) + thumbSize / 2;

    // Bán kính "lỗ" để che track dưới thumb
    // +1px để đảm bảo không bị hở track bên trong vòng
    const hole = thumbSize / 2 + 1;

    // Set CSS variables lên wrapper (track đang vẽ trên ::before của wrapper)
    wrap.style.setProperty("--pos", pos + "px");
    wrap.style.setProperty("--hole", hole + "px");

    // Cập nhật bubble
    bubble.textContent = val;
    bubble.style.left = pos + "px";
  }

  document
    .querySelectorAll('.range-wrap input[type="range"]')
    .forEach((range) => {
      // Khởi tạo
      updateSlider(range);
      // Lắng nghe thay đổi
      range.addEventListener("input", () => updateSlider(range));
      window.addEventListener("resize", () => updateSlider(range));
    });
  // Tạo layer nền nếu chưa có, seed ảnh từ background hiện tại của body
  // Tham chiếu audio + slider volume cũ (đang có sẵn trong code của bạn)
  // --- KHAI BÁO BIẾN ---
  // Đảm bảo các biến này trỏ đến đúng element trên trang của bạn
  const audioEl = window.audio || document.querySelector("audio");
  const volMain = window.volume || document.getElementById("volume"); // slider volume cũ (có thanh progress)
  const volSettings = document.getElementById("vol-settings"); // slider volume mới (có bubble)

  // --- HÀM HELPER CHO SLIDER MỚI (volSettings) ---

  // Helper vẽ slider mới (đặt vị trí bubble + cập nhật CSS var)
  function updateSlider(range, opts = {}) {
    if (!range) return;
    const wrap = range.closest(".range-wrap");
    if (!wrap) return;
    const bubble = wrap.querySelector(".value-bubble");
    if (!bubble) return;

    const min = Number(range.min || 0);
    const max = Number(range.max || 1);
    const val = Number(range.value);
    const p = (val - min) / (max - min);

    const styles = getComputedStyle(range);
    const thumbSize = parseFloat(styles.getPropertyValue("--thumb-size")) || 16;
    const w = range.clientWidth || 1;
    const pos = p * (w - thumbSize) + thumbSize / 2;
    const hole = thumbSize / 2 + (opts.holePadPx ?? 2);

    wrap.style.setProperty("--pos", pos + "px");
    wrap.style.setProperty("--hole", hole + "px");

    const fmt = range.dataset.format || "";
    let txt = val;
    if (fmt === "percent01") txt = Math.round(val * 100);
    bubble.textContent = txt;
    bubble.style.left = pos + "px";
  }

  function initSliderWatch(el) {
    if (!el) return;
    updateSlider(el);
    el.addEventListener("input", () => updateSlider(el));
    window.addEventListener("resize", () => updateSlider(el));
  }

  // Hiện/ẩn bubble khi hover/kéo
  function attachBubble(range) {
    if (!range) return;
    const wrap = range.closest(".range-wrap");
    if (!wrap) return;
    const show = () => {
      updateSlider(range);
      wrap.classList.add("show");
    };
    const hide = () => wrap.classList.remove("show");

    range.addEventListener("pointerenter", show);
    range.addEventListener("pointerleave", hide);
    range.addEventListener("pointerdown", show);
    range.addEventListener("pointerup", hide);
    range.addEventListener("blur", hide);

    window.addEventListener("resize", () => {
      if (wrap.classList.contains("show")) show();
    });
  }

  // --- HÀM HELPER CHUNG & LOGIC ĐỒNG BỘ ---

  /**
   * Cập nhật thanh progress cho slider cũ (volMain)
   * @param {HTMLInputElement} slider - Element slider cần cập nhật.
   */
  function updateVolumeProgress(slider) {
    if (!slider) return;
    const progressPct =
      (slider.valueAsNumber / Number(slider.max || 100)) * 100;
    slider.style.setProperty("--progress", progressPct + "%");
  }

  // Chuẩn hoá giá trị 0..1 từ slider bất kỳ (0..1 hoặc 0..100)
  function normFromSlider(sl) {
    if (!sl) return null;
    const max = Number(sl.max || 1);
    const v = sl.valueAsNumber;
    return max > 1 ? v / max : v;
  }

  // Đặt giá trị cho slider từ giá trị đã chuẩn hoá 0..1
  function setSliderFromNorm(sl, n) {
    if (!sl) return;
    const max = Number(sl.max || 1);
    sl.value = max > 1 ? String(n * max) : String(n);
  }

  // Biến cờ để tránh vòng lặp vô hạn khi đồng bộ
  let syncing = false;

  /**
   * Hàm trung tâm: Đặt âm lượng và đồng bộ tất cả các UI liên quan.
   * @param {number} n01 - Âm lượng đã được chuẩn hóa trong khoảng 0 đến 1.
   */
  function setUnifiedVolume(n01) {
    // Đảm bảo giá trị luôn nằm trong khoảng [0, 1]
    n01 = Math.max(0, Math.min(1, Number(n01) || 0));

    // Bật cờ syncing để các event listener khác không chạy lại hàm này
    syncing = true;

    // 1) Cập nhật audio player
    if (audioEl && audioEl.volume !== n01) {
      audioEl.volume = n01;
    }

    // 2) Cập nhật slider mới (volSettings) và hình ảnh (bubble) của nó
    if (volSettings) {
      // Chỉ cập nhật nếu giá trị khác để tránh tốn tài nguyên
      if (normFromSlider(volSettings) !== n01) {
        setSliderFromNorm(volSettings, n01);
        updateSlider(volSettings); // Cập nhật vị trí bubble
      }
    }

    // 3) Cập nhật slider cũ (volMain) và hình ảnh (progress bar) của nó
    if (volMain) {
      // Chỉ cập nhật nếu giá trị khác
      if (normFromSlider(volMain) !== n01) {
        setSliderFromNorm(volMain, n01);
      }
      // **QUAN TRỌNG**: Gọi hàm cập nhật hình ảnh cho slider cũ tại đây!
      updateVolumeProgress(volMain);
    }

    // Tắt cờ syncing
    syncing = false;
  }

  // --- GẮN EVENT LISTENER VÀ KHỞI TẠO ---

  // Lắng nghe thay đổi từ slider mới
  volSettings?.addEventListener("input", (e) => {
    if (!syncing) setUnifiedVolume(normFromSlider(e.target));
  });

  // Lắng nghe thay đổi từ slider cũ
  volMain?.addEventListener("input", (e) => {
    if (!syncing) setUnifiedVolume(normFromSlider(e.target));
  });

  // Nếu audio.volume bị thay đổi từ nơi khác (ví dụ: phím media), cũng đồng bộ lại
  audioEl?.addEventListener("volumechange", () => {
    if (!syncing) setUnifiedVolume(audioEl.volume);
  });

  // Khởi tạo các thành phần UI
  initSliderWatch(volSettings);
  attachBubble(volSettings);

  // Hàm tự gọi để khởi tạo giá trị âm lượng ban đầu
  const VOL_LS_KEY = 'mp_volume_v1';

function loadSavedVolume() {
  try {
    const v = localStorage.getItem(VOL_LS_KEY);
    if (v == null) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
  } catch {
    return null;
  }
}

function saveVolume(n01) {
  try {
    const v = Math.max(0, Math.min(1, Number(n01) || 0));
    localStorage.setItem(VOL_LS_KEY, String(v));
  } catch {}
}
function setUnifiedVolume(n01) {
  n01 = Math.max(0, Math.min(1, Number(n01) || 0));
  syncing = true;

  if (audioEl && audioEl.volume !== n01) audioEl.volume = n01;

  if (volSettings) {
    if (normFromSlider(volSettings) !== n01) {
      setSliderFromNorm(volSettings, n01);
      updateSlider(volSettings);
    }
  }

  if (volMain) {
    if (normFromSlider(volMain) !== n01) {
      setSliderFromNorm(volMain, n01);
    }
    updateVolumeProgress(volMain);
  }

  // Lưu vào LocalStorage
  saveVolume(n01);

  syncing = false;
}
  (function init() {
  // Ưu tiên: LocalStorage -> slider cũ -> audio -> slider mới -> 1
  let startVolume = loadSavedVolume();

  if (startVolume == null && volMain) startVolume = normFromSlider(volMain);
  if (startVolume == null && audioEl) startVolume = audioEl.volume;
  if (startVolume == null && volSettings) startVolume = normFromSlider(volSettings);
  if (startVolume == null) startVolume = 1;

  setUnifiedVolume(startVolume);

  setTimeout(() => { updateSlider(volSettings); }, 0);
})();
  // Gọi sau khi settings overlay đã set up:
  initColorSettings();

function initColorSettings(){
  const root = document.documentElement;

  // Helpers
  const clamp01 = x=>Math.min(1,Math.max(0,x));
  const hexToRgb = (hex)=>{
    hex=(hex||'').trim(); if(hex.startsWith('#')) hex=hex.slice(1);
    if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
    const n=parseInt(hex,16); if(isNaN(n)) return {r:30,g:26,b:37};
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  };
  const rgbToHex = ({r,g,b})=>{
    const t=v=>('0'+Math.round(v).toString(16)).slice(-2);
    return '#'+t(r)+t(g)+t(b);
  };
  const rgbToHsl = ({r,g,b})=>{
    r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}
    else{
      const d=max-min; s=l>0.5? d/(2-max-min): d/(max+min);
      switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;}
      h/=6;
    }
    return {h,s,l};
  };
  const hslToRgb = ({h,s,l})=>{
    const hue2rgb=(p,q,t)=>{ if(t<0)t+=1;if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    let r,g,b; if(s===0){r=g=b=l;}
    else{
      const q=l<.5? l*(1+s): l+s-l*s, p=2*l-q;
      r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
    }
    return {r:Math.round(r*255),g:Math.round(g*255),b:Math.round(b*255)};
  };
  const shade=(hex,dL=0,dS=0)=>{
    const hsl=rgbToHsl(hexToRgb(hex)); hsl.l=clamp01(hsl.l+dL); hsl.s=clamp01(hsl.s+dS);
    return rgbToHex(hslToRgb(hsl));
  };
  const withAlpha=(hex,a)=>{ const {r,g,b}=hexToRgb(hex); return `rgba(${r},${g},${b},${clamp01(a)})`; };

  // DOM
  const colPlayer = document.getElementById('col-player-bgr');
  const colHeading= document.getElementById('col-heading');
  const colText   = document.getElementById('col-text');

  const colPanel  = document.getElementById('col-panels-base');
  const slSpread  = document.getElementById('sl-panels-spread');
  const preview   = document.getElementById('panels-preview');

  const colAccent = document.getElementById('col-accent');

  const vizRadios = Array.from(document.querySelectorAll('input[name="viz-mode"]'));
  const colVizMono= document.getElementById('col-viz-mono');
  const vizModeSel = document.getElementById('viz-mode-select');
  // LS
  const LS_COLORS = 'mp_color_prefs_v4';
  function load(){ try{ return JSON.parse(localStorage.getItem(LS_COLORS))||{}; }catch{return{}} }
  function save(st){ try{ localStorage.setItem(LS_COLORS, JSON.stringify(st)); }catch{} }
  const st = load();

  // Init values
  colPlayer.value = st.playerBgr || getCss('--player-bgr','#2f1f36');
  colHeading.value= st.heading   || getCss('--lib-muted','#6f2ac9');
  colText.value   = st.text      || getCss('--lib-text','#e7e1f0');
  colPanel.value  = st.panelBase || getCss('--lib-panel','#1e1a25');
  slSpread.value  = Number.isFinite(st.panelSpread)? st.panelSpread : 12;
  colAccent.value = st.accent    || getCss('--accent','#ff7b95');
  const vizMode = st.vizMode || 'spectrum';
const vizMono = st.vizMono || 'rgba(255, 255, 255, 1)';
vizModeSel.value  = vizMode;
colVizMono.value  = vizMono;
colVizMono.style.display = (vizMode === 'mono') ? '' : 'none';

  function getCss(name, def){
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || def;
  }

  // Apply funcs
  function applyPlayer(hex){
    root.style.setProperty('--player-bgr', hex);
    st.playerBgr = hex; save(st);
  }
  function applyTexts(head, text){
    root.style.setProperty('--lib-muted', head);
    root.style.setProperty('--lib-text',  text);
    st.heading=head; st.text=text; save(st);
  }
  function applyPanels(baseHex, spread){
    const d = (spread||12)/100;       // độ lệch sáng/tối
    const libBg     = shade(baseHex, -d);
    const libPanel  = shade(baseHex,  0);
    const libBorder = shade(baseHex, +d);
    const railCol   = withAlpha(shade(baseHex, +d*1.2), 1);  // nền rail nhẹ
    const albActive = shade(baseHex, +d*1.4);                  // nhạt hơn panel

    root.style.setProperty('--lib-bg', libBg);
    root.style.setProperty('--lib-panel', libPanel);
    root.style.setProperty('--lib-border', libBorder);
    root.style.setProperty('--rail-color', railCol);
    root.style.setProperty('--alb-active', albActive);

    // preview chips: rail/bg/panel/border/alb-active
    if (preview){
      const chips = preview.querySelectorAll('i');
      if (chips[0]) chips[0].style.background = railCol;
      if (chips[1]) chips[1].style.background = libBg;
      if (chips[2]) chips[2].style.background = libPanel;
      if (chips[3]) chips[3].style.background = libBorder;
      if (chips[4]) chips[4].style.background = albActive;
    }
    st.panelBase=baseHex; st.panelSpread=spread; save(st);
  }
  function applySliderFromAccent(acHex){
    // Theo yêu cầu:
    // - background-color, track-muted đậm (tối) hơn accent
    // - foreground-color, thumb-hover-color đậm hơn các phần còn lại
    const bg  = shade(acHex, -0.25);
    const tm  = withAlpha(shade(acHex,+0.10), .55);
    const fg  = shade(acHex, -0.40);
    const th  = shade(acHex, -0.48);

    root.style.setProperty('--accent', acHex);
    root.style.setProperty('--background-color', bg);
    root.style.setProperty('--track-muted', tm);
    root.style.setProperty('--foreground-color', fg);
    root.style.setProperty('--thumb-hover-color', th);
    root.style.setProperty('--thumb-color', '#ffffff'); // giữ trắng

    st.accent = acHex; save(st);
  }
  function applyViz(mode, monoHex){
  st.vizMode = mode;
  st.vizMono = monoHex ?? st.vizMono ?? '#ffffff';
  save(st);
  colVizMono.style.display = (mode === 'mono') ? '' : 'none';
}

// Bind events
vizModeSel.addEventListener('change', () => {
  applyViz(vizModeSel.value, colVizMono.value);
});
colVizMono.addEventListener('input', () => {
  applyViz('mono', colVizMono.value);
});

  // Bind
  colPlayer.addEventListener('input', e => applyPlayer(e.target.value));
  colHeading.addEventListener('input', e => applyTexts(e.target.value, colText.value));
  colText.addEventListener('input',    e => applyTexts(colHeading.value, e.target.value));

  colPanel.addEventListener('input', e => applyPanels(e.target.value, Number(slSpread.value)));
  slSpread.addEventListener('input', e => {
    // bubble/track như slider khác
    const r = e.target;
    if (typeof updateSlider==='function') updateSlider(r);
    applyPanels(colPanel.value, Number(r.value));
  });

  colAccent.addEventListener('input', e => applySliderFromAccent(e.target.value));

  vizRadios.forEach(r => r.addEventListener('change', e => applyViz(e.target.value, colVizMono.value)));
  colVizMono.addEventListener('input', e => applyViz('mono', e.target.value));

  // Apply lần đầu
  applyPlayer(colPlayer.value);
  applyTexts(colHeading.value, colText.value);
  applyPanels(colPanel.value, Number(slSpread.value));
  applySliderFromAccent(colAccent.value);

  // Cho visualizer lấy màu theo prefs
  window.__getVizColor = function(i, value_in_ratio /* 0..1 */, segs, tSec){
  const mode = (st.vizMode || 'spectrum');
  if (mode === 'mono'){
    const hex = st.vizMono || '#ffffff';
    const hexToRgb = (h)=>{
      let s = h.startsWith('#') ? h.slice(1) : h;
      if (s.length===3) s = s.split('').map(c=>c+c).join('');
      const n = parseInt(s,16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
    };
    const {r,g,b} = hexToRgb(hex);
    const k = 0.35 + 0.65 * value_in_ratio; // sáng theo biên độ
    return `rgb(${Math.round(r*k)},${Math.round(g*k)},${Math.round(b*k)})`;
  }
  // Spectrum
  return `hsl(${value_in_ratio * 270}, 100%, 50%)`;
};

  // Khởi tạo bubble cho Spread (nếu bạn đang dùng hệ .range-wrap)
  const sl = document.getElementById('sl-panels-spread');
  if (sl && typeof updateSlider==='function'){
    updateSlider(sl);
    const wrap = sl.closest('.range-wrap');
    const show = ()=>{ updateSlider(sl); wrap.classList.add('show'); };
    const hide = ()=> wrap.classList.remove('show');
    sl.addEventListener('pointerenter', show);
    sl.addEventListener('pointerleave', hide);
    sl.addEventListener('pointerdown', show);
    sl.addEventListener('pointerup', hide);
    sl.addEventListener('blur', hide);
    window.addEventListener('resize', ()=>{ if (wrap.classList.contains('show')) show(); });
  }
}

  // --- Bắt đầu phần code Visualizer ---//

  // **QUAN TRỌNG**: Thay 'your-audio-player-id' bằng ID thật của thẻ <audio> trong code của bạn
  const player = document.getElementById("audio-player"); // hoặc "audioPlayer" nếu bạn dùng id đó
  const visualizer = document.getElementById("visualizer");

  const WIDTH = 800;
  const HEIGHT = 640;

  visualizer.width = WIDTH;
  visualizer.height = HEIGHT;
  const cCtx = visualizer.getContext("2d");

  // Web Audio
  let analyser, bufferLength, dataArray, aCtx, src;
  let isVisualizerInitialized = false;

  // Lưu bán kính hiện tại của hình tròn để bắt click

  function setupVisualizer() {
    if (isVisualizerInitialized) return;

    aCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Tránh lỗi tạo lại MediaElementSource nhiều lần
    try {
      src = aCtx.createMediaElementSource(player);
    } catch (e) {
      /* đã tạo trước đó */
    }
    analyser = analyser || aCtx.createAnalyser();

    if (src) src.connect(analyser);
    analyser.connect(aCtx.destination);

    analyser.fftSize = 512;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    isVisualizerInitialized = true;
  }

function draw() {
    requestAnimationFrame(draw);
    if (!analyser) return;

    analyser.getByteFrequencyData(dataArray);
    cCtx.clearRect(0, 0, WIDTH, HEIGHT);
    const t = performance.now()/1000;
    // --- Visualizer "tia nắng" (GIỮ NGUYÊN) ---
    for (let i = 0; i < bufferLength * 3; i++) {
      const sliceWidth = 2;
      let value_in_ratio = dataArray[i % bufferLength] / 256;
      const v = dataArray[i % bufferLength] / 256;
       const getClr = window.__getVizColor;
    cCtx.fillStyle = getClr ? getClr(i, v, bufferLength, t) : `hsl(${v * 270}, 100%, 50%)`;

      cCtx.save();
      cCtx.translate(WIDTH / 2, HEIGHT / 2);
      cCtx.rotate(((i / bufferLength) * 240 * Math.PI) / 180);
      cCtx.translate((WIDTH / 2) * -1, (HEIGHT / 2) * -1);

      cCtx.fillRect(
        WIDTH / 2,
        HEIGHT / 2,
        sliceWidth,
        value_in_ratio * (HEIGHT / 2) * -1
      );
      cCtx.restore();
    }

    // --- Hình tròn trắng (GIỮ NGUYÊN cách tính) ---
    let total = 0;
    for (let i = 0; i < bufferLength / 3; i++) total += dataArray[i];
    const average = total / (bufferLength / 3);

    const baseRadius = 200;
    const dynamicRadius = (average > 100 ? average - 100 : 0) * 0.1;
    const radius = baseRadius + dynamicRadius;

    const cx = WIDTH / 2,
      cy = HEIGHT / 2;

    cCtx.beginPath();
    cCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (circleImg) {
      cCtx.save();
      cCtx.clip();
      cCtx.drawImage(
        circleImg,
        cx - radius,
        cy - radius,
        radius * 2,
        radius * 2
      );
      cCtx.restore();
    } else {
      cCtx.fillStyle = "white";
      cCtx.fill();
    }
    cCtx.closePath();

    currentCircleRadius = radius; // nếu bạn dùng để hit-test click
  }

  // Khởi động khi audio bắt đầu phát
  player.addEventListener("playing", () => {
    if (!isVisualizerInitialized) setupVisualizer();
    // resume audio context nếu cần
    try {
      aCtx?.resume?.();
    } catch {}
    draw();
  });
  const card = document.querySelector(".player_card"); // lấy khung
  const panel = document.querySelector(".center-panel");
  let currentCircleRadius = 0;
  panel.addEventListener("mouseleave", () => {
    closePanel();
  });
  function openPanel() {
    card?.classList.add("open"); // left: 30%
    panel?.classList.add("open"); // hiện panel
  }
  function closePanel() {
    card?.classList.remove("open"); // quay về left: 50%
    panel?.classList.remove("open"); // ẩn panel
  }
  // Bắt click trên hình tròn (canvas)
  visualizer.addEventListener("click", function (event) {
    // Lấy vị trí của canvas trên trang web
    const rect = visualizer.getBoundingClientRect();

    // Tính toán tọa độ click của chuột bên trong canvas
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Tọa độ tâm của hình tròn
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    // Dùng định lý Pythagoras để tính khoảng cách từ điểm click đến tâm
    const distance = Math.sqrt(
      Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
    );

    // Kiểm tra xem khoảng cách có nhỏ hơn bán kính hiện tại không
    if (distance <= currentCircleRadius) {
      console.log("Đã click vào hình tròn!");
      openPanel();

      // --- ĐÂY LÀ NƠI BẠN THÊM HÀNH ĐỘNG CHO BUTTON ---
      // Ví dụ: Dừng/phát nhạc
    }
  });
  // === Profile (Settings) ===
(function initProfileSettings(){
  const PROFILE_KEY = 'mp_profile_v1';
  const input = document.getElementById('profile-name');

  function loadProfile(){
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveProfile(obj){
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(obj)); }
    catch {}
  }
  const prof = loadProfile();

  if (input){
    if (typeof prof.name === 'string') input.value = prof.name;

    const debounce = (fn, wait=250)=>{
      let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
    };

    const persist = debounce((val)=>{
      prof.name = (val || '').trim();
      saveProfile(prof);
      // Optional: hiển thị ở chỗ khác nếu bạn có phần tử
      // document.getElementById('profile-name-display')?.textContent = prof.name || '';
    });

    input.addEventListener('input', (e)=> persist(e.target.value));
  }

  // Expose tiện lợi (nếu cần dùng nơi khác)
  window.getProfileName = () => (loadProfile().name || '');
})();
// ===== Splash intro =====
(function initSplashIntro(){
  const splash = document.getElementById('splash');
  if (!splash) return;

  const barCenter = splash.querySelector('.bar-center');
  const barTop    = splash.querySelector('.bar-top');
  const barBot    = splash.querySelector('.bar-bottom');
  const textBox   = document.getElementById('splash-text');
  const nameEl    = document.getElementById('splash-name');
  const cta       = splash.querySelector('.splash-cta');

  // Lấy tên user từ Profile (LS) – trả '' nếu chưa đặt
  function getProfileName(){
    try {
      const n = (JSON.parse(localStorage.getItem('mp_profile_v1'))||{}).name || '';
      const t = String(n).trim();
      return t.length ? t : '';
    } catch { return ''; }
  }
  const userName = getProfileName();
  if (userName) {
    nameEl.textContent = userName;
    nameEl.style.display = '';
  } else {
    // Chưa có tên -> chỉ hiện "Welcome"
    nameEl.style.display = 'none';
  }

  let running = false;

  splash.addEventListener('click', async () => {
    if (running) return; running = true;

    cta?.remove();                 // 0) Ẩn CTA
    barCenter.classList.add('run'); // 1) Thanh giữa chạy dài

    // 2) Random phát bài (có user gesture nên không bị chặn autoplay)
    await randomPlayOneSongSafe();

    // 3) Khi thanh giữa xong -> tách lên/xuống + hiện chữ
    barCenter.addEventListener('animationend', () => {
      barCenter.style.display = 'none';
      barTop.classList.add('split');
      barBot.classList.add('split');

      setTimeout(() => { textBox.classList.add('on'); }, 120); // hiện chữ

      // 4) Sau khi chữ hiện một lúc -> ẩn splash
      setTimeout(() => {
        // KHÔNG dùng .out; để overlay và chữ fade cùng lúc
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 900); // khớp với 0.8s transition
 // khớp transition .35s
      }, 1400);
    }, { once: true });
  }, { once: true });

  // Helper: random phát 1 bài (im lặng, không bật relink nếu chưa được phép)
  async function randomPlayOneSongSafe(){
    try {
      const ids = Object.keys(store?.songs || {});
      if (!ids.length) return false;

      for (let i = 0; i < Math.min(6, ids.length); i++){
        const sid = ids[Math.floor(Math.random() * ids.length)];
        const song = store.songs[sid];
        await ensureSongObjectUrl(song).catch(()=>{});
        if (song.objectUrl){
          await startQueueFromSong(sid, 'all');
          return true;
        }
      }
      const fallbackId = ids[Math.floor(Math.random() * ids.length)];
      await startQueueFromSong(fallbackId, 'all');
      return true;
    } catch { return false; }
  }
})();

  rerender();
});
