// App State
const state = {
    view: 'home',
    stream: null,
    capturedImages: [null, null, null], // Array for 3 images
    activeSlot: 0,
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
    form: document.getElementById('novelty-form')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    elements.previewSlots = document.querySelectorAll('.photo-preview-slot');
    updateStats();
    renderCaptures();

    // Event Listeners
    document.getElementById('btn-camera').addEventListener('click', () => {
        // Find first empty slot or default to 0
        const emptySlot = state.capturedImages.findIndex(img => img === null);
        state.activeSlot = emptySlot === -1 ? 0 : emptySlot;
        openCamera();
    });

    document.getElementById('btn-close-camera').addEventListener('click', closeCamera);
    document.getElementById('btn-take-photo').addEventListener('click', takePhoto);
    document.getElementById('btn-switch-camera').addEventListener('click', switchCamera);
    document.getElementById('btn-cancel-form').addEventListener('click', () => switchView('home'));
    document.getElementById('btn-sync').addEventListener('click', syncAll);

    // Allow clicking slots to retake
    elements.previewSlots.forEach((slot, index) => {
        slot.addEventListener('click', () => {
            state.activeSlot = index;
            openCamera();
        });
    });

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

    const newCapture = {
        id: Date.now(),
        name: document.getElementById('prod-name').value,
        desc: document.getElementById('prod-desc').value,
        size: document.getElementById('prod-size').value,
        qty: document.getElementById('prod-qty').value,
        text: document.getElementById('prod-text').value,
        sample: document.getElementById('prod-sample').value,
        zone: document.getElementById('prod-zone').value,
        images: [...state.capturedImages], // Copy current images
        date: new Date().toLocaleString(),
        status: 'pending'
    };

    state.captures.unshift(newCapture);
    saveData();

    // Reset
    state.capturedImages = [null, null, null];
    elements.previewSlots.forEach(s => {
        s.classList.remove('has-photo');
        s.querySelector('img').src = '';
    });
    elements.form.reset();

    switchView('home');
    renderCaptures();
    updateStats();
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
        <div class="capture-item">
            <img src="${c.images[0] || ''}" class="item-thumb" alt="thumb">
            <div class="item-info">
                <h4>${c.name}</h4>
                <p>${c.date}</p>
            </div>
            <div class="item-status status-${c.status}">
                <i class="fas ${c.status === 'synced' ? 'fa-check-circle' : 'fa-clock'}"></i>
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
    const DEFAULT_URL = "https://script.google.com/macros/s/AKfycbw98X0A92tPhG-Zdi7O1PN-FBXfQezaUDZIA7m_PSh_IkYR-pvOoEgAggTo8Iunn2IZ5w/exec";

    // Si no hay URL guardada, usamos la por defecto y la guardamos
    if (!localStorage.getItem('myl_gas_url')) {
        localStorage.setItem('myl_gas_url', DEFAULT_URL);
    }

    const GAS_URL = localStorage.getItem('myl_gas_url');

    elements.loader.classList.remove('hidden');

    try {
        // Send items one by one to avoid large payload issues with Google Apps Script
        for (let item of pending) {
            await fetch(localStorage.getItem('myl_gas_url'), {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(item)
            });
            item.status = 'synced';
        }

        saveData();
        renderCaptures();
        updateStats();
        alert("¡Sincronización enviada!");
    } catch (err) {
        console.error("Error sync:", err);
        alert("Error al sincronizar.");
    } finally {
        elements.loader.classList.add('hidden');
    }
}
