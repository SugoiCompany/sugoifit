function convertImg(src, flag){
    let dst = new cv.Mat();
    cv.cvtColor(src, dst, flag, 0);
    return dst;
};

function isImgRGBA(img){
    return (img.type() === cv.CV_8UC4) && (img.isContinuous());
};

function isImgMask(mask){
    return mask.type() === cv.CV_8UC1;
};

function checkImgMask(mask){
    console.log(cv.minMaxLoc(mask));
    
    let srcVec = new cv.MatVector();
    srcVec.push_back(mask);
    let accumulate = false;
    let channels = [0];
    let histSize = [257];
    let ranges = [0, 256];
    let hist = new cv.Mat();
    let mask_ = new cv.Mat();

    cv.calcHist(srcVec, channels, mask_, hist, histSize, ranges, accumulate);
    console.log(hist)

    srcVec.delete(), hist.delete(), mask_.delete();
};

function drawGrabcutLabel(srcRGBA, gcLabel){
    let cloneRGBA = srcRGBA.clone();

    // Debugging : draw mask
    for (let i = 0; i < cloneRGBA.rows; i++) {
        for (let j = 0; j < cloneRGBA.cols; j++) {
            if (gcLabel.ucharPtr(i, j)[0] === cv.GC_BGD){
                cloneRGBA.ucharPtr(i, j)[0] = 255;
                cloneRGBA.ucharPtr(i, j)[1] = 0;
                cloneRGBA.ucharPtr(i, j)[2] = 0;
                cloneRGBA.ucharPtr(i, j)[3] = 255;
            }else if (gcLabel.ucharPtr(i, j)[0] === cv.GC_PR_BGD){
                cloneRGBA.ucharPtr(i, j)[0] = 0;
                cloneRGBA.ucharPtr(i, j)[1] = 255;
                cloneRGBA.ucharPtr(i, j)[2] = 0;
                cloneRGBA.ucharPtr(i, j)[3] = 255;
            }else if (gcLabel.ucharPtr(i, j)[0] === cv.GC_PR_FGD){
                cloneRGBA.ucharPtr(i, j)[0] = 0;
                cloneRGBA.ucharPtr(i, j)[1] = 0;
                cloneRGBA.ucharPtr(i, j)[2] = 255;
                cloneRGBA.ucharPtr(i, j)[3] = 255;
            }
        }
    }

    return cloneRGBA;
};


/*
 * https://answers.opencv.org/question/90455/how-to-perform-intersection-or-union-operations-on-a-rect-in-python/
 * https://github.com/shimat/opencvsharp/blob/4d99fd2b9f4d94498049c0c842a4103ddf6d05ea/src/OpenCvSharp/Modules/core/Struct/Rect.cs#L374
 *
 * */
function intersectionBoundingRect(a, b){
    x = Math.max(a.x, b.x);
    y = Math.max(a.y, b.y);
    w = Math.min(a.x + a.width, b.x + b.width) - x;
    h = Math.min(a.y + a.height, b.y + b.height) - y;
    if (w < 0 || h < 0){
        return null;
    }else{
        return {x: x, y: y, width: w, height: h};
    }
}



function drawMask(srcRGBA, mask, isClone = true){
    let drawRGBA = (isClone)? srcRGBA.clone() : srcRGBA;

    // Debugging : draw mask
    for (let i = 0; i < drawRGBA.rows; i++) {
        for (let j = 0; j < drawRGBA.cols; j++) {
            if (mask.ucharPtr(i, j)[0] == 255){
                drawRGBA.ucharPtr(i, j)[0] = 0;
                drawRGBA.ucharPtr(i, j)[1] = 255;
                drawRGBA.ucharPtr(i, j)[2] = 0;
                drawRGBA.ucharPtr(i, j)[3] = 255;
            }
        }
    }
    return drawRGBA;
};


function drawBoundingRect(src, bb, isClone = true, color = [0, 255, 0, 255]){
    let src_ = (isClone)? src.clone() : src;
    let p0 = new cv.Point(bb.x, bb.y);
    let p1 = new cv.Point(bb.x + bb.width, bb.y + bb.height);
    cv.rectangle(src_, p0, p1, color);
    return src_;
};


function clipLineMatL(matSize, line){
    let vx = line.data32F[0], vy = line.data32F[1];
    let px = line.data32F[2], py = line.data32F[3];
    let scale = Math.max(matSize.width, matSize.height) * 10.0;

    let pt1 = new cv.Point(px - scale * vx, py - scale * vy);
    let pt2 = new cv.Point(px + scale * vx, py + scale * vy);

    return clipLineMatP(matSize, pt1, pt2);
};

/*
 * Port from https://github.com/opencv/opencv/blob/master/modules/imgproc/src/drawing.cpp
 * commit : e0cfaee
 * 
 *              Intel License Agreement
 *      For Open Source Computer Vision Library
 * 
 * Copyright (C) 2000, Intel Corporation, all rights reserved.
 *
 */

function clipLineMatP(matSize, pt1, pt2){
    let c1, c2;
    let right = matSize.width - 1, bottom = matSize.height - 1;

    if( matSize.width <= 0 || matSize.height <= 0 ){
        return [false, pt1, pt2];
    }

    let x1 = pt1.x, y1 = pt1.y, x2 = pt2.x, y2 = pt2.y;
    c1 = (x1 < 0) + (x1 > right) * 2 + (y1 < 0) * 4 + (y1 > bottom) * 8;
    c2 = (x2 < 0) + (x2 > right) * 2 + (y2 < 0) * 4 + (y2 > bottom) * 8;

    if( (c1 & c2) == 0 && (c1 | c2) != 0 )
    {
        let a;
        if( c1 & 12 )
        {
            a = c1 < 8 ? 0 : bottom;
            x1 += Math.floor(1.0 * (a - y1) * (x2 - x1) / (y2 - y1));
            y1 = a;
            c1 = (x1 < 0) + (x1 > right) * 2;
        }
        if( c2 & 12 )
        {
            a = c2 < 8 ? 0 : bottom;
            x2 += Math.floor(1.0 * (a - y2) * (x2 - x1) / (y2 - y1));
            y2 = a;
            c2 = (x2 < 0) + (x2 > right) * 2;
        }
        if( (c1 & c2) == 0 && (c1 | c2) != 0 )
        {
            if( c1 )
            {
                a = c1 == 1 ? 0 : right;
                y1 += Math.floor(1.0 * (a - x1) * (y2 - y1) / (x2 - x1));
                x1 = a;
                c1 = 0;
            }
            if( c2 )
            {
                a = c2 == 1 ? 0 : right;
                y2 += Math.floor(1.0 * (a - x2) * (y2 - y1) / (x2 - x1));
                x2 = a;
                c2 = 0;
            }
        }
    
        console.assert( (c1 & c2) != 0 || (x1 | y1 | x2 | y2) >= 0 , "clipLineImg : Condition unmet.");
    }

    return [(c1 | c2) == 0, new cv.Point(x1, y1), new cv.Point(x2, y2)];
};


function clipLineRectL(rect, line){
    let vx = line.data32F[0], vy = line.data32F[1];
    let px = line.data32F[2], py = line.data32F[3];
    let scale = Math.max(rect.width, rect.height) * 10.0;

    let pt1 = new cv.Point(px - scale * vx, py - scale * vy);
    let pt2 = new cv.Point(px + scale * vx, py + scale * vy);

    return clipLineRectP(rect, pt1, pt2);
};


function clipLineRectP(rect, pt1, pt2){
    let tl = new cv.Point(rect.x, rect.y);
    pt1.x = pt1.x - tl.x; pt1.y = pt1.y - tl.y;
    pt2.x = pt2.x - tl.x; pt2.y = pt2.y - tl.y;

    let [inside, p1, p2] = clipLineMatP(new cv.Size(rect.width, rect.height), pt1, pt2);
    p1.x = p1.x + tl.x; p1.y = p1.y + tl.y;
    p2.x = p2.x + tl.x; p2.y = p2.y + tl.y;

    return [inside, p1, p2];
};


// https://stackoverflow.com/a/8273091/2514809
function range(start, stop, step) {
    if (typeof stop == 'undefined') {
        // one param defined
        stop = start;
        start = 0;
    }

    if (typeof step == 'undefined') {
        step = 1;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }

    return result;
};
