// Event handlers

import api from './api.js';
import dialogManager from './dialogManager.js';
import dragAndDrop from './dragAndDrop.js';
import game from './game.js';
import logger from './logger.js';
import { elements, gameState } from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const eventHandlers = {

    // global variables for swiping left
    startX: 0,
    endX: 0,
    isDragging: false,
    gameContainer: null,
    touchStartX: 0,
    touchStartY: 0,
    touchEndX: 0,
    touchEndY: 0,

    swipeThreshold: 50, // minimum distance to trigger a swipe
    swipeRestraint: 100, // maximum vertical distance allowed during a swipe

    isLoadingNewPair: false,

    initialize() {
        this.initializeSwipeFunctionality();
        this.initializeFunctionsMenuListeners();
        this.initializeAllEventListeners();

        this.debouncedKeyboardHandler = utils.debounce(this._handleKeyboardShortcuts.bind(this), 300);

        // Ensure keyboard shortcuts are properly set up
        //document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        //document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        document.removeEventListener('keydown', this.debouncedKeyboardHandler);
        document.addEventListener('keydown', this.debouncedKeyboardHandler);
    },

initializeSwipeFunctionality() {
    this.gameContainer = document.querySelector('.game-container');
    if (!this.gameContainer) {
        logger.error('Game container not found');
        return;
    }

  //  logger.debug("Setting up event listeners for swipe functionality");

    [elements.imageOneContainer, elements.imageTwoContainer].forEach((container, index) => {
  //      logger.debug(`Setting up listeners for container ${index + 1}`);
        
        container.addEventListener('mousedown', (e) => {
  //          logger.debug(`Mousedown on container ${index + 1}`);
            this.handleMouseDown(e);
        });
        container.addEventListener('touchstart', (e) => {
 //           logger.debug(`Touchstart on container ${index + 1}`);
            this.handleTouchStart(e);
        }, { passive: true });
        container.addEventListener('mousemove', (e) => {
 //           logger.debug(`Mousemove on container ${index + 1}`);
            this.handleDragMove(e);
        });
        container.addEventListener('touchmove', (e) => {
  //          logger.debug(`Touchmove on container ${index + 1}`);
            this.handleDragMove(e);
        }, { passive: true });
        container.addEventListener('mouseup', (e) => {
    //        logger.debug(`Mouseup on container ${index + 1}`);
            this.handleSwipeOrDrag(e);
        });
        container.addEventListener('touchend', (e) => {
     //       logger.debug(`Touchend on container ${index + 1}`);
            this.handleSwipeOrDrag(e);
        });
    });

    logger.debug("Swipe functionality initialized");
},

    safeAddEventListener(id, eventType, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            logger.warn(`Element with id '${id}' not found. Skipping event listener.`);
        }
    },

    initializeFunctionsMenuListeners: function() {
        this.safeAddEventListener('share-button', 'click', () => {
            this.shareCurrentPair();
            ui.closeFunctionsMenu(); // Close menu after action
        });
        this.safeAddEventListener('phylogeny-button', 'click', () => {
            game.showTaxaRelationship();
            ui.closeFunctionsMenu(); // Close menu after action
        });
        this.safeAddEventListener('select-pair-button', 'click', () => {
            ui.showTaxonPairList();
            ui.closeFunctionsMenu(); // Close menu after action
        });
        this.safeAddEventListener('enter-pair-button', 'click', () => {
            dialogManager.openDialog('enter-pair-dialog');
            ui.closeFunctionsMenu(); // Close menu after action
        });
/*        this.safeAddEventListener('info-button-1', 'click', () => {
            this.openDialog('info-dialog');
        });
        this.safeAddEventListener('info-button-1', 'click', () => {
            this.openDialog('info-dialog');
        }); */
        this.safeAddEventListener('random-pair-button', 'click', () => {
            game.loadNewRandomPair();
            ui.closeFunctionsMenu(); // Close menu after action
/*            game.setupGame(true);
            ui.closeFunctionsMenu(); // Close menu after action*/
        });
        this.safeAddEventListener('like-button', 'click', () => {
            this.likePair();
            ui.closeFunctionsMenu(); // Close menu after action
        });
        this.safeAddEventListener('trash-button', 'click', () => {
            this.trashPair();
            ui.closeFunctionsMenu(); // Close menu after action
        });
        this.safeAddEventListener('surprise-button', 'click', () => {
            utils.surprise();
            ui.closeFunctionsMenu(); // Close menu after action
        });
    },

    initializeAllEventListeners() {
        dragAndDrop.initialize();

        // button listeners
        //document.getElementById('share-button').addEventListener('click', this.shareCurrentPair);
        //document.getElementById('phylogeny-button').addEventListener('click', game.showTaxaRelationship);
        /*document.getElementById('random-pair-button').addEventListener('click', async () => { await game.setupGame(true); });
        document.getElementById('select-pair-button').addEventListener('click', () => ui.showTaxonPairList());
*/
        // touch events
        [elements.imageOneContainer, elements.imageTwoContainer].forEach(container => {
            container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            container.addEventListener('touchend', this.handleImageInteraction.bind(this));
            container.addEventListener('mousedown', this.handleMouseDown.bind(this));
            container.addEventListener('mouseup', this.handleImageInteraction.bind(this));
        });

        // dialog events
        document.getElementById('surprise-button').addEventListener('click', () => {
            utils.surprise();
        });

        // Keyboard shortcuts
//        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        document.addEventListener('keydown', this.debouncedKeyboardHandler);

        // Help button functionality
        document.getElementById('help-button').addEventListener('click', () => {
            dialogManager.openDialog('help-dialog');
            //           document.getElementById('help-dialog').showModal();
        });
        document.getElementById('start-tutorial-button').addEventListener('click', () => {
            ui.showTutorial();
        });
        document.getElementById('discord-help-dialog').addEventListener('click', () => {
            window.open('https://discord.gg/DcWrhYHmeM', '_blank');
        });

        // Prevent scrolling in the name-pair area
//        elements.namePair.addEventListener('touchmove', (event) => { event.preventDefault(); }, { passive: false });
//        elements.namePair.addEventListener('wheel', (event) => { event.preventDefault(); }, { passive: false });

        // Scroll to top when a button is clicked
//        elements.buttons.forEach(button => { button.addEventListener('click', () => { ui.scrollToTop(); }); });
    },

    handleMouseDown(e) {
        if (!e.target.closest('.image-container') || e.target.closest('.info-button')) return;
        if (e.target.closest('.draggable')) return; // Ignore draggable elements
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = true;
    },

handleTouchStart(e) {
   // logger.debug(`handleTouchStart called. Target: ${e.target.tagName}, closest .image-container: ${!!e.target.closest('.image-container')}, closest .info-button: ${!!e.target.closest('.info-button')}`);
    
    if (!e.target.closest('.image-container') || e.target.closest('.info-button')) {
    //    logger.debug("Returning early from handleTouchStart");
        return;
    }
    
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.isDragging = true;
    //logger.debug("Touch start, dragging started. isDragging set to true.");
},

    handleSwipeOrDrag(e) {
        if (!this.isDragging) return;

        let endX, endY;
        if (e.type.includes('touch')) {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
        } else {
            endX = e.clientX;
            endY = e.clientY;
        }

        const deltaX = this.startX - endX;
        const deltaY = Math.abs(this.startY - endY);

        if (deltaX > this.swipeThreshold && deltaY < this.swipeRestraint) {
            // Swipe left detected
            document.querySelector('.game-container').classList.add('swipe-out-left');

            // Hide the swipe info message
            const swipeInfoMessage = document.getElementById('swipe-info-message');
            swipeInfoMessage.style.opacity = 0;
            swipeInfoMessage.style.transform = 'translateY(0)';

            setTimeout(() => {
                document.querySelector('.game-container').classList.remove('swiping-left', 'swipe-out-left');
                ui.resetGameContainerStyle();
                game.loadNewRandomPair();
            }, 500); // Match this with the animation duration
        } else {
            // Reset if not swiped far enough or swiped vertically
            ui.resetGameContainerStyle();

            // Hide the swipe info message
            const swipeInfoMessage = document.getElementById('swipe-info-message');
            swipeInfoMessage.style.opacity = 0;
            swipeInfoMessage.style.transform = 'translateY(0)';
        }

        this.isDragging = false;
    },

    handleDragMove(e) {
        logger.debug(`Drag move called, isDragging: ${this.isDragging}`);
        if (!this.isDragging) {
        logger.debug("not dragging in hDM");
            return;}
        let currentX, currentY;
        if (e.type.includes('touch')) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        const deltaX = this.startX - currentX;
        const deltaY = Math.abs(this.startY - currentY);
logger.debug(`Drag move detected: deltaX = ${deltaX}, deltaY = ${deltaY}`);
        if (deltaX > 0 && deltaY < this.swipeRestraint) {
            const progress = Math.min(deltaX / 100, 1);
            const rotation = progress * -5;
            const opacity = 1 - progress * 0.5;

            this.gameContainer.style.transform = `rotate(${rotation}deg) translateX(${-deltaX}px)`;
            this.gameContainer.style.opacity = opacity;

            // Show the swipe info message
            logger.debug("show swipe info message");
            const swipeInfoMessage = document.getElementById('swipe-info-message');
            swipeInfoMessage.style.opacity = Math.min(progress * 2, 1); // Fade in as user swipes
            swipeInfoMessage.style.transform = `translateY(${-20 * progress}px)`; // Slide up slightly
        }
    },

    handleDragMove(e) {
        if (!this.isDragging) return;

        let currentX, currentY;
        if (e.type.includes('touch')) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        const deltaX = this.startX - currentX;
        const deltaY = Math.abs(this.startY - currentY);

        if (deltaX > 0 && deltaY < this.swipeRestraint) {
            const progress = Math.min(deltaX / 100, 1);
            const rotation = progress * -5;
            const opacity = 1 - progress * 0.5;

            this.gameContainer.style.transform = `rotate(${rotation}deg) translateX(${-deltaX}px)`;
            this.gameContainer.style.opacity = opacity;
        }
    },

    handleImageInteraction(event) {
        if (!event) return;  // handle cases where event is undefined
        // Add any specific image interaction logic here
    },

    showTaxonPairList() {
        api.fetchTaxonPairs().then(taxonPairs => {
            ui.showTaxonPairList(taxonPairs, (selectedPair) => {
                game.nextSelectedPair = selectedPair;
                game.setupGame(true);
            });
        });
    },

 /*  handleKeyboardShortcuts: function(event) {
        if (this.debouncedKeyboardHandler) {
            this.debouncedKeyboardHandler(event);
        } else {
            this.debouncedKeyboardHandler = utils.debounce(this._handleKeyboardShortcuts.bind(this), 300);
            this.debouncedKeyboardHandler(event);
        }
    },
*/
    _handleKeyboardShortcuts(event) {
//        logger.debug("Keyboard event:", event.key);
        if (dialogManager.isAnyDialogOpen() || 
            document.getElementById('info-dialog').open || 
            dialogManager.activeDialog || 
            document.getElementById('enter-pair-dialog').open) {
            logger.debug("Dialog is open, ignoring keyboard shortcut");
            return;
        }

        switch (event.key.toLowerCase()) {
            case 'r':
            case 'arrowleft':
                if (!this.isLoadingNewPair) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.isLoadingNewPair = true;
                    game.loadNewRandomPair().finally(() => {
                        this.isLoadingNewPair = false;
                    });
                }
                break;
            case 's':
                event.preventDefault();
                ui.showTaxonPairList();
                break;
            case 'h':
                event.preventDefault();
                document.getElementById('help-button').click();
                break;
            case 'e':
                event.preventDefault();
                dialogManager.openDialog('enter-pair-dialog');
                break;
            case 'm':
                event.preventDefault();
//                logger.debug("'M' key pressed, attempting to toggle menu");
                ui.toggleFunctionsMenu();
                break;
            case 'p':
            case 'f':
                event.preventDefault();
                document.getElementById('surprise-button').click();
                break;
            case 'g':
                event.preventDefault();
                game.showTaxaRelationship();
                break;
            case 'i':
                event.preventDefault();
                document.getElementById('info-button-1').click();
                break;
            case 'o':
                event.preventDefault();
                document.getElementById('info-button-2').click();
                break;
        }
    },
/*    _handleKeyboardShortcuts: function(event) {
        logger.debug("Keyboard event:", event.key);

        if (dialogManager.isAnyDialogOpen() || 
            document.getElementById('info-dialog').open || 
            dialogManager.activeDialog || 
            document.getElementById('enter-pair-dialog').open ||
            this.isLoadingNewPair) {
                logger.debug("Dialog is open or already loading, ignoring keyboard shortcut");
                return;
            }

            if (event.key === 'r' || event.key === 'R' || event.key === 'ArrowLeft') {
//                event.preventDefault();
                game.loadNewRandomPair();
                return;
            }
            if (event.key === 's' || event.key === 'S') {
                document.getElementById('select-pair-button').click();
            }
            if (event.key === 'h' || event.key === 'H') {
                document.getElementById('help-button').click();
            }
            if (event.key === 'e' || event.key === 'E') {
                dialogManager.openDialog('enter-pair-dialog');
            }
            if (event.key === 'm' || event.key === 'M') {
                logger.debug("'M' key pressed, attempting to toggle menu");
        //        event.preventDefault(); // Prevent default action
                ui.toggleFunctionsMenu();
                return; // Exit the function after toggling
            }
            if (event.key === 'p' || event.key === 'f') {
                document.getElementById('surprise-button').click();
            }
            if (event.key === 'g' || event.key === 'G') {
                document.getElementById('phylogeny-button').click();
            }
            if (event.key === 'i' || event.key === 'I') {
                document.getElementById('info-button-1').click();
            }
            if (event.key === 'o' || event.key === 'O') {
                document.getElementById('info-button-2').click();
            }

    },*/

    // move to other module, utils?
    shareCurrentPair() {
        let currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('taxon1');
        currentUrl.searchParams.delete('taxon2');
        currentUrl.searchParams.set('taxon1', gameState.taxonImageOne);
        currentUrl.searchParams.set('taxon2', gameState.taxonImageTwo);
        let shareUrl = currentUrl.toString();

        navigator.clipboard.writeText(shareUrl).then(() => { }).catch(err => {
            logger.error('Failed to copy: ', err);
            alert('Failed to copy link. Please try again.');
        });
    },

    likePair: function() {
        // Implement liking functionality
        logger.debug('Like pair clicked');
        // Add your implementation here
    },

    trashPair: function() {
        // Implement trashing functionality
        logger.debug('Trash pair clicked');
        // Add your implementation here
    },

};

export default eventHandlers;
