// Event handlers

import api from './api.js';
import dialogManager from './dialogManager.js';
import dragAndDrop from './dragAndDrop.js';
import game from './game.js';
import logger from './logger.js';
import { elements, gameState } from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName);
}

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
        this.initializeMainMenuListeners();
        this.initializeAllEventListeners();

        this.debouncedKeyboardHandler = utils.debounce(this._handleKeyboardShortcuts.bind(this), 300);

        // Ensure keyboard shortcuts are properly set up
        document.removeEventListener('keydown', this.debouncedKeyboardHandler);
        document.addEventListener('keydown', this.debouncedKeyboardHandler);

        // Select pair dialog close button
        const selectPairDialog = document.getElementById('select-pair-dialog');
        const selectPairCloseButton = selectPairDialog.querySelector('.dialog-close-button');
        selectPairCloseButton.addEventListener('click', () => {
            dialogManager.closeDialog('select-pair-dialog');
        });

        // Tag cloud dialog close button
        const tagCloudDialog = document.getElementById('tag-cloud-dialog');
        const tagCloudCloseButton = tagCloudDialog.querySelector('.dialog-close-button');
        tagCloudCloseButton.addEventListener('click', () => {
            dialogManager.closeDialog('tag-cloud-dialog');
        });

    },

initializeSwipeFunctionality() {
    this.gameContainer = document.querySelector('.game-container');
    if (!this.gameContainer) {
        logger.error('Game container not found');
        return;
    }

    [elements.imageOneContainer, elements.imageTwoContainer].forEach((container, index) => {
        container.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });
        container.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: true });
        container.addEventListener('mousemove', (e) => {
            this.handleDragMove(e);
        });
        container.addEventListener('touchmove', (e) => {
            this.handleDragMove(e);
        }, { passive: true });
        container.addEventListener('mouseup', (e) => {
            this.handleSwipeOrDrag(e);
        });
        container.addEventListener('touchend', (e) => {
            this.handleSwipeOrDrag(e);
        });
    });

},

    safeAddEventListener(id, eventType, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
        }
    },

    initializeMainMenuListeners: function() {
        this.safeAddEventListener('share-button', 'click', () => {
            this.shareCurrentPair();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('phylogeny-button', 'click', () => {
            game.showTaxaRelationship();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('select-pair-button', 'click', () => {
            ui.showTaxonPairList();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('enter-pair-button', 'click', () => {
            dialogManager.openDialog('enter-pair-dialog');
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('random-pair-button', 'click', () => {
            game.loadNewRandomPair();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('like-button', 'click', () => {
            this.likePair();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('trash-button', 'click', () => {
            this.trashPair();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('surprise-button', 'click', () => {
            utils.surprise();
            ui.closeMainMenu(); // Close menu after action
        });
    },

    initializeAllEventListeners() {
        dragAndDrop.initialize();

        // touch events
        [elements.imageOneContainer, elements.imageTwoContainer].forEach(container => {
            container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            container.addEventListener('touchend', this.handleImageInteraction.bind(this));
            container.addEventListener('mousedown', this.handleMouseDown.bind(this));
            container.addEventListener('mouseup', this.handleImageInteraction.bind(this));
        });

        ['1', '2'].forEach(index => {
            this.safeAddEventListener(`thumbs-up-${index}`, 'click', () => this.handleThumbsUp(index));
            this.safeAddEventListener(`thumbs-down-${index}`, 'click', () => this.handleThumbsDown(index));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', this.debouncedKeyboardHandler);

        // Failsafe to ensure all dialogs can be closed
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                dialogManager.closeAllDialogs();
            }
        });

        // Add search functionality
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch);
        }

        // Help button functionality
        document.getElementById('help-button').addEventListener('click', () => {
            dialogManager.openDialog('help-dialog');
        });
        document.getElementById('start-tutorial-button').addEventListener('click', () => {
            ui.showTutorial();
        });
        document.getElementById('discord-help-dialog').addEventListener('click', () => {
            window.open('https://discord.gg/DcWrhYHmeM', '_blank');
        });

    },

    handleSearch: async function(event) {
        const searchTerm = event.target.value.toLowerCase();
        const clearButton = document.getElementById('clear-search');
        
        if (searchTerm.length > 0) {
            clearButton.style.display = 'block';
        } else {
            clearButton.style.display = 'none';
        }

        const taxonPairs = await api.fetchTaxonPairs();
        const filteredPairs = [];

        for (const pair of taxonPairs) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            if (
                pair.taxon1.toLowerCase().includes(searchTerm) ||
                pair.taxon2.toLowerCase().includes(searchTerm) ||
                (vernacular1 && vernacular1.toLowerCase().includes(searchTerm)) ||
                (vernacular2 && vernacular2.toLowerCase().includes(searchTerm)) ||
                pair.setName.toLowerCase().includes(searchTerm) ||
                pair.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            ) {
                filteredPairs.push(pair);
            }
        }

        ui.updateTaxonPairList(filteredPairs);
    },

    handleThumbsUp(index) {
        // Implement thumbs up functionality
        logger.debug(`Thumbs up clicked for image ${index}`);
        // Add your implementation here
    },

    handleThumbsDown(index) {
        // Implement thumbs down functionality
        logger.debug(`Thumbs down clicked for image ${index}`);
        // Add your implementation here
    },

    handleMouseDown(e) {
        if (!e.target.closest('.image-container') || e.target.closest('.info-button')) return;
        if (e.target.closest('.name-pair__item--draggable')) return; // Ignore draggable elements
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

            // Update the swipe info message
            const swipeInfoMessage = document.getElementById('swipe-info-message');
            swipeInfoMessage.style.opacity = progress.toFixed(2); // Fade in smoothly
        }
    },

    handleImageInteraction(event) {
        if (!event) return;  // handle cases where event is undefined
        // Add any specific image interaction logic here
    },

/*    showTaxonPairList() {
        api.fetchTaxonPairs().then(taxonPairs => {
            ui.showTaxonPairList(taxonPairs, (selectedPair) => {
                game.nextSelectedPair = selectedPair;
                game.setupGame(true);
            });
        });
    },
*/
    _handleKeyboardShortcuts(event) {
//        logger.debug("Keyboard event:", event.key);

        if (dialogManager.isAnyDialogOpen()) {
            // If any dialog is open, don't process keyboard shortcuts
            return;
        }

        if (dialogManager.isAnyDialogOpen() || 
            document.getElementById('info-dialog').open || 
            dialogManager.activeDialog || 
            document.getElementById('enter-pair-dialog').open) {
//            logger.debug("Dialog is open, ignoring keyboard shortcut");
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
            case 'arrowup':
                event.preventDefault();
                this.moveTileToDropZone('left', 'upper');
                break;
            case 'arrowdown':
                event.preventDefault();
                this.moveTileToDropZone('left', 'lower');
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
                ui.toggleMainMenu();
                break;
            case 'p':
                event.preventDefault();
                document.getElementById('surprise-button').click();
                break;
            case 'g':
                event.preventDefault();
                game.showTaxaRelationship();
                break;
            case 'i':
                event.preventDefault();
                game.showInfoDialog(game.currentObservationURLs.imageOne, 1);
                break;
            case 'o':
                event.preventDefault();
                game.showInfoDialog(game.currentObservationURLs.imageTwo, 2);
                break;
            case 'w':
                // createWorldMap.toggleAllWorldMaps();
                // TODO need to find a way to trigger from here
                break;
        }
    },

    moveTileToDropZone(tilePosition, dropZonePosition) {
        const tile = document.getElementById(tilePosition === 'left' ? 'left-name' : 'right-name');
        const dropZone = document.getElementById(dropZonePosition === 'upper' ? 'drop-1' : 'drop-2');
        
        if (tile && dropZone) {
            // Remove the tile from its current position
            tile.parentNode.removeChild(tile);
            
            // Clear the drop zone and add the tile
            dropZone.innerHTML = '';
            dropZone.appendChild(tile);
            
            // Highlight the moved tile
            //ui.highlightTile(tile.id);
            
            // Trigger the answer check using the game's checkAnswer method
            game.checkAnswer(dropZone.id);
        }
    },

    // move to other module, utils?
    shareCurrentPair() {
        let currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('taxon1');
        currentUrl.searchParams.delete('taxon2');
        currentUrl.searchParams.delete('tags'); // Clear any existing tags
        
        currentUrl.searchParams.set('taxon1', gameState.taxonImageOne);
        currentUrl.searchParams.set('taxon2', gameState.taxonImageTwo);
        
        // Add active tags to the URL
        const activeTags = gameState.selectedTags;
        if (activeTags && activeTags.length > 0) {
            currentUrl.searchParams.set('tags', activeTags.join(','));
        }
        
        let shareUrl = currentUrl.toString();

        navigator.clipboard.writeText(shareUrl).then(() => {
            logger.info('Share URL copied to clipboard');
        }).catch(err => {
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
