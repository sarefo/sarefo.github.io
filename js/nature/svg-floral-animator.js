// SVG-based Jugendstil floral ornaments loaded from external file
class SvgFloralAnimator {
    constructor(themeHandler) {
        this.themeHandler = themeHandler;
        this.svg = null;
        this.paths = [];
        this.animationDuration = 3; // seconds
        this.ornamentPathData = null; // Will be loaded from external SVG
        this.ornamentLoaded = false;
    }

    // Load the ornament path from external SVG file
    async loadOrnamentSVG() {
        if (this.ornamentLoaded) return true;

        try {
            const response = await fetch('images/jugendstil-ornament.svg');
            if (!response.ok) {
                console.error('Failed to load ornament SVG');
                return false;
            }

            const svgText = await response.text();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

            // Extract the path data from the loaded SVG
            const pathElement = svgDoc.querySelector('#main-ornament-path');
            if (pathElement) {
                this.ornamentPathData = pathElement.getAttribute('d');
                this.ornamentLoaded = true;
                return true;
            } else {
                console.error('Could not find #main-ornament-path in SVG file');
                return false;
            }
        } catch (error) {
            console.error('Error loading ornament SVG:', error);
            return false;
        }
    }

    // Get the loaded path data
    getTracedPath() {
        return this.ornamentPathData;
    }

    async createFloralOrnaments(viewWidth, viewHeight) {
        // Ensure ornament SVG is loaded first
        const loaded = await this.loadOrnamentSVG();
        if (!loaded) {
            console.error('Could not load ornament SVG, skipping floral ornaments');
            return null;
        }

        // Create SVG element - only cover upper 65% of viewport (above water)
        const svgHeight = viewHeight * 0.65;
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('class', 'floral-svg');
        this.svg.setAttribute('viewBox', `0 0 ${viewWidth} ${svgHeight}`);
        this.svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 70%;
            pointer-events: none;
            z-index: -1;
            overflow: hidden;
        `;

        const color = this.themeHandler.getFloralColor();

        // Create left ornament using traced path
        this.createTracedOrnament(viewWidth, viewHeight, 'left', color);

        // Create right ornament (mirrored)
        this.createTracedOrnament(viewWidth, viewHeight, 'right', color);

        // Add CSS for animations
        this.addAnimationStyles();

        return this.svg;
    }

    createTracedOrnament(viewWidth, viewHeight, side, color) {
        const isLeft = side === 'left';
        const isMobile = viewWidth < 600;

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `ornament-group ornament-${side}`);

        // Path bounds: x: 100-135, y: 40-165 (height ~125 units, width ~35 units)
        // The ornament grows from root (x=132) toward flowers (x=100), spanning ~32 units horizontally
        const pathHeight = 125;
        const pathWidth = 32; // horizontal reach of the ornament

        let scale, rootY, tiltAngle;

        if (isMobile) {
            // Mobile: small ornaments that frame the "Sarefo" h1
            // Scale so the horizontal reach fits beside the header text
            const targetReach = (viewWidth / 2) - 60;
            scale = Math.max(1.8, Math.min(2.8, targetReach / pathWidth));

            // Position so flower tops start just below language switcher (~50px from top)
            // The path has flowers at y=40 and root at y=165
            // After transform, the flower top will be at: rootY - (165-40)*scale = rootY - 125*scale
            // We want flower top at ~50px, so: rootY = 50 + 125*scale
            const flowerTopY = 50; // just below language switcher
            rootY = flowerTopY + (pathHeight * scale);
            // Tilt scales from 0 at 460px to 8 at 600px
            tiltAngle = Math.max(0, ((viewWidth - 460) / 140) * 8);
        } else {
            // Desktop: scale based on height to reach water level
            const waterLevel = viewHeight * 0.62;
            const targetHeight = waterLevel * 0.85;
            scale = targetHeight / pathHeight;

            // Position flower tops just below language switcher (~50px from top)
            const flowerTopY = 50;
            rootY = flowerTopY + (pathHeight * scale);
            tiltAngle = 8;
        }

        let transform;

        if (isLeft) {
            // Left side: root at left edge, flip so ornament extends right toward center
            // Positive rotation because the flip will mirror it
            transform = `translate(0, ${rootY}) rotate(${tiltAngle}) scale(${-scale}, ${scale}) translate(-132, -165)`;
        } else {
            // Right side: root at right edge, ornament extends left toward center
            transform = `translate(${viewWidth}, ${rootY}) rotate(${-tiltAngle}) scale(${scale}, ${scale}) translate(-132, -165)`;
        }

        group.setAttribute('transform', transform);

        // Create the ornament path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', this.getTracedPath());
        path.setAttribute('fill', color);
        path.setAttribute('fill-opacity', '0.85');
        path.setAttribute('class', 'traced-ornament');

        group.appendChild(path);
        this.svg.appendChild(group);
        this.paths.push(path);
    }

    addAnimationStyles() {
        if (document.getElementById('floral-animation-styles')) return;

        const style = document.createElement('style');
        style.id = 'floral-animation-styles';
        style.textContent = `
            .traced-ornament {
                opacity: 0;
                animation: fadeIn 0.8s ease-out 0.2s forwards;
            }

            @keyframes fadeIn {
                to {
                    opacity: 1;
                }
            }

            .ornament-group {
                transition: fill 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }

    updateTheme() {
        const newColor = this.themeHandler.getFloralColor();
        this.paths.forEach(path => {
            path.setAttribute('fill', newColor);
        });
    }

    // Called by nature-scene-manager
    animate(deltaTime) {
        // CSS-based animations, no per-frame updates needed
    }
}
