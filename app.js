// app.js
let map, markers = [];
let locations = [];
let currentPhoto = null;
let isAddingMarker = false;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadFromLocalStorage();
  setupEventListeners();
});

function initMap() {
  // Default view: Jambi
  map = L.map('map').setView([-1.6101, 103.6131], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}

function setupEventListeners() {
  document.getElementById('photo-input').addEventListener('change', handlePhotoUpload);
  document.getElementById('add-marker-mode').addEventListener('click', toggleAddMode);
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-input').click());
  document.getElementById('import-input').addEventListener('change', importData);

  map.on('click', function(e) {
    if (isAddingMarker) showMarkerForm(e.latlng);
  });
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentPhoto = ev.target.result;
    const preview = document.getElementById('photo-preview');
    preview.src = currentPhoto;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function toggleAddMode() {
  isAddingMarker = !isAddingMarker;
  const btn = document.getElementById('add-marker-mode');
  btn.textContent = isAddingMarker ? '✅ Mode Aktif (Klik Peta)' : '📌 Mode Tambah Marker (Klik Peta)';
  btn.style.background = isAddingMarker ? '#10b981' : '#2563eb';
  map.getContainer().style.cursor = isAddingMarker ? 'crosshair' : 'default';
}

function showMarkerForm(latlng) {
  const popupContent = `
    <div style="min-width:220px; padding:5px;">
      <h3 style="margin:0 0 8px;">Tambah Lokasi</h3>
      <p style="margin:4px 0; font-size:0.85rem;">Lat: ${latlng.lat.toFixed(5)} | Lng: ${latlng.lng.toFixed(5)}</p>
      <label style="display:block; margin:6px 0;">Waktu: <input type="datetime-local" id="marker-time" value="${new Date().toISOString().slice(0,16)}" style="width:100%; padding:4px;"></label>
      <label style="display:block; margin:6px 0;">Catatan: <input type="text" id="marker-note" placeholder="Kegiatan di sini..." style="width:100%; padding:4px;"></label>
      <div style="margin-top:8px; display:flex; gap:6px;">
        <button id="save-marker" class="btn-sm" style="background:#10b981;">Simpan</button>
        <button id="cancel-marker" class="btn-sm" style="background:#6b7280;">Batal</button>
      </div>
    </div>
  `;
  const popup = L.popup().setLatLng(latlng).setContent(popupContent).openOn(map);

  // Leaflet menambahkan konten ke DOM setelah popup dibuka
  setTimeout(() => {
    document.getElementById('save-marker').addEventListener('click', () => {
      const time = document.getElementById('marker-time').value;
      const note = document.getElementById('marker-note').value;
      addLocation(latlng, time, note, currentPhoto);
      map.closePopup();
    });
    document.getElementById('cancel-marker').addEventListener('click', () => map.closePopup());
  }, 0);
}

function addLocation(latlng, time, note, photo) {
  const id = Date.now().toString();
  const location = { id, lat: latlng.lat, lng: latlng.lng, time, note, photo: photo || null };
  locations.push(location);
  
  try {
    localStorage.setItem('mapLocations', JSON.stringify(locations));
  } catch (e) {
    alert('⚠️ Penyimpanan browser penuh. Silakan Export JSON lalu hapus data lama.');
  }
  
  renderMarker(location);
  updateList();
  isAddingMarker = false;
  document.getElementById('add-marker-mode').textContent = '📌 Mode Tambah Marker (Klik Peta)';
  document.getElementById('add-marker-mode').style.background = '#2563eb';
  map.getContainer().style.cursor = 'default';
}

function renderMarker(loc) {
  const marker = L.marker([loc.lat, loc.lng]).addTo(map);
  const imgHtml = loc.photo ? `<img src="${loc.photo}" style="max-width:180px; margin-top:6px; border-radius:4px;">` : '';
  marker.bindPopup(`<b>${loc.time}</b><br>${loc.note}<br>${imgHtml}`);
  markers.push({ id: loc.id, marker });
}

function updateList() {
  const list = document.getElementById('saved-locations');
  list.innerHTML = '';
  locations.slice().reverse().forEach(loc => { // Tampilkan yang terbaru di atas
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${loc.time}</strong> - ${loc.note || 'Tanpa catatan'}
        <small>Lat: ${loc.lat.toFixed(5)}, Lng: ${loc.lng.toFixed(5)}</small>
      </div>
      <div>
        <button onclick="flyTo(${loc.lat}, ${loc.lng})" class="btn-sm">📍 Lihat</button>
        <button onclick="deleteLocation('${loc.id}')" class="btn-sm btn-delete">🗑️</button>
      </div>
    `;
    list.appendChild(li);
  });
}

window.flyTo = (lat, lng) => map.flyTo([lat, lng], 15);
window.deleteLocation = (id) => {
  if (!confirm('Hapus data ini?')) return;
  locations = locations.filter(l => l.id !== id);
  markers = markers.filter(m => { if (m.id === id) m.marker.remove(); return m.id !== id; });
  localStorage.setItem('mapLocations', JSON.stringify(locations));
  updateList();
};

function exportData() {
  const blob = new Blob([JSON.stringify(locations, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maps-data-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      locations = data;
      localStorage.setItem('mapLocations', JSON.stringify(locations));
      markers.forEach(m => m.marker.remove());
      markers = [];
      loadFromLocalStorage();
      alert('✅ Data berhasil diimpor!');
    } catch {
      alert('❌ File JSON tidak valid.');
    }
  };
  reader.readAsText(file);
}

function loadFromLocalStorage() {
  try {
    const stored = localStorage.getItem('mapLocations');
    if (stored) locations = JSON.parse(stored);
  } catch { locations = []; }
  locations.forEach(loc => renderMarker(loc));
  updateList();
}
