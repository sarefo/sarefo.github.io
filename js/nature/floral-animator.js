// Feature toggles
const ENABLE_FLORAL_ORNAMENTS = true;
const DEBUG_SPIRALS_ONLY = false;

// Seeded random number generator for reproducible but varied vines
class SeededRandom {
    constructor(seed = Date.now()) {
        this.seed = seed;
    }

    // Linear congruential generator
    random() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    // Random float between min and max
    range(min, max) {
        return min + this.random() * (max - min);
    }

    // Random int between min (inclusive) and max (exclusive)
    int(min, max) {
        return Math.floor(this.range(min, max));
    }

    // Random boolean with given probability (0-1)
    chance(probability) {
        return this.random() < probability;
    }

    // Pick random element from array
    pick(array) {
        return array[this.int(0, array.length)];
    }
}

// Floral ornament (Jugendstil vines) creation and animation
class FloralAnimator {
    constructor(themeHandler, floralGroup, contentBounds = []) {
        this.themeHandler = themeHandler;
        this.floralGroup = floralGroup;
        this.contentBounds = contentBounds;
        this.floralOrnaments = [];
        this.rng = new SeededRandom(Date.now());
    }

    createFloralOrnaments(viewWidth, viewHeight) {
        if (!ENABLE_FLORAL_ORNAMENTS) return;

        const floralColor = this.themeHandler.getFloralColor();
        const startHeight = viewHeight * 0.42;
        const ornamentHeight = startHeight * 0.7;
        const ornamentWidth = Math.min(viewWidth * 0.28, 350);

        // Attractor points: on either side of "Sarefo" title
        const centerX = viewWidth / 2;
        const attractorOffset = 180; // Distance from center to attractor
        const leftAttractorX = centerX - attractorOffset;
        const rightAttractorX = centerX + attractorOffset;
        const attractorY = viewHeight * 0.15; // Near the title

        // Reset RNG to same seed for both vines to create symmetry
        const symmetrySeed = this.rng.seed;

        this.rng.seed = symmetrySeed;
        this.createJugendstilVine(
            new paper.Point(-30, startHeight),
            ornamentWidth,
            ornamentHeight,
            floralColor,
            'left',
            leftAttractorX,
            attractorY
        );

        this.rng.seed = symmetrySeed;
        this.createJugendstilVine(
            new paper.Point(viewWidth + 30, startHeight),
            ornamentWidth,
            ornamentHeight,
            floralColor,
            'right',
            rightAttractorX,
            attractorY
        );
    }

    // Check if a point intersects with content bounds
    isPointInContent(point, margin = 20) {
        return this.contentBounds.some(bounds => {
            return point.x >= bounds.left - margin &&
                   point.x <= bounds.right + margin &&
                   point.y >= bounds.top - margin &&
                   point.y <= bounds.bottom + margin;
        });
    }

    // Get deflection vector to avoid content
    getDeflectionVector(point, direction) {
        for (const bounds of this.contentBounds) {
            const margin = 40;
            if (point.x >= bounds.left - margin &&
                point.x <= bounds.right + margin &&
                point.y >= bounds.top - margin &&
                point.y <= bounds.bottom + margin) {

                // Calculate distance to each edge
                const distLeft = point.x - (bounds.left - margin);
                const distRight = (bounds.right + margin) - point.x;
                const distTop = point.y - (bounds.top - margin);
                const distBottom = (bounds.bottom + margin) - point.y;

                // Find closest edge and deflect away from it
                const minDist = Math.min(distLeft, distRight, distTop, distBottom);

                if (minDist === distLeft) {
                    return new paper.Point(-1, 0); // Push left
                } else if (minDist === distRight) {
                    return new paper.Point(1, 0); // Push right
                } else if (minDist === distTop) {
                    return new paper.Point(0, -0.5); // Push up slightly
                } else {
                    return new paper.Point(0, 0.5); // Push down slightly
                }
            }
        }
        return new paper.Point(0, 0);
    }

    createJugendstilVine(startPoint, width, height, color, side, attractorX, attractorY) {
        const isLeft = side === 'left';
        const direction = isLeft ? 1 : -1;

        const mainPoints = [];
        const numMainPoints = 20;

        for (let i = 0; i <= numMainPoints; i++) {
            const t = i / numMainPoints;

            // Current Y position
            const currentY = startPoint.y - height * t;

            // Calculate how much to curve inward (more at the top)
            const inwardCurve = t * t; // Quadratic easing - curves more at the top

            // Start position: curve outward initially, then inward
            const outwardCurve = Math.sin(t * Math.PI * 0.6) * 0.8; // Gentle S-curve

            // Horizontal movement: initial outward curve, then pull toward attractor
            const baseX = startPoint.x + direction * width * outwardCurve;

            // Pull toward attractor increasingly as we go up
            const pullTowardAttractor = (attractorX - baseX) * inwardCurve;
            const x = baseX + pullTowardAttractor;

            // Vertical movement: smooth upward
            const y = currentY;

            // Add subtle organic variation
            const noiseX = this.rng.range(-0.02, 0.02) * width * Math.sin(t * Math.PI * 3);
            const noiseY = this.rng.range(-0.01, 0.01) * height * t;

            mainPoints.push(new paper.Point(x + noiseX, y + noiseY));
        }

        const mainStem = new paper.Path();
        mainStem.strokeColor = color;
        mainStem.strokeWidth = 3.5;
        mainStem.strokeCap = 'round';
        this.floralGroup.addChild(mainStem);

        // Generate branches that follow upward flow
        const branches = [];
        const branchConfigs = [
            { ratio: 0.2, length: 0.45, angle: -0.4 },
            { ratio: 0.35, length: 0.4, angle: 0.3 },
            { ratio: 0.5, length: 0.35, angle: -0.5 },
            { ratio: 0.65, length: 0.3, angle: 0.4 }
        ];

        branchConfigs.forEach(config => {
            const branchData = this.createBranch(
                mainPoints,
                config.ratio,
                height * config.length,
                config.angle,
                direction,
                color,
                2.2,
                0,
                attractorX,
                attractorY
            );

            if (branchData) {
                branches.push(branchData);
            }
        });

        // Generate fewer, evenly-spaced decorations
        const decorationThresholds = [
            { ratio: 0.15, type: 'leaf', style: 'simple', side: -1, size: 14 },
            { ratio: 0.28, type: 'flower', style: 'bell', side: 1, size: 10 },
            { ratio: 0.42, type: 'leaf', style: 'pointed', side: 1, size: 12 },
            { ratio: 0.58, type: 'flower', style: 'bell', side: -1, size: 10 },
            { ratio: 0.72, type: 'leaf', style: 'simple', side: 1, size: 11 },
            { ratio: 0.85, type: 'spiral', side: -1, size: 12 }
        ];

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
            growthSpeed: this.rng.range(70, 95),
            decorations: [],
            decorationThresholds: decorationThresholds
        });
    }

    // Create a branch with optional recursive sub-branches
    createBranch(parentPoints, ratio, branchLength, branchAngle, parentDirection, color, strokeWidth, depth, attractorX, attractorY) {
        const maxDepth = 1; // Reduce recursion for cleaner look

        const branchStem = new paper.Path();
        branchStem.strokeColor = color;
        branchStem.strokeWidth = strokeWidth;
        branchStem.strokeCap = 'round';
        this.floralGroup.addChild(branchStem);

        const startIdx = Math.floor(ratio * (parentPoints.length - 1));
        const branchStart = parentPoints[startIdx];
        const branchPoints = [];

        const numBranchPoints = 10;

        for (let i = 0; i <= numBranchPoints; i++) {
            const t = i / numBranchPoints;

            // Start angle: branch off from main vine
            const baseAngle = -Math.PI / 2 + branchAngle * parentDirection;

            // Gently curve toward upward direction as branch grows
            const curveTowardUp = t * 0.3; // Gradually align with upward direction
            const angle = baseAngle + curveTowardUp;

            // Subtle organic variation
            const noiseX = this.rng.range(-0.02, 0.02) * branchLength * t;
            const noiseY = this.rng.range(-0.02, 0.02) * branchLength * t;

            const x = branchStart.x + Math.cos(angle) * branchLength * t + noiseX;
            const y = branchStart.y + Math.sin(angle) * branchLength * t + noiseY;
            branchPoints.push(new paper.Point(x, y));
        }

        // Create fewer, more controlled sub-branches
        const subBranches = [];
        if (depth < maxDepth && this.rng.chance(0.5)) {
            const subRatio = 0.6;
            const subLength = branchLength * 0.5;
            const subAngle = branchAngle * 0.7;
            const subWidth = strokeWidth * 0.7;

            const subBranchData = this.createBranch(
                branchPoints,
                subRatio,
                subLength,
                subAngle,
                parentDirection,
                color,
                subWidth,
                depth + 1,
                attractorX,
                attractorY
            );

            if (subBranchData) {
                subBranches.push(subBranchData);
            }
        }

        return {
            stem: branchStem,
            ratio: ratio,
            points: branchPoints,
            width: strokeWidth,
            decorations: [],
            subBranches: subBranches,
            depth: depth
        };
    }

    createJugendstilLeaf(position, angle, size, color, style = 'simple') {
        const leafGroup = new paper.Group();

        // Minimal randomization for consistent look
        const randomSize = size * this.rng.range(0.95, 1.05);
        const randomAngle = angle + this.rng.range(-0.1, 0.1);

        if (style === 'pointed') {
            const tip = position.add(new paper.Point(
                Math.cos(randomAngle) * randomSize,
                Math.sin(randomAngle) * randomSize
            ));

            const width = randomSize * this.rng.range(0.28, 0.35);
            const leaf = new paper.Path();
            leaf.add(position);
            leaf.add(position.add(new paper.Point(
                Math.cos(randomAngle + Math.PI / 3) * width,
                Math.sin(randomAngle + Math.PI / 3) * width
            )));
            leaf.add(tip);
            leaf.add(position.add(new paper.Point(
                Math.cos(randomAngle - Math.PI / 3) * width,
                Math.sin(randomAngle - Math.PI / 3) * width
            )));
            leaf.closed = true;
            leaf.smooth({ type: 'continuous', factor: this.rng.range(0.5, 0.7) });
            leaf.fillColor = color.replace(/[\d\.]+\)$/, '0.3)');
            leaf.strokeColor = color;
            leaf.strokeWidth = this.rng.range(1.2, 1.8);
            leafGroup.addChild(leaf);

        } else if (style === 'compound') {
            // New compound leaf style (multiple leaflets)
            const numLeaflets = this.rng.int(3, 6);
            for (let i = 0; i < numLeaflets; i++) {
                const t = i / (numLeaflets - 1);
                const leafletAngle = randomAngle + (i - (numLeaflets - 1) / 2) * 0.3;
                const leafletSize = randomSize * (0.4 + t * 0.3);
                const leafletPos = position.add(new paper.Point(
                    Math.cos(randomAngle) * randomSize * t * 0.6,
                    Math.sin(randomAngle) * randomSize * t * 0.6
                ));

                const leafletWidth = leafletSize * 0.25;
                const leafletTip = leafletPos.add(new paper.Point(
                    Math.cos(leafletAngle) * leafletSize,
                    Math.sin(leafletAngle) * leafletSize
                ));

                const leaflet = new paper.Path.Ellipse({
                    center: leafletPos.add(leafletTip).divide(2),
                    size: [leafletWidth * 2, leafletSize]
                });
                leaflet.rotate((leafletAngle * 180 / Math.PI) + 90);
                leaflet.fillColor = color.replace(/[\d\.]+\)$/, '0.25)');
                leaflet.strokeColor = color;
                leaflet.strokeWidth = 1;
                leafGroup.addChild(leaflet);
            }

        } else {
            const tip = position.add(new paper.Point(
                Math.cos(randomAngle) * randomSize,
                Math.sin(randomAngle) * randomSize
            ));

            const width = randomSize * this.rng.range(0.32, 0.4);
            const leaf = new paper.Path();
            leaf.add(position);
            leaf.add(position.add(new paper.Point(
                Math.cos(randomAngle + Math.PI / 2) * width * 0.4,
                Math.sin(randomAngle + Math.PI / 2) * width * 0.4
            )));
            leaf.add(tip);
            leaf.add(position.add(new paper.Point(
                Math.cos(randomAngle - Math.PI / 2) * width * 0.4,
                Math.sin(randomAngle - Math.PI / 2) * width * 0.4
            )));
            leaf.closed = true;
            leaf.smooth({ type: 'continuous', factor: this.rng.range(0.7, 0.9) });
            leaf.fillColor = color.replace(/[\d\.]+\)$/, '0.25)');
            leaf.strokeColor = color;
            leaf.strokeWidth = this.rng.range(1.2, 1.8);

            const vein = new paper.Path.Line(position, tip);
            vein.strokeColor = color.replace(/[\d\.]+\)$/, '0.6)');
            vein.strokeWidth = this.rng.range(0.6, 1.0);

            leafGroup.addChild(leaf);
            leafGroup.addChild(vein);
        }

        return leafGroup;
    }

    createJugendstilBud(position, baseAngle, size, color, style = 'bud') {
        const group = new paper.Group();
        const budAngle = baseAngle - Math.PI / 2 + this.rng.range(-0.05, 0.05);

        const stemLength = size * 1.2;
        const stemEnd = position.add(new paper.Point(
            Math.cos(budAngle) * stemLength,
            Math.sin(budAngle) * stemLength
        ));
        const budStem = new paper.Path();
        budStem.add(position);
        budStem.add(position.add(new paper.Point(
            Math.cos(budAngle) * stemLength * this.rng.range(0.45, 0.55),
            Math.sin(budAngle) * stemLength * this.rng.range(0.65, 0.75)
        )));
        budStem.add(stemEnd);
        budStem.smooth();
        budStem.strokeColor = color;
        budStem.strokeWidth = this.rng.range(1.2, 1.8);
        group.addChild(budStem);

        if (style === 'bell') {
            const flowerCenter = stemEnd.add(new paper.Point(0, size * this.rng.range(0.15, 0.25)));
            const numPetals = this.rng.int(3, 6); // Randomize petal count

            for (let i = 0; i < numPetals; i++) {
                const petalAngle = budAngle + Math.PI + (i - (numPetals - 1) / 2) * (Math.PI / (numPetals + 1));
                const petalSize = size * this.rng.range(0.55, 0.7);
                const petal = new paper.Path();
                petal.add(flowerCenter);
                petal.add(flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle - 0.3) * size * 0.4,
                    Math.sin(petalAngle - 0.3) * size * 0.4
                )));
                petal.add(flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle) * petalSize,
                    Math.sin(petalAngle) * petalSize
                )));
                petal.add(flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle + 0.3) * size * 0.4,
                    Math.sin(petalAngle + 0.3) * size * 0.4
                )));
                petal.closed = true;
                petal.smooth();
                petal.fillColor = color.replace(/[\d\.]+\)$/, '0.2)');
                petal.strokeColor = color;
                petal.strokeWidth = this.rng.range(1.0, 1.4);
                group.addChild(petal);
            }
        } else if (style === 'cluster') {
            // New cluster style - multiple small buds
            const numBuds = this.rng.int(3, 6);
            for (let i = 0; i < numBuds; i++) {
                const offset = this.rng.range(-size * 0.3, size * 0.3);
                const budPos = stemEnd.add(new paper.Point(offset, offset * 0.5));
                const budSize = size * this.rng.range(0.25, 0.4);
                const bud = new paper.Path.Circle(budPos, budSize);
                bud.fillColor = color.replace(/[\d\.]+\)$/, '0.3)');
                bud.strokeColor = color;
                bud.strokeWidth = 1;
                group.addChild(bud);
            }
        } else {
            const budSize = size * this.rng.range(0.35, 0.45);
            const bud = new paper.Path.Circle(stemEnd, budSize);
            bud.fillColor = color.replace(/[\d\.]+\)$/, '0.3)');
            bud.strokeColor = color;
            bud.strokeWidth = this.rng.range(1.2, 1.8);
            group.addChild(bud);
        }

        return group;
    }

    createCurlingTendril(startPoint, direction, length, color, startAngle, strokeWidth = 3.5) {
        const group = new paper.Group();

        const tendril = new paper.Path();
        tendril.strokeColor = color;
        tendril.strokeWidth = strokeWidth * this.rng.range(0.85, 1.15);
        tendril.strokeCap = 'round';

        const numPoints = this.rng.int(12, 18);
        const curlTightness = this.rng.range(0.15, 0.25); // Randomize curl tightness
        const curlAcceleration = this.rng.range(1.3, 1.7); // How much curl accelerates

        let currentAngle = startAngle;
        let currentPoint = startPoint.clone();

        tendril.add(currentPoint);

        for (let i = 1; i <= numPoints; i++) {
            const t = i / numPoints;
            const angleChange = -direction * curlTightness * (1 + t * curlAcceleration);
            currentAngle += angleChange;

            const stepSize = length * this.rng.range(0.12, 0.18) * (1 - t * 0.5);

            currentPoint = currentPoint.add(new paper.Point(
                Math.cos(currentAngle) * stepSize,
                Math.sin(currentAngle) * stepSize
            ));

            tendril.add(currentPoint);
        }

        tendril.smooth({ type: 'catmull-rom', factor: this.rng.range(0.6, 0.8) });
        group.addChild(tendril);

        const endPoint = tendril.lastSegment.point;
        const bulbSize = this.rng.range(2.5, 4.5);
        const bulb = new paper.Path.Circle(endPoint, bulbSize);
        bulb.fillColor = color;
        group.addChild(bulb);

        return group;
    }

    // Helper method to recursively animate a branch and its sub-branches
    animateBranch(branch, parentProgress, ornament) {
        if (parentProgress >= branch.ratio && branch.points.length > 0) {
            const branchProgress = Math.min((parentProgress - branch.ratio) / 0.25, 1);
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

            // Add decoration at branch tip (randomized)
            if (branchProgress > 0.7 && !branch.decorations[0]) {
                const tipPoint = branch.points[branch.points.length - 1];
                const preTip = branch.points[Math.max(0, branch.points.length - 2)];
                const angle = Math.atan2(tipPoint.y - preTip.y, tipPoint.x - preTip.x);

                const decorationTypes = ['leaf', 'tendril', 'flower'];
                const chosenType = this.rng.pick(decorationTypes);
                let decoration;

                if (chosenType === 'leaf') {
                    const leafStyles = ['simple', 'pointed', 'compound'];
                    const style = this.rng.pick(leafStyles);
                    decoration = this.createJugendstilLeaf(tipPoint, angle - Math.PI / 2, this.rng.range(8, 14), ornament.color, style);
                } else if (chosenType === 'tendril') {
                    decoration = this.createCurlingTendril(tipPoint, ornament.direction, this.rng.range(12, 20), ornament.color, angle, branch.width);
                } else {
                    const flowerStyles = ['bell', 'bud', 'cluster'];
                    const style = this.rng.pick(flowerStyles);
                    decoration = this.createJugendstilBud(tipPoint, angle, this.rng.range(8, 12), ornament.color, style);
                }

                this.floralGroup.addChild(decoration);
                branch.decorations[0] = decoration;
            }

            // Recursively animate sub-branches
            if (branch.subBranches) {
                branch.subBranches.forEach(subBranch => {
                    this.animateBranch(subBranch, branchProgress, ornament);
                });
            }
        }
    }

    animate(deltaTime) {
        if (!ENABLE_FLORAL_ORNAMENTS) return;

        this.floralOrnaments.forEach((ornament, index) => {
            if (DEBUG_SPIRALS_ONLY) {
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
                ornament.currentHeight += ornament.growthSpeed * deltaTime;

                const progress = Math.min(ornament.currentHeight / ornament.targetHeight, 1);
                const targetPointIndex = Math.floor(progress * (ornament.mainPoints.length - 1));

                ornament.mainStem.removeSegments();
                for (let i = 0; i <= targetPointIndex; i++) {
                    ornament.mainStem.add(ornament.mainPoints[i]);
                }

                if (targetPointIndex < ornament.mainPoints.length - 1) {
                    const nextProgress = (progress * (ornament.mainPoints.length - 1)) - targetPointIndex;
                    const currentPt = ornament.mainPoints[targetPointIndex];
                    const nextPt = ornament.mainPoints[targetPointIndex + 1];
                    const interpPt = currentPt.add(nextPt.subtract(currentPt).multiply(nextProgress));
                    ornament.mainStem.add(interpPt);
                }

                ornament.mainStem.smooth({ type: 'catmull-rom', factor: 0.6 });

                // Animate branches recursively
                ornament.branches.forEach((branch, branchIdx) => {
                    this.animateBranch(branch, progress, ornament);
                });

                // Use randomized decoration thresholds from ornament
                ornament.decorationThresholds.forEach((deco, idx) => {
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
                            decoration = this.createCurlingTendril(point, ornament.direction * deco.side, 22, ornament.color, angle, 2.0);
                        } else if (deco.type === 'flower') {
                            decoration = this.createJugendstilBud(point, angle, 10, ornament.color, deco.style);
                        }

                        if (decoration) {
                            this.floralGroup.addChild(decoration);
                            ornament.decorations[idx] = decoration;
                        }
                    }
                });

                if (progress >= 1 && !ornament.decorations[99]) {
                    ornament.growing = false;
                    const topPoint = ornament.mainPoints[ornament.mainPoints.length - 1];
                    const preTop = ornament.mainPoints[ornament.mainPoints.length - 2];

                    const vineEndingAngle = Math.atan2(topPoint.y - preTop.y, topPoint.x - preTop.x);

                    const curlPoints = [];
                    let currentAngle = vineEndingAngle;
                    let currentPoint = topPoint.clone();
                    const numCurlPoints = 15;
                    const curlLength = 40;

                    for (let i = 1; i <= numCurlPoints; i++) {
                        const t = i / numCurlPoints;
                        const angleChange = -ornament.direction * 0.2 * (1 + t * 1.5);
                        currentAngle += angleChange;
                        const stepSize = curlLength * 0.15 * (1 - t * 0.5);
                        currentPoint = currentPoint.add(new paper.Point(
                            Math.cos(currentAngle) * stepSize,
                            Math.sin(currentAngle) * stepSize
                        ));
                        curlPoints.push(currentPoint);
                    }

                    curlPoints.forEach(pt => ornament.mainStem.add(pt));
                    ornament.mainStem.smooth({ type: 'catmull-rom', factor: 0.7 });

                    const endPoint = curlPoints[curlPoints.length - 1];
                    const bulb = new paper.Path.Circle(endPoint, 3.5);
                    bulb.fillColor = ornament.color;
                    this.floralGroup.addChild(bulb);
                    ornament.decorations[99] = bulb;
                }
            }
        });
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

    updateTheme() {
        const newFloralColor = this.themeHandler.getFloralColor();
        this.floralOrnaments.forEach(ornament => {
            if (ornament.mainStem && ornament.mainStem.strokeColor) {
                ornament.mainStem.strokeColor = newFloralColor;
            }
            if (ornament.branches) {
                ornament.branches.forEach(branch => {
                    if (branch.stem && branch.stem.strokeColor) {
                        branch.stem.strokeColor = newFloralColor;
                    }
                });
            }
            ornament.decorations.forEach(decoration => {
                if (decoration) {
                    this.updateFloralElementColors(decoration, newFloralColor);
                }
            });
        });
    }
}
