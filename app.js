// app.js
let map, markers = [], locations = [];
let isAdding = false;
let pendingLatLng = null;

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
});

function setupEventListeners() {
  $('photo-input').addEventListener('change', handlePhoto);
  $('toggle-add').addEventListener('click', toggleAddMode);
  $('btn-download').addEventListener('click', downloadArchive);
  $('btn-reset').addEventListener('click', resetData);

  // Event Delegation
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.closest('.btn-save')) handleSavePoint();
    if (target.closest('.btn-cancel')) map.closePopup();
    if (target.closest('.btn-focus')) focusLoc(target.dataset.id);
    if (target.closest('.btn-delete')) deleteLoc(target.dataset.id);
  });
}

function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    $('bg-photo').src = ev.target.result;
    $('upload-screen').classList.add('hidden');
    $('archive-container').classList.add('active');
    initMap();
  };
  reader.readAsDataURL(file);
}

function initMap() {
  map = L.map('mini-map', { zoomControl: false }).setView([-1.6101, 103.6131], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    crossOrigin: 'anonymous', attribution: '© OpenStreetMap'
  }).addTo(map);
  map.invalidateSize();
  map.on('click', handleMapClick);
  renderMarkers();
  renderList();
}

function toggleAddMode() {
  isAdding = !isAdding;
  $('toggle-add').classList.toggle('btn-active', isAdding);
  map.getContainer().style.cursor = isAdding ? 'crosshair' : 'default';
  $('toggle-add').textContent = isAdding ? '✅ Klik Peta untuk Tambah' : '📌 Tambah Titik';
}

function handleMapClick(e) {
  if (!isAdding) return;
  pendingLatLng = e.latlng;
  const nowStr = new Date().toISOString().slice(0, 16);
  const content = `
    <div class="popup-form">
      <label>Waktu Kegiatan</label>
      <input type="datetime-local" id="p-time" value="${nowStr}">
      <label>Catatan / Nama Kegiatan</label>
      <input type="text" id="p-note" placeholder="Contoh: Survey lapangan, koordinasi dinas...">
      <div class="btn-group">
        <button class="btn-save">💾 Simpan</button>
        <button class="btn-cancel">Batal</button>
      </div>
    </div>
  `;
  L.popup().setLatLng(pendingLatLng).setContent(content).openOn(map);
}

function handleSavePoint() {
  if (!pendingLatLng) return;
  const time = document.getElementById('p-time')?.value || new Date().toISOString().slice(0, 16);
  const note = document.getElementById('p-note')?.value.trim() || '';
  
  locations.push({ id: Date.now().toString(), lat: pendingLatLng.lat, lng: pendingLatLng.lng, time, note });
  saveData();
  renderMarkers();
  renderList();
  toggleAddMode();
  map.closePopup();
  pendingLatLng = null;
}

function renderMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  locations.forEach(loc => {
    const m = L.marker([loc.lat, loc.lng]).addTo(map);
    m.bindPopup(`<b>${loc.time}</b><br>${loc.note || 'Tanpa catatan'}<br><small>${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</small>`);
    markers.push(m);
  });
  $('count-badge').textContent = `${locations.length} titik`;
}

function renderList() {
  const list = $('loc-list');
  list.innerHTML = '';
  locations.slice().reverse().forEach(loc => {
    const li = document.createElement('li');
    li.className = 'loc-item';
    li.innerHTML = `
      <div>
        <div class="loc-time">🕒 ${loc.time}</div>
        <div class="loc-coords">📍 ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>
        <div class="loc-note">${loc.note || '-'}</div>
      </div>
      <div class="loc-actions">
        <button class="btn-focus" data-id="${loc.id}" title="Lihat di Peta">🔍</button>
        <button class="btn-delete" data-id="${loc.id}" title="Hapus">🗑️</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function focusLoc(id) {
  const loc = locations.find(l => l.id === id);
  const idx = locations.indexOf(loc);
  if (loc && markers[idx]) {
    map.flyTo([loc.lat, loc.lng], 14);
    markers[idx].openPopup();
    document.querySelectorAll('.loc-item').forEach(el => el.style.background = '');
    const activeLi = document.querySelector(`.loc-item .btn-focus[data-id="${id}"]`)?.closest('.loc-item');
    if (activeLi) activeLi.style.background = 'rgba(59, 130, 246, 0.2)';
  }
}

function deleteLoc(id) {
  if (!confirm('Hapus titik lokasi ini?')) return;
  locations = locations.filter(l => l.id !== id);
  saveData();
  renderMarkers();
  renderList();
}

function saveData() {
  try { localStorage.setItem('arsip_dinas_data', JSON.stringify(locations)); } catch {}
}
function loadData() {
  try { 
    const d = localStorage.getItem('arsip_dinas_data'); 
    if (d) locations = JSON.parse(d); 
  } catch {}
}
function resetData() {
  if (!confirm('Hapus semua data & kembali ke upload foto?')) return;
  locations = []; markers = []; pendingLatLng = null;
  localStorage.removeItem('arsip_dinas_data');
  $('bg-photo').src = '';
  $('archive-container').classList.remove('active');
  $('upload-screen').classList.remove('hidden');
  $('photo-input').value = '';
  if (map) map.remove(); map = null;
}

// 📥 FUNGSI UNDUH YANG DIPERBAIKI
async function downloadArchive() {
  const container = $('archive-container');
  const btn = $('btn-download');
  btn.textContent = '⏳ Menyiapkan...'; btn.disabled = true;
  
  // 1. Identifikasi & sembunyikan elemen yang tidak diinginkan di hasil gambar
  const zoomCtrl = document.querySelector('.leaflet-control-zoom');
  const delBtns = document.querySelectorAll('.btn-delete');
  const ctrlBtns = document.querySelectorAll('.controls button');
  const hideList = [zoomCtrl, ...delBtns, ...ctrlBtns];
  
  // Simpan style asli, lalu sembunyikan
  hideList.forEach(el => { 
    if(el) { 
      el.dataset.origDisplay = el.style.display || ''; 
      el.style.display = 'none'; 
    } 
  });
  
  // Tunggu DOM update sebelum capture
  await new Promise(r => setTimeout(r, 300));
  
  try {
    // 2. Capture dengan dimensi eksak 1:1 layar
    const canvas = await html2canvas(container, {
      useCORS: true,
      allowTaint: true,
      scale: 1, // 1:1 persis ukuran layar
      backgroundColor: '#0f172a',
      logging: false,
      // Tidak perlu width/height manual, html2canvas otomatis mengikuti ukuran container
    });
    
    // 3. Download
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `arsip_dinas_${new Date().toISOString().slice(0,10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  } catch (e) {
    console.error(e);
    alert('Gagal mengunduh. Pastikan tile peta sudah termuat penuh.');
  } finally {
    // 4. Kembalikan semua tombol
    hideList.forEach(el => { 
      if(el) el.style.display = el.dataset.origDisplay; 
    });
    btn.textContent = '📥 Unduh Arsip'; btn.disabled = false;
  }
}
