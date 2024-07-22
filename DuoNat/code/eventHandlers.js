// Event handlers

import api from './api.js';
import dialogManager from './dialogManager.js';
import game from './game.js';
import logger from './logger.js';
import ui from './ui.js';
import utils from './utils.js';
import dragAndDrop from './dragAndDrop.js';
import { elements, gameState } from './state.js';

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

    initialize() {
        this.initializeSwipeFunctionality();
        this.initializeFunctionsMenuListeners();
        this.initializeAllEventListeners();
    },

    initializeSwipeFunctionality() {
        this.gameContainer = document.querySelector('.game-container');
        if (!this.gameContainer) {
            logger.error('Game container not found');
            return;
        }

        const namePairElement = document.querySelector('.name-pair');

        // Add event listeners only to image containers
        [elements.imageOneContainer, elements.imageTwoContainer].forEach(container => {
            container.addEventListener('mousedown', this.handleMouseDown.bind(this));
            container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            container.addEventListener('mousemove', this.handleDragMove.bind(this));
            container.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: true });
            container.addEventListener('mouseup', this.handleSwipeOrDrag.bind(this));
            container.addEventListener('touchend', this.handleSwipeOrDrag.bind(this));
        });
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
        this.safeAddEventListener('share-button', 'click', this.shareCurrentPair);
        this.safeAddEventListener('graph-button', 'click', game.showTaxaRelationship);
        this.safeAddEventListener('select-pair-button', 'click', ui.showTaxonPairList);
        this.safeAddEventListener('enter-pair-button', 'click', () => dialogManager.openDialog('enter-pair-dialog'));
        this.safeAddEventListener('random-pair-button', 'click', () => game.setupGame(true));
        this.safeAddEventListener('like-button', 'click', this.likePair);
        this.safeAddEventListener('trash-button', 'click', this.trashPair);
        this.safeAddEventListener('surprise-button', 'click', utils.surprise);
    },

    initializeAllEventListeners() {
        dragAndDrop.initialize();

        // button listeners
        //document.getElementById('share-button').addEventListener('click', this.shareCurrentPair);
        //document.getElementById('phylogeny-button').addEventListener('click', game.showTaxaRelationship);
        document.getElementById('random-pair-button').addEventListener('click', async () => { await game.setupGame(true); });
        document.getElementById('select-pair-button').addEventListener('click', () => ui.showTaxonPairList());

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
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

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
        if (!e.target.closest('.image-container') || e.target.closest('.info-button')) return;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.isDragging = true;
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

            setTimeout(() => {
                document.querySelector('.game-container').classList.remove('swiping-left', 'swipe-out-left');
                ui.resetGameContainerStyle();
                game.setupGame(true);
            }, 500); // Match this with the animation duration
        } else {
            // Reset if not swiped far enough or swiped vertically
            ui.resetGameContainerStyle();
        }

        this.isDragging = false;
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

    handleKeyboardShortcuts(event) {
        const infoDialog = document.getElementById('info-dialog');

        if (infoDialog.open) {
            // Info dialog is open, don't process main view shortcuts
            return;
        }

        const activeDialog = dialogManager.activeDialog;
        if (activeDialog) {
            // Another dialog is active, don't process main view shortcuts
            return;
        }

        const isDialogOpen = document.getElementById('enter-pair-dialog').open;

        if (!isDialogOpen) {
            if (event.key === 'r' || event.key === 'R' || event.key === 'ArrowLeft') {
                document.getElementById('random-pair-button').click();
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
            if (event.key === 'm' || event.key === 'M' || event.key === 'f' || event.key === 'F') {
                document.getElementById('functions-toggle').click();
            }
            if (event.key === 'p' || event.key === 'P' || event.key === 'f' || event.key === 'F') {
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
        }
    },

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
