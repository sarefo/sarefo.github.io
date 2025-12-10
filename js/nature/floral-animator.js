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
        const ornamentHeight = startHeight * 0.75;
        const ornamentWidth = Math.min(viewWidth * 0.32, 400);

        // Attractor points: on either side of "Sarefo" title
        const centerX = viewWidth / 2;
        const attractorOffset = 200;
        const leftAttractorX = centerX - attractorOffset;
        const rightAttractorX = centerX + attractorOffset;
        const attractorY = viewHeight * 0.12;

        // Reset RNG to same seed for both vines to create symmetry
        const symmetrySeed = this.rng.seed;

        this.rng.seed = symmetrySeed;
        this.createJugendstilVine(
            new paper.Point(-20, startHeight),
            ornamentWidth,
            ornamentHeight,
            floralColor,
            'left',
            leftAttractorX,
            attractorY
        );

        this.rng.seed = symmetrySeed;
        this.createJugendstilVine(
            new paper.Point(viewWidth + 20, startHeight),
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

        // Very subtle curve - almost vertical, gentle inward lean
        const mainPoints = [];
        const numPoints = 35;
        const maxInward = width * 0.25; // Very subtle

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;

            // Vertical progress
            const y = startPoint.y - height * t;

            // Simple curve that only goes inward, never back out
            // Using sqrt gives a curve that's steeper at start, gentler at top
            const curve = Math.sqrt(t) * maxInward;

            const x = startPoint.x + direction * curve;

            mainPoints.push(new paper.Point(x, y));
        }

        const mainStem = new paper.Path();
        mainStem.strokeColor = color;
        mainStem.strokeWidth = 1.5;
        mainStem.strokeCap = 'round';
        this.floralGroup.addChild(mainStem);

        // Small side branches that curve inward and end with spirals
        const branches = [];
        const branchConfigs = [
            { ratio: 0.2, side: -1, length: 25 },
            { ratio: 0.4, side: 1, length: 22 },
            { ratio: 0.6, side: -1, length: 20 },
            { ratio: 0.8, side: 1, length: 18 }
        ];

        branchConfigs.forEach(config => {
            const branchData = this.createDelicateBranch(
                mainPoints,
                config.ratio,
                config.length,
                config.side * direction,
                color
            );
            if (branchData) {
                branches.push(branchData);
            }
        });

        // A few delicate leaves
        const decorationThresholds = [
            { ratio: 0.3, type: 'leaf', side: -direction, size: 10 },
            { ratio: 0.55, type: 'leaf', side: direction, size: 9 },
            { ratio: 0.75, type: 'leaf', side: -direction, size: 8 }
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
            growthSpeed: this.rng.range(80, 110),
            decorations: [],
            decorationThresholds: decorationThresholds
        });
    }

    // Cubic bezier interpolation
    cubicBezier(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        return new paper.Point(
            mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
        );
    }

    // Quadratic bezier interpolation
    quadraticBezier(p0, p1, p2, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        return new paper.Point(
            mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
            mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y
        );
    }

    // Create a delicate branch that flows upward with a tight spiral at the end
    createDelicateBranch(parentPoints, ratio, length, sideDirection, color) {
        const startIdx = Math.floor(ratio * (parentPoints.length - 1));
        const branchStart = parentPoints[startIdx];
        const prevPoint = parentPoints[Math.max(0, startIdx - 1)];
        const nextPoint = parentPoints[Math.min(startIdx + 1, parentPoints.length - 1)];

        // Get tangent direction of parent vine
        const tangent = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);

        // Branch emerges at angle from tangent, then curves upward
        const startAngle = tangent + sideDirection * Math.PI * 0.35;

        const branchPoints = [];
        const numPoints = 15;

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;

            // Start at branch angle, gradually curve upward (toward -PI/2)
            const targetAngle = -Math.PI / 2 + sideDirection * 0.2; // Mostly upward
            const angle = startAngle + (targetAngle - startAngle) * Math.pow(t, 0.7);

            // Length with slight taper
            const dist = length * t;

            const x = branchStart.x + Math.cos(angle) * dist;
            const y = branchStart.y + Math.sin(angle) * dist;
            branchPoints.push(new paper.Point(x, y));
        }

        const branchStem = new paper.Path();
        branchStem.strokeColor = color;
        branchStem.strokeWidth = 1.2; // Delicate
        branchStem.strokeCap = 'round';
        this.floralGroup.addChild(branchStem);

        return {
            stem: branchStem,
            ratio: ratio,
            points: branchPoints,
            width: 1.2,
            decorations: [],
            sideDirection: sideDirection
        };
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

        // Delicate, elongated leaf like in reference
        const leafLength = size;
        const leafWidth = size * 0.22; // Narrow, elongated

        const tip = position.add(new paper.Point(
            Math.cos(angle) * leafLength,
            Math.sin(angle) * leafLength
        ));

        // Simple elongated leaf shape
        const leaf = new paper.Path();
        leaf.add(position);

        // Control points for elegant curve
        const midPoint = position.add(tip).divide(2);
        const perpAngle = angle + Math.PI / 2;

        leaf.add(midPoint.add(new paper.Point(
            Math.cos(perpAngle) * leafWidth,
            Math.sin(perpAngle) * leafWidth
        )));
        leaf.add(tip);
        leaf.add(midPoint.add(new paper.Point(
            Math.cos(perpAngle) * -leafWidth,
            Math.sin(perpAngle) * -leafWidth
        )));

        leaf.closed = true;
        leaf.smooth({ type: 'continuous', factor: 0.6 });
        leaf.fillColor = color.replace(/[\d\.]+\)$/, '0.2)');
        leaf.strokeColor = color;
        leaf.strokeWidth = 0.8;
        leafGroup.addChild(leaf);

        // Delicate center vein
        const vein = new paper.Path.Line(position, tip);
        vein.strokeColor = color.replace(/[\d\.]+\)$/, '0.5)');
        vein.strokeWidth = 0.5;
        leafGroup.addChild(vein);

        return leafGroup;
    }

    createJugendstilBud(position, baseAngle, size, color, style = 'bud') {
        const group = new paper.Group();
        const budAngle = baseAngle - Math.PI / 2 + this.rng.range(-0.08, 0.08);

        // Elegant curved stem characteristic of Jugendstil
        const stemLength = size * 1.4;
        const stemEnd = position.add(new paper.Point(
            Math.cos(budAngle) * stemLength,
            Math.sin(budAngle) * stemLength
        ));
        const budStem = new paper.Path();
        budStem.add(position);
        // Add graceful curve to stem
        const midPoint = position.add(new paper.Point(
            Math.cos(budAngle + 0.2) * stemLength * 0.5,
            Math.sin(budAngle) * stemLength * 0.6
        ));
        budStem.add(midPoint);
        budStem.add(stemEnd);
        budStem.smooth({ type: 'catmull-rom', factor: 0.7 });
        budStem.strokeColor = color;
        budStem.strokeWidth = this.rng.range(1.0, 1.5);
        group.addChild(budStem);

        if (style === 'bell' || style === 'tulip') {
            // Elegant drooping bell flower like in reference
            const flowerCenter = stemEnd;
            const dropAngle = budAngle + Math.PI * 0.1; // Slight droop
            const numPetals = 3;
            const petalLength = size * 0.8;
            const petalWidth = size * 0.35;

            for (let i = 0; i < numPetals; i++) {
                const petalSpread = (i - 1) * 0.4;
                const petalAngle = dropAngle + Math.PI + petalSpread;

                const petal = new paper.Path();
                petal.add(flowerCenter);

                // Create elegant curved petal with pointed tip
                const cp1 = flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle - 0.25) * petalLength * 0.4,
                    Math.sin(petalAngle - 0.25) * petalLength * 0.4
                ));
                const tip = flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle) * petalLength,
                    Math.sin(petalAngle) * petalLength
                ));
                const cp2 = flowerCenter.add(new paper.Point(
                    Math.cos(petalAngle + 0.25) * petalLength * 0.4,
                    Math.sin(petalAngle + 0.25) * petalLength * 0.4
                ));

                petal.add(cp1);
                petal.add(tip);
                petal.add(cp2);
                petal.closed = true;
                petal.smooth({ type: 'continuous', factor: 0.6 });
                petal.fillColor = color.replace(/[\d\.]+\)$/, '0.15)');
                petal.strokeColor = color;
                petal.strokeWidth = 1.2;
                group.addChild(petal);
            }

            // Add small stamens/center detail
            const centerDot = new paper.Path.Circle(flowerCenter.add(new paper.Point(
                Math.cos(dropAngle + Math.PI) * size * 0.15,
                Math.sin(dropAngle + Math.PI) * size * 0.15
            )), size * 0.08);
            centerDot.fillColor = color;
            group.addChild(centerDot);

        } else if (style === 'hanging') {
            // New hanging bell style - multiple drooping bells
            const numBells = this.rng.int(2, 4);
            for (let i = 0; i < numBells; i++) {
                const bellAngle = budAngle + (i - (numBells - 1) / 2) * 0.5;
                const bellLength = size * this.rng.range(0.5, 0.7);
                const bellEnd = stemEnd.add(new paper.Point(
                    Math.cos(bellAngle + Math.PI * 0.6) * bellLength,
                    Math.sin(bellAngle + Math.PI * 0.6) * bellLength
                ));

                // Small stem to bell
                const bellStem = new paper.Path.Line(stemEnd, bellEnd);
                bellStem.strokeColor = color;
                bellStem.strokeWidth = 0.8;
                group.addChild(bellStem);

                // Bell shape
                const bell = new paper.Path();
                bell.add(bellEnd.add(new paper.Point(-size * 0.12, 0)));
                bell.add(bellEnd.add(new paper.Point(-size * 0.08, size * 0.2)));
                bell.add(bellEnd.add(new paper.Point(size * 0.08, size * 0.2)));
                bell.add(bellEnd.add(new paper.Point(size * 0.12, 0)));
                bell.smooth();
                bell.strokeColor = color;
                bell.strokeWidth = 1;
                bell.fillColor = color.replace(/[\d\.]+\)$/, '0.12)');
                group.addChild(bell);
            }

        } else if (style === 'cluster') {
            const numBuds = this.rng.int(3, 5);
            for (let i = 0; i < numBuds; i++) {
                const angle = (i / numBuds) * Math.PI * 0.8 + budAngle + Math.PI * 0.6;
                const dist = size * this.rng.range(0.15, 0.3);
                const budPos = stemEnd.add(new paper.Point(
                    Math.cos(angle) * dist,
                    Math.sin(angle) * dist
                ));
                const budSize = size * this.rng.range(0.12, 0.18);
                const bud = new paper.Path.Circle(budPos, budSize);
                bud.fillColor = color.replace(/[\d\.]+\)$/, '0.25)');
                bud.strokeColor = color;
                bud.strokeWidth = 0.8;
                group.addChild(bud);
            }
        } else {
            // Simple elegant bud
            const budSize = size * this.rng.range(0.25, 0.35);
            const bud = new paper.Path.Circle(stemEnd, budSize);
            bud.fillColor = color.replace(/[\d\.]+\)$/, '0.2)');
            bud.strokeColor = color;
            bud.strokeWidth = this.rng.range(1.0, 1.4);
            group.addChild(bud);
        }

        return group;
    }

    // Create a very tight curling spiral like in the Jugendstil reference
    createCurlingTendril(startPoint, direction, length, color, startAngle, strokeWidth = 1.5, style = 'classic') {
        const group = new paper.Group();

        const tendril = new paper.Path();
        tendril.strokeColor = color;
        tendril.strokeWidth = strokeWidth;
        tendril.strokeCap = 'round';

        // Very tight spirals for authentic Jugendstil look
        const numPoints = 25;
        const curlTightness = 0.35; // Tighter curl
        const curlAcceleration = 3.0; // Strong acceleration for tight end

        let currentAngle = startAngle;
        let currentPoint = startPoint.clone();

        tendril.add(currentPoint);

        for (let i = 1; i <= numPoints; i++) {
            const t = i / numPoints;
            // Strong exponential acceleration creates very tight spiral at the end
            const angleChange = -direction * curlTightness * (1 + Math.pow(t, 1.8) * curlAcceleration);
            currentAngle += angleChange;

            // Step size decreases rapidly for tight spiral
            const stepSize = length * 0.08 * Math.pow(1 - t * 0.8, 1.5);

            currentPoint = currentPoint.add(new paper.Point(
                Math.cos(currentAngle) * stepSize,
                Math.sin(currentAngle) * stepSize
            ));

            tendril.add(currentPoint);
        }

        tendril.smooth({ type: 'catmull-rom', factor: 0.7 });
        group.addChild(tendril);

        // Tiny end dot
        const endPoint = tendril.lastSegment.point;
        const bulb = new paper.Path.Circle(endPoint, 1.2);
        bulb.fillColor = color;
        group.addChild(bulb);

        return group;
    }

    // Animate a delicate branch
    animateBranch(branch, parentProgress, ornament) {
        if (parentProgress >= branch.ratio && branch.points.length > 0) {
            const branchProgress = Math.min((parentProgress - branch.ratio) / 0.15, 1);
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
            branch.stem.smooth({ type: 'catmull-rom', factor: 0.7 });

            // Add tight spiral at branch tip when fully grown
            if (branchProgress >= 1 && !branch.decorations[0]) {
                const tipPoint = branch.points[branch.points.length - 1];
                const preTip = branch.points[Math.max(0, branch.points.length - 3)];
                const angle = Math.atan2(tipPoint.y - preTip.y, tipPoint.x - preTip.x);

                // Create tight spiral at branch end
                const spiral = this.createCurlingTendril(
                    tipPoint,
                    branch.sideDirection || ornament.direction,
                    18,
                    ornament.color,
                    angle,
                    1.0
                );

                this.floralGroup.addChild(spiral);
                branch.decorations[0] = spiral;
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
                    const spiralTendril = this.createCurlingTendril(topPoint, ornament.direction, 40, ornament.color, vineEndingAngle, 3.5, 'tight');
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

                // Add elegant decorations along the vine
                ornament.decorationThresholds.forEach((deco, idx) => {
                    if (progress >= deco.ratio && !ornament.decorations[idx]) {
                        const pointIndex = Math.floor(deco.ratio * (ornament.mainPoints.length - 1));
                        const point = ornament.mainPoints[pointIndex];
                        const prevPoint = ornament.mainPoints[Math.max(0, pointIndex - 2)];
                        const nextPoint = ornament.mainPoints[Math.min(pointIndex + 2, ornament.mainPoints.length - 1)];

                        // Get tangent direction of vine at this point
                        const tangentAngle = Math.atan2(nextPoint.y - prevPoint.y, nextPoint.x - prevPoint.x);

                        let decoration;
                        if (deco.type === 'leaf') {
                            // Leaves point slightly outward from the vine direction
                            const leafAngle = tangentAngle + deco.side * Math.PI * 0.3;
                            decoration = this.createJugendstilLeaf(point, leafAngle, deco.size || 14, ornament.color, deco.style);
                        } else if (deco.type === 'spiral') {
                            const spiralAngle = tangentAngle + deco.side * Math.PI * 0.25;
                            decoration = this.createCurlingTendril(point, deco.side, deco.size || 22, ornament.color, spiralAngle, 1.8, 'tight');
                        } else if (deco.type === 'flower') {
                            decoration = this.createJugendstilBud(point, tangentAngle, deco.size || 10, ornament.color, deco.style);
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
                    const preTop = ornament.mainPoints[ornament.mainPoints.length - 3];

                    const vineEndingAngle = Math.atan2(topPoint.y - preTop.y, topPoint.x - preTop.x);

                    // Create elegant tight spiral at the vine tip
                    const endSpiral = this.createCurlingTendril(
                        topPoint,
                        ornament.direction,
                        35,
                        ornament.color,
                        vineEndingAngle,
                        2.0,
                        'tight'
                    );
                    this.floralGroup.addChild(endSpiral);
                    ornament.decorations[99] = endSpiral;
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
                    if (branch.decorations) {
                        branch.decorations.forEach(decoration => {
                            if (decoration) {
                                this.updateFloralElementColors(decoration, newFloralColor);
                            }
                        });
                    }
                });
            }
            if (ornament.decorations) {
                ornament.decorations.forEach(decoration => {
                    if (decoration) {
                        this.updateFloralElementColors(decoration, newFloralColor);
                    }
                });
            }
            ornament.color = newFloralColor;
        });
    }
}
