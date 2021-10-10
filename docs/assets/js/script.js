let croppingImg  = null;

window.addEventListener('DOMContentLoaded', function() {
    document.getElementById("cameraFileInput").addEventListener("change", function (evt) {
        // Resize upon load.
        // Reference:
        //  - https://www.askingbox.com/tutorial/how-to-resize-image-before-upload-in-browser
        //  - https://codepen.io/tuanitpro/pen/wJZJbp
        //
        var file = evt.target.files[0];
 
        if (file.type == "image/jpeg" || file.type == "image/png") {
            var reader = new FileReader();  
            reader.onload = function(readerEvt) {
                var image = new Image();
                image.onload = function() {    
                    var max_size = 400;
                    var w = image.width;
                    var h = image.height;
                  
                    if (w > h) {  if (w > max_size) { h*=max_size/w; w=max_size; }
                    } else     {  if (h > max_size) { w*=max_size/h; h=max_size; } }
                  
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(image, 0, 0, w, h);
                       
                    if (file.type == "image/jpeg") {
                        var dataURL = canvas.toDataURL("image/jpeg", 1.0);
                    } else {
                        var dataURL = canvas.toDataURL("image/png");   
                    }
                    document.getElementById('pictureFromCamera')
                        .setAttribute("src",dataURL);
                }
                image.src = readerEvt.target.result;
            }
            reader.readAsDataURL(file);
        } else {
            document.getElementById('cameraFileInput').value = ''; 
            alert('Please only select images in JPG- or PNG-format.');  
        }
    });

    document.getElementById("analyseButton0").addEventListener("click", analyseFunction);

    document.getElementById("pictureFromCamera").addEventListener("load", function () {
        var origImg = document.getElementById("pictureFromCamera");

        if (croppingImg){
            croppingImg.destroy();
        }

        croppingImg = new Croppie(origImg, {
            viewport: {
                width: Math.floor(0.9 * origImg.width),
                height: Math.floor(0.9 * origImg.height)
            },
            boundary: {
                width: Math.floor(1.2 * origImg.width),
                height: Math.floor(1.2 * origImg.height)
            },
            enableExif: true,
            enableResize: true,
            showZoomer: false,
            enableZoom: false,
            enableOrientation: false,
            mouseWheelZoom: 'ctrl',
            }
        );
    });

});

async function analyseFunction() {
    try{
        let src_ = cv.imread('pictureFromCamera');
        // let src_ = cv.imread('inputCanvas0');

        let croppedCorners = croppingImg.get().points;
        let crX1 = parseInt(croppedCorners[0]), crY1 = parseInt(croppedCorners[1]);
        let crX2 = parseInt(croppedCorners[2]), crY2 = parseInt(croppedCorners[3]);
        var srcRect_ = new cv.Rect(crX1, crY1, crX2 - crX1, crY2 - crY1);
            
        let src = resize2width(src_.roi(srcRect_), 320);
        cv.imshow('outputCanvas0a', src);

        let [mask, bb] = foregroundSegmentation(src);

        let [features, otherFeatures] = extractObjectFeatures(mask, bb);

        let debugRGBA = drawMask(src, mask);
        cv.drawContours(debugRGBA, otherFeatures.contour, 0, new cv.Scalar(255, 0, 0, 255));
        cv.line(debugRGBA, otherFeatures.pointBB1, otherFeatures.pointBB2, new cv.Scalar(0, 0, 255, 255), 2, cv.LINE_AA, 0);
        cv.circle(debugRGBA, otherFeatures.pointBase, radius=2, color=new cv.Scalar(255, 255, 0, 255), thickness=-1);
        cv.circle(debugRGBA, otherFeatures.pointTip, radius=2, color=new cv.Scalar(255, 0, 255, 255), thickness=-1);

        for (var v = Math.min(...Object.keys(otherFeatures.horizontalIntersection)); 
                 v < Math.max(...Object.keys(otherFeatures.horizontalIntersection)) + 1;
                 v=v+5){
            cv.line(debugRGBA,
                otherFeatures.horizontalIntersection[v].pc1,
                otherFeatures.horizontalIntersection[v].pc2,
                new cv.Scalar(0, 0, 255, 255), 1, cv.LINE_AA, 0);
        }

        cv.imshow('outputCanvas0b', debugRGBA);

        src_.delete();
        src.delete();
        mask.delete();
        debugRGBA.delete();
        delete features;
        delete otherFeatures;

    }catch(error){
        window.alert(error);
    }
};

function resize2width(srcRGBA, width){
    let imgSize = srcRGBA.size();

    if (width <= 0 || width === imgSize.width)
        return srcRGBA.clone();

    var ratio = width*1.0/imgSize.width;
    var newSize = new cv.Size(width, Math.floor(imgSize.height * ratio));

    let newSrcRGBA = new cv.Mat()
    cv.resize(srcRGBA, newSrcRGBA, newSize, interpolation=cv.INTER_AREA);
    return newSrcRGBA;
};


function kmeanSegmentation(srcRGBA, attempts = 10){
    if (! isImgRGBA(srcRGBA)){
        errMsg = "kmeanSegmentation: Source image should be RGBA.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let nrows = srcRGBA.rows;
    let ncols = srcRGBA.cols;

    let srcRGB = convertImg(srcRGBA, cv.COLOR_RGBA2RGB);
    let srcHSV = convertImg(srcRGB, cv.COLOR_RGB2HSV);

    let srcPoints = new cv.Mat(nrows * ncols, 3, cv.CV_32FC1);
    let labelNRGB  = new cv.Mat.zeros(nrows * ncols, 1, cv.CV_32SC1);
    let labelHSV  = new cv.Mat.zeros(nrows * ncols, 1, cv.CV_32SC1);
    for( var y = 0; y < nrows; y++ ){
        for( var x = 0; x < ncols; x++ ){
            // RGB
            let cr = srcRGB.ucharPtr(y, x)[0];
            let cg = srcRGB.ucharPtr(y, x)[1];
            let cb = srcRGB.ucharPtr(y, x)[2];

            // Normalized RGB
            var cnr = cr * 1.0 / (cr + cg + cb);
            var cng = cg * 1.0 / (cr + cg + cb);
            var cnb = cb * 1.0 / (cr + cg + cb);

            // HSV
            let ch = srcHSV.ucharPtr(y, x)[0];
            let cs = srcHSV.ucharPtr(y, x)[1];
            let cv = srcHSV.ucharPtr(y, x)[2];

            // RGB seems to work best! even though other combination are tested.
            srcPoints.floatPtr(y + x*nrows)[0] = cr;
            srcPoints.floatPtr(y + x*nrows)[1] = cg;
            srcPoints.floatPtr(y + x*nrows)[2] = cb;

            // NRGB
            if (cnr/cng > 1.185 && cnr*cnb/((cnr + cng + cnb)**2) > 0.107 && cnr*cng/((cnr + cng + cnb)**2) > 0.112 ){
                labelNRGB.intPtr(y + x*nrows)[0] = 1;
            }

            // HSV
            if (((ch > 0 && ch < 25) || (ch > 335 && ch < 360)) && (cs > 51 && cs < 153) && (cv >= 40)){
                labelHSV.intPtr(y + x*nrows)[0] = 1;
            }
        }
    }

    var labels = new cv.Mat(labelNRGB.size(), labelNRGB.type());
    cv.bitwise_and(labelNRGB, labelHSV, labels);

    var numClusters = 2;
    var criteria    = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 10000, 0.0001);
    var flag        = cv.KMEANS_USE_INITIAL_LABELS;   // cv.KMEANS_RANDOM_CENTERS;
    var centers     = new cv.Mat();

    cv.kmeans(srcPoints, numClusters, labels, criteria, attempts, flag, centers);

    var fgMask = new cv.Mat(nrows, ncols, cv.CV_8UC1);
    var fgPix = 0;
    for( var y = 0; y < nrows; y++ ){
        for( var x = 0; x < ncols; x++ ){ 
            var cluster_idx = labels.intPtr(y + x*nrows, 0)[0];
            // var cluster_idx = labelHSV.intPtr(y + x*nrows, 0)[0];
            // var cluster_idx = labelNRGB.intPtr(y + x*nrows, 0)[0];
            fgMask.ucharPtr(y,x)[0] = Math.floor((cluster_idx * 1.0/ (numClusters - 1)) * 255);
            if (cluster_idx === 1){
                fgPix = fgPix + 1;
            }
        }
    }

    // foreground should have less pixel than background
    // inverse foreground and background if otherwise.
    var whiteMask = new cv.Mat(fgMask.rows, fgMask.cols, fgMask.type(), new cv.Scalar(255));
    if (2 * fgPix > (nrows*ncols)){
        cv.subtract(whiteMask, fgMask, fgMask);
    }

    srcRGB.delete(), srcHSV.delete(), srcPoints.delete();
    labelHSV.delete(), labelNRGB.delete(), labels.delete();
    centers.delete(), whiteMask.delete();

    return fgMask;
};


// fill small noise and delete connected region
function morphingMask(mask, kernelSize = 3){
    if (! isImgMask(mask)){
        errMsg = "morphingMask: invalid mask format.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8UC1);

    let cleanMask = new cv.Mat();
    let largerMask = new cv.Mat();

    // fill small noise [enlarge >> shrink]
    cv.dilate(mask, cleanMask, kernel);
    cv.erode(cleanMask, cleanMask, kernel);

    // delete connected region [shrink >> enlarge]
    cv.erode(cleanMask, cleanMask, kernel);
    cv.dilate(cleanMask, cleanMask, kernel);

    // [enlarge]
    cv.dilate(cleanMask, largerMask, kernel);

    kernel.delete();

    return [cleanMask, largerMask];
};


function findCertainForgroundUsingDT(mask, dtThresholdRatio = 0.5){
    if (! isImgMask(mask)){
        errMsg = "findCertainForgroundUsingDT: invalid mask format.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let foregroundMask = new cv.Mat();
    // Perform the distance transform algorithm
    cv.distanceTransform(mask, foregroundMask, cv.DIST_L2, 5);

    // Normalize the distance image for range = {0.0, 1.0}
    // so we can visualize and threshold it
    cv.normalize(foregroundMask, foregroundMask, 1, 0, cv.NORM_INF);

    // Threshold to obtain the peaks
    cv.threshold(foregroundMask, foregroundMask, dtThresholdRatio, 255, cv.THRESH_BINARY);

    // Convert back to CV_8U version of the distance image
    foregroundMask.convertTo(foregroundMask, cv.CV_8UC1, 1, 0);

    return foregroundMask;
};


function findLargestConnectedComponent(mask){
    if (! isImgMask(mask)){
        errMsg = "findLargestConnectedComponent: invalid mask format.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let ccLabels = new cv.Mat(), ccStats = new cv.Mat(), ccCentroids = new cv.Mat();

    // Get Connected Components Labels
    let ccNum = cv.connectedComponentsWithStats(mask, ccLabels, ccStats, ccCentroids);
    let ccMaxLabelIdx = -1, ccMaxCount = -1;
    for (let i = 1; i < ccNum; i++) {
        var curCount = ccStats.intPtr(i, cv.CC_STAT_AREA)[0];
        if (curCount > ccMaxCount){
            ccMaxLabelIdx = i;
            ccMaxCount = curCount;
        }
    }

    let largestCcMask = new cv.Mat(ccLabels.rows, ccLabels.cols, cv.CV_8UC1, new cv.Scalar(0));

    for (let i = 0; i < ccLabels.rows; i++) {
        for (let j = 0; j < ccLabels.cols; j++) {
            if (ccLabels.intPtr(i, j)[0] === ccMaxLabelIdx){
                largestCcMask.ucharPtr(i, j)[0] = 255;
            }
        }
    }

    ccLabels.delete(), ccStats.delete(), ccCentroids.delete();

    return largestCcMask;
};


function grabcutSegmentation(srcRGBA, foregroundMask, iterCount = 10){
    if (! isImgRGBA(srcRGBA)){
        errMsg = "grabcutSegmentation: Source image should be RGBA.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    if (! isImgMask(foregroundMask)){
        errMsg = "grabcutSegmentation: invalid mask format (foregroundMask).";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let nrows = srcRGBA.rows;
    let ncols = srcRGBA.cols;

    let srcRGB = convertImg(srcRGBA, cv.COLOR_RGBA2RGB);

    var gcLabel = new cv.Mat(nrows, ncols, cv.CV_8UC1, new cv.Scalar(cv.GC_PR_BGD));

    for (let i = 0; i < gcLabel.rows; i++) {
        for (let j = 0; j < gcLabel.cols; j++) {
            if (foregroundMask.ucharPtr(i, j)[0] === 255){
                gcLabel.ucharPtr(i, j)[0] = cv.GC_PR_FGD;
            }
        }
    }

    // if only background, make sure the mask did not have only GC_BGD
    if (cv.minMaxLoc(foregroundMask).maxVal === 0){
        gcLabel.ucharPtr(0, 0)[0] = cv.GC_PR_FGD;
    }

    let bgdModel = new cv.Mat(), fgdModel = new cv.Mat();

    // TODO: try to use combine mode between GC_INIT_WITH_RECT and GC_INIT_WITH_MASK
    // Outside of this roi, obvious background when use cv.GC_INIT_WITH_RECT
    let rect = new cv.Rect(0, 0, nrows, ncols);  

    cv.grabCut(srcRGB, gcLabel, rect, bgdModel, fgdModel, iterCount, cv.GC_INIT_WITH_MASK);

    srcRGB.delete(), bgdModel.delete(), fgdModel.delete();

    var gcMask = new cv.Mat(nrows, ncols, cv.CV_8UC1, new cv.Scalar(0));

    for (let i = 0; i < gcMask.rows; i++) {
        for (let j = 0; j < gcMask.cols; j++) {
            if (gcLabel.ucharPtr(i, j)[0] === cv.GC_FGD || gcLabel.ucharPtr(i, j)[0] === cv.GC_PR_FGD){
                gcMask.ucharPtr(i, j)[0] = 255;
            }
        }
    }

    return [gcMask, gcLabel];
};

function maskPostProcessing(mask, src){
    if (! isImgMask(mask)){
        errMsg = "maskPostProcessing: invalid mask format.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let origObjMask = findLargestConnectedComponent(mask);
    let origBB = cv.boundingRect(origObjMask)

    ////////////////////////////////////////////////////////////////////
    //
    // Using heuristic that object at the bottom might have
    //    a connect region to the part that is not related.
    //
    var vertOffset = 0.20;
    var subHeight = origBB.y + Math.floor(origBB.height * (1.0 - vertOffset));
    var subRoi = new cv.Rect(0, 0, origObjMask.cols, subHeight);
    let subMask = origObjMask.roi(subRoi);
    let subObjMask = findLargestConnectedComponent(subMask);

    let subBB = cv.boundingRect(subObjMask);

    // Adjust height to cover to the bottom of the image.
    subBB.height = origObjMask.rows - subBB.y + 1;

    // Also adjust weight, as the subMask might cut the bottom part of the object.
    //   Since we will do the intersection after ward, we may extend it early than before.
    var subHorizontalOffset = Math.floor(origBB.height * vertOffset / 2.0);
    var newX = Math.max(subBB.x - subHorizontalOffset, 0);
    var newW = subBB.width + subHorizontalOffset + (subBB.x - newX);
    newW = ((newX + newW) < origObjMask.cols)? newW: origObjMask.cols - newX;
    subBB.x = newX;
    subBB.width = newW;

    let objectBB = intersectionBoundingRect(origBB, subBB);

    let src_ = drawBoundingRect(src, origBB, true);
    src_ = drawBoundingRect(src_, subBB, false, [255, 0, 0, 255]);
    src_ = drawBoundingRect(src_, objectBB, false, [0, 0, 255, 255]);

    ////////////////////////////////////////////////////////////////////
    if (objectBB !== null){
        let copyMask = cv.Mat.zeros(origObjMask.size(), cv.CV_8UC1);
        copyMask.roi(objectBB).setTo(new cv.Scalar(255));

        let objectMask = cv.Mat.zeros(origObjMask.size(), origObjMask.type());
        origObjMask.copyTo(objectMask, copyMask);

        copyMask.delete(), origObjMask.delete();
        return [objectMask, objectBB];
    }else{
        return [origObjMask, origBB];
    }
};

function foregroundSegmentation(src){
    try{
        /*
         * use kmean to get a rough fg/bg using color
         * output: range [0, 255]
         */
        let maskKMean = kmeanSegmentation(src);

        /*
         * use morphology to delete noise and some thin connected regtion
         * output: range [0, 255], range[0, 255]
         */
        let [cleanMaskKMean, largerMaskKMean] = morphingMask(maskKMean, 3);

        /*
         * use distance transform to the part that is most likely to be foreground.
         * output: range [0, 255]
         */
        let foregroundMask = findCertainForgroundUsingDT(cleanMaskKMean, 0.2);

        /*
         * selected only one largest part to be an object candidate.
         * output: range [0, 255]
         */
        let largestForegroundMask = findLargestConnectedComponent(foregroundMask);

        /*
         * use grabcut to perform a segmentation with the mask as initial.
         * output: range [0, 255], range[0, 3]
         */
        let [gcMask, gcLabel] = grabcutSegmentation(src, largestForegroundMask);

        /*
         * post processing of the mask
         * output: range [0, 255]
         */
        let [objectMask, objectBB] = maskPostProcessing(gcMask, src);

        // delete mat to be collected.
        maskKMean.delete(), cleanMaskKMean.delete(), largerMaskKMean.delete();
        foregroundMask.delete(), largestForegroundMask.delete();
        gcMask.delete(), gcLabel.delete();

        return [objectMask, objectBB];
    }catch(error){
        throw error;
    }
};


function findObjecMainAxis(objectMask){
    let pixelN = cv.countNonZero(objectMask);
    let maskPoints = new cv.Mat(pixelN, 2, cv.CV_32SC1);
    let countN = 0;
    for( var y = 0; y < objectMask.rows; y++ ){
        for( var x = 0; x < objectMask.cols; x++ ){
            if (objectMask.ucharPtr(y, x)[0] !== 0){
                maskPoints.intPtr(countN, 0)[0] = x;
                maskPoints.intPtr(countN, 1)[0] = y;
                countN = countN + 1;
            }
        }
    }

    if (pixelN !== countN){
        errMsg = "findObjecMainAxis: pixelN and countN must be equal. Something wrong here.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    let objectMainAxis = new cv.Mat();
    cv.fitLine(maskPoints, objectMainAxis, cv.DIST_L12, 0, 0.01, 0.01);

    maskPoints.delete();

    return objectMainAxis;
};


function findObjecContour(objectMask){
    let contours = new cv.MatVector(), hierarchy = new cv.Mat();
    cv.findContours(objectMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    if (contours.size() !== 1){
        errMsg = "findObjecContour: Size of contours of the object must be 1. Something wrong here.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    hierarchy.delete();

    return contours;
};


/*
 *
 * Find intersection points between
 * - Line and Rect
 * - Line and Mask
 *
 * */
function intersectLineAndRectAndMask(line, rect, mask){
    // Intersection betwen Line and Rect
    let [isIntercept, pr1, pr2] = clipLineRectL(rect, line);
    if (!isIntercept){
        errMsg = "intersectLineAndRectAndMask: Line must intersect with Rect. Something wrong here.";
        console.error(errMsg);
        throw new Error(errMsg);
    }

    // Draw points on the lines
    let rasterDots = XiaolinWu.plot(pr1.x, pr1.y, pr2.x, pr2.y);

    // Pick up point that intersect with mask and calculate their dot product with the line.
    let dotsOnMask = [];
    let dotDist = [];
    for (var i = 0; i < rasterDots.length; i++) {
        if (mask.ucharPtr(rasterDots[i].y, rasterDots[i].x)[0] !==0){
            dotsOnMask.push({
                x: rasterDots[i].x,
                y: rasterDots[i].y,
            });

            let vx = line.data32F[0], vy = line.data32F[1];
            let px = line.data32F[2], py = line.data32F[3];
            let dist = vx * (rasterDots[i].x - px) + vy * (rasterDots[i].y - py);
            dotDist.push(dist);
        }
    }

    // Find the minimum and maximum of the dot product to find the border points.
    var idxMin = dotDist.indexOf(Math.min(...dotDist));
    var idxMax = dotDist.indexOf(Math.max(...dotDist));

    let pc1 = new cv.Point(dotsOnMask[idxMin].x, dotsOnMask[idxMin].y);
    let pc2 = new cv.Point(dotsOnMask[idxMax].x, dotsOnMask[idxMax].y);

    return  [pr1, pr2, pc1, pc2];

};


function cvPointDistance(p1, p2){
    return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
};


function calculateWidthProfile(mainAxis, pcBase, pcTip, objectBB, objectMask){

    let vBaseTip = new cv.Mat(2, 1, cv.CV_32FC1);
    vBaseTip.floatPtr(0, 0)[0] = pcTip.x - pcBase.x;
    vBaseTip.floatPtr(1, 0)[0] = pcTip.y - pcBase.y;

    /*
     * Loop through all ratio to find the intersection with BB and Mask
     * */
    let horizontalIntersection = {};

    let ratio4mBase = range(20, 96, 1);
    for (var ridx = 0; ridx < ratio4mBase.length; ridx++) {
        let curRatio = ratio4mBase[ridx];
        let mpx = pcBase.x + curRatio/100.0 * vBaseTip.floatPtr(0, 0)[0];
        let mpy = pcBase.y + curRatio/100.0 * vBaseTip.floatPtr(1, 0)[0];

        let curAxis = new cv.Mat(4, 1, cv.CV_32FC1);
        // https://gamedev.stackexchange.com/a/113394 ; don't care direction.
        curAxis.floatPtr(0, 0)[0] = mainAxis.floatPtr(1, 0)[0];
        curAxis.floatPtr(1, 0)[0] = -1.0 * mainAxis.floatPtr(0, 0)[0];
        curAxis.floatPtr(2, 0)[0] = mpx;
        curAxis.floatPtr(3, 0)[0] = mpy;

        let [pr1, pr2, pc1, pc2] = intersectLineAndRectAndMask(curAxis, objectBB, objectMask);

        horizontalIntersection[curRatio] = {
            pr1: pr1,
            pr2: pr2,
            pc1: pc1,
            pc2: pc2,
            width: cvPointDistance(pc1, pc2),
        };
    }

    vBaseTip.delete();

    return horizontalIntersection;
};

function extractObjectFeatures(objectMask, objectBB){
    try{
        /*
         * Using line fitting (with RANSAC) on the mask to find the main axis.
         * 
         * output: line (vx, vy, px, py)
         * */
        let objMainAxis = findObjecMainAxis(objectMask);

        /*
         * Find the intersection between
         * - the line of the main axis and objectBB
         * - the line of the main axis and objectMask
         *
         * output: PointLineRect1, 2; PointLineMask1, 2
         * */
        let [pr1, pr2, pcBase, pcTip] = intersectLineAndRectAndMask(objMainAxis, objectBB, objectMask);
        if (pcBase.y < pcTip.y){    // Swap points
            let pcTemp = pcBase; pcBase = pcTip; pcTip = pcTemp;
        }


        /*
         * Calculate width profile alone the main axis of the object.
         *
         * output: ???
         * */
        let horizInt = calculateWidthProfile(objMainAxis, pcBase, pcTip, objectBB, objectMask);

        /*
         * Extract object contour
         * */
        let objContour = findObjecContour(objectMask);

        let features = {
            length: cvPointDistance(pcBase, pcTip),
        };

        let otherFeatures = {
            mainAxis: objMainAxis,  // Main object axis
            pointBB1: pr1,          // Intersection point1 between main-axis and objectBB
            pointBB2: pr2,          // Intersection point2 between main-axis and objectBB
            pointBase: pcBase,      // Intersection point1 between main-axis and objectMask
            pointTip: pcTip,        // Intersection point2 between main-axis and objectMask
            contour: objContour,    // Contour of the mask
            horizontalIntersection: horizInt,
        };

        return [features, otherFeatures];

    }catch(error){
        throw error;
    }

};


