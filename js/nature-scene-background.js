// Water and Insects Background Animation
// Lower third water animation with swirling insects above

class WaterInsectsBackground {
    constructor() {
        this.canvas = null;
        this.waterWaves = [];
        this.insects = [];
        this.animationId = null;
        this.time = 0;
        
        this.init();
    }

    init() {
        this.createCanvas();
        this.setupPaper();
        this.detectContentBounds();
        this.createWaterSection();
        this.createInsects();
        this.startAnimation();
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Handle theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this.updateTheme();
        });
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'water-insects-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.pointerEvents = 'none';
        
        document.body.appendChild(this.canvas);
        
        // Set actual canvas size for crisp rendering
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
    }

    setupPaper() {
        paper.setup(this.canvas);
        
        // Create groups for different elements
        this.waterGroup = new paper.Group();
        this.insectsGroup = new paper.Group();
    }

    getWaterColor() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? 'rgba(100, 150, 200, 0.3)' : 'rgba(120, 180, 240, 0.4)';
    }

    getInsectColor() {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? 'rgba(180, 140, 100, 0.6)' : 'rgba(80, 60, 40, 0.7)';
    }

    detectContentBounds() {
        // Find main content areas to avoid placing insects there
        this.contentBounds = [];
        
        const selectors = ['.container', '.header', '.hero-section', '.content-sections', '.github-section'];
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 50) {
                    this.contentBounds.push({
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                        centerX: rect.left + rect.width / 2,
                        centerY: rect.top + rect.height / 2
                    });
                }
            });
        });
    }

    createWaterSection() {
        const viewWidth = paper.view.size.width;
        const viewHeight = paper.view.size.height;
        const waterHeight = viewHeight / 3; // Lower third
        const waterTop = viewHeight - waterHeight;
        
        // Create multiple wave layers for depth
        for (let layer = 0; layer < 4; layer++) {
            const wave = this.createWaveLayer(viewWidth, waterHeight, waterTop, layer);
            this.waterWaves.push(wave);
            this.waterGroup.addChild(wave);
        }
    }

    createInsects() {
        const viewWidth = paper.view.size.width;
        const viewHeight = paper.view.size.height;
        const insectCount = 5 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < insectCount; i++) {
            const insect = this.createDragonfly(viewWidth, viewHeight);
            this.insects.push(insect);
            this.insectsGroup.addChild(insect.group);
        }
    }

    createWaveLayer(width, height, top, layer) {
        const waterColor = this.getWaterColor();
        const opacity = 0.3 - (layer * 0.05);
        const waveHeight = 20 + (layer * 5);
        const frequency = 0.003 + (layer * 0.001);
        
        const wave = new paper.Path();
        
        // Create wave points
        for (let x = 0; x <= width; x += 5) {
            const baseY = top + (layer * 10);
            const y = baseY + Math.sin(x * frequency) * waveHeight;
            
            if (x === 0) {
                wave.moveTo(x, y);
            } else {
                wave.lineTo(x, y);
            }
        }
        
        // Complete the water shape
        wave.lineTo(width, height + top);
        wave.lineTo(0, height + top);
        wave.closed = true;
        
        wave.fillColor = waterColor.replace(/[\d\.]+\)$/, `${opacity})`);
        
        // Store wave properties for animation
        wave.waveData = {
            layer: layer,
            frequency: frequency,
            amplitude: waveHeight,
            baseY: top + (layer * 10),
            width: width
        };
        
        return wave;
    }

    createDragonfly(viewWidth, viewHeight) {
        const insectColor = this.getInsectColor();
        const group = new paper.Group();
        
        // Avoid content areas for initial position
        let x, y;
        let attempts = 0;
        do {
            x = Math.random() * viewWidth;
            y = Math.random() * (viewHeight * 0.67); // Upper 2/3 only
            attempts++;
        } while (this.wouldCollideWithContent(new paper.Point(x, y), 100) && attempts < 10);
        
        const center = new paper.Point(x, y);
        const size = 8 + Math.random() * 4;
        
        // Head (small circle at top)
        const head = new paper.Path.Circle({
            center: center.add([0, -size * 0.7]),
            radius: size * 0.15
        });
        head.fillColor = insectColor;
        
        // Eyes (tiny dots)
        const leftEye = new paper.Path.Circle({
            center: center.add([-size * 0.08, -size * 0.75]),
            radius: size * 0.05
        });
        const rightEye = new paper.Path.Circle({
            center: center.add([size * 0.08, -size * 0.75]),
            radius: size * 0.05
        });
        leftEye.fillColor = insectColor.replace(/[\d\.]+\)$/, '0.8)');
        rightEye.fillColor = insectColor.replace(/[\d\.]+\)$/, '0.8)');
        
        // Thorax (middle segment, wider)
        const thorax = new paper.Path.Ellipse({
            center: center.add([0, -size * 0.25]),
            size: [size * 0.3, size * 0.4]
        });
        thorax.fillColor = insectColor;
        
        // Abdomen (elongated lower body with segments)
        const abdomenSegments = [];
        for (let i = 0; i < 4; i++) {
            const segmentY = center.y + (i * size * 0.15) + size * 0.1;
            const segmentWidth = size * (0.25 - i * 0.02); // Tapering
            const segment = new paper.Path.Ellipse({
                center: new paper.Point(center.x, segmentY),
                size: [segmentWidth, size * 0.12]
            });
            segment.fillColor = insectColor;
            abdomenSegments.push(segment);
        }
        
        // Wings - 4 wings like a dragonfly with more realistic shapes
        const wingSize = size * 0.6;
        const wings = [];
        
        // Create wing shape (more dragonfly-like)
        const createWingShape = (centerPoint, wingLength, wingWidth) => {
            const wing = new paper.Path();
            wing.add(centerPoint);
            wing.add(centerPoint.add([wingLength * 0.3, -wingWidth * 0.2]));
            wing.add(centerPoint.add([wingLength, -wingWidth * 0.1]));
            wing.add(centerPoint.add([wingLength * 0.9, wingWidth * 0.3]));
            wing.add(centerPoint.add([wingLength * 0.6, wingWidth * 0.5]));
            wing.add(centerPoint.add([wingLength * 0.2, wingWidth * 0.3]));
            wing.closed = true;
            wing.smooth({ type: 'continuous', factor: 0.7 });
            return wing;
        };
        
        // Upper wings (larger)
        const upperWing1 = createWingShape(
            center.add([-size * 0.1, -size * 0.3]), 
            -wingSize * 1.2, 
            wingSize * 0.6
        );
        const upperWing2 = createWingShape(
            center.add([size * 0.1, -size * 0.3]), 
            wingSize * 1.2, 
            wingSize * 0.6
        );
        
        // Lower wings (smaller)
        const lowerWing1 = createWingShape(
            center.add([-size * 0.1, -size * 0.1]), 
            -wingSize * 0.9, 
            wingSize * 0.4
        );
        const lowerWing2 = createWingShape(
            center.add([size * 0.1, -size * 0.1]), 
            wingSize * 0.9, 
            wingSize * 0.4
        );
        
        wings.push(upperWing1, upperWing2, lowerWing1, lowerWing2);
        
        wings.forEach(wing => {
            wing.fillColor = insectColor.replace(/[\d\.]+\)$/, '0.15)');
            wing.strokeColor = insectColor.replace(/[\d\.]+\)$/, '0.6)');
            wing.strokeWidth = 0.5;
        });
        
        // Add wing veins for more detail
        wings.forEach(wing => {
            const vein1 = new paper.Path.Line(
                wing.segments[0].point,
                wing.segments[2].point
            );
            const vein2 = new paper.Path.Line(
                wing.segments[1].point,
                wing.segments[4].point
            );
            [vein1, vein2].forEach(vein => {
                vein.strokeColor = insectColor.replace(/[\d\.]+\)$/, '0.4)');
                vein.strokeWidth = 0.3;
                group.addChild(vein);
            });
        });
        
        // Add all parts to group in proper order (wings first, then body)
        wings.forEach(wing => group.addChild(wing));
        abdomenSegments.forEach(segment => group.addChild(segment));
        group.addChild(thorax);
        group.addChild(head);
        group.addChild(leftEye);
        group.addChild(rightEye);
        
        // Animation properties
        const insectData = {
            group: group,
            center: center.clone(),
            angle: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 0.5,
            radius: 50 + Math.random() * 100,
            wingPhase: Math.random() * Math.PI * 2,
            wingSpeed: 8 + Math.random() * 4,
            wings: wings,
            bodyParts: [...abdomenSegments, thorax, head, leftEye, rightEye]
        };
        
        return insectData;
    }

    wouldCollideWithContent(point, margin = 50) {
        for (let bound of this.contentBounds) {
            if (point.x > bound.left - margin &&
                point.x < bound.right + margin &&
                point.y > bound.top - margin &&
                point.y < bound.bottom + margin) {
                return true;
            }
        }
        return false;
    }

    startAnimation() {
        this.animate();
    }

    animate() {
        this.time += 0.01;
        
        // Animate water waves
        this.waterWaves.forEach(wave => {
            const data = wave.waveData;
            wave.segments.forEach((segment, index) => {
                if (index < wave.segments.length - 2) { // Skip the closing segments
                    const x = index * 5;
                    const waveOffset = Math.sin(this.time * 2 + x * data.frequency) * data.amplitude;
                    segment.point.y = data.baseY + waveOffset;
                }
            });
        });
        
        // Animate insects with swirling motion (inspired by tadpoles example)
        this.insects.forEach(insect => {
            // Update angle for circular motion
            insect.angle += insect.speed * 0.02;
            
            // Calculate new position in circular/spiral motion
            const spiralRadius = insect.radius + Math.sin(this.time * 0.5) * 20;
            const x = insect.center.x + Math.cos(insect.angle) * spiralRadius;
            const y = insect.center.y + Math.sin(insect.angle) * spiralRadius * 0.6;
            
            // Avoid content areas
            const newPos = new paper.Point(x, y);
            if (!this.wouldCollideWithContent(newPos, 80)) {
                insect.group.position = newPos;
            }
            
            // Animate wing flapping
            insect.wingPhase += insect.wingSpeed * 0.1;
            const wingScale = 1 + Math.sin(insect.wingPhase) * 0.2;
            
            // Scale wings to simulate flapping (wings are first 4 children)
            insect.wings.forEach(wing => {
                wing.scaling = wingScale;
            });
            
            // Rotate insect to face movement direction
            const rotation = Math.atan2(
                Math.sin(insect.angle) * spiralRadius * 0.6,
                Math.cos(insect.angle) * spiralRadius
            ) * 180 / Math.PI;
            insect.group.rotation = rotation;
        });
        
        paper.view.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateTheme() {
        const newWaterColor = this.getWaterColor();
        const newInsectColor = this.getInsectColor();
        
        // Update water colors
        this.waterWaves.forEach(wave => {
            const opacity = 0.3 - (wave.waveData.layer * 0.05);
            wave.fillColor = newWaterColor.replace(/[\d\.]+\)$/, `${opacity})`);
        });
        
        // Update insect colors
        this.insects.forEach(insect => {
            // Update wings
            insect.wings.forEach(wing => {
                wing.fillColor = newInsectColor.replace(/[\d\.]+\)$/, '0.15)');
                wing.strokeColor = newInsectColor.replace(/[\d\.]+\)$/, '0.6)');
            });
            
            // Update body parts
            insect.bodyParts.forEach(part => {
                if (part.fillColor) {
                    part.fillColor = newInsectColor;
                }
                if (part.strokeColor) {
                    part.strokeColor = newInsectColor;
                }
            });
            
            // Update wing veins (they're in the group but not in wings or bodyParts arrays)
            insect.group.children.forEach(child => {
                if (child.strokeColor && child.strokeWidth === 0.3) { // Wing veins
                    child.strokeColor = newInsectColor.replace(/[\d\.]+\)$/, '0.4)');
                }
            });
        });
        
        paper.view.draw();
    }

    handleResize() {
        // Stop current animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Remove existing canvas
        if (this.canvas) {
            this.canvas.remove();
        }
        
        // Recreate everything
        this.init();
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment to ensure Paper.js is loaded
    setTimeout(() => {
        window.waterInsectsBackground = new WaterInsectsBackground();
    }, 100);
});