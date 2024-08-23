import logger from './logger.js';
import swipeHandler from './swipeHandler.js';

const imagePanner = {
    isPanningEnabled: false, // TODO for debugging

    isPanning: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    panStartTime: 0,
    currentImage: null,
    longPressTimer: null,
    longPressDuration: 300, // milliseconds
    initialTransform: null,
    panningDelay: 150, // Delay before allowing panning to start
    panningDelayTimer: null,

    initialize() {
        if (!imagePanner.isPanningEnabled) return;
        const imageContainers = document.querySelectorAll('.image-container');
        imageContainers.forEach(container => {
            container.addEventListener('mousedown', this.handleMouseDown.bind(this));
            container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            container.addEventListener('mousemove', this.pan.bind(this));
            container.addEventListener('touchmove', this.pan.bind(this), { passive: false });
            container.addEventListener('mouseup', this.endPan.bind(this));
            container.addEventListener('touchend', this.endPan.bind(this));
            container.addEventListener('mouseleave', this.endPan.bind(this));
        });
    },

    handleMouseDown(e) {
        if (!imagePanner.isPanningEnabled) return;
        if (e.button !== 0) return; // Only left mouse button
        this.startLongPress(e);
    },

    handleTouchStart(e) {
        if (!imagePanner.isPanningEnabled) return;
        if (e.touches.length > 1) return; // Ignore multi-touch
        this.startLongPress(e);
    },

    startLongPress(e) {
        if (e.target.closest('.info-button')) return;

        const touch = e.type.includes('touch') ? e.touches[0] : e;
        this.startX = this.lastX = touch.clientX;
        this.startY = this.lastY = touch.clientY;

        clearTimeout(this.longPressTimer);
        clearTimeout(this.panningDelayTimer);

        this.panningDelayTimer = setTimeout(() => {
            this.longPressTimer = setTimeout(() => {
                this.startPan(e);
            }, this.longPressDuration);
        }, this.panningDelay);

        // Prevent default to avoid text selection during long press
        e.preventDefault();
    },

    isPanningActive() {
        return this.isPanning;
    },

    startPan(e) {
        if (!imagePanner.isPanningEnabled) return;
        if (swipeHandler.isSwipeDetected) return;

        const imageContainer = e.target.closest('.image-container');
        if (!imageContainer) return;

        this.currentImage = imageContainer.querySelector('img');
        this.isPanning = true;
        this.panStartTime = Date.now();

        // Notify swipeHandler that panning has started
        swipeHandler.setPanningState(true);

        // Store the initial transform
        this.initialTransform = window.getComputedStyle(this.currentImage).transform;
        if (this.initialTransform === 'none') {
            this.initialTransform = 'matrix(1, 0, 0, 1, 0, 0)';
        }

        // Calculate the limits for panning
        const containerRect = imageContainer.getBoundingClientRect();
        const imageRect = this.currentImage.getBoundingClientRect();
        this.maxPanX = Math.max(0, (imageRect.width - containerRect.width) / 2);
        this.maxPanY = Math.max(0, (imageRect.height - containerRect.height) / 2);

        logger.debug('Panning started');
    },

    pan(e) {
        if (!imagePanner.isPanningEnabled) return;
        if (!this.isPanning) return;
        e.preventDefault();

        const touch = e.type.includes('touch') ? e.touches[0] : e;
        const deltaX = touch.clientX - this.lastX;
        const deltaY = touch.clientY - this.lastY;

        const currentTransform = new WebKitCSSMatrix(window.getComputedStyle(this.currentImage).transform);
        let newX = currentTransform.e + deltaX;
        let newY = currentTransform.f + deltaY;

        // Limit panning to reveal only cropped parts
        newX = Math.max(-this.maxPanX, Math.min(this.maxPanX, newX));
        newY = Math.max(-this.maxPanY, Math.min(this.maxPanY, newY));

        const initialMatrix = new WebKitCSSMatrix(this.initialTransform);
        this.currentImage.style.transform = `matrix(${initialMatrix.a}, ${initialMatrix.b}, ${initialMatrix.c}, ${initialMatrix.d}, ${newX}, ${newY})`;

        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
    },

    endPan() {
        clearTimeout(this.longPressTimer);
        clearTimeout(this.panningDelayTimer);  // Make sure to clear this timer as well
        this.isPanning = false;

        if (this.currentImage) {
            // Store the current image in a local variable
            const image = this.currentImage;
            
            // Apply the transition
            image.style.transition = 'transform 0.3s ease-out';
            image.style.transform = this.initialTransform || '';

            // Remove the transition after it completes
            setTimeout(() => {
                if (image) {  // Check if the image still exists
                    image.style.transition = '';
                }
            }, 300);
        }

        // Reset properties
        this.currentImage = null;
        this.initialTransform = null;

        // Notify swipeHandler that panning has ended
        if (typeof swipeHandler !== 'undefined' && swipeHandler.setPanningState) {
            swipeHandler.setPanningState(false);
        }
    },

    cancelPanning() {
        clearTimeout(this.longPressTimer);
        clearTimeout(this.panningDelayTimer);
        if (this.isPanning) {
            this.endPan();
            if (this.currentImage) {
                this.currentImage.style.transition = 'transform 0.3s ease-out';
                this.currentImage.style.transform = this.initialTransform;
            }
        }
    },

    isPanningGesture() {
        return this.isPanning;
    }
};

export default imagePanner;
// don't call directly; API is in eventMain
