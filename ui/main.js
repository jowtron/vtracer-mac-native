const { invoke } = window.__TAURI__.core;
const { save } = window.__TAURI__.dialog;
const { writeTextFile } = window.__TAURI__.fs;

let currentImageBase64 = null;
let currentSVG = null;
let debounceTimer;

const els = {
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    placeholder: document.getElementById('placeholder'),
    svgContainer: document.getElementById('svg-container'),
    originalImg: document.getElementById('original-img'),
    mediaContainer: document.getElementById('media-container'),
    downloadBtn: document.getElementById('download-btn'),
    resetBtn: document.getElementById('reset-btn'),
    loadingOverlay: document.getElementById('loading-overlay'),
    viewControls: document.getElementById('view-controls'),
    
    // Toggles
    modeBw: document.getElementById('mode-bw'),
    modeColor: document.getElementById('mode-color'),
    hierCutout: document.getElementById('hier-cutout'),
    hierStacked: document.getElementById('hier-stacked'),
    simPixel: document.getElementById('sim-pixel'),
    simPolygon: document.getElementById('sim-polygon'),
    simSpline: document.getElementById('sim-spline'),
    viewOriginal: document.getElementById('view-original'),
    viewSvg: document.getElementById('view-svg'),
    
    // Sliders
    filterSpeckle: document.getElementById('filter-speckle'),
    colorPrecision: document.getElementById('color-precision'),
    gradientStep: document.getElementById('gradient-step'),
    cornerThreshold: document.getElementById('corner-threshold'),
    segmentLength: document.getElementById('segment-length'),
    spliceThreshold: document.getElementById('splice-threshold'),
    pathPrecision: document.getElementById('path-precision'),
};

// UI State Management
const state = {
    isColor: true,
    isStacked: true,
    simplifyMode: 'pixel',
    viewMode: 'svg'
};

const defaults = {
    isColor: true,
    isStacked: true,
    simplifyMode: 'pixel',
    filterSpeckle: 4,
    colorPrecision: 6,
    gradientStep: 16,
    cornerThreshold: 60,
    segmentLength: 4.0,
    spliceThreshold: 45,
    pathPrecision: 2
};

function init() {
    setupDragAndDrop();
    setupControls();
    
    // Set initial slider positions
    updateToggleSlider(els.modeColor);
    updateToggleSlider(els.hierStacked);
    updateToggleSlider(els.simPixel);
    updateToggleSlider(els.viewSvg);
    updateSplineVisibility();
}

function setupDragAndDrop() {
    // HTML5 Drag and Drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        els.dropZone.addEventListener(evt, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    els.dropZone.addEventListener('drop', e => {
        const file = e.dataTransfer.files[0];
        if (file) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (file.type.startsWith('image/') || ['heic', 'heif'].includes(ext)) {
                loadFile(file);
            }
        }
    });

    els.fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) loadFile(file);
    });
}

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        currentImageBase64 = dataUrl.split(',')[1];
        
        els.originalImg.src = dataUrl;
        els.placeholder.style.display = 'none';
        els.mediaContainer.style.display = 'flex';
        els.viewControls.style.display = 'block';
        els.downloadBtn.disabled = false;
        
        triggerTrace();
    };
    reader.readAsDataURL(file);
}

function updateToggleSlider(activeBtn) {
    const group = activeBtn.parentElement;
    const slider = group.querySelector('.toggle-slider');
    const btns = Array.from(group.querySelectorAll('.toggle-btn'));
    
    btns.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
    
    const index = parseInt(activeBtn.dataset.index);
    const btnWidth = 100 / btns.length;
    slider.style.width = `calc(${btnWidth}% - 6px)`;
    slider.style.transform = `translateX(calc(${index * 100}% + ${index * 6}px))`;
}

function updateSplineVisibility() {
    const splineGroup = document.getElementById('spline-controls');
    if (state.simplifyMode === 'spline') {
        splineGroup.style.display = 'block';
    } else {
        splineGroup.style.display = 'none';
    }
}

function resetToDefaults() {
    state.isColor = defaults.isColor;
    state.isStacked = defaults.isStacked;
    state.simplifyMode = defaults.simplifyMode;

    updateToggleSlider(state.isColor ? els.modeColor : els.modeBw);
    updateToggleSlider(state.isStacked ? els.hierStacked : els.hierCutout);
    
    if (state.simplifyMode === 'pixel') updateToggleSlider(els.simPixel);
    else if (state.simplifyMode === 'polygon') updateToggleSlider(els.simPolygon);
    else updateToggleSlider(els.simSpline);

    els.filterSpeckle.value = defaults.filterSpeckle;
    els.colorPrecision.value = defaults.colorPrecision;
    els.gradientStep.value = defaults.gradientStep;
    els.cornerThreshold.value = defaults.cornerThreshold;
    els.segmentLength.value = defaults.segmentLength;
    els.spliceThreshold.value = defaults.spliceThreshold;
    els.pathPrecision.value = defaults.pathPrecision;

    // Update value displays
    [
        els.filterSpeckle, els.colorPrecision, els.gradientStep, 
        els.cornerThreshold, els.segmentLength, els.spliceThreshold, els.pathPrecision
    ].forEach(input => {
        const valSpan = input.parentElement.querySelector('.val');
        let val = input.value;
        if (input.id === 'corner-threshold' || input.id === 'splice-threshold') val += '°';
        valSpan.textContent = val;
    });

    updateSplineVisibility();
    triggerTrace();
}

function setupControls() {
    // Control Toggles
    els.modeBw.onclick = (e) => { state.isColor = false; updateToggleSlider(e.target); triggerTrace(); };
    els.modeColor.onclick = (e) => { state.isColor = true; updateToggleSlider(e.target); triggerTrace(); };
    els.hierCutout.onclick = (e) => { state.isStacked = false; updateToggleSlider(e.target); triggerTrace(); };
    els.hierStacked.onclick = (e) => { state.isStacked = true; updateToggleSlider(e.target); triggerTrace(); };
    els.simPixel.onclick = (e) => { state.simplifyMode = 'pixel'; updateToggleSlider(e.target); updateSplineVisibility(); triggerTrace(); };
    els.simPolygon.onclick = (e) => { state.simplifyMode = 'polygon'; updateToggleSlider(e.target); updateSplineVisibility(); triggerTrace(); };
    els.simSpline.onclick = (e) => { state.simplifyMode = 'spline'; updateToggleSlider(e.target); updateSplineVisibility(); triggerTrace(); };

    // View Toggles
    els.viewOriginal.onclick = (e) => { 
        state.viewMode = 'original'; 
        updateToggleSlider(e.target); 
        els.originalImg.style.display = 'block';
        els.svgContainer.style.display = 'none';
    };
    els.viewSvg.onclick = (e) => { 
        state.viewMode = 'svg'; 
        updateToggleSlider(e.target); 
        els.originalImg.style.display = 'none';
        els.svgContainer.style.display = 'block';
    };

    els.resetBtn.onclick = () => {
        resetToDefaults();
    };

    // Sliders
    [
        els.filterSpeckle, els.colorPrecision, els.gradientStep, 
        els.cornerThreshold, els.segmentLength, els.spliceThreshold, els.pathPrecision
    ].forEach(slider => {
        slider.addEventListener('input', e => {
            const valSpan = e.target.parentElement.querySelector('.val');
            let val = e.target.value;
            if (e.target.id === 'corner-threshold' || e.target.id === 'splice-threshold') val += '°';
            valSpan.textContent = val;
            debouncedTrace();
        });
    });

    // Download
    els.downloadBtn.onclick = async () => {
        if (!currentSVG) return;
        const filePath = await save({
            filters: [{ name: 'SVG', extensions: ['svg'] }],
            defaultPath: 'vectorized.svg'
        });
        if (filePath) {
            await writeTextFile(filePath, currentSVG);
        }
    };
}

function debouncedTrace() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(triggerTrace, 300); // Increased debounce to 300ms
}

async function triggerTrace() {
    if (!currentImageBase64) return;

    els.loadingOverlay.style.display = 'flex';

    try {
        const params = {
            image_base64: currentImageBase64,
            is_color: state.isColor,
            is_stacked: state.isStacked,
            filter_speckle: parseInt(els.filterSpeckle.value),
            color_precision: parseInt(els.colorPrecision.value),
            gradient_step: parseInt(els.gradientStep.value),
            simplify_mode: state.simplifyMode,
            corner_threshold: parseFloat(els.cornerThreshold.value),
            segment_length: parseFloat(els.segmentLength.value),
            splice_threshold: parseFloat(els.spliceThreshold.value),
            path_precision: parseInt(els.pathPrecision.value)
        };

        const svg = await invoke('trace_image', { params });
        currentSVG = svg;
        els.svgContainer.innerHTML = svg;
    } catch (e) {
        console.error("Tracing failed", e);
        alert("Error: " + e);
    } finally {
        els.loadingOverlay.style.display = 'none';
    }
}

init();
