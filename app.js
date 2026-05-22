/* ═══════════════════════════════════════════════════════════════
   app.js — Fondo Familiar Francihelena
   Conecta con el backend de Apps Script. Sin frameworks.
═══════════════════════════════════════════════════════════════ */

// ─── CONFIG ──────────────────────────────────────────────────
const API = 'https://script.google.com/macros/s/AKfycbw9_hYqRsE111fhNBqfMFQpOJNqnMYFz_2N2f-RsUX2AotXNLs31Qbk34TUBNXBwV0t/exec';

// ─── ESTADO GLOBAL ───────────────────────────────────────────
const STATE = {
  user:        null,   // { email, nombre, rol }
  feedLoaded:  false,
  actasLoaded: false,
};

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavPill();
  initScrollShadow();
  initRevealObserver();
  initComposerListeners();
  bootSession();
});

async function bootSession() {
  showAuthBanner('loading');
  try {
    const res = await get('getSessionUser');
    if (!res.ok) throw new Error(res.error);
    STATE.user = res.data.user;
    hideAuthBanner();
    applyRoleUI();
    loadInicio();
  } catch (err) {
    showAuthBanner('error', err.message || 'No autorizado.');
  }
}

// ─── AUTH BANNER ─────────────────────────────────────────────
function showAuthBanner(type, msg) {
  let banner = document.getElementById('auth-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'auth-banner';
    document.body.prepend(banner);
  }
  if (type === 'loading') {
    banner.className = 'auth-banner auth-loading';
    banner.innerHTML = `<span class="auth-spin"></span> Verificando tu acceso…`;
  } else {
    banner.className = 'auth-banner auth-error';
    banner.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <strong>Acceso denegado</strong><br>
        <span>${escHTML(msg)}</span><br>
        <small>Si crees que es un error, contacta al administrador del fondo.</small>
      </div>`;
    // Deshabilitar toda interacción
    document.querySelectorAll('button, input, textarea').forEach(el => el.disabled = true);
  }
}
function hideAuthBanner() {
  const b = document.getElementById('auth-banner');
  if (b) { b.style.animation = 'toastOut .3s forwards'; setTimeout(() => b.remove(), 320); }
}

// ─── ROL UI ──────────────────────────────────────────────────
function applyRoleUI() {
  const { rol } = STATE.user;

  // Mostrar nombre en nav
  const nameEl = document.getElementById('nav-user-name');
  if (nameEl) nameEl.textContent = STATE.user.nombre || STATE.user.email.split('@')[0];

  // Compositor de posts: visible para admin y member
  const composer = document.getElementById('composer');
  if (composer) composer.style.display = (rol === 'admin' || rol === 'member') ? '' : 'none';

  // Botón "Nueva acta": solo admin
  document.querySelectorAll('[data-role="admin"]').forEach(el => {
    el.style.display = rol === 'admin' ? '' : 'none';
  });

  // Like / react: solo member y admin
  document.querySelectorAll('[data-role="member"]').forEach(el => {
    el.style.display = (rol === 'admin' || rol === 'member') ? '' : 'none';
  });
}

// ─── NAV ─────────────────────────────────────────────────────
const VIEWS = ['inicio', 'muro', 'actas'];

function showView(v) {
  VIEWS.forEach(id => {
    const el = document.getElementById('v-' + id);
    if (!el) return;
    const active = id === v;
    el.classList.toggle('active', active);
    if (active) { el.classList.remove('view-enter'); void el.offsetWidth; el.classList.add('view-enter'); }
  });
  updatePillIndicator(v);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (v === 'muro'  && !STATE.feedLoaded)  loadFeed();
  if (v === 'actas' && !STATE.actasLoaded) loadActas();
}

function initNavPill() {
  updatePillIndicator('inicio');
}

function updatePillIndicator(view) {
  const wrap  = document.getElementById('nav-pills');
  if (!wrap) return;
  const pills = wrap.querySelectorAll('.pill');
  pills.forEach(p => p.classList.toggle('active', p.dataset.view === view));
  const active = wrap.querySelector('.pill.active');
  if (!active) return;

  let ind = document.getElementById('pill-ind');
  if (!ind) {
    ind = document.createElement('span');
    ind.id = 'pill-ind';
    ind.className = 'pill-ind';
    wrap.style.position = 'relative';
    wrap.insertBefore(ind, wrap.firstChild);
  }
  ind.style.left  = active.offsetLeft + 'px';
  ind.style.width = active.offsetWidth + 'px';
}

function initScrollShadow() {
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
  }, { passive: true });
}

// ─── SCROLL REVEAL ────────────────────────────────────────────
function initRevealObserver() {
  const ro = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('shown'); ro.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => ro.observe(el));
}
function observeNewReveal(root) {
  const ro = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('shown'); ro.unobserve(e.target); } });
  }, { threshold: 0.1 });
  root.querySelectorAll('.reveal:not(.shown)').forEach(el => ro.observe(el));
}

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = 'inf') {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-dot"></span>${escHTML(msg)}`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 280); }, 3400);
}

// ─── COMPOSER ────────────────────────────────────────────────
let selFile = null;

function initComposerListeners() {
  const nameIn = document.getElementById('post-name');
  const capIn  = document.getElementById('post-cap');
  if (nameIn) nameIn.addEventListener('input', () => { updateAvatar(); checkReady(); });
  if (capIn)  capIn.addEventListener('input', checkReady);
}

function updateAvatar() {
  const n  = (document.getElementById('post-name')?.value || '').trim();
  const av = document.getElementById('c-av');
  if (av) av.textContent = n ? n[0].toUpperCase() : '?';
}

function checkReady() {
  const name = (document.getElementById('post-name')?.value || '').trim();
  const cap  = (document.getElementById('post-cap')?.value  || '').trim();
  const btn  = document.getElementById('post-btn');
  if (btn) btn.disabled = !(name && (cap || selFile));
}

function previewFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Imagen demasiado grande (máx 5 MB)', 'err'); return; }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) { toast('Tipo de imagen no permitido', 'err'); return; }
  selFile = file;
  const r = new FileReader();
  r.onload = e => {
    const img = document.getElementById('prev-src');
    const wrap = document.getElementById('prev-wrap');
    if (img)  img.src = e.target.result;
    if (wrap) { wrap.style.display = 'block'; wrap.style.animation = 'cardIn .35s var(--spring)'; }
    checkReady();
  };
  r.readAsDataURL(file);
}

function clearImg() {
  selFile = null;
  const fi = document.getElementById('file-in');
  const ps = document.getElementById('prev-src');
  const pw = document.getElementById('prev-wrap');
  if (fi) fi.value = '';
  if (ps) ps.src = '';
  if (pw) pw.style.display = 'none';
  checkReady();
}

// ─── SUBMIT POST ─────────────────────────────────────────────
async function submitPost() {
  if (!STATE.user) return;
  if (!['admin', 'member'].includes(STATE.user.rol)) {
    toast('No tienes permiso para publicar', 'err'); return;
  }

  const name = (document.getElementById('post-name')?.value || '').trim();
  const cap  = (document.getElementById('post-cap')?.value  || '').trim();
  if (!name) { toast('Ingresa tu nombre', 'err'); return; }

  const btn = document.getElementById('post-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Publicando…'; }

  try {
    let b64 = '', btype = '';
    if (selFile) { b64 = await toB64(selFile); btype = selFile.type; }

    const res = await post({ action: 'newPost', caption: cap, imageBase64: b64, imageType: btype });
    if (!res.ok) throw new Error(res.error);

    toast('¡Publicado! 🎉', 'ok');
    if (document.getElementById('post-cap')) document.getElementById('post-cap').value = '';
    clearImg();
    STATE.feedLoaded = false;
    loadFeed();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Publicar'; checkReady(); }
  }
}

function toB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── FEED ────────────────────────────────────────────────────
const EMOJIS = ['❤️', '😂', '🔥', '👏', '😍', '🎉'];

async function loadFeed() {
  const container = document.getElementById('main-feed');
  if (!container) return;
  container.innerHTML = skeletonPosts();

  try {
    const res = await get('getPosts');
    if (!res.ok) throw new Error(res.error);
    STATE.feedLoaded = true;
    renderFeed(res.data.posts || [], container);
    const sEl = document.getElementById('s-posts');
    if (sEl) animateCount(sEl, (res.data.posts || []).length);
    renderPreview((res.data.posts || []).slice(0, 2));
  } catch (e) {
    container.innerHTML = emptyHTML('file', 'No se pudo cargar el muro.');
  }
}

function renderFeed(posts, container) {
  if (!posts.length) { container.innerHTML = emptyHTML('camera', 'Sé el primero en publicar.'); return; }
  container.innerHTML = posts.map((p, i) => postHTML(p, i)).join('');
  observeNewReveal(container);
}

function renderPreview(posts) {
  const c = document.getElementById('feed-preview');
  if (!c) return;
  if (!posts.length) { c.innerHTML = emptyHTML('camera', 'Aún no hay publicaciones.'); return; }
  c.innerHTML = posts.map((p, i) => postHTML(p, i)).join('');
  observeNewReveal(c);
}

function postHTML(p, i) {
  const rol     = STATE.user?.rol || 'viewer';
  const isOwner = STATE.user?.email === p.email;
  const canAct  = rol === 'admin' || rol === 'member';
  const canDel  = rol === 'admin' || isOwner;

  const img = p.imageUrl
    ? `<div class="post-img-wrap"><img class="post-img" src="${escAttr(p.imageUrl)}" alt="foto" loading="lazy" onerror="this.closest('.post-img-wrap').remove()"></div>`
    : '';

  const emojisHTML = canAct
    ? EMOJIS.map(e => `<button class="emo-btn" onclick="reactPost('${escAttr(p.id)}','${e}',this)">${e}</button>`).join('')
    : '';

  const deleteBtn = canDel
    ? `<button class="del-btn" onclick="confirmDeletePost('${escAttr(p.id)}')" title="Eliminar post">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>`
    : '';

  const likeBtn = canAct
    ? `<button class="like-btn" onclick="toggleLike('${escAttr(p.id)}',this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span class="lc">${p.likes || 0}</span>
      </button>`
    : `<span class="like-count-static">${p.likes || 0} ❤️</span>`;

  return `<article class="post-card" style="animation-delay:${i * .07}s" data-post-id="${escAttr(p.id)}">
    ${img}
    <div class="post-body">
      <div class="post-meta">
        <div class="post-av">${escHTML((p.autor || '?')[0].toUpperCase())}</div>
        <div>
          <span class="post-author">${escHTML(p.autor || 'Anónimo')}</span>
          ${isOwner ? '<span class="post-you">tú</span>' : ''}
        </div>
        <span class="post-date">${fmtDate(p.fecha)}</span>
        ${deleteBtn}
      </div>
      ${p.caption ? `<div class="post-caption">${escHTML(p.caption)}</div>` : ''}
    </div>
    <div class="post-foot">
      ${likeBtn}
      <div class="emoji-bar">${emojisHTML}</div>
    </div>
  </article>`;
}

async function toggleLike(postId, btn) {
  if (!canInteract()) return;
  const lc    = btn.querySelector('.lc');
  const liked = btn.classList.toggle('liked');
  lc.textContent = Math.max(0, (parseInt(lc.textContent) || 0) + (liked ? 1 : -1));
  btn.querySelector('svg')?.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.55)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }
  );
  try {
    const res = await post({ action: 'likePost', postId, delta: liked ? 1 : -1 });
    if (!res.ok) throw new Error(res.error);
  } catch (e) {
    toast('Error al guardar like', 'err');
    // Revertir optimistic update
    btn.classList.toggle('liked');
    lc.textContent = Math.max(0, (parseInt(lc.textContent) || 0) + (liked ? -1 : 1));
  }
}

async function reactPost(postId, emoji, btn) {
  if (!canInteract()) return;
  btn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.9) translateY(-6px)' }, { transform: 'scale(1)' }],
    { duration: 280, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }
  );
  toast(emoji, 'inf');
  try {
    const res = await post({ action: 'reactPost', postId, emoji });
    if (!res.ok) throw new Error(res.error);
  } catch (e) {
    toast('Error al guardar reacción', 'err');
  }
}

async function confirmDeletePost(postId) {
  if (!confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;
  try {
    const res = await post({ action: 'deletePost', postId });
    if (!res.ok) throw new Error(res.error);
    // Remover del DOM con animación
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) {
      card.style.transition = 'opacity .25s, transform .25s';
      card.style.opacity = '0';
      card.style.transform = 'scale(.95)';
      setTimeout(() => card.remove(), 260);
    }
    toast('Publicación eliminada', 'ok');
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// ─── ACTAS ───────────────────────────────────────────────────
async function loadActas() {
  const grid = document.getElementById('actas-grid');
  if (!grid) return;
  grid.innerHTML = skeletonActas();
  try {
    const res = await get('getActas');
    if (!res.ok) throw new Error(res.error);
    STATE.actasLoaded = true;
    const actas = res.data.actas || [];
    const sEl = document.getElementById('s-actas');
    if (sEl) animateCount(sEl, actas.length);
    if (!actas.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">${emptyHTML('file', 'No hay actas disponibles aún.')}</div>`;
      return;
    }
    grid.innerHTML = actas.map((a, i) => actaHTML(a, i)).join('');
    observeNewReveal(grid);
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1">${emptyHTML('wifi-off', 'No se pudo cargar. Verifica la URL del API.')}</div>`;
  }
}

function actaHTML(a, i) {
  const canAdmin = STATE.user?.rol === 'admin';

  const docxBtn = a.linkDocx
    ? `<a href="${escAttr(a.linkDocx)}" target="_blank" rel="noopener noreferrer"
         class="dl-btn dl-docx" onclick="event.stopPropagation();toast('Descargando DOCX…','inf')">
         ${iconDownload()} DOCX</a>` : '';
  const pptxBtn = a.linkPptx
    ? `<a href="${escAttr(a.linkPptx)}" target="_blank" rel="noopener noreferrer"
         class="dl-btn dl-pptx" onclick="event.stopPropagation();toast('Descargando PPTX…','inf')">
         ${iconDownload()} PPTX</a>` : '';
  const delBtn = canAdmin
    ? `<button class="del-btn" onclick="event.stopPropagation();confirmDeleteActa('${escAttr(a.id)}')" title="Eliminar acta">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg></button>` : '';

  return `<article class="acta-card" style="animation-delay:${i * .07}s" data-acta-id="${escAttr(a.id)}">
    <div class="acta-stripe"></div>
    <div class="acta-body">
      <span class="acta-tag">${escHTML(a.tipo || 'Asamblea General')}</span>
      <div class="acta-fecha">${escHTML(a.fecha || '')}</div>
      <div class="acta-resumen">${escHTML(a.resumen || '')}</div>
    </div>
    <div class="acta-foot">
      <div class="dl-btns">${docxBtn}${pptxBtn}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:10px;color:var(--t4)">${escHTML(a.asistentes || '')} asistentes</span>
        ${delBtn}
      </div>
    </div>
  </article>`;
}

async function confirmDeleteActa(actaId) {
  if (!confirm('¿Eliminar esta acta y sus archivos? Esta acción no se puede deshacer.')) return;
  try {
    const res = await post({ action: 'deleteActa', actaId });
    if (!res.ok) throw new Error(res.error);
    const card = document.querySelector(`[data-acta-id="${actaId}"]`);
    if (card) { card.style.opacity = '0'; card.style.transform = 'scale(.95)'; setTimeout(() => card.remove(), 260); }
    toast('Acta eliminada', 'ok');
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// Upload nueva acta — abre modal
function openNewActaModal() {
  let modal = document.getElementById('modal-acta');
  if (!modal) {
    modal = buildActaModal();
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
  modal.querySelector('input')?.focus();
}
function closeActaModal() {
  const m = document.getElementById('modal-acta');
  if (m) m.classList.remove('open');
}

function buildActaModal() {
  const el = document.createElement('div');
  el.id = 'modal-acta';
  el.className = 'modal-ov';
  el.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Nueva acta">
      <h3 class="modal-title">Nueva Acta</h3>
      <p class="modal-sub">Solo administradores pueden subir actas.</p>
      <div class="form-group">
        <label class="form-label" for="acta-fecha">Fecha *</label>
        <input class="form-input" id="acta-fecha" type="text" placeholder="19 de Abril, 2026" maxlength="60">
      </div>
      <div class="form-group">
        <label class="form-label" for="acta-tipo">Tipo *</label>
        <input class="form-input" id="acta-tipo" type="text" placeholder="Asamblea General" maxlength="80" value="Asamblea General">
      </div>
      <div class="form-group">
        <label class="form-label" for="acta-resumen">Resumen</label>
        <textarea class="form-input" id="acta-resumen" rows="3" placeholder="Temas tratados…" maxlength="500"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="acta-asistentes">Nº asistentes</label>
        <input class="form-input" id="acta-asistentes" type="number" min="0" max="999" placeholder="13">
      </div>
      <div class="form-group">
        <label class="form-label">Archivo DOCX</label>
        <div class="file-drop">
          <input type="file" id="acta-docx-file" accept=".docx">
          <div class="file-drop-ico">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="file-drop-txt">Selecciona el archivo DOCX</div>
          <div class="file-drop-name" id="docx-name"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Archivo PPTX</label>
        <div class="file-drop">
          <input type="file" id="acta-pptx-file" accept=".pptx">
          <div class="file-drop-ico">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div class="file-drop-txt">Selecciona el archivo PPTX</div>
          <div class="file-drop-name" id="pptx-name"></div>
        </div>
      </div>
      <div id="acta-upload-progress" class="upload-progress">
        <div class="progress-bar-wrap"><div class="progress-bar-fill" id="acta-pbar"></div></div>
        <div class="progress-txt" id="acta-ptxt">Subiendo…</div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" onclick="closeActaModal()">Cancelar</button>
        <button class="btn-submit" id="acta-submit-btn" onclick="submitNewActa()">Subir acta</button>
      </div>
    </div>`;

  // Preview de nombres de archivo
  el.querySelector('#acta-docx-file').addEventListener('change', function() {
    document.getElementById('docx-name').textContent = this.files[0]?.name || '';
  });
  el.querySelector('#acta-pptx-file').addEventListener('change', function() {
    document.getElementById('pptx-name').textContent = this.files[0]?.name || '';
  });

  // Cerrar al clic fuera
  el.addEventListener('click', e => { if (e.target === el) closeActaModal(); });

  return el;
}

async function submitNewActa() {
  const fecha      = document.getElementById('acta-fecha')?.value.trim();
  const tipo       = document.getElementById('acta-tipo')?.value.trim();
  const resumen    = document.getElementById('acta-resumen')?.value.trim();
  const asistentes = document.getElementById('acta-asistentes')?.value.trim();
  const docxFile   = document.getElementById('acta-docx-file')?.files[0];
  const pptxFile   = document.getElementById('acta-pptx-file')?.files[0];

  if (!fecha || !tipo) { toast('Fecha y tipo son obligatorios', 'err'); return; }
  if (!docxFile && !pptxFile) { toast('Sube al menos un documento', 'err'); return; }

  const btn  = document.getElementById('acta-submit-btn');
  const prog = document.getElementById('acta-upload-progress');
  const pbar = document.getElementById('acta-pbar');
  const ptxt = document.getElementById('acta-ptxt');

  btn.disabled = true;
  prog.classList.add('show');
  pbar.style.width = '20%'; ptxt.textContent = 'Preparando…';

  try {
    let docxB64 = '', pptxB64 = '';
    if (docxFile) { pbar.style.width = '40%'; ptxt.textContent = 'Leyendo DOCX…'; docxB64 = await toB64(docxFile); }
    if (pptxFile) { pbar.style.width = '60%'; ptxt.textContent = 'Leyendo PPTX…'; pptxB64 = await toB64(pptxFile); }

    pbar.style.width = '80%'; ptxt.textContent = 'Subiendo a Drive…';

    const res = await post({
      action: 'newActa', fecha, tipo, resumen, asistentes,
      docxBase64: docxB64, pptxBase64: pptxB64,
    });

    if (!res.ok) throw new Error(res.error);

    pbar.style.width = '100%'; ptxt.textContent = '¡Listo!';
    toast('Acta subida correctamente ✅', 'ok');
    setTimeout(() => { closeActaModal(); STATE.actasLoaded = false; loadActas(); }, 600);
  } catch (e) {
    toast('Error: ' + e.message, 'err');
    pbar.style.width = '0%';
  } finally {
    btn.disabled = false;
  }
}

// ─── INICIO ──────────────────────────────────────────────────
async function loadInicio() {
  try {
    const res = await get('getPosts');
    if (!res.ok) throw new Error(res.error);
    const posts = res.data.posts || [];
    const sEl = document.getElementById('s-posts');
    if (sEl) animateCount(sEl, posts.length);
    renderPreview(posts.slice(0, 2));
  } catch (e) { /* silencioso en inicio */ }
  try {
    const res = await get('getActas');
    if (!res.ok) throw new Error(res.error);
    const sEl = document.getElementById('s-actas');
    if (sEl) animateCount(sEl, (res.data.actas || []).length);
  } catch (e) {}
}

// ─── HTTP HELPERS ────────────────────────────────────────────
async function get(action) {
  const res = await fetch(`${API}?action=${encodeURIComponent(action)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function post(body) {
  const res = await fetch(API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── UTILS ───────────────────────────────────────────────────
function canInteract() {
  return STATE.user && ['admin', 'member'].includes(STATE.user.rol);
}

function escHTML(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s || '')));
  return d.innerHTML;
}
function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s), now = new Date(), df = Math.floor((now - d) / 1000);
    if (df < 60) return 'ahora';
    if (df < 3600) return Math.floor(df / 60) + 'm';
    if (df < 86400) return Math.floor(df / 3600) + 'h';
    if (df < 604800) return Math.floor(df / 86400) + 'd';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  } catch (e) { return s; }
}

function animateCount(el, target) {
  if (!el || isNaN(target)) return;
  let start = 0, dur = 900, t0 = null;
  const step = ts => {
    if (!t0) t0 = ts;
    const p    = Math.min((ts - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function skeletonPosts() {
  return `<div class="post-skel"><div class="skel sk-img"></div><div class="skel sk-ln mid"></div><div class="skel sk-ln short"></div></div>
    <div class="post-skel"><div class="skel sk-img" style="height:130px"></div><div class="skel sk-ln"></div><div class="skel sk-ln short"></div></div>`;
}
function skeletonActas() {
  return `<div class="acta-skel"><div class="skel sk-tag"></div><div class="skel sk-dt"></div><div class="skel sk-rs"></div><div class="skel sk-rs s"></div></div>`.repeat(3);
}

function emptyHTML(iconType, msg) {
  const icons = {
    camera: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    file:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    'wifi-off': '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  };
  return `<div class="empty">
    <div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${icons[iconType] || icons.file}</svg></div>
    <div>${escHTML(msg)}</div>
  </div>`;
}

function iconDownload() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`;
}
