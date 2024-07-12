// Event handlers

import api from './api.js';
import game from './game.js';
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
        this.initializeAllEventListeners();
    },

    initializeSwipeFunctionality() {
        this.gameContainer = document.querySelector('.game-container');
        if (!this.gameContainer) {
            console.error('Game container not found');
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

    initializeAllEventListeners() {
        dragAndDrop.initialize();
        
        // button listeners
        document.getElementById('share-button').addEventListener('click', this.shareCurrentPair);
        document.getElementById('random-pair-button').addEventListener('click', async () => { await game.setupGame(true); });
        document.getElementById('select-pair-button').addEventListener('click', this.showTaxonPairList);
    
        // touch events
        [elements.imageOneContainer, elements.imageTwoContainer].forEach(container => {
            container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            container.addEventListener('touchend', this.handleImageInteraction.bind(this));
            container.addEventListener('mousedown', this.handleMouseDown.bind(this));
            container.addEventListener('mouseup', this.handleImageInteraction.bind(this));
        });

        // dialog events
        document.getElementById('enter-pair-button').addEventListener('click', () => {
            ui.clearDialogInputs();
            document.getElementById('enter-pair-dialog').showModal();
        });
        document.getElementById('close-dialog').addEventListener('click', () => {
            document.getElementById('enter-pair-dialog').close();
        });
        document.querySelector('#enter-pair-dialog form').addEventListener('submit', this.handleNewPairSubmit);
        document.getElementById('surprise-button').addEventListener('click', () => {
            ui.clearDialogInputs();
            utils.surprise();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // Help button functionality
        document.getElementById('help-button').addEventListener('click', () => {
            document.getElementById('help-dialog').showModal();
        });
        document.getElementById('discord-help-dialog').addEventListener('click', () => {
            window.open('https://discord.gg/DcWrhYHmeM', '_blank');
        });
        document.getElementById('close-help-dialog').addEventListener('click', () => {
            document.getElementById('help-dialog').close();
        });

        // Prevent scrolling in the name-pair area
        elements.namePair.addEventListener('touchmove', (event) => { event.preventDefault(); }, { passive: false });
        elements.namePair.addEventListener('wheel', (event) => { event.preventDefault(); }, { passive: false });

        // Scroll to top when a button is clicked
        elements.buttons.forEach(button => { button.addEventListener('click', () => { ui.scrollToTop(); }); });
    },

    handleMouseDown(e) {
        if (!e.target.closest('.image-container')) return;
        if (e.target.closest('.draggable')) return; // Ignore draggable elements
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isDragging = true;
    },

    handleTouchStart(e) {
        if (!e.target.closest('.image-container')) return;
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
        const diffX = Math.abs(this.touchStartX - (event.clientX || event.changedTouches[0].clientX));
        const diffY = Math.abs(this.touchStartY - (event.clientY || event.changedTouches[0].clientY));
        // Add any specific image interaction logic here
    },

    async handleNewPairSubmit(event) {
        event.preventDefault();
        const taxon1 = document.getElementById('taxon1').value;
        const taxon2 = document.getElementById('taxon2').value;
        const dialogMessage = document.getElementById('dialog-message');
        
        dialogMessage.textContent = 'Validating taxa...';
        
        const [validatedTaxon1, validatedTaxon2] = await Promise.all([
            api.validateTaxon(taxon1),
            api.validateTaxon(taxon2)
        ]);
        
        if (validatedTaxon1 && validatedTaxon2) {
            const newPair = {
                taxon1: validatedTaxon1.name,
                taxon2: validatedTaxon2.name
            };
        
            try {
                const response = await fetch('./data/taxonPairs.json');
                const taxonPairs = await response.json();
                taxonPairs.push(newPair);
        
                // Set the new pair as the next pair to be used
                game.nextSelectedPair = newPair;
                
                // Close the dialog
                document.getElementById('enter-pair-dialog').close();
                
                // Set up the game with the new pair
                game.setupGame(true);
            } catch (error) {
                console.error('Error updating taxonPairs.json:', error);
                dialogMessage.textContent = 'Error saving new pair. Please try again.';
            }
        } else {
            dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
        }
    },

    showTaxonPairList() {
        api.fetchTaxonPairs().then(taxonPairs => {
            ui.showTaxonPairList(taxonPairs, (selectedPair) => {
                game.nextSelectedPair = selectedPair;
                game.setupGame(true);
            });
        });
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
            console.error('Failed to copy: ', err);
            alert('Failed to copy link. Please try again.');
        });
    },

    handleKeyboardShortcuts(event) {
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
                document.getElementById('enter-pair-button').click();
                setTimeout(() => {
                    document.getElementById('taxon1').value = '';
                    document.getElementById('taxon1').focus();
                }, 0);
            }
            if (event.key === 'p' || event.key === 'P' || event.key === 'f' || event.key === 'F') {
                document.getElementById('surprise-button').click();
            }
        }
    }
};

export default eventHandlers;
