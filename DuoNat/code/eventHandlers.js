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
    isOpeningDialog: false,
    hasLostFocus: true,

    initialize() {
        this.initializeSwipeFunctionality();
        this.initializeMainMenuListeners();
        this.initializeAllEventListeners();
        this.initializeSelectSetDialogShortcuts();
        this.initializeSkillLevelIndicator();

        this.debouncedKeyboardHandler = utils.debounce(this._handleKeyboardShortcuts.bind(this), 300);
        document.addEventListener('keydown', this.debouncedKeyboardHandler);

        // Ensure keyboard shortcuts are properly set up
        document.removeEventListener('keydown', this.debouncedKeyboardHandler);
        document.addEventListener('keydown', this.debouncedKeyboardHandler);

        // Select set dialog close button
        const selectSetDialog = document.getElementById('select-set-dialog');
        const selectSetCloseButton = selectSetDialog.querySelector('.dialog-close-button');
        selectSetCloseButton.addEventListener('click', () => {
            dialogManager.closeDialog('select-set-dialog');
        });

        // Tag cloud dialog close button
        const tagCloudDialog = document.getElementById('tag-cloud-dialog');
        const tagCloudCloseButton = tagCloudDialog.querySelector('.dialog-close-button');
        tagCloudCloseButton.addEventListener('click', () => {
            dialogManager.closeDialog('tag-cloud-dialog');
        });

    },

    initializeSkillLevelIndicator() {
        const skillLevelIndicator = document.getElementById('skill-level-indicator');
        if (skillLevelIndicator) {
            skillLevelIndicator.addEventListener('click', this.handleSkillLevelIndicatorClick);
            skillLevelIndicator.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleSkillLevelIndicatorClick();
                }
            });
        }
    },

    handleSkillLevelIndicatorClick() {
        ui.showTaxonPairList();
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

    initializeMainMenuListeners: function () {
        this.safeAddEventListener('share-button', 'click', () => {
            utils.shareCurrentPair();
//            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('phylogeny-button', 'click', () => {
            game.showTaxaRelationship();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('select-set-button', 'click', () => {
            ui.showTaxonPairList();
            ui.closeMainMenu(); // Close menu after action
        });
        this.safeAddEventListener('enter-set-button', 'click', () => {
            dialogManager.openDialog('enter-set-dialog');
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
            searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
        }
        const clearSearchButton = document.getElementById('clear-search');
        if (clearSearchButton) {
            clearSearchButton.addEventListener('click', this.handleClearSearch);
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
        const searchInput = event.target;
        const searchTerm = searchInput.value.toLowerCase();
        const clearButton = document.getElementById('clear-search');

        if (searchTerm.length > 0) {
            clearButton.style.display = 'block';
        } else {
            clearButton.style.display = 'none';
        }

        const taxonPairs = await api.fetchTaxonPairs();
        const activeTags = gameState.selectedTags;
        const selectedLevel = gameState.selectedLevel;
        const filteredPairs = [];

        for (const pair of taxonPairs) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            const matchesTags = activeTags.length === 0 || pair.tags.some(tag => activeTags.includes(tag));
            const matchesLevel = selectedLevel === '' || pair.skillLevel === selectedLevel;

            if (matchesTags && matchesLevel && (
                pair.taxon1.toLowerCase().includes(searchTerm) ||
                pair.taxon2.toLowerCase().includes(searchTerm) ||
                (vernacular1 && vernacular1.toLowerCase().includes(searchTerm)) ||
                (vernacular2 && vernacular2.toLowerCase().includes(searchTerm)) ||
                pair.setName.toLowerCase().includes(searchTerm) ||
                pair.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            )) {
                filteredPairs.push(pair);
            }
        }

        ui.updateTaxonPairList(filteredPairs);
        ui.updateActiveCollectionCount(filteredPairs.length);

        if (this.hasLostFocus && searchInput.value.length > 1) {
            searchInput.select();
        }
        this.hasLostFocus = false;

        searchInput.addEventListener('blur', () => {
            this.hasLostFocus = true;
        }, { once: true });
    },

    handleSearchKeydown: function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.openFirstTaxonSet();
            dialogManager.closeDialog('select-set-dialog');
        }
    },

    handleClearSearch: async function() {
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            searchInput.value = '';
            // Hide the clear button
            document.getElementById('clear-search').style.display = 'none';
            // Trigger the search event to update the list
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            // Set hasLostFocus to true before focusing
            this.hasLostFocus = true;
            // Focus on the search input
            searchInput.focus();
        }
    },

    openFirstTaxonSet: function() {
        const firstTaxonSetButton = document.querySelector('.taxon-set-button');
        if (firstTaxonSetButton) {
            firstTaxonSetButton.click();
        }
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
                if (!game.isCurrentPairInCollection()) {
                    game.loadRandomPairFromCurrentCollection();
                } else {
                    game.loadNewRandomPair();
                }
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

        if (dialogManager.isAnyDialogOpen()) {
            // If any dialog is open, don't process keyboard shortcuts
            return;
        }

        if (dialogManager.isAnyDialogOpen() ||
            document.getElementById('info-dialog').open ||
            dialogManager.activeDialog ||
            document.getElementById('enter-set-dialog').open) {
            return;
        }

        switch (event.key.toLowerCase()) {
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
            case 'l':
            case 'c':
                event.preventDefault();
                ui.showTaxonPairList();
                break;
            case 'h':
                event.preventDefault();
                dialogManager.openDialog('help-dialog');
                break;
            case 'e':
                event.preventDefault();
                dialogManager.openDialog('enter-set-dialog');
                break;
            case 'm':
                event.preventDefault();
                ui.toggleMainMenu();
                break;
            case 's':
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

    initializeSelectSetDialogShortcuts() {
        const dialog = document.getElementById('select-set-dialog');
        dialog.addEventListener('keydown', this.handleSelectSetDialogKeydown.bind(this));
    },

    handleSelectSetDialogKeydown(event) {
        if (event.altKey) {
            switch (event.key.toLowerCase()) {
                case 't':
                    event.preventDefault();
                    document.getElementById('select-tags-button').click();
                    break;
                case 'g':
                    event.preventDefault();
                    document.getElementById('clear-all-tags').click();
                    break;
                case 'r':
                    event.preventDefault();
                    document.getElementById('select-range-button').click();
                    break;
                case 'l':
                    event.preventDefault();
                    document.getElementById('level-filter-dropdown').focus();
                    break;
                case 's':
                    event.preventDefault();
                    document.getElementById('taxon-search').focus();
                    break;
                case 'c':
                    event.preventDefault();
                    this.handleClearSearch();
                    break;
            }
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

    likePair: function () {
        // Implement liking functionality
        logger.debug('Like pair clicked');
        // Add your implementation here
    },

    trashPair: function () {
        // Implement trashing functionality
        logger.debug('Trash pair clicked');
        // Add your implementation here
    },

};

export default eventHandlers;
