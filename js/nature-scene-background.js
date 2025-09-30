// Water and Insects Background Animation
// Lower third water animation with swirling insects above

// ========================================
// FEATURE TOGGLES - Easy on/off switches
// ========================================
const ENABLE_FLORAL_ORNAMENTS = true; // toggle Jugendstil vines
const DEBUG_SPIRALS_ONLY = false; // show only spirals for debugging
// ========================================

class WaterInsectsBackground {
    constructor() {
        this.canvas = null;
        this.waterWaves = [];
        this.insects = [];
        this.seaStars = [];
        this.floralOrnaments = [];
        this.animationId = null;
        this.time = 0;
        this.resizeTimeout = null;

        this.init();
    }

    init() {
        this.createCanvas();
        this.setupPaper();
        this.detectContentBounds();
        this.createWaterSection();

        // Only create floral ornaments if enabled
        if (ENABLE_FLORAL_ORNAMENTS) {
            this.createFloralOrnaments();
        }

        this.createInsects();
        this.createSeaStars();
        this.startAnimation();

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());

        // Handle theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this.updateTheme();
        });

        // Watch for manual theme changes
        const observer = new MutationObserver(() => {
            this.updateTheme();
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
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
        this.seaStarsGroup = new paper.Group();
        this.floralGroup = new paper.Group();
    }

    isDarkTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme?.includes('dark') || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    getWaterColor(opacity) {
        const isDark = this.isDarkTheme();
        // Pure greyscale - ensure NO color tint
        const grey = isDark ? 230 : 70;  // Very light grey in dark, dark grey in light
        return `rgba(${grey}, ${grey}, ${grey}, ${opacity || 0.15})`;
    }

    getInsectColor() {
        const isDark = this.isDarkTheme();
        // Pure greyscale for insects
        const grey = isDark ? 220 : 60;
        return `rgba(${grey}, ${grey}, ${grey}, 0.5)`;
    }

    getSeaStarColor() {
        const isDark = this.isDarkTheme();
        // Pure greyscale for sea stars
        const grey = isDark ? 210 : 80;
        return `rgba(${grey}, ${grey}, ${grey}, 0.4)`;
    }

    getFloralColor() {
        const isDark = this.isDarkTheme();
        // Pure greyscale for floral ornaments - much more visible
        const grey = isDark ? 100 : 40;
        return `rgba(${grey}, ${grey}, ${grey}, 0.8)`;
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
        // Calculate opacity for this layer
        const isDark = this.isDarkTheme();
        const baseOpacity = isDark ? 0.25 : 0.15;
        const opacity = baseOpacity - (layer * 0.03);
        
        // Get pure greyscale color
        const waterColor = this.getWaterColor(opacity);
        
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
        
        // Use the pure greyscale waterColor directly
        wave.fillColor = waterColor;
        
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

    createFloralOrnaments() {
        const viewWidth = paper.view.size.width;
        const viewHeight = paper.view.size.height;
        const floralColor = this.getFloralColor();

        // Create symmetrical ornaments from both sides
        // They should frame content without crossing center
        const startHeight = viewHeight * 0.42; // Middle area
        const ornamentHeight = startHeight * 0.7; // Upward reach
        const ornamentWidth = Math.min(viewWidth * 0.28, 350); // Stop before center

        // Left side ornament - starts off-screen to the left
        this.createJugendstilVine(
            new paper.Point(-30, startHeight),
            ornamentWidth,
            ornamentHeight,
            floralColor,
            'left'
        );

        // Right side ornament - starts off-screen to the right
        this.createJugendstilVine(
            new paper.Point(viewWidth + 30, startHeight),
            ornamentWidth,
            ornamentHeight,
            floralColor,
            'right'
        );
    }

    createJugendstilVine(startPoint, width, height, color, side) {
        const isLeft = side === 'left';
        const direction = isLeft ? 1 : -1;

        // Main vine with bold, flowing Jugendstil curve
        const mainPoints = [];
        const numMainPoints = 20;

        for (let i = 0; i <= numMainPoints; i++) {
            const t = i / numMainPoints;
            // Strong inward curve with natural flow
            const curveFactor = Math.sin(t * Math.PI * 0.9);
            const x = startPoint.x + direction * width * (curveFactor * 1.1 + t * 0.7);
            const y = startPoint.y - height * t;
            mainPoints.push(new paper.Point(x, y));
        }

        // Create main stem with tapering width
        const mainStem = new paper.Path();
        mainStem.strokeColor = color;
        mainStem.strokeWidth = 4.5;
        mainStem.strokeCap = 'round';
        this.floralGroup.addChild(mainStem);

        // Create secondary flowing vines - more organic placement
        const branches = [];
        const branchConfigs = [
            { ratio: 0.15, length: 0.5, curve: 1.2, width: 2.5 },
            { ratio: 0.3, length: 0.45, curve: -0.8, width: 2.2 },
            { ratio: 0.5, length: 0.4, curve: 1.0, width: 2.0 },
            { ratio: 0.68, length: 0.35, curve: -0.9, width: 1.8 }
        ];

        branchConfigs.forEach(config => {
            const branchStem = new paper.Path();
            branchStem.strokeColor = color;
            branchStem.strokeWidth = config.width;
            branchStem.strokeCap = 'round';
            this.floralGroup.addChild(branchStem);

            const startIdx = Math.floor(config.ratio * mainPoints.length);
            const branchStart = mainPoints[startIdx];
            const branchLength = height * config.length;
            const branchPoints = [];

            // Organic flowing branch
            const numBranchPoints = 10;
            for (let i = 0; i <= numBranchPoints; i++) {
                const t = i / numBranchPoints;
                const baseAngle = -Math.PI / 2; // Start upward
                const curveAngle = config.curve * direction * Math.sin(t * Math.PI * 0.7);
                const angle = baseAngle + curveAngle;

                const x = branchStart.x + Math.cos(angle) * branchLength * t;
                const y = branchStart.y + Math.sin(angle) * branchLength * t;
                branchPoints.push(new paper.Point(x, y));
            }

            branches.push({
                stem: branchStem,
                ratio: config.ratio,
                points: branchPoints,
                decorations: []
            });
        });

        this.floralOrnaments.push({
            mainStem: mainStem,
            mainPoints: mainPoints,
            branches: branches,
            startPoint: startPoint,
            side: side,
            color: color,
            direction: direction,
            width: width,
            height: height,
            targetHeight: height,
            currentHeight: 0,
            growing: true,
            growthSpeed: 80,
            decorations: []
        });
    }

    createJugendstilLeaf(position, angle, size, color, style = 'simple') {
        const leafGroup = new paper.Group();

        if (style === 'pointed') {
            // Pointed three-part leaf like in reference
            const tip = position.add(new paper.Point(
                Math.cos(angle) * size,
                Math.sin(angle) * size
            ));

            const width = size * 0.3;
            const leaf = new paper.Path();
            leaf.add(position);
            leaf.add(position.add(new paper.Point(
                Math.cos(angle + Math.PI / 3) * width,
                Math.sin(angle + Math.PI / 3) * width
            )));
            leaf.add(tip);
            leaf.add(position.add(new paper.Point(
                Math.cos(angle - Math.PI / 3) * width,
                Math.sin(angle - Math.PI / 3) * width
            )));
            leaf.closed = true;
            leaf.smooth({ type: 'continuous', factor: 0.6 });
            leaf.fillColor = color.replace(/[\d\.]+\)$/, '0.3)');
            leaf.strokeColor = color;
            leaf.strokeWidth = 1.5;
            leafGroup.addChild(leaf);

        } else {
            // Simple elongated leaf
            const tip = position.add(new paper.Point(
                Math.cos(angle) * size,
                Math.sin(angle) * size
            ));

            const width = size * 0.35;
            const leaf = new paper.Path();
            leaf.add(position);
            leaf.add(position.add(new paper.Point(
                Math.cos(angle + Math.PI / 2) * width * 0.4,
                Math.sin(angle + Math.PI / 2) * width * 0.4
            )));
            leaf.add(tip);
            leaf.add(position.add(new paper.Point(
                Math.cos(angle - Math.PI / 2) * width * 0.4,
                Math.sin(angle - Math.PI / 2) * width * 0.4
            )));
            leaf.closed = true;
            leaf.smooth({ type: 'continuous', factor: 0.8 });
            leaf.fillColor = color.replace(/[\d\.]+\)$/, '0.25)');
            leaf.strokeColor = color;
            leaf.strokeWidth = 1.5;

            // Add central vein
            const vein = new paper.Path.Line(position, tip);
            vein.strokeColor = color.replace(/[\d\.]+\)$/, '0.6)');
            vein.strokeWidth = 0.8;

            leafGroup.addChild(leaf);
            leafGroup.addChild(vein);
        }

        return leafGroup;
    }

    createJugendstilBud(position, baseAngle, size, color, style = 'bud') {
        const group = new paper.Group();
        const budAngle = baseAngle - Math.PI / 2;

        // Stem for flower
        const stemLength = size * 1.2;
        const stemEnd = position.add(new paper.Point(
            Math.cos(budAngle) * stemLength,
            Math.sin(budAngle) * stemLength
        ));
        const budStem = new paper.Path();
        budStem.add(position);
        budStem.add(position.add(new paper.Point(
            Math.cos(budAngle) * stemLength * 0.5,
            Math.sin(budAngle) * stemLength * 0.7
        )));
        budStem.add(stemEnd);
        budStem.smooth();
        budStem.strokeColor = color;
        budStem.strokeWidth = 1.5;
        group.addChild(budStem);

        if (style === 'bell') {
            // Bell-shaped drooping flower like in reference
            const flowerCenter = stemEnd.add(new paper.Point(0, size * 0.2));

            // Create bell shape with three petals
            for (let i = 0; i < 3; i++) {
                const petalAngle = budAngle + Math.PI + (i - 1) * Math.PI / 6;
                const petal = new paper.Path();
                petal.add(flowerCenter);
                petal.add(flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle - 0.3) * size * 0.4,
                    Math.sin(petalAngle - 0.3) * size * 0.4
                )));
                petal.add(flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle) * size * 0.6,
                    Math.sin(petalAngle) * size * 0.6
                )));
                petal.add(flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle + 0.3) * size * 0.4,
                    Math.sin(petalAngle + 0.3) * size * 0.4
                )));
                petal.closed = true;
                petal.smooth();
                petal.fillColor = color.replace(/[\d\.]+\)$/, '0.2)');
                petal.strokeColor = color;
                petal.strokeWidth = 1.2;
                group.addChild(petal);
            }
        } else {
            // Simple bud
            const bud = new paper.Path.Circle(stemEnd, size * 0.4);
            bud.fillColor = color.replace(/[\d\.]+\)$/, '0.3)');
            bud.strokeColor = color;
            bud.strokeWidth = 1.5;
            group.addChild(bud);
        }

        return group;
    }

    createCurlingTendril(startPoint, direction, length, color, startAngle) {
        const group = new paper.Group();

        // Create a natural curl by continuing the vine's direction and gradually bending it back
        const tendril = new paper.Path();
        tendril.strokeColor = color;
        tendril.strokeWidth = 2.5;
        tendril.strokeCap = 'round';

        const numPoints = 15;
        let currentAngle = startAngle;
        let currentPoint = startPoint.clone();

        tendril.add(currentPoint);

        for (let i = 1; i <= numPoints; i++) {
            const t = i / numPoints;

            // Gradually increase the curvature (bend more and more)
            // The angle change accelerates as we progress, creating the inward curl
            const angleChange = -direction * 0.25 * (1 + t * 2); // Increasing bend
            currentAngle += angleChange;

            // Step size decreases as we curl tighter
            const stepSize = length * 0.15 * (1 - t * 0.5);

            currentPoint = currentPoint.add(new paper.Point(
                Math.cos(currentAngle) * stepSize,
                Math.sin(currentAngle) * stepSize
            ));

            tendril.add(currentPoint);
        }

        tendril.smooth({ type: 'catmull-rom', factor: 0.7 });
        group.addChild(tendril);

        // Add small bulb at the end
        const endPoint = tendril.lastSegment.point;
        const bulb = new paper.Path.Circle(endPoint, 3);
        bulb.fillColor = color;
        group.addChild(bulb);

        return group;
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

    createSeaStars() {
        const viewWidth = paper.view.size.width;
        const viewHeight = paper.view.size.height;
        const waterHeight = viewHeight / 3;
        const waterTop = viewHeight - waterHeight;
        const seaStarCount = 4 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < seaStarCount; i++) {
            const seaStar = this.createSeaStar(viewWidth, waterHeight, waterTop);
            this.seaStars.push(seaStar);
            this.seaStarsGroup.addChild(seaStar.group);
        }
    }

    createSeaStar(viewWidth, waterHeight, waterTop) {
        const seaStarColor = this.getSeaStarColor();
        const group = new paper.Group();
        
        // Position sea star in water area
        const x = Math.random() * viewWidth;
        const y = waterTop + (waterHeight * 0.4) + Math.random() * (waterHeight * 0.4);
        const center = new paper.Point(x, y);
        const size = 8 + Math.random() * 6;
        
        // Create proper pentameric starfish with continuous symmetry
        const starfish = new paper.Path();
        const armLength = size * 1.1;
        const armWidth = size * 0.35;
        const centerRadius = size * 0.25;
        
        // Create 10 points (2 per arm) for perfect 5-fold symmetry
        for (let i = 0; i < 10; i++) {
            const angle = (i * 36) * Math.PI / 180; // 36 degrees between points
            const isArmTip = i % 2 === 0;
            
            let radius;
            if (isArmTip) {
                // Arm tips - extend outward
                radius = armLength;
            } else {
                // Between arms - create the "waist" between arms
                radius = centerRadius + armWidth * 0.6;
            }
            
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            
            if (i === 0) {
                starfish.moveTo(x, y);
            } else {
                starfish.lineTo(x, y);
            }
        }
        
        starfish.closed = true;
        starfish.smooth({ type: 'continuous', factor: 0.85 });
        starfish.fillColor = seaStarColor;
        
        group.addChild(starfish);
        
        // Animation properties
        const seaStarData = {
            group: group,
            center: center.clone(),
            angle: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.3,
            rotationSpeed: 0.005 + Math.random() * 0.01,
            waterBounds: {
                top: waterTop + waterHeight * 0.3,
                bottom: waterTop + waterHeight * 0.9,
                left: size,
                right: viewWidth - size
            }
        };
        
        return seaStarData;
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
        const deltaTime = 1 / 60; // Approximate frame time

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
        
        // Animate sea stars with gentle floating and slow rotation
        this.seaStars.forEach(seaStar => {
            // Very slow, gentle horizontal drift
            seaStar.angle += seaStar.speed * 0.002;

            // Gentle floating motion - mostly horizontal with slight vertical drift
            const x = seaStar.center.x + Math.sin(this.time * 0.4) * 25;
            const y = seaStar.center.y + Math.sin(this.time * 0.25 + seaStar.angle) * 12;

            // Keep sea stars within water bounds
            const constrainedX = Math.max(seaStar.waterBounds.left, Math.min(seaStar.waterBounds.right, x));
            const constrainedY = Math.max(seaStar.waterBounds.top, Math.min(seaStar.waterBounds.bottom, y));

            seaStar.group.position = new paper.Point(constrainedX, constrainedY);

            // Gentle rotation
            seaStar.group.rotation += seaStar.rotationSpeed;
        });

        // Animate floral ornaments - progressive growth
        this.floralOrnaments.forEach((ornament, index) => {
            if (DEBUG_SPIRALS_ONLY) {
                // Skip everything except the terminal spiral
                if (!ornament.decorations[99]) {
                    ornament.growing = false;
                    const topPoint = ornament.mainPoints[ornament.mainPoints.length - 1];
                    const preTop = ornament.mainPoints[ornament.mainPoints.length - 2];
                    const vineEndingAngle = Math.atan2(topPoint.y - preTop.y, topPoint.x - preTop.x);
                    const spiralTendril = this.createCurlingTendril(topPoint, ornament.direction, 40, ornament.color, vineEndingAngle);
                    this.floralGroup.addChild(spiralTendril);
                    ornament.decorations[99] = spiralTendril;
                }
                return;
            }

            if (ornament.growing) {
                // Grow the ornament upward
                ornament.currentHeight += ornament.growthSpeed * deltaTime;

                // Calculate how far along the path we should be (0 to 1)
                const progress = Math.min(ornament.currentHeight / ornament.targetHeight, 1);
                const targetPointIndex = Math.floor(progress * (ornament.mainPoints.length - 1));

                // Build the main stem progressively
                ornament.mainStem.removeSegments();
                for (let i = 0; i <= targetPointIndex; i++) {
                    ornament.mainStem.add(ornament.mainPoints[i]);
                }

                // If we're partway to the next point, add interpolated point
                if (targetPointIndex < ornament.mainPoints.length - 1) {
                    const nextProgress = (progress * (ornament.mainPoints.length - 1)) - targetPointIndex;
                    const currentPt = ornament.mainPoints[targetPointIndex];
                    const nextPt = ornament.mainPoints[targetPointIndex + 1];
                    const interpPt = currentPt.add(nextPt.subtract(currentPt).multiply(nextProgress));
                    ornament.mainStem.add(interpPt);
                }

                ornament.mainStem.smooth({ type: 'catmull-rom', factor: 0.6 });

                // Draw branches as we reach them
                ornament.branches.forEach((branch, branchIdx) => {
                    if (progress >= branch.ratio && branch.points.length > 0) {
                        const branchProgress = Math.min((progress - branch.ratio) / 0.25, 1);
                        const branchTargetIdx = Math.floor(branchProgress * (branch.points.length - 1));

                        branch.stem.removeSegments();
                        for (let i = 0; i <= branchTargetIdx; i++) {
                            branch.stem.add(branch.points[i]);
                        }
                        if (branchProgress < 1 && branchTargetIdx < branch.points.length - 1) {
                            const bp = (branchProgress * (branch.points.length - 1)) - branchTargetIdx;
                            const curr = branch.points[branchTargetIdx];
                            const next = branch.points[branchTargetIdx + 1];
                            branch.stem.add(curr.add(next.subtract(curr).multiply(bp)));
                        }
                        branch.stem.smooth({ type: 'catmull-rom', factor: 0.6 });

                        // Add decorations to branches when they're mostly grown
                        if (branchProgress > 0.7 && !branch.decorations[0]) {
                            const tipPoint = branch.points[branch.points.length - 1];
                            const preTip = branch.points[Math.max(0, branch.points.length - 2)];
                            const angle = Math.atan2(tipPoint.y - preTip.y, tipPoint.x - preTip.x);

                            // Add small leaf or spiral at branch tip
                            let decoration;
                            if (branchIdx % 2 === 0) {
                                decoration = this.createJugendstilLeaf(tipPoint, angle - Math.PI / 2, 10, ornament.color, 'simple');
                            } else {
                                decoration = this.createCurlingTendril(tipPoint, ornament.direction, 15, ornament.color, angle);
                            }
                            this.floralGroup.addChild(decoration);
                            branch.decorations[0] = decoration;
                        }
                    }
                });

                // Add decorations - Jugendstil style with bell flowers and leaves
                const decorationThresholds = [
                    { ratio: 0.1, type: 'leaf', style: 'simple', side: -1, size: 16 },
                    { ratio: 0.22, type: 'flower', style: 'bell', side: 1 },
                    { ratio: 0.35, type: 'leaf', style: 'pointed', side: 1, size: 14 },
                    { ratio: 0.48, type: 'flower', style: 'bell', side: -1 },
                    { ratio: 0.58, type: 'spiral', side: 1 },
                    { ratio: 0.68, type: 'leaf', style: 'simple', side: -1, size: 13 },
                    { ratio: 0.78, type: 'flower', style: 'bell', side: 1 },
                    { ratio: 0.88, type: 'leaf', style: 'pointed', side: -1, size: 12 }
                ];

                decorationThresholds.forEach((deco, idx) => {
                    if (progress >= deco.ratio && !ornament.decorations[idx]) {
                        const pointIndex = Math.floor(deco.ratio * (ornament.mainPoints.length - 1));
                        const point = ornament.mainPoints[pointIndex];
                        const nextPoint = ornament.mainPoints[Math.min(pointIndex + 1, ornament.mainPoints.length - 1)];
                        const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);

                        let decoration;
                        if (deco.type === 'leaf') {
                            const leafAngle = angle + (Math.PI / 2) * deco.side;
                            decoration = this.createJugendstilLeaf(point, leafAngle, deco.size || 14, ornament.color, deco.style);
                        } else if (deco.type === 'spiral') {
                            decoration = this.createCurlingTendril(point, ornament.direction * deco.side, 22, ornament.color, angle);
                        } else if (deco.type === 'flower') {
                            decoration = this.createJugendstilBud(point, angle, 10, ornament.color, deco.style);
                        }

                        if (decoration) {
                            this.floralGroup.addChild(decoration);
                            ornament.decorations[idx] = decoration;
                        }
                    }
                });

                // Finish growing - add elegant coiling spiral continuing the vine's direction
                if (progress >= 1 && !ornament.decorations[99]) {
                    ornament.growing = false;
                    const topPoint = ornament.mainPoints[ornament.mainPoints.length - 1];
                    const preTop = ornament.mainPoints[ornament.mainPoints.length - 2];

                    // Calculate the actual ending angle of the vine
                    const vineEndingAngle = Math.atan2(topPoint.y - preTop.y, topPoint.x - preTop.x);

                    // Create elegant coiling spiral that continues the natural flow direction
                    const spiralTendril = this.createCurlingTendril(topPoint, ornament.direction, 40, ornament.color, vineEndingAngle);
                    this.floralGroup.addChild(spiralTendril);
                    ornament.decorations[99] = spiralTendril;
                }
            }
        });

        paper.view.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateTheme() {
        const isDark = this.isDarkTheme();
        
        // Update water colors with pure greyscale
        this.waterWaves.forEach((wave, index) => {
            const baseOpacity = isDark ? 0.25 : 0.15;
            const opacity = baseOpacity - (index * 0.03);
            wave.fillColor = this.getWaterColor(opacity);
        });
        
        const newInsectColor = this.getInsectColor();
        const newSeaStarColor = this.getSeaStarColor();
        
        // Update insect colors
        this.insects.forEach(insect => {
            if (insect.item && insect.item.children) {
                insect.item.children.forEach(child => {
                    if (child.fillColor) {
                        const opacity = child.fillColor.components[3] || 0.5;
                        child.fillColor = newInsectColor.replace(/[\d\.]+\)$/, `${opacity})`);
                    }
                    if (child.strokeColor) {
                        const opacity = child.strokeColor.components[3] || 0.5;
                        child.strokeColor = newInsectColor.replace(/[\d\.]+\)$/, `${opacity})`);
                    }
                });
            }
        });
        
        // Update sea star colors
        this.seaStars.forEach(seaStar => {
            if (seaStar.item && seaStar.item.children) {
                seaStar.item.children.forEach(child => {
                    if (child.fillColor) {
                        const opacity = child.fillColor.components[3] || 0.5;
                        child.fillColor = newSeaStarColor.replace(/[\d\.]+\)$/, `${opacity})`);
                    }
                });
            }
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
        
        // Update sea star colors (already declared above)
        this.seaStars.forEach(seaStar => {
            if (seaStar.group.children[0] && seaStar.group.children[0].fillColor) {
                seaStar.group.children[0].fillColor = newSeaStarColor;
            }
        });

        // Update floral ornament colors
        const newFloralColor = this.getFloralColor();
        this.floralOrnaments.forEach(ornament => {
            // Update main stem color
            if (ornament.mainStem && ornament.mainStem.strokeColor) {
                ornament.mainStem.strokeColor = newFloralColor;
            }
            // Update branch colors
            if (ornament.branches) {
                ornament.branches.forEach(branch => {
                    if (branch.stem && branch.stem.strokeColor) {
                        branch.stem.strokeColor = newFloralColor;
                    }
                });
            }
            // Update decorations
            ornament.decorations.forEach(decoration => {
                if (decoration) {
                    this.updateFloralElementColors(decoration, newFloralColor);
                }
            });
        });

        paper.view.draw();
    }

    updateFloralElementColors(item, color) {
        if (item.strokeColor) {
            const opacity = item.strokeColor.alpha;
            item.strokeColor = color.replace(/[\d\.]+\)$/, `${opacity})`);
        }
        if (item.fillColor) {
            const opacity = item.fillColor.alpha;
            item.fillColor = color.replace(/[\d\.]+\)$/, `${opacity})`);
        }
        if (item.children) {
            item.children.forEach(child => this.updateFloralElementColors(child, color));
        }
    }

    handleResize() {
        // Hide canvas immediately when resize starts
        if (this.canvas && !this.resizeTimeout) {
            this.canvas.style.opacity = '0';
        }

        // Clear any existing resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Wait 300ms after resize stops before recreating
        this.resizeTimeout = setTimeout(() => {
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

            // Clear timeout reference
            this.resizeTimeout = null;
        }, 300);
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
        // Force initial theme update and redraw to ensure correct colors
        setTimeout(() => {
            if (window.waterInsectsBackground) {
                window.waterInsectsBackground.updateTheme();
                // Force Paper.js to redraw
                if (paper && paper.view) {
                    paper.view.draw();
                }
            }
        }, 300);
    }, 100);
});
