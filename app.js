// App State
const state = {
    view: 'home',
    stream: null,
    capturedImages: [null, null, null], // Array for 3 images
    activeSlot: 0,
    editingId: null, // Track if we are editing an existing record
    captures: JSON.parse(localStorage.getItem('myl_captures') || '[]'),
    facingMode: 'environment'
};

// DOM Elements
const views = {
    home: document.getElementById('home-view'),
    camera: document.getElementById('camera-view'),
    form: document.getElementById('form-view')
};

const elements = {
    video: document.getElementById('video'),
    canvas: document.getElementById('canvas'),
    previewImages: [
        document.getElementById('preview-img-1'),
        document.getElementById('preview-img-2'),
        document.getElementById('preview-img-3')
    ],
    previewSlots: null, // Will be set in DOMContentLoaded
    captureContainer: document.getElementById('capture-container'),
    pendingCount: document.getElementById('pending-count'),
    syncedCount: document.getElementById('synced-count'),
    loader: document.getElementById('loader'),
    form: document.getElementById('novelty-form'),
    modal: document.getElementById('photo-options-modal'),
    fileInput: document.getElementById('file-input')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    elements.previewSlots = document.querySelectorAll('.photo-preview-slot');
    updateStats();
    renderCaptures();

    // Event Listeners
    document.getElementById('btn-camera').addEventListener('click', () => {
        resetForm();
        switchView('form');
    });

    document.getElementById('btn-close-camera').addEventListener('click', closeCamera);
    document.getElementById('btn-take-photo').addEventListener('click', takePhoto);
    document.getElementById('btn-switch-camera').addEventListener('click', switchCamera);
    document.getElementById('btn-cancel-form').addEventListener('click', () => switchView('home'));
    document.getElementById('btn-sync').addEventListener('click', syncAll);

    // Allow clicking slots to open options
    elements.previewSlots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            state.activeSlot = index;
            openModal();
        });
    });

    elements.fileInput.addEventListener('change', handleFileSelect);

    elements.form.addEventListener('submit', handleFormSubmit);
});

// Navigation
function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
    state.view = viewName;
}

// Camera Logic
async function openCamera() {
    try {
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: state.facingMode },
            audio: false
        });
        elements.video.srcObject = state.stream;
        switchView('camera');
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
    }
}

function closeCamera() {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
    }
    switchView('home');
}

function switchCamera() {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    closeCamera();
    openCamera();
}

function takePhoto() {
    const context = elements.canvas.getContext('2d');
    elements.canvas.width = elements.video.videoWidth;
    elements.canvas.height = elements.video.videoHeight;
    context.drawImage(elements.video, 0, 0, elements.canvas.width, elements.canvas.height);

    const imgData = elements.canvas.toDataURL('image/jpeg', 0.7);
    state.capturedImages[state.activeSlot] = imgData;

    // Update preview
    const imgElement = elements.previewImages[state.activeSlot];
    imgElement.src = imgData;
    elements.previewSlots[state.activeSlot].classList.add('has-photo');

    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
    }

    switchView('form');
}

// Form & Data Handling
function handleFormSubmit(e) {
    e.preventDefault();

    const captureData = {
        name: document.getElementById('prod-name').value,
        desc: document.getElementById('prod-desc').value,
        size: document.getElementById('prod-size').value,
        qty: document.getElementById('prod-qty').value,
        text: document.getElementById('prod-text').value,
        sample: document.getElementById('prod-sample').value,
        zone: document.getElementById('prod-zone').value,
        images: [...state.capturedImages],
        date: new Date().toLocaleString(),
        status: 'pending'
    };

    if (state.editingId) {
        // Update existing
        const index = state.captures.findIndex(c => c.id === state.editingId);
        if (index !== -1) {
            state.captures[index] = { ...state.captures[index], ...captureData, id: state.editingId };
        }
        state.editingId = null;
    } else {
        // New capture
        const newCapture = { ...captureData, id: Date.now() };
        state.captures.unshift(newCapture);
    }

    saveData();
    resetForm();
    switchView('home');
    renderCaptures();
    updateStats();
}

function resetForm() {
    state.capturedImages = [null, null, null];
    state.editingId = null;
    elements.previewSlots.forEach(s => {
        s.classList.remove('has-photo');
        s.querySelector('img').src = '';
    });
    elements.form.reset();
}

function editCapture(id) {
    const capture = state.captures.find(c => c.id === id);
    if (!capture) return;

    state.editingId = id;
    state.capturedImages = [...capture.images];

    // Fill form
    document.getElementById('prod-name').value = capture.name;
    document.getElementById('prod-desc').value = capture.desc;
    document.getElementById('prod-size').value = capture.size;
    document.getElementById('prod-qty').value = capture.qty;
    document.getElementById('prod-text').value = capture.text;
    document.getElementById('prod-sample').value = capture.sample;
    document.getElementById('prod-zone').value = capture.zone;

    // Show images
    state.capturedImages.forEach((img, i) => {
        const imgEl = elements.previewImages[i];
        if (img) {
            imgEl.src = img;
            elements.previewSlots[i].classList.add('has-photo');
        } else {
            imgEl.src = '';
            elements.previewSlots[i].classList.remove('has-photo');
        }
    });

    switchView('form');
}

function deleteCapture(id) {
    if (confirm('¿Estás seguro de que quieres borrar este registro?')) {
        state.captures = state.captures.filter(c => c.id !== id);
        saveData();
        renderCaptures();
        updateStats();
    }
}

function saveData() {
    localStorage.setItem('myl_captures', JSON.stringify(state.captures.slice(0, 50))); // Keep last 50
}

function updateStats() {
    const pending = state.captures.filter(c => c.status === 'pending').length;
    const synced = state.captures.filter(c => c.status === 'synced').length;

    elements.pendingCount.textContent = pending;
    elements.syncedCount.textContent = synced;
}

function renderCaptures() {
    if (state.captures.length === 0) {
        elements.captureContainer.innerHTML = '<p class="empty-msg">No hay capturas recientes</p>';
        return;
    }

    elements.captureContainer.innerHTML = state.captures.map(c => `
        <div class="capture-item" onclick="editCapture(${c.id})">
            <img src="${c.images[0] || ''}" class="item-thumb" alt="thumb">
            <div class="item-info">
                <h4>${c.name}</h4>
                <p>${c.date}</p>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="event.stopPropagation(); deleteCapture(${c.id})">
                    <i class="fas fa-trash"></i>
                </button>
                <div class="item-status status-${c.status}">
                    <i class="fas ${c.status === 'synced' ? 'fa-check-circle' : 'fa-clock'}"></i>
                </div>
            </div>
        </div>
    `).join('');
}

// Sync Logic
async function syncAll() {
    const pending = state.captures.filter(c => c.status === 'pending');
    if (pending.length === 0) {
        alert("No hay nada pendiente de sincronizar.");
        return;
    }

    // URL por defecto proporcionada por el usuario
    const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbwGCFaayECnQi-ajh4R48zOGoU3BNVXfgTJq7BilCCKTuIOj62QOEpVFNNGTd_OjFL6uA/exec";

    // Forzamos la actualización de la URL si es la vieja
    if (localStorage.getItem('myl_gas_url') !== DEFAULT_URL) {
        localStorage.setItem('myl_gas_url', DEFAULT_URL);
    }

    const GAS_URL = DEFAULT_URL;

    elements.loader.classList.remove('hidden');

    try {
        let successCount = 0;
        let errors = [];

        for (let item of pending) {
            try {
                // Ensure timestamp and app version identifier to debug old script issues
                const payload = { ...item, _app_version: '1.1', _sync_time: new Date().toISOString() };

                await fetch(GAS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify(payload)
                });

                item.status = 'synced';
                successCount++;
            } catch (e) {
                console.error("Error enviando item:", item.id, e);
                errors.push(item.name);
            }
        }

        saveData();
        renderCaptures();
        updateStats();

        if (errors.length === 0) {
            alert(`¡Sincronización enviada! ${successCount} registros procesados.\nSi el Excel sigue vacío, revisa que hayas IMPLEMENTADO el script como NUEVA VERSIÓN en Google.`);
        } else {
            alert(`Sincronización parcial. Se enviaron ${successCount}, pero fallaron: ${errors.join(', ')}`);
        }
    } catch (err) {
        console.error("Sync error:", err);
        alert("Error de conexión al sincronizar.");
    } finally {
        elements.loader.classList.add('hidden');
    }
}

// Modal & File Handling
function openModal() {
    elements.modal.classList.add('active');
}

function closeModal() {
    elements.modal.classList.remove('active');
}

function handlePhotoOption(type) {
    closeModal();
    if (type === 'camera') {
        openCamera();
    } else if (type === 'gallery') {
        elements.fileInput.click();
    }
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    e.target.value = ''; // Reset input

    try {
        const imgData = await resizeImage(file);
        state.capturedImages[state.activeSlot] = imgData;

        // Update preview
        const imgElement = elements.previewImages[state.activeSlot];
        imgElement.src = imgData;
        elements.previewSlots[state.activeSlot].classList.add('has-photo');
    } catch (err) {
        console.error("Error reading file:", err);
        alert("Error al procesar la imagen.");
    }
}

function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1280;

                if (width > height && width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                } else if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Expose functions to window for inline onclick handlers
window.editCapture = editCapture;
window.deleteCapture = deleteCapture;
window.handlePhotoOption = handlePhotoOption;
window.closeModal = closeModal;
