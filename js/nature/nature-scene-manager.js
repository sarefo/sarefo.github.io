// Main coordinator for nature scene background animation
class NatureSceneManager {
    constructor() {
        this.canvas = null;
        this.animationId = null;
        this.time = 0;
        this.resizeTimeout = null;
        this.contentBounds = [];

        // Cursor tracking for insect swarming
        this.cursorPosition = null;
        this.lastCursorMoveTime = 0;
        this.cursorInactivityTimeout = 5000;

        this.themeHandler = null;
        this.waterAnimator = null;
        this.insectAnimator = null;
        this.seaStarAnimator = null;
        this.floralAnimator = null;
        this.soundGenerator = null;
        this.soundToggle = null;

        this.init();
    }

    async init() {
        this.createCanvas();
        this.setupPaper();
        this.setupCursorTracking();
        this.detectContentBounds();

        this.themeHandler = new ThemeHandler();
        this.waterAnimator = new WaterAnimator(this.themeHandler, this.waterGroup);
        this.insectAnimator = new InsectAnimator(this.themeHandler, this.insectsGroup);
        this.seaStarAnimator = new SeaStarAnimator(this.themeHandler, this.seaStarsGroup);

        // Use SVG-based floral animator if available, otherwise fall back to Paper.js
        if (typeof SvgFloralAnimator !== 'undefined') {
            this.svgFloralAnimator = new SvgFloralAnimator(this.themeHandler);
            this.floralAnimator = null;
        } else {
            this.floralAnimator = new FloralAnimator(this.themeHandler, this.floralGroup, this.contentBounds);
        }

        // Initialize sound system
        if (typeof SoundGenerator !== 'undefined') {
            this.soundGenerator = new SoundGenerator(this.themeHandler);
            this.soundToggle = new SoundToggle(this.soundGenerator);
        }

        this.waterAnimator.createWaterSection(paper.view.size.width, paper.view.size.height);

        // Create floral ornaments using appropriate animator (async for SVG loading)
        if (this.svgFloralAnimator) {
            const svgElement = await this.svgFloralAnimator.createFloralOrnaments(paper.view.size.width, paper.view.size.height);
            if (svgElement) {
                document.body.appendChild(svgElement);
            }
        } else if (this.floralAnimator) {
            this.floralAnimator.createFloralOrnaments(paper.view.size.width, paper.view.size.height);
        }
        this.insectAnimator.createInsects(paper.view.size.width, paper.view.size.height);
        this.seaStarAnimator.createSeaStars(paper.view.size.width, paper.view.size.height);

        this.startAnimation();

        window.addEventListener('resize', () => this.handleResize());

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this.updateTheme();
        });

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

        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
    }

    setupPaper() {
        paper.setup(this.canvas);

        this.waterGroup = new paper.Group();
        this.insectsGroup = new paper.Group();
        this.seaStarsGroup = new paper.Group();
        this.floralGroup = new paper.Group();
    }

    setupCursorTracking() {
        // Track mouse position
        document.addEventListener('mousemove', (e) => this.handleCursorMove(e.clientX, e.clientY));

        // Track touch position (use first touch only)
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.handleCursorMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        // Clear cursor when mouse leaves window
        document.addEventListener('mouseleave', () => this.handleCursorLeave());

        // Clear cursor when touch ends
        document.addEventListener('touchend', () => this.handleCursorLeave());
        document.addEventListener('touchcancel', () => this.handleCursorLeave());
    }

    handleCursorMove(x, y) {
        this.cursorPosition = { x, y };
        this.lastCursorMoveTime = Date.now();
    }

    handleCursorLeave() {
        this.cursorPosition = null;
    }

    getActiveCursorPosition() {
        if (!this.cursorPosition) return null;

        const timeSinceMove = Date.now() - this.lastCursorMoveTime;
        if (timeSinceMove > this.cursorInactivityTimeout) {
            return null;
        }

        return this.cursorPosition;
    }

    detectContentBounds() {
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

    startAnimation() {
        this.animate();
    }

    animate() {
        this.time += 0.01;
        const deltaTime = 1 / 60;

        const activeCursor = this.getActiveCursorPosition();
        this.waterAnimator.animate(this.time);
        this.insectAnimator.animate(paper.view.size.width, paper.view.size.height, deltaTime, activeCursor);
        this.seaStarAnimator.animate(this.time);
        if (this.floralAnimator) {
            this.floralAnimator.animate(deltaTime);
        }

        paper.view.draw();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateTheme() {
        this.waterAnimator.updateTheme();
        this.insectAnimator.updateTheme();
        this.seaStarAnimator.updateTheme();
        if (this.floralAnimator) {
            this.floralAnimator.updateTheme();
        }
        if (this.svgFloralAnimator) {
            this.svgFloralAnimator.updateTheme();
        }
        if (this.soundGenerator) {
            this.soundGenerator.updateTheme();
        }
        paper.view.draw();
    }

    handleResize() {
        if (this.canvas && !this.resizeTimeout) {
            this.canvas.style.opacity = '0';
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }

            if (this.canvas) {
                this.canvas.remove();
            }

            // Remove SVG floral element if it exists
            const existingSvg = document.querySelector('.floral-svg');
            if (existingSvg) {
                existingSvg.remove();
            }

            this.init();

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
        if (this.soundGenerator) {
            this.soundGenerator.destroy();
        }
        if (this.soundToggle) {
            this.soundToggle.destroy();
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.waterInsectsBackground = new NatureSceneManager();
        setTimeout(() => {
            if (window.waterInsectsBackground) {
                window.waterInsectsBackground.updateTheme();
                if (paper && paper.view) {
                    paper.view.draw();
                }
            }
        }, 300);
    }, 100);
});
