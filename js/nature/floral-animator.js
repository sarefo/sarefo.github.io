// Feature toggles
const ENABLE_FLORAL_ORNAMENTS = false;
const DEBUG_SPIRALS_ONLY = false;

// Floral ornament (Jugendstil vines) creation and animation
class FloralAnimator {
    constructor(themeHandler, floralGroup) {
        this.themeHandler = themeHandler;
        this.floralGroup = floralGroup;
        this.floralOrnaments = [];
    }

    createFloralOrnaments(viewWidth, viewHeight) {
        if (!ENABLE_FLORAL_ORNAMENTS) return;

        const floralColor = this.themeHandler.getFloralColor();
        const startHeight = viewHeight * 0.42;
        const ornamentHeight = startHeight * 0.7;
        const ornamentWidth = Math.min(viewWidth * 0.28, 350);

        this.createJugendstilVine(
            new paper.Point(-30, startHeight),
            ornamentWidth,
            ornamentHeight,
            floralColor,
            'left'
        );

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

        const mainPoints = [];
        const numMainPoints = 20;

        for (let i = 0; i <= numMainPoints; i++) {
            const t = i / numMainPoints;
            const curveFactor = Math.sin(t * Math.PI * 0.9);
            const x = startPoint.x + direction * width * (curveFactor * 1.1 + t * 0.7);
            const y = startPoint.y - height * t;
            mainPoints.push(new paper.Point(x, y));
        }

        const mainStem = new paper.Path();
        mainStem.strokeColor = color;
        mainStem.strokeWidth = 3.5;
        mainStem.strokeCap = 'round';
        this.floralGroup.addChild(mainStem);

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

            const numBranchPoints = 10;
            for (let i = 0; i <= numBranchPoints; i++) {
                const t = i / numBranchPoints;
                const baseAngle = -Math.PI / 2;
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
                width: config.width,
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
            const flowerCenter = stemEnd.add(new paper.Point(0, size * 0.2));

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
            const bud = new paper.Path.Circle(stemEnd, size * 0.4);
            bud.fillColor = color.replace(/[\d\.]+\)$/, '0.3)');
            bud.strokeColor = color;
            bud.strokeWidth = 1.5;
            group.addChild(bud);
        }

        return group;
    }

    createCurlingTendril(startPoint, direction, length, color, startAngle, strokeWidth = 3.5) {
        const group = new paper.Group();

        const tendril = new paper.Path();
        tendril.strokeColor = color;
        tendril.strokeWidth = strokeWidth;
        tendril.strokeCap = 'round';

        const numPoints = 15;
        let currentAngle = startAngle;
        let currentPoint = startPoint.clone();

        tendril.add(currentPoint);

        for (let i = 1; i <= numPoints; i++) {
            const t = i / numPoints;
            const angleChange = -direction * 0.2 * (1 + t * 1.5);
            currentAngle += angleChange;

            const stepSize = length * 0.15 * (1 - t * 0.5);

            currentPoint = currentPoint.add(new paper.Point(
                Math.cos(currentAngle) * stepSize,
                Math.sin(currentAngle) * stepSize
            ));

            tendril.add(currentPoint);
        }

        tendril.smooth({ type: 'catmull-rom', factor: 0.7 });
        group.addChild(tendril);

        const endPoint = tendril.lastSegment.point;
        const bulb = new paper.Path.Circle(endPoint, 3.5);
        bulb.fillColor = color;
        group.addChild(bulb);

        return group;
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

                        if (branchProgress > 0.7 && !branch.decorations[0]) {
                            const tipPoint = branch.points[branch.points.length - 1];
                            const preTip = branch.points[Math.max(0, branch.points.length - 2)];
                            const angle = Math.atan2(tipPoint.y - preTip.y, tipPoint.x - preTip.x);

                            let decoration;
                            if (branchIdx % 2 === 0) {
                                decoration = this.createJugendstilLeaf(tipPoint, angle - Math.PI / 2, 10, ornament.color, 'simple');
                            } else {
                                decoration = this.createCurlingTendril(tipPoint, ornament.direction, 15, ornament.color, angle, branch.width);
                            }
                            this.floralGroup.addChild(decoration);
                            branch.decorations[0] = decoration;
                        }
                    }
                });

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
