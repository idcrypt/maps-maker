let map, markers = [], locations = [];
let isAdding = false, pendingLatLng = null;
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  $('photo-input').addEventListener('change', handlePhoto);
  $('toggle-add').addEventListener('click', toggleAddMode);
  $('btn-download').addEventListener('click', downloadArchive);
  $('btn-reset').addEventListener('click', resetData);

  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-save')) handleSavePoint();
    if (e.target.closest('.btn-cancel')) map.closePopup();
    if (e.target.closest('.btn-focus')) focusLoc(e.target.dataset.id);
    if (e.target.closest('.btn-delete')) deleteLoc(e.target.dataset.id);
  });
});

function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // 1. Hitung rasio agar muat di layar browser
      const maxH = window.innerHeight * 0.9; // Maks 90% tinggi layar
      const scale = Math.min(1, maxH / img.naturalHeight);
      
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const footerH = Math.round(h * 0.125); // Footer 1/8 tinggi foto

      // 2. Terapkan ukuran ke container
      const container = $('archive-container');
      container.style.width = `${w}px`;
      container.style.height = `${h}px`;
      
      $('bg-photo').src = ev.target.result;
      $('bottom-panel').style.height = `${footerH}px`;
      
      $('upload-screen').classList.add('hidden');
      container.classList.add('active');
      
      initMap();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function initMap() {
  if(map) map.remove();
  map = L.map('mini-map', { zoomControl: false }).setView([-1.6101, 103.6131], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    crossOrigin: 'anonymous', attribution: 'OSM'
  }).addTo(map);
  
  map.invalidateSize();
  map.on('click', handleMapClick);
  renderMarkers();
  renderList();
}

function toggleAddMode() {
  isAdding = !isAdding;
  $('toggle-add').classList.toggle('btn-active', isAdding);
  $('toggle-add').textContent = isAdding ? '✅ Klik Peta' : '📌 Tambah Titik';
  map.getContainer().style.cursor = isAdding ? 'crosshair' : 'default';
}

function handleMapClick(e) {
  if (!isAdding) return;
  pendingLatLng = e.latlng;
  const content = `
    <div class="popup-form">
      <label>Waktu</label><input type="datetime-local" id="p-time" value="${new Date().toISOString().slice(0,16)}">
      <label>Catatan</label><input type="text" id="p-note" placeholder="Kegiatan...">
      <div class="btn-group"><button class="btn-save">Simpan</button><button class="btn-cancel">Batal</button></div>
    </div>`;
  L.popup().setLatLng(pendingLatLng).setContent(content).openOn(map);
}

function handleSavePoint() {
  if (!pendingLatLng) return;
  const time = document.getElementById('p-time').value;
  const note = document.getElementById('p-note').value;
  locations.push({ id: Date.now().toString(), lat: pendingLatLng.lat, lng: pendingLatLng.lng, time, note });
  saveData(); renderMarkers(); renderList();
  toggleAddMode(); map.closePopup(); pendingLatLng = null;
}

function renderMarkers() {
  markers.forEach(m => map.removeLayer(m)); markers = [];
  locations.forEach(loc => {
    const m = L.marker([loc.lat, loc.lng]).addTo(map);
    m.bindPopup(`<b>${loc.time}</b><br>${loc.note}<br><small>${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</small>`);
    markers.push(m);
  });
  $('count-badge').textContent = `${locations.length} titik`;
}

function renderList() {
  const list = $('loc-list'); list.innerHTML = '';
  locations.slice().reverse().forEach(loc => {
    list.innerHTML += `
      <li class="loc-item">
        <div><div class="loc-time">${loc.time}</div><div class="loc-coords">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div><div class="loc-note">${loc.note}</div></div>
        <div class="loc-actions"><button class="btn-focus" data-id="${loc.id}">🔍</button><button class="btn-delete" data-id="${loc.id}">🗑️</button></div>
      </li>`;
  });
}

function focusLoc(id) {
  const idx = locations.findIndex(l => l.id === id);
  if (idx > -1 && markers[idx]) {
    map.flyTo([locations[idx].lat, locations[idx].lng], 14);
    markers[idx].openPopup();
  }
}

function deleteLoc(id) {
  if (!confirm('Hapus titik ini?')) return;
  locations = locations.filter(l => l.id !== id);
  saveData(); renderMarkers(); renderList();
}

function saveData() { try { localStorage.setItem('arsipData', JSON.stringify(locations)); } catch {} }
function loadData() { try { const d = localStorage.getItem('arsipData'); if (d) locations = JSON.parse(d); } catch {} }
function resetData() {
  if (!confirm('Reset semua?')) return;
  locations = []; markers = []; localStorage.removeItem('arsipData');
  $('archive-container').classList.remove('active'); $('upload-screen').classList.remove('hidden'); $('photo-input').value = '';
  if(map) map.remove(); map = null;
}

async function downloadArchive() {
  const btn = $('btn-download');
  const container = $('archive-container');
  
  // Sembunyikan tombol & kontrol
  const hide = ['.controls button', '.btn-delete', '.leaflet-control-zoom'];
  hide.forEach(sel => {
    const els = document.querySelectorAll(sel);
    els.forEach(el => { el.style.display = 'none'; });
  });

  btn.textContent = '⏳...';
  await new Promise(r => setTimeout(r, 300));

  try {
    // Capture container (yang ukurannya sudah pas dengan rasio foto)
    const canvas = await html2canvas(container, {
      useCORS: true, allowTaint: true, scale: window.devicePixelRatio || 2, // Kualitas tinggi
      backgroundColor: null, logging: false
    });
    
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      // Nama file mengikuti tanggal
      a.download = `arsip_${new Date().toISOString().slice(0,10)}.png`;
      a.click();
    });
  } catch (e) { alert('Gagal unduh. Tunggu peta termuat.'); }
  finally {
    btn.textContent = '📥 Unduh';
    hide.forEach(sel => {
      const els = document.querySelectorAll(sel);
      els.forEach(el => { el.style.display = ''; });
    });
  }
}
