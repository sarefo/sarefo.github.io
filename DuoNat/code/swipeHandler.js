import state from './state.js';
import logger from './logger.js';
import gameLogic from './gameLogic.js';

const swipeHandler = {
    isLoadingNewPair: false,
    swipeOutThreshold: 30,
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

    handleMouseDown(e) {
        if (!e.target.closest('.image-container') || e.target.closest('.info-button')) return;
        if (e.target.closest('.name-pair__item--draggable')) return;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = true;
    },

    handleTouchStart(e) {
        if (!e.target.closest('.image-container') || e.target.closest('.info-button')) {
            return;
        }
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.isDragging = true;
    },

    handleSwipeOrDrag(e) {
        if (!this.isDragging || this.swipeDisabled) return;

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
        if (!this.isDragging || this.swipeDisabled) return;

        const { currentX, currentY } = this.getCurrentCoordinates(e);
        const deltaX = this.startX - currentX;
        const deltaY = Math.abs(this.startY - currentY);

        if (this.isValidDragMove(deltaX, deltaY)) {
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
            this.updateSwipeInfoMessage(progress);
        });
    },

    updateSwipeInfoMessage(progress) {
        document.getElementById('swipe-info-message').style.opacity = progress.toFixed(2);
    },

    performSwipeOutAnimation(initialDeltaX) {
        this.hideSwipeInfoMessage();
        this.animateSwipeOut(initialDeltaX);
        this.scheduleNewPairLoad();
    },

    hideSwipeInfoMessage() {
        document.getElementById('swipe-info-message').style.opacity = 0;
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
            this.loadNewPair();
            this.fadeInNewPair();
        }, this.animationDuration);
    },

    resetContainerForNewPair() {
        this.gameContainer.style.transition = 'none';
        this.gameContainer.style.transform = 'none';
        this.gameContainer.style.opacity = '0';
    },

    loadNewPair() {
        if (!gameLogic.isCurrentPairInCollection()) {
            gameLogic.loadRandomPairFromCurrentCollection();
        } else {
            gameLogic.loadNewRandomPair();
        }
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
        document.getElementById('swipe-info-message').style.opacity = 0;

        this.gameContainer.animate([
            { transform: this.gameContainer.style.transform, opacity: this.gameContainer.style.opacity },
            { transform: 'none', opacity: 1 }
        ], {
            duration: 150,
            easing: 'ease-out'
        });

        this.gameContainer.style.transform = 'none';
        this.gameContainer.style.opacity = '';
    },

    disable() {
        this.swipeDisabled = true;
    },

    enable() {
        this.swipeDisabled = false;
    }
};

export default swipeHandler;
