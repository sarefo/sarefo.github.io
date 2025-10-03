// Sea star creation and animation
class SeaStarAnimator {
    constructor(themeHandler, seaStarsGroup) {
        this.themeHandler = themeHandler;
        this.seaStarsGroup = seaStarsGroup;
        this.seaStars = [];
    }

    createSeaStars(viewWidth, viewHeight) {
        const waterHeight = viewHeight / 3;
        const waterTop = viewHeight - waterHeight;
        const seaStarCount = 4 + Math.floor(Math.random() * 3);

        const positions = [];
        const minDistance = 50;

        for (let i = 0; i < seaStarCount; i++) {
            let seaStar;
            let attempts = 0;
            let validPosition = false;

            while (!validPosition && attempts < 20) {
                seaStar = this.createSeaStar(viewWidth, waterHeight, waterTop);
                const newPos = seaStar.center;

                validPosition = positions.every(pos => {
                    const dx = newPos.x - pos.x;
                    const dy = newPos.y - pos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    return distance >= minDistance;
                });

                attempts++;
            }

            positions.push(seaStar.center);
            this.seaStars.push(seaStar);
            this.seaStarsGroup.addChild(seaStar.group);
        }
    }

    createSeaStar(viewWidth, waterHeight, waterTop) {
        const seaStarColor = this.themeHandler.getSeaStarColor();
        const group = new paper.Group();

        const x = Math.random() * viewWidth;
        const y = waterTop + (waterHeight * 0.4) + Math.random() * (waterHeight * 0.4);
        const center = new paper.Point(x, y);
        const size = 8 + Math.random() * 6;

        const starfish = new paper.Path();
        const numArms = 5;
        const armLength = size * 2.2;
        const bodyRadius = size * 0.8;
        const pointsPerArm = 8;

        for (let arm = 0; arm < numArms; arm++) {
            const armBaseAngle = (arm * 72 - 90) * Math.PI / 180;

            for (let i = 0; i <= pointsPerArm; i++) {
                const t = i / pointsPerArm;

                const angleSpan = 72 * Math.PI / 180;
                const currentAngle = armBaseAngle - angleSpan/2 + t * angleSpan;

                let radius;
                if (t < 0.25) {
                    radius = bodyRadius * 0.9;
                } else if (t < 0.5) {
                    const growT = (t - 0.25) / 0.25;
                    const growCurve = Math.sin(growT * Math.PI / 2);
                    radius = bodyRadius + (armLength - bodyRadius) * growCurve * 0.7;
                } else if (t < 0.75) {
                    const extendT = (t - 0.5) / 0.25;
                    radius = bodyRadius + (armLength - bodyRadius) * (0.7 + extendT * 0.3);
                } else {
                    const returnT = (t - 0.75) / 0.25;
                    radius = bodyRadius + (armLength - bodyRadius) * (1 - returnT) * 0.7;
                }

                const px = center.x + Math.cos(currentAngle) * radius;
                const py = center.y + Math.sin(currentAngle) * radius;

                if (arm === 0 && i === 0) {
                    starfish.moveTo(px, py);
                } else {
                    starfish.lineTo(px, py);
                }
            }
        }

        starfish.closed = true;
        starfish.smooth({ type: 'continuous', factor: 0.9 });
        starfish.fillColor = seaStarColor;

        group.addChild(starfish);

        return {
            group: group,
            center: center.clone(),
            angle: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.3,
            rotationSpeed: 0.005 + Math.random() * 0.01,
            waterBounds: {
                top: waterTop + waterHeight * 0.3,
                bottom: waterTop + waterHeight * 0.9,
                left: size * 2,
                right: viewWidth - size * 2
            }
        };
    }

    animate(time) {
        this.seaStars.forEach(seaStar => {
            seaStar.angle += seaStar.speed * 0.002;

            const x = seaStar.center.x + Math.sin(time * 0.4) * 25;
            const y = seaStar.center.y + Math.sin(time * 0.25 + seaStar.angle) * 12;

            const constrainedX = Math.max(seaStar.waterBounds.left, Math.min(seaStar.waterBounds.right, x));
            const constrainedY = Math.max(seaStar.waterBounds.top, Math.min(seaStar.waterBounds.bottom, y));

            seaStar.group.position = new paper.Point(constrainedX, constrainedY);
            seaStar.group.rotation += seaStar.rotationSpeed;
        });
    }

    updateTheme() {
        const newSeaStarColor = this.themeHandler.getSeaStarColor();

        this.seaStars.forEach(seaStar => {
            if (seaStar.group.children[0] && seaStar.group.children[0].fillColor) {
                seaStar.group.children[0].fillColor = newSeaStarColor;
            }
        });
    }
}
