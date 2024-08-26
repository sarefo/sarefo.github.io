import imagePanner from './imagePanner.js';
import state from './state.js';
import logger from './logger.js';
import gameLogic from './gameLogic.js';

const swipeHandler = {
    isLoadingNewPair: false,

    swipeOutThreshold: 50, // Increased from 30 to make it less sensitive
    swipeThreshold: 30, // Minimum horizontal distance to trigger a swipe
    isSwipeDetected: false,
    isPanning: false,

    swipeRestraint: 100,
    maxRotation: 15,
    animationDuration: 300,
    swipeDisabled: false,

    startX: 0,
    endX: 0,
    isDragging: false,
    gameContainer: null,
    touchStartX: 0,
    touchStartY: 0,
    touchEndX: 0,
    touchEndY: 0,

    initialize() {
        this.gameContainer = document.querySelector('.game-container');
        if (!this.gameContainer) {
            logger.error('Game container not found');
            return;
        }
        this.addSwipeListeners();
        this.hideSwipeInfoMessage();
    },

    addSwipeListeners() {
        [state.getElement('imageOneContainer'), state.getElement('imageTwoContainer')].forEach((container) => {
            this.addContainerListeners(container);
        });
    },

    addContainerListeners(container) {
        container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        container.addEventListener('mousemove', this.handleDragMove.bind(this));
        container.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: true });
        container.addEventListener('mouseup', this.handleSwipeOrDrag.bind(this));
        container.addEventListener('touchend', this.handleSwipeOrDrag.bind(this));
    },

    setPanningState(state) {
        this.isPanning = state;
    },

    handleMouseDown(e) {
        if (imagePanner.isPanningEnabled && this.isPanning) return; 
        if (this.isPanning || !e.target.closest('.image-container') || e.target.closest('.info-button')) return;
        if (e.target.closest('.name-pair__item--draggable')) return;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = true;
        this.isSwipeDetected = false;
    },

    handleTouchStart(e) {
        if (imagePanner.isPanningEnabled && this.isPanning) return; 
        if (this.isPanning || !e.target.closest('.image-container') || e.target.closest('.info-button')) {
            return;
        }
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.isDragging = true;
        this.isSwipeDetected = false;
    },

    handleSwipeOrDrag(e) {
        if (!this.isDragging || this.swipeDisabled || this.isPanning) {
            this.isDragging = false;
            return;
        }

        const { endX, endY } = this.getEndCoordinates(e);
        const deltaX = this.startX - endX;
        const deltaY = Math.abs(this.startY - endY);

        if (this.isValidSwipe(deltaX, deltaY)) {
            this.performSwipeOutAnimation(deltaX);
        } else {
            this.resetSwipeAnimation();
        }

        this.finishSwipeOrDrag();
    },

    getEndCoordinates(e) {
        if (e.type.includes('touch')) {
            return { endX: e.changedTouches[0].clientX, endY: e.changedTouches[0].clientY };
        }
        return { endX: e.clientX, endY: e.clientY };
    },

    isValidSwipe(deltaX, deltaY) {
        return deltaX > this.swipeOutThreshold && deltaY < this.swipeRestraint;
    },

    finishSwipeOrDrag() {
        this.isDragging = false;
        this.resetGameContainer();
    },

    resetGameContainer() {
        this.gameContainer.style.transform = 'none';
        this.gameContainer.style.opacity = '1';
        document.getElementById('swipe-info-message').style.opacity = '0';
    },

    handleDragMove(e) {
        if (!this.isDragging || this.swipeDisabled || this.isPanning) return;

        const { currentX, currentY } = this.getCurrentCoordinates(e);
        const deltaX = this.startX - currentX;
        const deltaY = Math.abs(this.startY - currentY);

        if (Math.abs(deltaX) > this.swipeThreshold && !this.isSwipeDetected) {
            this.isSwipeDetected = true;
            imagePanner.cancelPanning();
        }

        if (this.isSwipeDetected && this.isValidDragMove(deltaX, deltaY)) {
            this.updateDragAnimation(deltaX);
        } else {
            this.resetSwipeAnimation();
        }
    },

    getCurrentCoordinates(e) {
        if (e.type.includes('touch')) {
            return { currentX: e.touches[0].clientX, currentY: e.touches[0].clientY };
        }
        return { currentX: e.clientX, currentY: e.clientY };
    },

    isValidDragMove(deltaX, deltaY) {
        return deltaX > 0 && deltaY < this.swipeRestraint;
    },

    updateDragAnimation(deltaX) {
        const progress = Math.min(deltaX / this.swipeOutThreshold, 1);
        const rotation = progress * -this.maxRotation;
        const opacity = 1 - progress * 0.3;

        requestAnimationFrame(() => {
            this.gameContainer.style.transform = `rotate(${rotation}deg) translateX(${-deltaX}px)`;
            this.gameContainer.style.opacity = opacity;

            if (progress > 0) {
                this.showSwipeInfoMessage();
            } else {
                this.hideSwipeInfoMessage();
            }
        });
    },

    performSwipeOutAnimation(initialDeltaX) {
        this.hideSwipeInfoMessage();
        this.animateSwipeOut(initialDeltaX);
        this.scheduleNewPairLoad();
    },

    showSwipeInfoMessage() {
        const swipeInfoMessage = document.getElementById('swipe-info-message');
        swipeInfoMessage.style.display = 'block';

        // Force a reflow to ensure the transition is applied
        void swipeInfoMessage.offsetWidth;

        swipeInfoMessage.style.transition = 'opacity 0.3s ease';
        swipeInfoMessage.style.opacity = '1';
    },

    hideSwipeInfoMessage() {
        const swipeInfoMessage = document.getElementById('swipe-info-message');
        swipeInfoMessage.style.transition = 'opacity 0.3s ease';
        swipeInfoMessage.style.opacity = '0';

        // Ensure the message is hidden after the transition
        setTimeout(() => {
            swipeInfoMessage.style.display = 'none';
        }, 300);
    },

    animateSwipeOut(initialDeltaX) {
        const startRotation = (initialDeltaX / this.swipeOutThreshold) * -this.maxRotation;
        this.setInitialSwipeOutStyles(startRotation, initialDeltaX);
        this.setFinalSwipeOutStyles();
    },

    setInitialSwipeOutStyles(startRotation, initialDeltaX) {
        this.gameContainer.style.transition = `transform ${this.animationDuration}ms ease-out, opacity ${this.animationDuration}ms ease-out`;
        this.gameContainer.style.transform = `rotate(${startRotation}deg) translateX(-${initialDeltaX}px)`;
    },

    setFinalSwipeOutStyles() {
        requestAnimationFrame(() => {
            this.gameContainer.style.transform = `rotate(${-this.maxRotation}deg) translateX(-100%)`;
            this.gameContainer.style.opacity = '0';
        });
    },

    scheduleNewPairLoad() {
        setTimeout(() => {
            this.resetContainerForNewPair();
            gameLogic.loadNewPair();
            this.fadeInNewPair();
        }, this.animationDuration);
    },

    resetContainerForNewPair() {
        this.gameContainer.style.transition = 'none';
        this.gameContainer.style.transform = 'none';
        this.gameContainer.style.opacity = '0';
    },


    fadeInNewPair() {
        requestAnimationFrame(() => {
            this.gameContainer.style.transition = 'opacity 300ms ease-in';
            this.gameContainer.style.opacity = '1';
        });

        setTimeout(() => {
            this.gameContainer.style.transition = '';
        }, 300);
    },

    resetSwipeAnimation() {
        this.hideSwipeInfoMessage();

        this.gameContainer.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        this.gameContainer.style.transform = 'none';
        this.gameContainer.style.opacity = '1';

        // Force a reflow to ensure the transition is applied
        void this.gameContainer.offsetWidth;

        setTimeout(() => {
            this.gameContainer.style.transition = '';
        }, 300);
    },

    disable() {
        this.swipeDisabled = true;
    },

    enable() {
        this.swipeDisabled = false;
    }
};

// Bind all methods to ensure correct 'this' context
Object.keys(swipeHandler).forEach(key => {
    if (typeof swipeHandler[key] === 'function') {
        swipeHandler[key] = swipeHandler[key].bind(swipeHandler);
    }
});

export default swipeHandler;
// don't call directly; API is in eventMain
