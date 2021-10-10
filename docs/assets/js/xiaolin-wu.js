// https://gist.github.com/polyamide/3f33cb4dc69e22fbf8b66cee39b78d60
class XiaolinWu {

    static integerPart(v) {
        let isNeg = (v < 0) ? -1 : 1;
        let abs = Math.abs(v);
        let integerPart = Math.floor(abs);

        return integerPart * isNeg;
    }

    static fraction(v) {
        if (v < 0) {
            return 1 - (v - Math.floor(v));
        }

        return v - Math.floor(v);
    }

    static reverseFraction(v) {
        return 1 - XiaolinWu.fraction(v);
    }

    static round(v) {
        return XiaolinWu.integerPart(v + 0.5);
    }

    static plot(x0, y0, x1, y1) {
        if (x0 == x1 && y0 == y1) {
            return []
        }

        let fpart = XiaolinWu.fraction;
        let rfpart = XiaolinWu.reverseFraction;
        let ipart = XiaolinWu.integerPart;
        let round = XiaolinWu.round;

        let dots = [];
        let steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);

        if (steep) {
            [y0, x0] = [x0, y0];
            [y1, x1] = [x1, y1];
        }

        if (x0 > x1) {
            [x1, x0] = [x0, x1];
            [y1, y0] = [y0, y1];
        }

        let dx = x1 - x0;
        let dy = y1 - y0;
        let gradient = dy / dx;

        let xEnd = round(x0);
        let yEnd = y0 + gradient * (xEnd - x0);
        let xGap = rfpart(x0 + 0.5);
        let xPx1 = xEnd;
        let yPx1 = ipart(yEnd);

        if (steep) {
            dots.push({ x: yPx1, y: xPx1, b: rfpart(yEnd) * xGap });
            dots.push({ x: yPx1 + 1, y: xPx1, b: fpart(yEnd) * xGap });
        } else {
            dots.push({ x: xPx1, y: yPx1, b: rfpart(yEnd) * xGap });
            dots.push({ x: xPx1, y: yPx1 + 1, b: fpart(yEnd) * xGap });
        }

        let intery = yEnd + gradient;

        xEnd = round(x1);
        yEnd = y1 + gradient * (xEnd - x1);
        xGap = fpart(x1 + 0.5);

        let xPx2 = xEnd;
        let yPx2 = ipart(yEnd);

        if (steep) {
            dots.push({ x: yPx2, y: xPx2, b: rfpart(yEnd) * xGap });
            dots.push({ x: yPx2 + 1, y: xPx2, b: fpart(yEnd) * xGap });
        } else {
            dots.push({ x: xPx2, y: yPx2, b: rfpart(yEnd) * xGap });
            dots.push({ x: xPx2, y: yPx2 + 1, b: fpart(yEnd) * xGap });
        }

        if (steep) {
            for (let x = xPx1 + 1; x <= xPx2 - 1; x++) {
                dots.push({ x: ipart(intery), y: x, b: rfpart(intery) });
                dots.push({ x: ipart(intery) + 1, y: x, b: fpart(intery) });
                intery = intery + gradient;
            }
        } else {
            for (let x = xPx1 + 1; x <= xPx2 - 1; x++) {
                dots.push({ x: x, y: ipart(intery), b: rfpart(intery) });
                dots.push({ x: x, y: ipart(intery) + 1, b: fpart(intery) });
                intery = intery + gradient
            }
        }

        return dots;
    }
}
