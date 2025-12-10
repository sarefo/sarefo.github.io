// Insect movement settings
const INSECT_MOVE_SPEED = 1;
const INSECT_TARGET_CHANGE_DISTANCE = 50;
const INSECT_RANDOM_TARGET_CHANCE = 0.02;

// Dragonfly creation and animation
class InsectAnimator {
    constructor(themeHandler, insectsGroup) {
        this.themeHandler = themeHandler;
        this.insectsGroup = insectsGroup;
        this.insects = [];
    }

    createInsects(viewWidth, viewHeight) {
        const insectCount = 5 + Math.floor(Math.random() * 3);

        for (let i = 0; i < insectCount; i++) {
            const insect = this.createDragonfly(viewWidth, viewHeight);
            this.insects.push(insect);
            this.insectsGroup.addChild(insect.group);
        }
    }

    createDragonfly(viewWidth, viewHeight) {
        const insectColor = this.themeHandler.getInsectColor();
        const group = new paper.Group();

        const waterHeight = viewHeight / 3;
        const waterTop = viewHeight - waterHeight;

        const x = Math.random() * viewWidth;
        const y = Math.random() * waterTop;
        const center = new paper.Point(x, y);
        const size = 8 + Math.random() * 4;

        // Head
        const head = new paper.Path.Circle({
            center: center.add([0, -size * 0.7]),
            radius: size * 0.15
        });
        head.fillColor = insectColor;

        // Eyes
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

        // Thorax
        const thorax = new paper.Path.Ellipse({
            center: center.add([0, -size * 0.25]),
            size: [size * 0.3, size * 0.4]
        });
        thorax.fillColor = insectColor;

        // Abdomen segments
        const abdomenSegments = [];
        for (let i = 0; i < 4; i++) {
            const segmentY = center.y + (i * size * 0.15) + size * 0.1;
            const segmentWidth = size * (0.25 - i * 0.02);
            const segment = new paper.Path.Ellipse({
                center: new paper.Point(center.x, segmentY),
                size: [segmentWidth, size * 0.12]
            });
            segment.fillColor = insectColor;
            abdomenSegments.push(segment);
        }

        // Wings
        const wingSize = size * 0.6;
        const wingGroups = [];

        const leftUpperAttach = center.add([-size * 0.12, -size * 0.3]);
        const rightUpperAttach = center.add([size * 0.12, -size * 0.3]);
        const leftLowerAttach = center.add([-size * 0.08, -size * 0.15]);
        const rightLowerAttach = center.add([size * 0.08, -size * 0.15]);

        const createWing = (attachPoint, length, isLeft) => {
            const wingGroup = new paper.Group();
            const direction = isLeft ? -1 : 1;

            const wing = new paper.Path.Ellipse({
                center: attachPoint.add([direction * length * 0.5, 0]),
                size: [length, length * 0.35]
            });
            wing.fillColor = insectColor.replace(/[\d\.]+\)$/, '0.15)');
            wing.strokeColor = insectColor.replace(/[\d\.]+\)$/, '0.6)');
            wing.strokeWidth = 0.5;

            const vein = new paper.Path.Line(
                attachPoint,
                attachPoint.add([direction * length, 0])
            );
            vein.strokeColor = insectColor.replace(/[\d\.]+\)$/, '0.4)');
            vein.strokeWidth = 0.3;

            wingGroup.addChild(wing);
            wingGroup.addChild(vein);
            wingGroup.pivot = attachPoint;

            return { group: wingGroup, attachPoint: attachPoint };
        };

        const leftUpperWing = createWing(leftUpperAttach, wingSize * 1.2, true);
        const rightUpperWing = createWing(rightUpperAttach, wingSize * 1.2, false);
        const leftLowerWing = createWing(leftLowerAttach, wingSize * 0.9, true);
        const rightLowerWing = createWing(rightLowerAttach, wingSize * 0.9, false);

        wingGroups.push(leftUpperWing, rightUpperWing, leftLowerWing, rightLowerWing);

        wingGroups.forEach(wg => group.addChild(wg.group));
        abdomenSegments.forEach(segment => group.addChild(segment));
        group.addChild(thorax);
        group.addChild(head);
        group.addChild(leftEye);
        group.addChild(rightEye);

        return {
            group: group,
            center: center.clone(),
            angle: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 0.5,
            radius: 50 + Math.random() * 100,
            wingPhase: Math.random() * Math.PI * 2,
            wingSpeed: 5 + Math.random() * 3,
            wingGroups: wingGroups,
            bodyRotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 0.6
        };
    }


    animate(viewWidth, viewHeight, deltaTime) {
        const waterHeight = viewHeight / 3;
        const waterTop = viewHeight - waterHeight;

        this.insects.forEach(insect => {
            if (!insect.targetX) {
                insect.targetX = Math.random() * viewWidth;
                insect.targetY = Math.random() * waterTop;
            }

            const currentPos = insect.group.position;
            const dx = insect.targetX - currentPos.x;
            const dy = insect.targetY - currentPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < INSECT_TARGET_CHANGE_DISTANCE || Math.random() < INSECT_RANDOM_TARGET_CHANCE) {
                // Bias targets towards upper half - if insect is currently in top half,
                // give it a 70% chance of staying in top half
                const currentlyInTopHalf = currentPos.y < waterTop / 2;
                const stayInTopHalf = currentlyInTopHalf && Math.random() < 0.7;

                if (stayInTopHalf) {
                    // Pick a target in the top half
                    insect.targetY = Math.random() * (waterTop / 2);
                } else {
                    // Pick any target in the full range
                    insect.targetY = Math.random() * waterTop;
                }
                insect.targetX = Math.random() * viewWidth;
            } else if (distance > 1) {
                const newX = currentPos.x + (dx / distance) * INSECT_MOVE_SPEED;
                const newY = currentPos.y + (dy / distance) * INSECT_MOVE_SPEED;
                insect.group.position = new paper.Point(newX, newY);
            }

            insect.group.rotation += insect.rotationSpeed;

            insect.wingPhase += insect.wingSpeed * deltaTime;
            const flapAngle = Math.sin(insect.wingPhase) * 50;

            if (insect.wingGroups[0]) insect.wingGroups[0].group.rotation = flapAngle;
            if (insect.wingGroups[1]) insect.wingGroups[1].group.rotation = flapAngle;
            if (insect.wingGroups[2]) insect.wingGroups[2].group.rotation = flapAngle;
            if (insect.wingGroups[3]) insect.wingGroups[3].group.rotation = flapAngle;
        });
    }

    updateTheme() {
        const newInsectColor = this.themeHandler.getInsectColor();

        this.insects.forEach(insect => {
            if (insect.wingGroups) {
                insect.wingGroups.forEach(wg => {
                    wg.group.children.forEach(child => {
                        if (child.fillColor) {
                            child.fillColor = newInsectColor.replace(/[\d\.]+\)$/, '0.15)');
                        }
                        if (child.strokeColor) {
                            if (child.strokeWidth === 0.3) {
                                child.strokeColor = newInsectColor.replace(/[\d\.]+\)$/, '0.4)');
                            } else {
                                child.strokeColor = newInsectColor.replace(/[\d\.]+\)$/, '0.6)');
                            }
                        }
                    });
                });
            }

            insect.group.children.forEach(child => {
                if (insect.wingGroups && insect.wingGroups.some(wg => wg.group === child)) {
                    return;
                }

                if (child.fillColor) {
                    child.fillColor = newInsectColor;
                }
                if (child.strokeColor) {
                    child.strokeColor = newInsectColor;
                }
            });
        });
    }
}
