/**
 * CROP FILLING VALIDATION - Core Validation Logic
 * Converted from Python validation_logic.py to JavaScript
 */

const PIXEL_AREA = 0.01; // hectares (10m x 10m)

// =============================================================================
// FILENAME PARSER
// =============================================================================
const PATTERN = /\d+_(\d{15})_CS([A-Z]{2})\d+_([A-Z]\d{3})\.tif/;

function parse(fname) {
    const match = fname.match(PATTERN);
    if (match) {
        return {
            rid: match[1],
            crop: match[2],
            season: match[3]
        };
    }
    return null;
}

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

function createZeroArray(rows, cols, dtype = 'uint8') {
    const arr = Array(rows).fill(0).map(() => Array(cols).fill(0));
    return arr;
}

function createOnesArray(rows, cols, dtype = 'uint8') {
    return Array(rows).fill(0).map(() => Array(cols).fill(1));
}

function where(condition, trueVal, falseVal) {
    if (!Array.isArray(condition[0])) {
        return condition.map(c => c ? trueVal : falseVal);
    }
    return condition.map(row => 
        row.map(c => c ? trueVal : falseVal)
    );
}

function and(arr1, arr2) {
    return arr1.map((row, i) => 
        row.map((val, j) => val && arr2[i][j])
    );
}

function or(arr1, arr2) {
    return arr1.map((row, i) => 
        row.map((val, j) => val || arr2[i][j])
    );
}

function not(arr) {
    return arr.map(row => row.map(val => !val));
}

function sum(arr) {
    if (!Array.isArray(arr[0])) {
        return arr.reduce((a, b) => a + b, 0);
    }
    return arr.reduce((sum, row) => 
        sum + row.reduce((a, b) => a + b, 0), 0
    );
}

function unique(arr) {
    const flat = Array.isArray(arr[0]) ? arr.flat() : arr;
    return [...new Set(flat)].sort((a, b) => a - b);
}

function flatten(arr) {
    return arr.flat();
}

// =============================================================================
// METRICS CALCULATION
// =============================================================================

function confusionMatrix(yTrue, yPred) {
    let tn = 0, fp = 0, fn = 0, tp = 0;
    
    for (let i = 0; i < yTrue.length; i++) {
        const true_val = yTrue[i];
        const pred_val = yPred[i];
        
        if (true_val === 0 && pred_val === 0) tn++;
        else if (true_val === 0 && pred_val === 1) fp++;
        else if (true_val === 1 && pred_val === 0) fn++;
        else if (true_val === 1 && pred_val === 1) tp++;
    }
    
    return { tn, fp, fn, tp };
}

function calculateMetrics(tp, fp, fn, tn) {
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall) > 0 ? 
        2 * (precision * recall) / (precision + recall) : 0;
    const accuracy = (tp + tn + fp + fn) > 0 ?
        (tp + tn) / (tp + tn + fp + fn) : 0;
    
    // Cohen's Kappa
    const total = tp + tn + fp + fn;
    const po = (tp + tn) / total; // observed agreement
    const pe = ((tp + fp) / total) * ((tp + fn) / total) + 
               ((tn + fp) / total) * ((tn + fn) / total); // expected agreement
    const kappa = total > 0 && pe < 1 ? (po - pe) / (1 - pe) : 0;
    
    return {
        precision: isNaN(precision) ? 0 : precision,
        recall: isNaN(recall) ? 0 : recall,
        f1: isNaN(f1) ? 0 : f1,
        accuracy: isNaN(accuracy) ? 0 : accuracy,
        kappa: isNaN(kappa) ? 0 : kappa
    };
}

// =============================================================================
// BINARY CONVERSION
// =============================================================================

function convertToBinary(data) {
    return data.map(row => 
        row.map(val => val > 0 ? 1 : 0)
    );
}

// =============================================================================
// SINGLE CROP PROCESSING
// =============================================================================

function processSingleCrop(rid, crop, seasonCode, legacyStack, newStack, valid) {
    const lCrop = legacyStack[crop];
    const nCrop = newStack[crop];
    
    if (!lCrop || !nCrop) return null;
    
    const lBin = convertToBinary(lCrop);
    const nBin = convertToBinary(nCrop);
    
    // Flatten for comparison
    const lVec = [];
    const nVec = [];
    const validPixels = [];
    
    for (let i = 0; i < lBin.length; i++) {
        for (let j = 0; j < lBin[i].length; j++) {
            if (valid[i][j]) {
                lVec.push(lBin[i][j]);
                nVec.push(nBin[i][j]);
                validPixels.push([i, j]);
            }
        }
    }
    
    if (lVec.length === 0) return null;
    
    // Confusion matrix
    const cm = confusionMatrix(lVec, nVec);
    const metrics = calculateMetrics(cm.tp, cm.fp, cm.fn, cm.tn);
    
    // Pixel counts
    let pxL = 0, pxN = 0;
    for (let i = 0; i < lBin.length; i++) {
        for (let j = 0; j < lBin[i].length; j++) {
            if (valid[i][j]) {
                if (lBin[i][j]) pxL++;
                if (nBin[i][j]) pxN++;
            }
        }
    }
    
    const deltaPct = pxL > 0 ? ((pxN - pxL) / pxL) * 100 : 0;
    
    return {
        RID: rid,
        Crop: crop,
        Season: seasonCode,
        TP: cm.tp,
        FP: cm.fp,
        FN: cm.fn,
        Precision: metrics.precision.toFixed(4),
        Recall: metrics.recall.toFixed(4),
        F1: metrics.f1.toFixed(4),
        Accuracy: metrics.accuracy.toFixed(4),
        Kappa: metrics.kappa.toFixed(4),
        Legacy_px: pxL,
        New_px: pxN,
        Legacy_ha: (pxL * PIXEL_AREA).toFixed(2),
        New_ha: (pxN * PIXEL_AREA).toFixed(2),
        Delta_pct: deltaPct.toFixed(2)
    };
}

// =============================================================================
// CROP SWITCHING ANALYSIS
// =============================================================================

function analyzeCropSwitching(rid, seasonCode, legacyStack, newStack, valid) {
    const crops = Object.keys(legacyStack).sort();
    const mismatchRecords = [];
    
    // For each legacy crop, count transitions
    for (const legacyCrop of crops) {
        const legacyData = convertToBinary(legacyStack[legacyCrop]);
        const legacyTotal = sumBinaryPixels(legacyData, valid);
        
        if (legacyTotal === 0) continue;
        
        // Check where this crop maps to in new system
        for (const newCrop of crops) {
            const newData = convertToBinary(newStack[newCrop]);
            let pixelCount = 0;
            
            for (let i = 0; i < legacyData.length; i++) {
                for (let j = 0; j < legacyData[i].length; j++) {
                    if (valid[i][j] && legacyData[i][j] && newData[i][j]) {
                        pixelCount++;
                    }
                }
            }
            
            if (pixelCount > 0) {
                mismatchRecords.push({
                    RID: rid,
                    Season: seasonCode,
                    Legacy_Crop: legacyCrop,
                    Wherobots_Crop: newCrop,
                    Pixel_Count: pixelCount,
                    Percentage_of_Legacy_Crop_Total: 
                        ((pixelCount / legacyTotal) * 100).toFixed(2),
                    Legacy_Crop_Total_Pixels: legacyTotal
                });
            }
        }
    }
    
    return mismatchRecords;
}

function sumBinaryPixels(binaryArray, valid) {
    let count = 0;
    for (let i = 0; i < binaryArray.length; i++) {
        for (let j = 0; j < binaryArray[i].length; j++) {
            if (valid[i][j] && binaryArray[i][j]) {
                count++;
            }
        }
    }
    return count;
}

// =============================================================================
// MAIN VALIDATION ENTRY POINT
// =============================================================================

async function runValidation(legacyFiles, newFiles, progressCallback) {
    try {
        // Parse files and organize by RID/Crop
        const legacyByRID = {};
        const newByRID = {};
        const ridToSeason = {};
        
        // Process legacy files
        for (const file of legacyFiles) {
            const parsed = parse(file.name);
            if (!parsed) continue;
            
            const { rid, crop, season } = parsed;
            if (!legacyByRID[rid]) legacyByRID[rid] = {};
            if (!legacyByRID[rid][crop]) legacyByRID[rid][crop] = file;
            ridToSeason[rid] = season;
        }
        
        // Process new files
        for (const file of newFiles) {
            const parsed = parse(file.name);
            if (!parsed) continue;
            
            const { rid, crop, season } = parsed;
            if (!newByRID[rid]) newByRID[rid] = {};
            if (!newByRID[rid][crop]) newByRID[rid][crop] = file;
        }
        
        const commonRIDs = Object.keys(legacyByRID)
            .filter(rid => newByRID[rid])
            .sort();
        
        const singleResults = [];
        const mismatchDetails = [];
        
        let currentStep = 0;
        const totalSteps = commonRIDs.length * 2;
        
        // Process each RID
        for (const rid of commonRIDs) {
            const seasonCode = ridToSeason[rid];
            const legacyStack = legacyByRID[rid];
            const newStack = newByRID[rid];
            
            // Get common crops
            const legacyCrops = Object.keys(legacyStack);
            const newCrops = Object.keys(newStack);
            const commonCrops = legacyCrops
                .filter(c => newCrops.includes(c))
                .sort();
            
            if (commonCrops.length === 0) continue;
            
            // Read and process files for this RID
            const legacyData = {};
            const newData = {};
            
            // Create a default valid mask (all true for now)
            // In a full implementation, would handle CRS/projection
            let valid = null;
            
            for (const crop of commonCrops) {
                const legacyFile = legacyStack[crop];
                const newFile = newStack[crop];
                
                // Read TIFF data
                legacyData[crop] = await readTIFFFile(legacyFile);
                newData[crop] = await readTIFFFile(newFile);
                
                // Initialize valid mask from first file
                if (!valid) {
                    const shape = legacyData[crop].data.length;
                    const cols = legacyData[crop].data[0].length;
                    valid = createOnesArray(shape, cols);
                }
            }
            
            // Process single crops
            for (const crop of commonCrops) {
                currentStep++;
                if (progressCallback) {
                    progressCallback(currentStep, totalSteps, 
                        `Processing RID ${rid} (${seasonCode}) - Crop ${crop}`);
                }
                
                const result = processSingleCrop(rid, crop, seasonCode, 
                    legacyData, newData, valid);
                if (result) {
                    singleResults.push(result);
                }
            }
            
            // Analyze crop switching
            currentStep++;
            if (progressCallback) {
                progressCallback(currentStep, totalSteps, 
                    `Analyzing mismatches for RID ${rid}`);
            }
            
            const mismatchRecs = analyzeCropSwitching(rid, seasonCode, 
                legacyData, newData, valid);
            mismatchDetails.push(...mismatchRecs);
        }
        
        return {
            summary: singleResults,
            mismatch: mismatchDetails,
            success: true
        };
        
    } catch (error) {
        console.error('Validation error:', error);
        return {
            summary: [],
            mismatch: [],
            success: false,
            error: error.message
        };
    }
}

// =============================================================================
// TIFF FILE READER (Browser-based)
// =============================================================================

async function readTIFFFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Use geotiff.js to read the file
        if (typeof GeoTIFF === 'undefined') {
            throw new Error('GeoTIFF.js library not loaded');
        }
        
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        
        // Read raster data
        const data = await image.readRasters();
        const pixelData = data[0]; // First band
        
        // Get dimensions
        const [width, height] = image.getWidth(), image.getHeight();
        
        // Reshape to 2D array
        const array2D = [];
        for (let i = 0; i < height; i++) {
            const row = [];
            for (let j = 0; j < width; j++) {
                row.push(pixelData[i * width + j]);
            }
            array2D.push(row);
        }
        
        return {
            data: array2D,
            width: width,
            height: height,
            metadata: {
                crs: image.geoKeys?.ProjectedCSTypeGeoKey,
                bbox: image.getBoundingBox()
            }
        };
        
    } catch (error) {
        console.error(`Error reading TIFF file ${file.name}:`, error);
        return null;
    }
}
