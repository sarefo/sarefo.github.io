// Water wave animation
class WaterAnimator {
    constructor(themeHandler, waterGroup) {
        this.themeHandler = themeHandler;
        this.waterGroup = waterGroup;
        this.waterWaves = [];
    }

    createWaterSection(viewWidth, viewHeight) {
        const waterHeight = viewHeight / 3;
        const waterTop = viewHeight - waterHeight;

        for (let layer = 0; layer < 4; layer++) {
            const wave = this.createWaveLayer(viewWidth, waterHeight, waterTop, layer);
            this.waterWaves.push(wave);
            this.waterGroup.addChild(wave);
        }
    }

    createWaveLayer(width, height, top, layer) {
        const isDark = this.themeHandler.isDarkTheme();
        const baseOpacity = isDark ? 0.25 : 0.15;
        const opacity = baseOpacity - (layer * 0.03);
        const waterColor = this.themeHandler.getWaterColor(opacity);

        const waveHeight = 20 + (layer * 5);
        const frequency = 0.003 + (layer * 0.001);

        const wave = new paper.Path();

        for (let x = 0; x <= width; x += 5) {
            const baseY = top + (layer * 10);
            const y = baseY + Math.sin(x * frequency) * waveHeight;

            if (x === 0) {
                wave.moveTo(x, y);
            } else {
                wave.lineTo(x, y);
            }
        }

        wave.lineTo(width, height + top);
        wave.lineTo(0, height + top);
        wave.closed = true;
        wave.fillColor = waterColor;

        wave.waveData = {
            layer: layer,
            frequency: frequency,
            amplitude: waveHeight,
            baseY: top + (layer * 10),
            width: width
        };

        return wave;
    }

    animate(time) {
        this.waterWaves.forEach(wave => {
            const data = wave.waveData;
            wave.segments.forEach((segment, index) => {
                if (index < wave.segments.length - 2) {
                    const x = index * 5;
                    const waveOffset = Math.sin(time * 2 + x * data.frequency) * data.amplitude;
                    segment.point.y = data.baseY + waveOffset;
                }
            });
        });
    }

    updateTheme() {
        const isDark = this.themeHandler.isDarkTheme();
        this.waterWaves.forEach((wave, index) => {
            const baseOpacity = isDark ? 0.25 : 0.15;
            const opacity = baseOpacity - (index * 0.03);
            wave.fillColor = this.themeHandler.getWaterColor(opacity);
        });
    }
}
