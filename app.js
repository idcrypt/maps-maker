// app.js
let map, markers = [], locations = [];
let isAdding = false;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadFromStorage();
  setupEvents();
});

function initMap() {
  // Default view ke wilayah Jambi
  map = L.map('map').setView([-1.6101, 103.6131], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  map.on('click', (e) => {
    if (!isAdding) return;
    showAddForm(e.latlng);
  });
}

function setupEvents() {
  document.getElementById('add-btn').addEventListener('click', toggleAddMode);
  document.getElementById('export-img').addEventListener('click', exportAsImage);
  document.getElementById('export-json').addEventListener('click', exportJSON);
  document.getElementById('import-json').addEventListener('click', () => document.getElementById('import-input').click());
  document.getElementById('import-input').addEventListener('change', importJSON);
}

function toggleAddMode() {
  isAdding = !isAdding;
  const btn = document.getElementById('add-btn');
  btn.textContent = isAdding ? '✅ Klik Peta untuk Tambah' : '📌 Tambah Marker';
  btn.style.background = isAdding ? '#10b981' : '#3b82f6';
  map.getContainer().style.cursor = isAdding ? 'crosshair' : 'grab';
}

function showAddForm(latlng) {
  const content = `
    <div style="min-width:220px; padding:4px;">
      <h3 style="margin-bottom:6px; font-size:1rem;">Tambah Titik Lokasi</h3>
      <p style="font-size:0.82rem; margin-bottom:8px; font-family:monospace;">📍 ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</p>
      <label style="display:block; margin-bottom:6px; font-size:0.85rem;">Waktu:
        <input type="datetime-local" id="popup-time" value="${new Date().toISOString().slice(0,16)}" style="width:100%; margin-top:3px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;">
      </label>
      <label style="display:block; margin-bottom:8px; font-size:0.85rem;">Catatan:
        <input type="text" id="popup-note" placeholder="Contoh: Survey lahan, rapat desa..." style="width:100%; margin-top:3px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;">
      </label>
      <div style="display:flex; gap:6px;">
        <button id="save-btn" style="flex:1; padding:7px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer;">Simpan</button>
        <button id="cancel-btn" style="flex:1; padding:7px; background:#64748b; color:white; border:none; border-radius:4px; cursor:pointer;">Batal</button>
      </div>
    </div>
  `;
  const popup = L.popup().setLatLng(latlng).setContent(content).openOn(map);

  setTimeout(() => {
    document.getElementById('save-btn').onclick = () => {
      const time = document.getElementById('popup-time').value;
      const note = document.getElementById('popup-note').value;
      addLocation({ lat: latlng.lat, lng: latlng.lng }, time, note);
      map.closePopup();
    };
    document.getElementById('cancel-btn').onclick = () => map.closePopup();
  }, 0);
}

function addLocation(coord, time, note) {
  const id = Date.now().toString();
  const loc = { id, lat: coord.lat, lng: coord.lng, time, note };
  locations.push(loc);

  const marker = L.marker([loc.lat, loc.lng]).addTo(map);
  marker.bindPopup(`<b>🕒 ${time}</b><br>📝 ${note || 'Tanpa catatan'}`);
  markers.push({ id, marker });

  saveToStorage();
  updateFootnote();
  isAdding = false;
  document.getElementById('add-btn').textContent = '📌 Tambah Marker';
  document.getElementById('add-btn').style.background = '#3b82f6';
  map.getContainer().style.cursor = 'grab';
}

function updateFootnote() {
  const list = document.getElementById('locations-list');
  list.innerHTML = '';
  document.getElementById('marker-count').textContent = `${locations.length} lokasi`;

  // Tampilkan dari yang terbaru
  locations.slice().reverse().forEach(loc => {
    const li = document.createElement('li');
    li.className = 'loc-item';
    li.dataset.id = loc.id;
    li.innerHTML = `
      <div class="loc-header">
        <span class="loc-time">🕒 ${loc.time || '-'}</span>
        <span class="loc-coords">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</span>
      </div>
      <div class="loc-note">${loc.note || 'Tanpa catatan'}</div>
      <div class="loc-actions">
        <button class="btn-view" onclick="focusMarker('${loc.id}')">📍 Lihat</button>
        <button class="btn-del" onclick="deleteLoc('${loc.id}')">🗑️ Hapus</button>
      </div>
    `;
    list.appendChild(li);
  });
}

window.focusMarker = (id) => {
  const m = markers.find(x => x.id === id);
  if (m) {
    map.flyTo([m.marker.getLatLng().lat, m.marker.getLatLng().lng], 15);
    m.marker.openPopup();
    document.querySelectorAll('.loc-item').forEach(el => el.classList.remove('active'));
    const el = document.querySelector(`.loc-item[data-id="${id}"]`);
    if (el) { el.classList.add('active'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }
};

window.deleteLoc = (id) => {
  if (!confirm('Hapus lokasi ini?')) return;
  locations = locations.filter(l => l.id !== id);
  const m = markers.find(x => x.id === id);
  if (m) map.removeLayer(m.marker);
  markers = markers.filter(x => x.id !== id);
  saveToStorage();
  updateFootnote();
};

function saveToStorage() {
  try {
    localStorage.setItem('mapMakerData', JSON.stringify(locations));
  } catch (e) {
    alert('⚠️ Penyimpanan browser penuh. Silakan Export JSON.');
  }
}

function loadFromStorage() {
  try {
    const data = localStorage.getItem('mapMakerData');
    if (data) {
      locations = JSON.parse(data);
      locations.forEach(loc => {
        const m = L.marker([loc.lat, loc.lng]).addTo(map).bindPopup(`<b>${loc.time}</b><br>${loc.note}`);
        markers.push({ id: loc.id, marker: m });
      });
      updateFootnote();
    }
  } catch {}
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(locations, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `maps-data-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      locations = data;
      markers.forEach(m => map.removeLayer(m.marker));
      markers = [];
      saveToStorage();
      loadFromStorage();
      alert('✅ Data berhasil dimuat!');
    } catch {
      alert('❌ File JSON tidak valid.');
    }
  };
  reader.readAsText(file);
}

async function exportAsImage() {
  const btn = document.getElementById('export-img');
  btn.textContent = '⏳ Memproses...';
  btn.disabled = true;

  try {
    // Tunggu render peta selesai
    await new Promise(r => setTimeout(r, 300));
    const canvas = await html2canvas(document.getElementById('capture-area'), {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: 2, // Resolusi tinggi
      logging: false,
      foreignObjectRendering: true
    });

    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `maps-screenshot-${new Date().toISOString().slice(0,10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  } catch (err) {
    console.error(err);
    alert('Gagal membuat gambar. Pastikan koneksi internet aktif untuk memuat tile peta.');
  } finally {
    btn.textContent = '📸 Unduh Gambar';
    btn.disabled = false;
  }
}
