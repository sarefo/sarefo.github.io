// Event handlers

import api from './api.js';
import dialogManager from './dialogManager.js';
import dragAndDrop from './dragAndDrop.js';
import game from './game.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import { elements, gameState } from './state.js';
import taxaRelationshipViewer from './taxaRelationshipViewer.js';
import testingDialog from './testingDialog.js';
import ui from './ui.js';
import utils from './utils.js';

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.vernacular.fetchVernacular(taxonName);
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


    isLoadingNewPair: false,
    isOpeningDialog: false,
    hasLostFocus: true,

    swipeOutThreshold: 30, // Minimum distance to trigger a swipe-out
    swipeRestraint: 100, // maximum vertical distance allowed during a swipe
    maxRotation: 15, // Maximum rotation angle in degrees
    animationDuration: 300, // Duration of the swipe-out animation in milliseconds

    initialize() {
        this.initializeSwipeFunctionality();
        this.initializeMainMenuListeners();
        this.initializeAllEventListeners();
        this.initializeSelectSetDialogShortcuts();
        this.initializeLevelIndicator();
        this.initializeLongPressHandler(); // only used for testing dialog secret long-press on chili for now
        this.debouncedKeyboardHandler = utils.ui.debounce(this._handleKeyboardShortcuts.bind(this), 300);
        document.addEventListener('keydown', this.debouncedKeyboardHandler);

        window.addEventListener('blur', this.resetSwipeState);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.resetSwipeState();
            }
        });

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

        testingDialog.initialize();

          const searchInput = document.getElementById('taxon-search');
          if (searchInput) {
            const debouncedHandleSearch = utils.ui.debounce(this.handleSearch.bind(this), 300); // 300ms delay
            searchInput.addEventListener('input', debouncedHandleSearch);
            searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
          }
    },

    initializeLongPressHandler() {
        const levelIndicator = document.getElementById('level-indicator');
        let longPressTimer;

        levelIndicator.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                testingDialog.openDialog();
            }, 1500); // 1.5 seconds long press
        }, { passive: true });

        levelIndicator.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        levelIndicator.addEventListener('touchmove', (e) => {
            clearTimeout(longPressTimer);
        }, { passive: true });
    },

    initializeLevelIndicator() {
        const levelIndicator = document.getElementById('level-indicator');
        if (levelIndicator) {
            levelIndicator.addEventListener('click', this.handleLevelIndicatorClick);
            levelIndicator.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleLevelIndicatorClick();
                }
            });
        }
    },

    handleLevelIndicatorClick() {
        ui.taxonPairList.showTaxonPairList();
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

    disableSwipe: function() {
        this.swipeDisabled = true;
    },

    enableSwipe: function() {
        this.swipeDisabled = false;
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
        const addMenuListener = (buttonId, action) => {
            this.safeAddEventListener(buttonId, 'click', () => {
                action();
                ui.menu.close(); // Close menu after action
            });
        };

        this.safeAddEventListener('share-button', 'click', () => {
            utils.url.shareCurrentPair();
        });

        addMenuListener('phylogeny-button', taxaRelationshipViewer.graphManagement.showTaxaRelationship);
        addMenuListener('select-set-button', ui.taxonPairList.showTaxonPairList);
        addMenuListener('enter-set-button', () => dialogManager.openDialog('enter-set-dialog'));
        addMenuListener('random-pair-button', gameLogic.loadNewRandomPair);
        addMenuListener('like-button', this.likePair.bind(this));
        addMenuListener('trash-button', this.trashPair.bind(this));
        addMenuListener('surprise-button', utils.sound.surprise);
    },

    initializeAllEventListeners() {
        dragAndDrop.init.initialize();

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
        document.getElementById('help-button').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!ui.tutorial.isActive) {
                const helpDialog = document.getElementById('help-dialog');
                if (helpDialog && !helpDialog.open) {
                    dialogManager.openDialog('help-dialog');
                }
            }
        });

        document.getElementById('start-tutorial-button').addEventListener('click', () => {
            ui.tutorial.showTutorial();
        });

        document.getElementById('discord-help-dialog').addEventListener('click', () => {
            window.open('https://discord.gg/DcWrhYHmeM', '_blank');
        });

    },

    handleSearch: async function (event) {
        const searchInput = event.target;
        const searchTerm = searchInput.value.trim();
        const clearButton = document.getElementById('clear-search');

        if (searchTerm.length > 0) {
            clearButton.style.display = 'block';
        } else {
            clearButton.style.display = 'none';
        }

        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const activeTags = gameState.selectedTags;
        const selectedLevel = gameState.selectedLevel;
        const filteredPairs = [];

        const isNumericSearch = /^\d+$/.test(searchTerm);

        for (const pair of taxonPairs) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            const matchesTags = activeTags.length === 0 || pair.tags.some(tag => activeTags.includes(tag));
            const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;

            let matches = false;

            if (isNumericSearch) {
                matches = pair.setID === searchTerm;
            } else {
                matches = pair.taxon1.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          pair.taxon2.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (vernacular1 && vernacular1.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (vernacular2 && vernacular2.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          pair.setName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          pair.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
            }

            if (matchesTags && matchesLevel && matches) {
                filteredPairs.push(pair);
            }
        }

        ui.taxonPairList.updateTaxonPairList(filteredPairs);
        ui.taxonPairList.updateActiveCollectionCount(filteredPairs.length);

        if (this.hasLostFocus && searchInput.value.length > 1) {
            searchInput.select();
        }
        this.hasLostFocus = false;

        searchInput.addEventListener('blur', () => {
            this.hasLostFocus = true;
        }, { once: true });
    },

    handleSearchKeydown: function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const firstTaxonSetButton = document.querySelector('.taxon-set-button');
            if (firstTaxonSetButton) {
                firstTaxonSetButton.click();
                setTimeout(() => {
                    dialogManager.closeDialog('select-set-dialog');
                }, 100);
            }
        }
    },

    handleClearSearch: async function () {
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

    openFirstTaxonSet: function () {
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

        if (deltaX > this.swipeOutThreshold && deltaY < this.swipeRestraint) {
            this.performSwipeOutAnimation(deltaX);
        } else {
            this.resetSwipeState();
        }

        this.isDragging = false;
    },

    performSwipeOutAnimation(initialDeltaX) {
        document.getElementById('swipe-info-message').style.opacity = '0';

        const startRotation = (initialDeltaX / this.swipeOutThreshold) * -this.maxRotation;
        
        this.gameContainer.style.transition = `transform ${this.animationDuration}ms ease-out, opacity ${this.animationDuration}ms ease-out`;
        this.gameContainer.style.transform = `rotate(${startRotation}deg) translateX(-${initialDeltaX}px)`;
        
        requestAnimationFrame(() => {
            this.gameContainer.style.transform = `rotate(${-this.maxRotation}deg) translateX(-100%)`;
            this.gameContainer.style.opacity = '0';
        });

        setTimeout(() => {
            this.resetSwipeState();

            if (!gameLogic.isCurrentPairInCollection()) {
                gameLogic.loadRandomPairFromCurrentCollection();
            } else {
                gameLogic.loadNewRandomPair();
            }

            // Ensure state is reset after loading new pair
            setTimeout(this.resetSwipeState, 100);
        }, this.animationDuration);
    },

    resetSwipeState() {
        const swipeInfoMessage = document.getElementById('swipe-info-message');
        const gameContainer = document.querySelector('.game-container');

        // Cancel any ongoing animations
        gameContainer.getAnimations().forEach(animation => animation.cancel());

        // Reset game container
        gameContainer.style.transition = 'none';
        gameContainer.style.transform = 'none';
        gameContainer.style.opacity = '1';

        // Reset swipe info message
        swipeInfoMessage.style.transition = 'none';
        swipeInfoMessage.style.opacity = '0';

        // Force a reflow to ensure changes take effect immediately
        void gameContainer.offsetWidth;

        // Re-enable transitions after a short delay
        setTimeout(() => {
            gameContainer.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            swipeInfoMessage.style.transition = 'opacity 0.3s ease-out';
        }, 50);
    },

    resetSwipeAnimation() {
        const swipeInfoMessage = document.getElementById('swipe-info-message');
        const gameContainer = document.querySelector('.game-container');

        // Reset game container
        gameContainer.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        gameContainer.style.transform = 'none';
        gameContainer.style.opacity = '1';

        // Reset swipe info message
        swipeInfoMessage.style.transition = 'opacity 0.3s ease-out';
        swipeInfoMessage.style.opacity = '0';

        // After transitions complete, remove transition styles
        setTimeout(() => {
            gameContainer.style.transition = '';
            swipeInfoMessage.style.transition = '';
        }, 300);
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
            const progress = Math.min(deltaX / this.swipeOutThreshold, 1);
            const rotation = progress * -this.maxRotation;
            const opacity = 1 - progress * 0.3;

            requestAnimationFrame(() => {
                this.gameContainer.style.transform = `rotate(${rotation}deg) translateX(${-deltaX}px)`;
                this.gameContainer.style.opacity = opacity.toString();
                document.getElementById('swipe-info-message').style.opacity = progress.toFixed(2);
            });
        } else {
            this.resetSwipeState();
        }
    },
 
    handleImageInteraction(event) {
        if (!event) return;  // handle cases where event is undefined
        // Add any specific image interaction logic here
    },

    _handleKeyboardShortcuts(event) {

        if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
            return; // Exit the function if any modifier key is pressed
        }

        if (dialogManager.isAnyDialogOpen() || ui.tutorial.isActive) {
            // If any dialog or tutorial is open, don't process keyboard shortcuts
            return;
        }

        if (dialogManager.isAnyDialogOpen() ||
            document.getElementById('info-dialog').open ||
            document.getElementById('enter-set-dialog').open) {
            return;
        }

        switch (event.key.toLowerCase()) {
            case 'arrowleft':
                if (!this.isLoadingNewPair) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.isLoadingNewPair = true;
                    gameLogic.loadNewRandomPair().finally(() => {
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
            case 'c':
            case 'l':
                event.preventDefault();
                ui.taxonPairList.showTaxonPairList();
                break;
            case 'e':
                event.preventDefault();
                dialogManager.openDialog('enter-set-dialog');
                break;
            case 'i':
                event.preventDefault();
                game.dialogHandling.showInfoDialog(game.currentObservationURLs.imageOne, 1);
                break;
            case 'o':
                event.preventDefault();
                game.dialogHandling.showInfoDialog(game.currentObservationURLs.imageTwo, 2);
                break;
            case 'g':
                taxaRelationshipViewer.graphManagement.showTaxaRelationship();
                break;
            case 'h':
                if (!event.target.closest('button')) {  // Only trigger if not clicking a button
                    event.preventDefault();
                    dialogManager.openDialog('help-dialog');
                }
                break;
            case 'm':
                event.preventDefault();
                ui.menu.toggleMainMenu();
                break;
            case 's':
                event.preventDefault();
                utils.url.shareCurrentPair();
                break;
            case 't': // hidden
                event.preventDefault();
                testingDialog.openDialog();
                break;
            case '+': // hidden
                event.preventDefault();
                this.incrementSetID();
                break;
            case 'w':
                // createWorldMap.toggleAllWorldMaps();
                // TODO need to find a way to trigger from here
                break;
            case 'x':
                event.preventDefault();
                document.getElementById('surprise-button').click();
                break;
        }
    },

    initializeSelectSetDialogShortcuts() {
        const dialog = document.getElementById('select-set-dialog');
        dialog.addEventListener('keydown', this.handleSelectSetDialogKeydown.bind(this));
    },

    incrementSetID() {
        const currentSetID = gameState.currentTaxonImageCollection?.pair?.setID;
        if (currentSetID) {
            const nextSetID = String(Number(currentSetID) + 1);
            gameLogic.loadSetByID(nextSetID, true); // Pass true to indicate clearing filters
        }
    },

    handleSelectSetDialogKeydown(event) {
        if (event.altKey) {
            switch (event.key.toLowerCase()) {
                case 't':
                    event.preventDefault();
                    document.getElementById('select-tags-button').click();
                    break;
                case 'f':
                    event.preventDefault();
                    document.getElementById('clear-all-filters').click();
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

            // Trigger the answer check using the game's checkAnswer method
            gameLogic.checkAnswer(dropZone.id);
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
