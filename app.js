let map, markers = [], locations = [];
let isAdding = false, pendingLatLng = null;
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  $('photo-input').addEventListener('change', handlePhoto);
  $('toggle-add').addEventListener('click', toggleAddMode);
  $('btn-download').addEventListener('click', downloadArchive);
  $('btn-reset').addEventListener('click', resetData);
});

function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const maxW = window.innerWidth * 0.95;
      const maxH = window.innerHeight * 0.8;
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
      
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      
      const container = $('archive-container');
      container.style.width = `${w}px`;
      container.style.height = `${h}px`;

      $('bg-photo').src = ev.target.result;
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
  renderMarkers(); renderList();
}

function toggleAddMode() {
  isAdding = !isAdding;
  $('toggle-add').classList.toggle('btn-active', isAdding);
  $('toggle-add').textContent = isAdding ? '✅ Klik pada Peta' : '📌 Tambah Titik';
  map.getContainer().style.cursor = isAdding ? 'crosshair' : 'default';
}

function handleMapClick(e) {
  if (!isAdding) return;
  pendingLatLng = e.latlng;
  openModal(e.latlng);
}

// Modal Logic
function openModal(latlng) {
  $('m-time').value = new Date().toISOString().slice(0, 16);
  $('m-note').value = '';
  $('modal-coords-display').textContent = `📍 ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
  $('input-modal').classList.add('active');
}
window.closeModal = () => $('input-modal').classList.remove('active');
window.saveFromModal = () => {
  if (!pendingLatLng) return;
  const time = $('m-time').value;
  const note = $('m-note').value.trim();
  locations.push({ id: Date.now().toString(), lat: pendingLatLng.lat, lng: pendingLatLng.lng, time, note });
  saveData(); renderMarkers(); renderList();
  closeModal(); toggleAddMode(); pendingLatLng = null;
};

function renderMarkers() {
  markers.forEach(m => map.removeLayer(m)); markers = [];
  locations.forEach(loc => {
    const m = L.marker([loc.lat, loc.lng]).addTo(map);
    m.bindPopup(`<b>${loc.time}</b><br>${loc.note}`);
    markers.push(m);
  });
  $('count-badge').textContent = `${locations.length} titik`;
}

function renderList() {
  const list = $('loc-list'); list.innerHTML = '';
  locations.slice().reverse().forEach(loc => {
    list.innerHTML += `
      <li class="loc-item">
        <div class="loc-main">
          <span class="loc-time">🕒 ${loc.time}</span>
          <div class="loc-meta">
            <span class="loc-coords">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</span>
          </div>
          <span class="loc-note">${loc.note || '-'}</span>
        </div>
        <div class="loc-actions">
          <button class="btn-focus" data-id="${loc.id}" title="Lihat di Peta">🔍</button>
          <button class="btn-delete" data-id="${loc.id}" title="Hapus">🗑️</button>
        </div>
      </li>`;
  });
  
  // Event delegation untuk tombol dinamis
  document.querySelectorAll('.btn-focus').forEach(btn => {
    btn.onclick = () => {
      const idx = locations.findIndex(l => l.id === btn.dataset.id);
      if (idx > -1 && markers[idx]) map.flyTo([locations[idx].lat, locations[idx].lng], 14), markers[idx].openPopup();
    };
  });
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('Hapus titik ini?')) return;
      locations = locations.filter(l => l.id !== btn.dataset.id);
      saveData(); renderMarkers(); renderList();
    };
  });
}

function saveData() { try { localStorage.setItem('arsipData', JSON.stringify(locations)); } catch {} }
function loadData() { try { const d = localStorage.getItem('arsipData'); if (d) locations = JSON.parse(d); } catch {} }
function resetData() {
  if (!confirm('Reset semua data & foto?')) return;
  locations = []; markers = []; localStorage.removeItem('arsipData');
  $('archive-container').classList.remove('active'); $('upload-screen').classList.remove('hidden'); $('photo-input').value = '';
  if(map) map.remove(); map = null;
}

async function downloadArchive() {
  const container = $('archive-container');
  const btn = $('btn-download');
  
  // Sembunyikan UI saat capture
  const hideEls = document.querySelectorAll('.controls button, .btn-delete, .leaflet-control-zoom');
  hideEls.forEach(el => { el.dataset.prevDisp = el.style.display; el.style.display = 'none'; });

  btn.textContent = '⏳ Memproses...'; btn.disabled = true;
  await new Promise(r => setTimeout(r, 400)); // Tunggu UI render

  try {
    const canvas = await html2canvas(container, {
      width: container.offsetWidth,
      height: container.offsetHeight,
      scale: window.devicePixelRatio || 2,
      useCORS: true, allowTaint: true, backgroundColor: '#000', logging: false
    });
    
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `arsip_${new Date().toISOString().slice(0,10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  } catch (e) { alert('Gagal unduh. Pastikan tile peta sudah termuat.'); }
  finally {
    btn.textContent = '📥 Unduh Arsip'; btn.disabled = false;
    hideEls.forEach(el => { el.style.display = el.dataset.prevDisp || ''; });
  }
}
