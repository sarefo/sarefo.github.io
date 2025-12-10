// Main coordinator for nature scene background animation
class NatureSceneManager {
    constructor() {
        this.canvas = null;
        this.animationId = null;
        this.time = 0;
        this.resizeTimeout = null;
        this.contentBounds = [];

        this.themeHandler = null;
        this.waterAnimator = null;
        this.insectAnimator = null;
        this.seaStarAnimator = null;
        this.floralAnimator = null;

        this.init();
    }

    init() {
        this.createCanvas();
        this.setupPaper();
        this.detectContentBounds();

        this.themeHandler = new ThemeHandler();
        this.waterAnimator = new WaterAnimator(this.themeHandler, this.waterGroup);
        this.insectAnimator = new InsectAnimator(this.themeHandler, this.insectsGroup, this.contentBounds);
        this.seaStarAnimator = new SeaStarAnimator(this.themeHandler, this.seaStarsGroup);

        // Use SVG-based floral animator if available, otherwise fall back to Paper.js
        if (typeof SvgFloralAnimator !== 'undefined') {
            this.svgFloralAnimator = new SvgFloralAnimator(this.themeHandler);
            this.floralAnimator = null;
        } else {
            this.floralAnimator = new FloralAnimator(this.themeHandler, this.floralGroup, this.contentBounds);
        }

        this.waterAnimator.createWaterSection(paper.view.size.width, paper.view.size.height);

        // Create floral ornaments using appropriate animator
        if (this.svgFloralAnimator) {
            const svgElement = this.svgFloralAnimator.createFloralOrnaments(paper.view.size.width, paper.view.size.height);
            document.body.appendChild(svgElement);
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

        this.waterAnimator.animate(this.time);
        this.insectAnimator.animate(paper.view.size.width, paper.view.size.height, deltaTime);
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
