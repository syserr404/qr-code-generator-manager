/* ═══════════════════════════════════════════════════
   Xduce QR Manager — Frontend Logic v2
   Campaigns → QR Codes hierarchy
   ═══════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────
let state = {
  campaigns: {},
  currentCampaignId: null,
  currentQRCode: null,
  editingCampaignId: null  // for edit mode in campaign modal
};

// ── Utils ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

function toast(msg, type = 'ok') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

function fmt(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso));
}

function fmtShort(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(iso));
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function totalScans(camp) {
  return Object.values(camp.qrCodes || {}).reduce((sum, q) => sum + (q.scanCount || 0), 0);
}

function qrCount(camp) {
  return Object.keys(camp.qrCodes || {}).length;
}

// ── View Navigation ───────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
  const el = $(`view-${name}`);
  el.style.display = '';
  el.classList.add('active');
}

function showCampaigns() {
  state.currentCampaignId = null;
  state.currentQRCode = null;
  showView('campaigns');
  updateBreadcrumb();
  updateHeaderBtn('campaigns');
  renderCampaignGrid();
}

function showQRCodes(campaignId) {
  state.currentCampaignId = campaignId;
  state.currentQRCode = null;
  showView('qrcodes');
  updateBreadcrumb(campaignId);
  updateHeaderBtn('qrcodes');
  renderQRView();
}

function updateBreadcrumb(campaignId) {
  const bc = $('breadcrumb');
  if (!campaignId) {
    bc.innerHTML = `<span class="bc-item bc-active" data-view="campaigns">All Campaigns</span>`;
  } else {
    const name = esc(state.campaigns[campaignId]?.name || 'Campaign');
    bc.innerHTML = `
      <span class="bc-item" id="bc-campaigns">All Campaigns</span>
      <span class="bc-sep">›</span>
      <span class="bc-item bc-active">${name}</span>`;
    $('bc-campaigns').addEventListener('click', showCampaigns);
  }
}

function updateHeaderBtn(view) {
  const btn = $('btn-primary-action');
  if (view === 'campaigns') {
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> <span class="btn-primary-text">New Campaign</span>`;
    btn.onclick = () => openCampaignModal();
  } else {
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> <span class="btn-primary-text">Add QR Code</span>`;
    btn.onclick = () => openQRModal();
  }
}

// ── API ───────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadCampaigns() {
  state.campaigns = await api('GET', '/api/campaigns');
}

// ── Campaign Grid ──────────────────────────────────────
function renderCampaignGrid() {
  const grid = $('campaign-grid');
  const empty = $('campaigns-empty');
  const camps = Object.values(state.campaigns).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  grid.innerHTML = '';

  if (camps.length === 0) {
    empty.style.display = 'flex';
    grid.appendChild(empty);
    return;
  }
  empty.style.display = 'none';

  camps.forEach(camp => {
    const card = document.createElement('div');
    card.className = 'campaign-card';
    card.innerHTML = `
      <div class="cc-top">
        <div class="cc-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
            <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
            <rect x="18" y="18" width="3" height="3"/>
          </svg>
        </div>
        <div style="flex:1">
          <div class="cc-name">${esc(camp.name)}</div>
          <div class="cc-desc">${esc(camp.description || '')}</div>
        </div>
      </div>
      <div class="cc-footer">
        <div class="cc-stat">
          <strong>${qrCount(camp)}</strong> QR code${qrCount(camp) !== 1 ? 's' : ''}
          &nbsp;&nbsp;<strong>${totalScans(camp)}</strong> total scan${totalScans(camp) !== 1 ? 's' : ''}
        </div>
        <div class="cc-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    card.addEventListener('click', () => showQRCodes(camp.id));
    grid.appendChild(card);
  });

  // "New campaign" card
  const newCard = document.createElement('div');
  newCard.className = 'campaign-card new-card';
  newCard.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    <span class="new-card-label">New Campaign</span>`;
  newCard.addEventListener('click', () => openCampaignModal());
  grid.appendChild(newCard);
}

// ── QR Code View ──────────────────────────────────────
function renderQRView() {
  const camp = state.campaigns[state.currentCampaignId];
  if (!camp) return;

  $('campaign-view-name').textContent = camp.name;
  $('campaign-view-desc').textContent = camp.description || '';

  const qrCodes = camp.qrCodes || {};
  const codes = Object.keys(qrCodes).sort((a, b) => new Date(qrCodes[b].createdAt) - new Date(qrCodes[a].createdAt));

  $('qr-badge').textContent = codes.length;
  const listEl = $('qr-list-inner');
  const qrEmpty = $('qr-empty');

  listEl.innerHTML = '';

  if (codes.length === 0) {
    listEl.appendChild(qrEmpty);
    qrEmpty.style.display = 'flex';
  } else {
    qrEmpty.style.display = 'none';
    codes.forEach(code => {
      const entry = qrCodes[code];
      const item = document.createElement('div');
      item.className = `qr-item${state.currentQRCode === code ? ' active' : ''}`;
      item.id = `qi-${code}`;
      item.innerHTML = `
        <div class="qr-item-label">${esc(entry.label)}</div>
        <div class="qr-item-code">${code}</div>
        <div class="qr-item-status">
          <div class="dot-status${entry.target ? '' : ' off'}"></div>
          <span style="color:${entry.target ? 'var(--green)' : 'var(--txt3)'}">
            ${entry.target ? 'Active' : 'Not configured'}
          </span>
          ${entry.scanCount ? `<span style="color:var(--txt3);margin-left:6px">· ${entry.scanCount} scan${entry.scanCount !== 1 ? 's' : ''}</span>` : ''}
        </div>`;
      item.addEventListener('click', () => selectQR(code));
      listEl.appendChild(item);
    });
  }

  // Show detail or placeholder
  if (state.currentQRCode && qrCodes[state.currentQRCode]) {
    renderQRDetail(state.currentQRCode);
  } else if (codes.length > 0) {
    selectQR(codes[0]);
  } else {
    $('qr-placeholder').style.display = 'flex';
    $('qr-detail-content').style.display = 'none';
  }
}

function selectQR(code) {
  state.currentQRCode = code;
  document.querySelectorAll('.qr-item').forEach(el => el.classList.remove('active'));
  const item = $(`qi-${code}`);
  if (item) item.classList.add('active');
  renderQRDetail(code);
}

function renderQRDetail(code) {
  const camp = state.campaigns[state.currentCampaignId];
  const entry = camp?.qrCodes?.[code];
  if (!entry) return;

  $('qr-placeholder').style.display = 'none';
  $('qr-detail-content').style.display = 'grid';

  $('qr-name-display').textContent = entry.label;
  $('qr-scans').textContent = `${entry.scanCount || 0} scan${entry.scanCount !== 1 ? 's' : ''}`;
  $('qr-created-date').textContent = `Created ${fmtShort(entry.createdAt)}`;
  $('fixed-url-display').textContent = `${window.location.origin}/r/${code}`;
  $('inp-target').value = entry.target || '';
  $('inp-qr-label').value = entry.label || '';
  $('field-status').textContent = '';
  $('field-status').className = 'field-status';

  renderHistory(entry.history || []);
  renderScans(entry.scans || []);
  loadQRImage(code);
}

function loadQRImage(code) {
  const wrap = $('qr-img-wrap');
  const spinner = $('qr-spinner-wrap');
  spinner.classList.remove('hidden');

  // Remove old canvas if any
  const old = wrap.querySelector('canvas');
  if (old) old.remove();
  const oldImg = $('qr-img');
  if (oldImg) oldImg.style.display = 'none';

  const canvas = document.createElement('canvas');
  canvas.className = 'qr-img loaded';
  canvas.id = 'qr-canvas';
  canvas.style.cssText = 'width:100%;height:100%;display:block;';

  // Load QR PNG from server (plain, no logo)
  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  qrImg.onload = () => {
    const size = qrImg.naturalWidth || 600;
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Draw QR
    ctx.drawImage(qrImg, 0, 0, size, size);

    // Overlay logo client-side
    const logo = new Image();
    logo.onload = () => {
      const logoSize  = Math.round(size * 0.22);
      const padding   = Math.round(logoSize * 0.15);
      const padded    = logoSize + padding * 2;
      const x         = Math.round((size - padded) / 2);
      const y         = Math.round((size - padded) / 2);

      // White background square
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, padded, padded);

      // Logo centred on the white square
      ctx.drawImage(logo, x + padding, y + padding, logoSize, logoSize);

      wrap.appendChild(canvas);
      spinner.classList.add('hidden');
    };
    logo.onerror = () => {
      // No logo — still show QR
      wrap.appendChild(canvas);
      spinner.classList.add('hidden');
    };
    logo.src = '/logo.png';
  };
  qrImg.onerror = () => {
    spinner.classList.add('hidden');
    console.error('QR image failed to load');
  };
  qrImg.src = `/api/qr/${code}?t=${Date.now()}`;
}

function renderHistory(history) {
  const box = $('history-box');
  if (!history.length) {
    box.innerHTML = '<p class="history-empty-msg">No redirect history yet.</p>';
    return;
  }
  box.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-url">${esc(h.url)}</div>
      <div class="history-date">${fmt(h.replacedAt || h.setAt)}</div>
    </div>`).join('');
}

function renderScans(scans) {
  const box = $('scans-box');
  if (!scans.length) {
    box.innerHTML = '<p class="history-empty-msg">No scans yet.</p>';
    return;
  }
  box.innerHTML = scans.map(s => `
    <div class="history-item">
      <div class="history-url" style="color:var(--txt)">IP: ${esc(s.ip || 'Unknown')}</div>
      <div class="history-date" style="margin-top:2px; font-size:10px; color:var(--txt3)">${esc(s.ua || '')}</div>
      <div class="history-date" style="margin-top:2px">${fmt(s.timestamp)}</div>
    </div>`).join('');
}

// ── Campaign Actions ──────────────────────────────────
function openCampaignModal(editId) {
  state.editingCampaignId = editId || null;
  $('modal-campaign-title').textContent = editId ? 'Edit Campaign' : 'New Campaign';
  $('modal-campaign-submit').textContent = editId ? 'Save Changes' : 'Create Campaign';
  if (editId) {
    const camp = state.campaigns[editId];
    $('inp-camp-name').value = camp.name;
    $('inp-camp-desc').value = camp.description || '';
  } else {
    $('inp-camp-name').value = '';
    $('inp-camp-desc').value = '';
  }
  $('modal-campaign-backdrop').classList.add('open');
  setTimeout(() => $('inp-camp-name').focus(), 80);
}

function closeCampaignModal() { $('modal-campaign-backdrop').classList.remove('open'); }

$('modal-campaign-close').addEventListener('click', closeCampaignModal);
$('modal-campaign-cancel').addEventListener('click', closeCampaignModal);
$('modal-campaign-backdrop').addEventListener('click', e => { if (e.target === $('modal-campaign-backdrop')) closeCampaignModal(); });

$('modal-campaign-submit').addEventListener('click', async () => {
  const name = $('inp-camp-name').value.trim();
  const description = $('inp-camp-desc').value.trim();
  if (!name) { $('inp-camp-name').focus(); return; }

  const btn = $('modal-campaign-submit');
  btn.disabled = true;
  try {
    if (state.editingCampaignId) {
      await api('PUT', `/api/campaigns/${state.editingCampaignId}`, { name, description });
      state.campaigns[state.editingCampaignId].name = name;
      state.campaigns[state.editingCampaignId].description = description;
      closeCampaignModal();
      toast('Campaign updated!');
      if (state.currentCampaignId === state.editingCampaignId) renderQRView();
      else renderCampaignGrid();
    } else {
      const res = await api('POST', '/api/campaigns', { name, description });
      state.campaigns[res.id] = res.campaign;
      closeCampaignModal();
      toast('Campaign created!');
      showQRCodes(res.id);
    }
  } catch (err) { toast(`Failed: ${err.message}`, 'err'); }
  finally { btn.disabled = false; }
});

$('inp-camp-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('inp-camp-submit')?.click() || $('modal-campaign-submit').click(); });

// Edit / Delete campaign buttons (inside QR view header)
$('btn-edit-campaign').addEventListener('click', () => { if (state.currentCampaignId) openCampaignModal(state.currentCampaignId); });
$('btn-delete-campaign').addEventListener('click', async () => {
  if (!state.currentCampaignId) return;
  const camp = state.campaigns[state.currentCampaignId];
  if (!confirm(`Delete campaign "${camp.name}" and all its QR codes?\n\nThis cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/campaigns/${state.currentCampaignId}`);
    delete state.campaigns[state.currentCampaignId];
    toast('Campaign deleted');
    showCampaigns();
  } catch { toast('Delete failed', 'err'); }
});

// ── QR Code Actions ───────────────────────────────────
function openQRModal() {
  $('inp-qr-new-label').value = '';
  $('inp-qr-new-target').value = '';
  $('modal-qr-backdrop').classList.add('open');
  setTimeout(() => $('inp-qr-new-label').focus(), 80);
}
function closeQRModal() { $('modal-qr-backdrop').classList.remove('open'); }

$('modal-qr-close').addEventListener('click', closeQRModal);
$('modal-qr-cancel').addEventListener('click', closeQRModal);
$('modal-qr-backdrop').addEventListener('click', e => { if (e.target === $('modal-qr-backdrop')) closeQRModal(); });

$('modal-qr-submit').addEventListener('click', async () => {
  const label = $('inp-qr-new-label').value.trim();
  const target = $('inp-qr-new-target').value.trim();
  if (!label) { $('inp-qr-new-label').focus(); return; }
  const btn = $('modal-qr-submit');
  btn.disabled = true;
  try {
    const res = await api('POST', `/api/campaigns/${state.currentCampaignId}/qrcodes`, { label, target });
    if (!state.campaigns[state.currentCampaignId].qrCodes) state.campaigns[state.currentCampaignId].qrCodes = {};
    state.campaigns[state.currentCampaignId].qrCodes[res.code] = res.entry;
    state.currentQRCode = res.code;
    closeQRModal();
    renderQRView();
    toast('QR code created!');
  } catch (err) { toast(`Failed: ${err.message}`, 'err'); }
  finally { btn.disabled = false; }
});

$('inp-qr-new-target').addEventListener('keydown', e => { if (e.key === 'Enter') $('modal-qr-submit').click(); });

// Add QR button in sidebar
$('btn-add-qr').addEventListener('click', openQRModal);

// Update destination URL
$('btn-update').addEventListener('click', async () => {
  if (!state.currentCampaignId || !state.currentQRCode) return;
  const target = $('inp-target').value.trim();
  const status = $('field-status');
  if (!target) { status.textContent = 'Enter a destination URL.'; status.className = 'field-status err'; return; }
  try { new URL(target); } catch { status.textContent = 'Enter a valid URL (include https://).'; status.className = 'field-status err'; return; }

  const btn = $('btn-update');
  btn.disabled = true;
  try {
    const res = await api('PUT', `/api/campaigns/${state.currentCampaignId}/qrcodes/${state.currentQRCode}`, { target });
    state.campaigns[state.currentCampaignId].qrCodes[state.currentQRCode] = res.entry;
    status.textContent = '✓ Redirect updated!';
    status.className = 'field-status ok';
    renderHistory(res.entry.history || []);
    renderQRView();
    toast('Redirect updated!');
    setTimeout(() => { status.textContent = ''; }, 4000);
  } catch (err) { 
    status.textContent = `Update failed: ${err.message}`; 
    status.className = 'field-status err'; 
    toast('Update failed', 'err'); 
  }
  finally { btn.disabled = false; }
});

$('inp-target').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-update').click(); });

// Save label
$('btn-save-label').addEventListener('click', async () => {
  if (!state.currentCampaignId || !state.currentQRCode) return;
  const label = $('inp-qr-label').value.trim();
  if (!label) return;
  const entry = state.campaigns[state.currentCampaignId].qrCodes[state.currentQRCode];
  try {
    await api('PUT', `/api/campaigns/${state.currentCampaignId}/qrcodes/${state.currentQRCode}`, { target: entry.target || '', label });
    entry.label = label;
    $('qr-name-display').textContent = label;
    renderQRView();
    toast('Label saved!');
  } catch { toast('Failed to save label', 'err'); }
});

// Delete QR
$('btn-delete-qr').addEventListener('click', async () => {
  if (!state.currentCampaignId || !state.currentQRCode) return;
  const entry = state.campaigns[state.currentCampaignId].qrCodes[state.currentQRCode];
  if (!confirm(`Delete QR code "${entry.label}"?\n\nThis cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/campaigns/${state.currentCampaignId}/qrcodes/${state.currentQRCode}`);
    delete state.campaigns[state.currentCampaignId].qrCodes[state.currentQRCode];
    state.currentQRCode = null;
    renderQRView();
    toast('QR code deleted');
  } catch { toast('Delete failed', 'err'); }
});

// Download — export the canvas which already has the logo baked in
$('btn-download').addEventListener('click', () => {
  if (!state.currentQRCode) return;
  const entry = state.campaigns[state.currentCampaignId]?.qrCodes?.[state.currentQRCode];
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) { toast('QR not loaded yet', 'err'); return; }
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `xduce-qr-${(entry?.label || state.currentQRCode).replace(/\s+/g,'-').toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('QR downloaded!');
  }, 'image/png');
});

// Copy URL
$('btn-copy-url').addEventListener('click', () => {
  if (!state.currentQRCode) return;
  const url = `${window.location.origin}/r/${state.currentQRCode}`;
  navigator.clipboard.writeText(url).then(() => toast('URL copied!')).catch(() => toast('Copy failed', 'err'));
});

// Empty state create button
$('btn-empty-create').addEventListener('click', () => openCampaignModal());

// ── Init ──────────────────────────────────────────────
async function init() {
  try {
    await loadCampaigns();
    showCampaigns();
  } catch (err) {
    console.error(err);
    toast('Failed to load data', 'err');
  }
}

init();
