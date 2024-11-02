import logger from '../logger.js';
import state from '../state.js';
import imagePanner from '../imagePanner.js';
import pairManager from '../pairManager.js';

class SwipeHandler {
    constructor() {
        // Configuration
        this.config = {
            minSwipeDistance: window.innerWidth * 0.10, // 10% of screen width
            swipeOutDuration: 300, // ms
            maxRotation: 15, // degrees
            verticalThreshold: window.innerHeight * 0.1 // 10% of screen height
        };

        // State
        this.state = {
            isActive: false,
            startX: 0,
            startY: 0,
            startTime: 0,
            currentX: 0,
            currentY: 0
        };

        // Elements
        this.elements = {
            gameContainer: null,
            swipeMessage: null
        };

        // Initialize bound methods
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
    }

    initialize() {
        this.elements.gameContainer = document.querySelector('.game-container');
        this.elements.swipeMessage = document.getElementById('swipe-info-message');

        if (!this.elements.gameContainer) {
            logger.error('Game container not found');
            return;
        }

        // Update thresholds on resize
        window.addEventListener('resize', () => {
            this.config.minSwipeDistance = window.innerWidth * 0.10;
            this.config.verticalThreshold = window.innerHeight * 0.1;
        });

        this.hideSwipeMessage();
    }

    handlePointerDown(event) {
        // Ignore if panning is enabled or we're in landscape mode
        if (imagePanner.isPanningEnabled || state.getUseLandscape() || 
            event.target.closest('.info-button') || 
            event.target.closest('.name-pair__item--draggable')) {
            return;
        }

        logger.debug('Pointer down detected');

        // Store the event target for pointer capture
        this.currentTarget = event.target;
        this.currentTarget.setPointerCapture(event.pointerId);

        this.state = {
            isActive: true,
            startX: event.clientX,
            startY: event.clientY,
            startTime: Date.now(),
            currentX: event.clientX,
            currentY: event.clientY
        };
    }

    handlePointerMove(event) {
        if (!this.state.isActive) return;

        this.state.currentX = event.clientX;
        this.state.currentY = event.clientY;

        const deltaX = this.state.startX - this.state.currentX;
        const deltaY = Math.abs(this.state.startY - this.state.currentY);

        // Cancel if vertical movement is too much
        if (deltaY > this.config.verticalThreshold) {
            this.resetSwipe();
            return;
        }

        if (deltaX > 0) {
            this.updateSwipeAnimation(deltaX);
        }
    }

    handlePointerUp(event) {
        if (!this.state.isActive) return;

        const deltaX = this.state.startX - event.clientX;
        logger.debug(`Swipe completed: deltaX=${deltaX}`);

        if (deltaX > this.config.minSwipeDistance) {
            this.completeSwipe(deltaX);
        } else {
            this.resetSwipe();
        }

        if (this.currentTarget) {
            this.currentTarget.releasePointerCapture(event.pointerId);
            this.currentTarget = null;
        }
        this.state.isActive = false;
    }

    handlePointerCancel(event) {
        if (this.state.isActive) {
            logger.debug('Pointer cancel/leave detected');
            this.resetSwipe();
            if (this.currentTarget) {
                this.currentTarget.releasePointerCapture(event.pointerId);
                this.currentTarget = null;
            }
            this.state.isActive = false;
        }
    }

    updateSwipeAnimation(deltaX) {
        const progress = Math.min(deltaX / this.config.minSwipeDistance, 1);
        const rotation = progress * -this.config.maxRotation;
        const opacity = 1 - progress * 0.3;

        requestAnimationFrame(() => {
            this.elements.gameContainer.style.transform = 
                `rotate(${rotation}deg) translateX(${-deltaX}px)`;
            this.elements.gameContainer.style.opacity = opacity;

            if (progress > 0.2) {
                this.showSwipeMessage();
            } else {
                this.hideSwipeMessage();
            }
        });
    }

    completeSwipe(deltaX) {
        logger.debug('Completing swipe animation');
        this.hideSwipeMessage();
        
        // Set transition properties
        this.elements.gameContainer.style.transition = 
            `transform ${this.config.swipeOutDuration}ms ease-out, opacity ${this.config.swipeOutDuration}ms ease-out`;
        
        // Animate out
        requestAnimationFrame(() => {
            this.elements.gameContainer.style.transform = 
                `rotate(${-this.config.maxRotation}deg) translateX(-100%)`;
            this.elements.gameContainer.style.opacity = '0';
        });

        // Load new pair after animation
        setTimeout(() => {
            this.elements.gameContainer.style.transition = 'none';
            this.elements.gameContainer.style.transform = 'none';
            this.elements.gameContainer.style.opacity = '0';

            pairManager.loadNewPair().then(() => {
                requestAnimationFrame(() => {
                    this.elements.gameContainer.style.transition = 'opacity 300ms ease-in';
                    this.elements.gameContainer.style.opacity = '1';

                    // Clear transition after fade in
                    setTimeout(() => {
                        this.elements.gameContainer.style.transition = '';
                    }, 300);
                });
            });
        }, this.config.swipeOutDuration);
    }

    resetSwipe() {
        logger.debug('Resetting swipe animation');
        this.hideSwipeMessage();
        
        this.elements.gameContainer.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        this.elements.gameContainer.style.transform = 'none';
        this.elements.gameContainer.style.opacity = '1';

        setTimeout(() => {
            this.elements.gameContainer.style.transition = '';
        }, 300);
    }

    showSwipeMessage() {
        this.elements.swipeMessage.style.display = 'block';
        void this.elements.swipeMessage.offsetWidth; // Force reflow
        this.elements.swipeMessage.style.opacity = '1';
    }

    hideSwipeMessage() {
        this.elements.swipeMessage.style.opacity = '0';
        setTimeout(() => {
            this.elements.swipeMessage.style.display = 'none';
        }, 300);
    }

    disable() {
        this.state.isActive = false;
    }

    enable() {
        // Just reset the state; event listeners are managed by eventInitializer
        this.state.isActive = false;
    }
}

const swipeHandler = new SwipeHandler();

export default swipeHandler;
