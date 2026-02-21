/**
 * CROP FILLING VALIDATION - Main Application Logic
 * Converted from Python main.py to JavaScript
 */

// =============================================================================
// GLOBAL STATE
// =============================================================================

const AppState = {
    summaryDF: null,
    mismatchDF: null,
    validationRun: false,
    legacyFiles: [],
    newFiles: [],
    isProcessing: false
};

// =============================================================================
// FILE HANDLING
// =============================================================================

function handleLegacyFileUpload(event) {
    const files = Array.from(event.target.files);
    AppState.legacyFiles = files;
    
    const fileList = document.getElementById('legacy-file-list');
    fileList.innerHTML = '';
    
    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.textContent = `✓ ${file.name}`;
        fileList.appendChild(div);
    });
}

function handleNewFileUpload(event) {
    const files = Array.from(event.target.files);
    AppState.newFiles = files;
    
    const fileList = document.getElementById('new-file-list');
    fileList.innerHTML = '';
    
    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.textContent = `✓ ${file.name}`;
        fileList.appendChild(div);
    });
}

// =============================================================================
// VALIDATION RUNNER
// =============================================================================

async function runValidation() {
    // Validation checks
    if (AppState.legacyFiles.length === 0) {
        showToast('⚠️ Upload Legacy files first', 'warning');
        return;
    }
    
    if (AppState.newFiles.length === 0) {
        showToast('⚠️ Upload Wherobots files first', 'warning');
        return;
    }
    
    AppState.isProcessing = true;
    
    // Disable buttons during processing
    document.getElementById('run-btn').disabled = true;
    document.getElementById('reset-btn').disabled = true;
    
    // Show progress
    const progressDiv = document.getElementById('progress-container');
    progressDiv.style.display = 'block';
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '0%';
    
    const statusText = document.getElementById('status-text');
    statusText.textContent = 'Initializing validation...';
    
    try {
        // Run validation with progress callback
        const result = await runValidation(
            AppState.legacyFiles,
            AppState.newFiles,
            (current, total, message) => {
                const percent = (current / total) * 100;
                progressBar.style.width = percent + '%';
                statusText.textContent = message;
            }
        );
        
        if (!result.success) {
            showToast(`❌ Validation failed: ${result.error}`, 'error');
            return;
        }
        
        // Store results
        AppState.summaryDF = result.summary;
        AppState.mismatchDF = result.mismatch;
        AppState.validationRun = true;
        
        // Hide progress
        progressDiv.style.display = 'none';
        
        // Show results
        displayResults(result.summary, result.mismatch);
        
        showToast('✅ Validation completed successfully!', 'success');
        
    } catch (error) {
        console.error('Validation error:', error);
        showToast(`❌ Error: ${error.message}`, 'error');
    } finally {
        AppState.isProcessing = false;
        
        // Re-enable buttons
        document.getElementById('run-btn').disabled = false;
        document.getElementById('reset-btn').disabled = false;
    }
}

// =============================================================================
// RESULTS DISPLAY
// =============================================================================

function displayResults(summary, mismatch) {
    const resultsSection = document.getElementById('results-section');
    resultsSection.style.display = 'block';
    
    // Display Summary Tab
    displaySummaryTable(summary);
    
    // Display Mismatch Tab
    displayMismatchTable(mismatch);
    
    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 500);
}

function displaySummaryTable(data) {
    if (!data || data.length === 0) {
        document.getElementById('summary-table').innerHTML = 
            '<p class="no-data">No summary data available</p>';
        return;
    }
    
    const table = createTable(data, ['RID', 'Crop', 'Season', 'TP', 'FP', 'FN', 
        'Precision', 'Recall', 'F1', 'Accuracy', 'Kappa']);
    
    document.getElementById('summary-table').innerHTML = '';
    document.getElementById('summary-table').appendChild(table);
}

function displayMismatchTable(data) {
    if (!data || data.length === 0) {
        document.getElementById('mismatch-table').innerHTML = 
            '<p class="no-data">No mismatch data available</p>';
        return;
    }
    
    const table = createTable(data, ['RID', 'Legacy_Crop', 'Wherobots_Crop', 
        'Pixel_Count', 'Percentage_of_Legacy_Crop_Total']);
    
    document.getElementById('mismatch-table').innerHTML = '';
    document.getElementById('mismatch-table').appendChild(table);
}

function createTable(data, columns) {
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        columns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = row[col] !== undefined ? row[col] : '';
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    return table;
}

// =============================================================================
// CSV GENERATION & DOWNLOAD
// =============================================================================

function downloadSummaryCSV() {
    if (!AppState.summaryDF || AppState.summaryDF.length === 0) {
        showToast('⚠️ No summary data to download', 'warning');
        return;
    }
    
    const csv = convertToCSV(AppState.summaryDF);
    downloadFile(csv, 'RID_Validation_Summary.csv', 'text/csv');
}

function downloadMismatchCSV() {
    if (!AppState.mismatchDF || AppState.mismatchDF.length === 0) {
        showToast('⚠️ No mismatch data to download', 'warning');
        return;
    }
    
    const csv = convertToCSV(AppState.mismatchDF);
    downloadFile(csv, 'Legacy_vs_Wherobots_Mismatch.csv', 'text/csv');
}

async function downloadAllZIP() {
    if (!AppState.summaryDF || !AppState.mismatchDF) {
        showToast('⚠️ No data to download', 'warning');
        return;
    }
    
    try {
        const csv1 = convertToCSV(AppState.summaryDF);
        const csv2 = convertToCSV(AppState.mismatchDF);
        
        // Create ZIP file
        const zip = new JSZip();
        zip.file('RID_Validation_Summary.csv', csv1);
        zip.file('Legacy_vs_Wherobots_Mismatch.csv', csv2);
        
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadFile(blob, 'Results.zip', 'application/zip');
        
        showToast('✅ ZIP downloaded successfully', 'success');
    } catch (error) {
        showToast(`❌ Error creating ZIP: ${error.message}`, 'error');
    }
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create header row
    let csv = headers.join(',') + '\n';
    
    // Create data rows
    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header] || '';
            // Escape quotes and wrap if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        csv += values.join(',') + '\n';
    });
    
    return csv;
}

function downloadFile(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// =============================================================================
// RESET & UI UTILITIES
// =============================================================================

function resetValidation() {
    AppState.summaryDF = null;
    AppState.mismatchDF = null;
    AppState.validationRun = false;
    AppState.legacyFiles = [];
    AppState.newFiles = [];
    
    // Clear file lists
    document.getElementById('legacy-file-list').innerHTML = '';
    document.getElementById('new-file-list').innerHTML = '';
    document.getElementById('legacy-file-input').value = '';
    document.getElementById('new-file-input').value = '';
    
    // Hide results
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('progress-container').style.display = 'none';
    
    // Clear tables
    document.getElementById('summary-table').innerHTML = '';
    document.getElementById('mismatch-table').innerHTML = '';
    
    showToast('🗑️ Validation reset', 'info');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners
    document.getElementById('legacy-file-input').addEventListener('change', handleLegacyFileUpload);
    document.getElementById('new-file-input').addEventListener('change', handleNewFileUpload);
    document.getElementById('run-btn').addEventListener('click', runValidation);
    document.getElementById('reset-btn').addEventListener('click', resetValidation);
    
    // Download buttons
    document.getElementById('download-summary').addEventListener('click', downloadSummaryCSV);
    document.getElementById('download-mismatch').addEventListener('click', downloadMismatchCSV);
    document.getElementById('download-all-zip').addEventListener('click', downloadAllZIP);
    
    console.log('Crop Filling Validation Platform - Initialized');
});
