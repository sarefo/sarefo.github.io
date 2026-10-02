// Main coordinator for nature scene background animation

// The simulation advances in fixed 60 Hz steps (the animators move a fixed
// amount per step), while drawing is capped at ~30 fps to save CPU and battery.
const SIMULATION_STEP_MS = 1000 / 60;
const DRAW_INTERVAL_MS = 1000 / 30;
// Small allowance so a 60 Hz display reliably draws every second frame
const DRAW_INTERVAL_SLACK_MS = 2;

class NatureSceneManager {
    constructor() {
        this.canvas = null;
        this.animationId = null;
        this.time = 0;
        this.resizeTimeout = null;

        // Cursor tracking for insect swarming
        this.cursorPosition = null;
        this.lastCursorMoveTime = 0;
        this.cursorInactivityTimeout = 5000;

        this.themeHandler = null;
        this.waterAnimator = null;
        this.insectAnimator = null;
        this.seaStarAnimator = null;
        this.svgFloralAnimator = null;
        this.soundGenerator = null;
        this.soundGeneratorPromise = null;
        this.soundToggle = null;

        this.init();
    }

    async init() {
        // One-time setup: listeners, theme, sound. Scene (re)building lives in buildScene().
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.setupCursorTracking();

        this.themeHandler = new ThemeHandler();

        // Sound system: the toggle is created now, but the 38 KB generator
        // script is only fetched once the visitor reaches for the toggle
        this.soundToggle = new SoundToggle(() => this.loadSoundGenerator());
        if (new URLSearchParams(window.location.search).has('sound-debug')) {
            this.soundToggle.ensureGenerator();
        }

        await this.buildScene();

        window.addEventListener('resize', () => this.handleResize());

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this.updateTheme();
        });

        this.reducedMotionQuery.addEventListener('change', () => {
            this.stopAnimation();
            this.startAnimation();
        });

        const observer = new MutationObserver(() => {
            this.updateTheme();
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    async buildScene() {
        this.builtWidth = window.innerWidth;
        this.createCanvas();
        this.setupPaper();

        this.waterAnimator = new WaterAnimator(this.themeHandler, this.waterGroup);
        this.insectAnimator = new InsectAnimator(this.themeHandler, this.insectsGroup);
        this.seaStarAnimator = new SeaStarAnimator(this.themeHandler, this.seaStarsGroup);
        this.svgFloralAnimator = new SvgFloralAnimator(this.themeHandler);

        this.waterAnimator.createWaterSection(paper.view.size.width, paper.view.size.height);

        // Floral ornaments are an inline SVG layered over the page (async: fetches the SVG)
        const svgElement = await this.svgFloralAnimator.createFloralOrnaments(paper.view.size.width, paper.view.size.height);
        if (svgElement) {
            document.body.appendChild(svgElement);
        }
        this.insectAnimator.createInsects(paper.view.size.width, paper.view.size.height);
        this.seaStarAnimator.createSeaStars(paper.view.size.width, paper.view.size.height);

        this.startAnimation();
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'water-insects-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        // Size to the large viewport so the mobile URL bar showing and hiding
        // doesn't resize (and stretch) the canvas
        this.canvas.style.height = '100lvh';
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

    startAnimation() {
        // Honor prefers-reduced-motion: render a single static frame instead of looping
        if (this.reducedMotionQuery && this.reducedMotionQuery.matches) {
            this.renderFrame();
            return;
        }
        this.lastFrameTime = null;
        this.simulationBacklog = 0;
        this.timeSinceDraw = 0;
        this.animationId = requestAnimationFrame((now) => this.animate(now));
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Advance the simulation by one fixed 60 Hz step
    step() {
        this.time += 0.01;
        const deltaTime = SIMULATION_STEP_MS / 1000;

        const activeCursor = this.getActiveCursorPosition();
        this.waterAnimator.animate(this.time);
        this.insectAnimator.animate(paper.view.size.width, paper.view.size.height, deltaTime, activeCursor);
        this.seaStarAnimator.animate(this.time);
    }

    renderFrame() {
        this.step();
        paper.view.draw();
    }

    animate(now) {
        // Clamp so a long pause (background tab) doesn't trigger a burst of catch-up steps
        const elapsed = this.lastFrameTime === null ? 0 : Math.min(now - this.lastFrameTime, 100);
        this.lastFrameTime = now;
        this.simulationBacklog += elapsed;
        this.timeSinceDraw += elapsed;

        if (this.timeSinceDraw >= DRAW_INTERVAL_MS - DRAW_INTERVAL_SLACK_MS) {
            this.timeSinceDraw = 0;
            while (this.simulationBacklog >= SIMULATION_STEP_MS) {
                this.step();
                this.simulationBacklog -= SIMULATION_STEP_MS;
            }
            paper.view.draw();
        }

        this.animationId = requestAnimationFrame((t) => this.animate(t));
    }

    loadSoundGenerator() {
        if (!this.soundGeneratorPromise) {
            this.soundGeneratorPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'js/nature/sound-generator.js';
                script.onload = () => {
                    this.soundGenerator = new SoundGenerator(this.themeHandler);
                    resolve(this.soundGenerator);
                };
                script.onerror = () => {
                    // Allow a retry on the next attempt
                    this.soundGeneratorPromise = null;
                    script.remove();
                    reject(new Error('Failed to load sound-generator.js'));
                };
                document.head.appendChild(script);
            });
        }
        return this.soundGeneratorPromise;
    }

    updateTheme() {
        this.waterAnimator.updateTheme();
        this.insectAnimator.updateTheme();
        this.seaStarAnimator.updateTheme();
        if (this.svgFloralAnimator) {
            this.svgFloralAnimator.updateTheme();
        }
        if (this.soundGenerator) {
            this.soundGenerator.updateTheme();
        }
        paper.view.draw();
    }

    handleResize() {
        // On touch devices a height-only resize is the URL bar showing or
        // hiding during scroll; the 100lvh canvas absorbs it, so skip the rebuild
        const widthUnchanged = window.innerWidth === this.builtWidth;
        if (widthUnchanged && window.matchMedia('(pointer: coarse)').matches) {
            return;
        }

        if (this.canvas && !this.resizeTimeout) {
            this.canvas.style.opacity = '0';
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            this.stopAnimation();

            if (this.canvas) {
                this.canvas.remove();
            }

            // Remove SVG floral element if it exists
            const existingSvg = document.querySelector('.floral-svg');
            if (existingSvg) {
                existingSvg.remove();
            }

            // Rebuild only the scene — listeners, observers and the
            // sound system were set up once in init() and must not duplicate
            this.buildScene();

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
