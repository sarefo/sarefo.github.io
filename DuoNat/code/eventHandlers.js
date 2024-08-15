import api from './api.js';
import dialogManager from './dialogManager.js';
import dragAndDrop from './dragAndDrop.js';
import game from './game.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import state from './state.js';
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

    isLoadingNewPair: false,
    isOpeningDialog: false,
    hasLostFocus: true,

    swipeOutThreshold: 30, // Minimum distance to trigger a swipe-out
    swipeRestraint: 100, // maximum vertical distance allowed during a swipe
    maxRotation: 15, // Maximum rotation angle in degrees
    animationDuration: 300, // Duration of the swipe-out animation in milliseconds

    swipeAndDrag: {
        // Swipe and drag related properties and methods
        startX: 0,
        endX: 0,
        isDragging: false,
        gameContainer: null,
        touchStartX: 0,
        touchStartY: 0,
        touchEndX: 0,
        touchEndY: 0,

        handleImageInteraction(event) {
            if (!event) return;  // handle cases where event is undefined
            // Add any specific image interaction logic here
        },

        initializeSwipeFunctionality() {
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
            return deltaX > eventHandlers.swipeOutThreshold && deltaY < eventHandlers.swipeRestraint;
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
            if (!this.isDragging) return;

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
            return deltaX > 0 && deltaY < eventHandlers.swipeRestraint;
        },

        updateDragAnimation(deltaX) {
            const progress = Math.min(deltaX / eventHandlers.swipeOutThreshold, 1);
            const rotation = progress * -eventHandlers.maxRotation;
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
            const startRotation = (initialDeltaX / eventHandlers.swipeOutThreshold) * -eventHandlers.maxRotation;
            this.setInitialSwipeOutStyles(startRotation, initialDeltaX);
            this.setFinalSwipeOutStyles();
        },

        setInitialSwipeOutStyles(startRotation, initialDeltaX) {
            this.gameContainer.style.transition = `transform ${eventHandlers.animationDuration}ms ease-out, opacity ${eventHandlers.animationDuration}ms ease-out`;
            this.gameContainer.style.transform = `rotate(${startRotation}deg) translateX(-${initialDeltaX}px)`;
        },

        setFinalSwipeOutStyles() {
            requestAnimationFrame(() => {
                this.gameContainer.style.transform = `rotate(${-eventHandlers.maxRotation}deg) translateX(-100%)`;
                this.gameContainer.style.opacity = '0';
            });
        },

        scheduleNewPairLoad() {
            setTimeout(() => {
                this.resetContainerForNewPair();
                this.loadNewPair();
                this.fadeInNewPair();
            }, eventHandlers.animationDuration);
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

    },

    uiInteractions: {

        safeAddEventListener(id, eventType, handler) {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(eventType, handler);
            } else {
                logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
            }
        },

        initializeMainMenuListeners() {
            this.addMenuButtonListeners();
            this.addShareButtonListener();
        },

        addMenuButtonListeners() {
            const menuActions = {
                'phylogeny-button': taxaRelationshipViewer.showTaxaRelationship,
                'select-set-button': ui.showTaxonPairList,
                'enter-set-button': () => dialogManager.openDialog('enter-set-dialog'),
                'random-pair-button': gameLogic.loadNewRandomPair,
                'like-button': this.likePair.bind(this),
                'trash-button': this.trashPair.bind(this),
                'surprise-button': utils.sound.surprise
            };

            Object.entries(menuActions).forEach(([buttonId, action]) => {
                this.addMenuListener(buttonId, action);
            });
        },

        addMenuListener(buttonId, action) {
            this.safeAddEventListener(buttonId, 'click', () => {
                action();
                ui.closeMenu();
            });
        },

        addShareButtonListener() {
            this.safeAddEventListener('share-button', 'click', utils.url.shareCurrentPair);
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
            ui.showTaxonPairList();
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
    },

    keyboardShortcuts: {
        debouncedKeyboardHandler: null,
        _handleKeyboardShortcuts(event) {

            if (this.shouldIgnoreKeyboardShortcut(event)) return;

            let currentObservationURLs = state.getObservationURLs();

            const shortcutActions = {
                'arrowleft': this.handleArrowLeft.bind(this),
                'arrowup': () => this.moveTileToDropZone('left', 'upper'),
                'arrowdown': () => this.moveTileToDropZone('left', 'lower'),
                'c': ui.showTaxonPairList,
                'l': ui.showTaxonPairList,
                'e': () => dialogManager.openDialog('enter-set-dialog'),
                'i': () => game.showInfoDialog(currentObservationURLs.imageOne, 1),
                'o': () => game.showInfoDialog(currentObservationURLs.imageTwo, 2),
                'h': () => eventHandlers.hintButton.showHint(1),
                'j': () => eventHandlers.hintButton.showHint(2),
                'g': taxaRelationshipViewer.showTaxaRelationship,
                '?': () => this.handleQuestionMark(event),
                'm': ui.toggleMainMenu,
                's': utils.url.shareCurrentPair,
                't': testingDialog.openDialog,
                '+': this.incrementSetID.bind(this),
                'x': () => document.getElementById('surprise-button').click()
            };

            const action = shortcutActions[event.key.toLowerCase()];
            if (action) {
                event.preventDefault();
                action();
            }
        },

        shouldIgnoreKeyboardShortcut(event) {
            return event.ctrlKey || event.altKey || event.metaKey ||
                   dialogManager.isAnyDialogOpen() || 
                   ui.isTutorialActive() ||
                   document.getElementById('info-dialog').open ||
                   document.getElementById('enter-set-dialog').open;
        },

        handleArrowLeft() {
            if (!eventHandlers.isLoadingNewPair) {
                eventHandlers.isLoadingNewPair = true;
                gameLogic.loadNewRandomPair().finally(() => {
                    eventHandlers.isLoadingNewPair = false;
                });
            }
        },

        handleQuestionMark(event) {
            if (event && event.target && !event.target.closest('button')) {
                dialogManager.openDialog('help-dialog');
            }
        },

        incrementSetID() {
            const currentSetID = state.getCurrentTaxonImageCollection()?.pair?.setID;
            if (currentSetID) {
                const nextSetID = String(Number(currentSetID) + 1);
                gameLogic.loadSetByID(nextSetID, true); // Pass true to indicate clearing filters
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
    },

    search: {

        handleSearch: async function (event) {
            const searchInput = event.target;
            const searchTerm = searchInput.value.trim();
            
            this.updateClearButtonVisibility(searchTerm);
            
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filteredPairs = await this.filterTaxonPairs(taxonPairs, searchTerm);
            
            this.updateUI(filteredPairs);
            this.handleSearchInputFocus(searchInput);
        },

        updateClearButtonVisibility(searchTerm) {
            const clearButton = document.getElementById('clear-search');
            clearButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
        },

        async filterTaxonPairs(taxonPairs, searchTerm) {
            const activeTags = state.getSelectedTags;
            const selectedLevel = state.getSelectedLevel;
            const isNumericSearch = /^\d+$/.test(searchTerm);
            const filteredPairs = [];

            for (const pair of taxonPairs) {
                if (await this.isPairMatching(pair, searchTerm, activeTags, selectedLevel, isNumericSearch)) {
                    filteredPairs.push(pair);
                }
            }

            return filteredPairs;
        },

        async isPairMatching(pair, searchTerm, activeTags, selectedLevel, isNumericSearch) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            const matchesTags = this.matchesTags(pair, activeTags);
            const matchesLevel = this.matchesLevel(pair, selectedLevel);
            const matchesSearch = this.matchesSearch(pair, searchTerm, vernacular1, vernacular2, isNumericSearch);

            return matchesTags && matchesLevel && matchesSearch;
        },

        matchesTags(pair, activeTags) {
            return activeTags.length === 0 || pair.tags.some(tag => activeTags.includes(tag));
        },

        matchesLevel(pair, selectedLevel) {
            return selectedLevel === '' || pair.level === selectedLevel;
        },

        matchesSearch(pair, searchTerm, vernacular1, vernacular2, isNumericSearch) {
            if (isNumericSearch) {
                return pair.setID === searchTerm;
            }

            const searchTermLower = searchTerm.toLowerCase();
            return pair.taxon1.toLowerCase().includes(searchTermLower) ||
                   pair.taxon2.toLowerCase().includes(searchTermLower) ||
                   (vernacular1 && vernacular1.toLowerCase().includes(searchTermLower)) ||
                   (vernacular2 && vernacular2.toLowerCase().includes(searchTermLower)) ||
                   pair.setName.toLowerCase().includes(searchTermLower) ||
                   pair.tags.some(tag => tag.toLowerCase().includes(searchTermLower));
        },

        updateUI(filteredPairs) {
            ui.updateTaxonPairList(filteredPairs);
            ui.updateActiveCollectionCount(filteredPairs.length);
        },

        handleSearchInputFocus(searchInput) {
            if (eventHandlers.hasLostFocus && searchInput.value.length > 1) {
                searchInput.select();
            }
            eventHandlers.hasLostFocus = false;

            searchInput.addEventListener('blur', () => {
                eventHandlers.hasLostFocus = true;
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
                eventHandlers.hasLostFocus = true;
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

    },

    hintButton: {
        async showHint(index) {
            const imageContainer = document.getElementById(`image-container-${index}`);
            const taxonName = imageContainer.querySelector('img').alt.split(' Image')[0];
            const taxonId = await this.getTaxonId(taxonName);
            
            if (!taxonId) {
                logger.warn(`Could not find ID for taxon: ${taxonName}`);
                return;
            }
            
            const hints = await api.taxonomy.fetchTaxonHints(taxonId);
            
            if (hints && hints.length > 0) {
                this.displayRandomHint(hints, index);
            } else {
                logger.warn(`No hints available for ${taxonName} (ID: ${taxonId})`);
            }
        },

        async getTaxonId(taxonName) {
            const taxonInfo = await api.taxonomy.loadTaxonInfo();
            return Object.keys(taxonInfo).find(id => taxonInfo[id].taxonName === taxonName);
        },

        displayRandomHint(hints, index) {
            if (state.areAllHintsShown(index, hints.length)) {
                state.resetShownHints();
            }
            
            const shownHints = state.getShownHints(index);
            const availableHints = hints.filter(hint => !shownHints.includes(hint));
            
            if (availableHints.length > 0) {
                const randomHint = availableHints[Math.floor(Math.random() * availableHints.length)];
                state.addShownHint(index, randomHint);
                
                this.showHintOverlay(randomHint, index);
            }
        },

        showHintOverlay(hint, index) {
            const imageContainer = document.getElementById(`image-container-${index}`);
            const hintOverlay = document.createElement('div');
            hintOverlay.className = 'hint-overlay';
            hintOverlay.textContent = hint;
            
            imageContainer.appendChild(hintOverlay);
            
            setTimeout(() => {
                hintOverlay.remove();
            }, 3000); // Show hint for 3 seconds
        },

        initialize: function() {
            eventHandlers.uiInteractions.safeAddEventListener('hint-button-1', 'click', () => this.showHint(1));
            eventHandlers.uiInteractions.safeAddEventListener('hint-button-2', 'click', () => this.showHint(2));
        }
    },

    eventInitializer: {
        initialize() {
            this.initializeDragAndDrop();
            this.initializeTouchEvents();
            this.initializeThumbsEvents();
            this.initializeKeyboardEvents();
            this.initializeSearchFunctionality();
            this.initializeHelpButton();
            this.initializeTutorialButton();
            this.initializeDiscordButton();
            this.initializeDialogCloseButtons();
            this.initializeSearchInput();
        },

        initializeDragAndDrop() {
            dragAndDrop.initialize();
        },

        initializeTouchEvents() {
            const containers = [state.getElement('imageOneContainer'), state.getElement('imageTwoContainer')];
            containers.forEach(container => {
                container.addEventListener('touchstart', eventHandlers.swipeAndDrag.handleTouchStart.bind(eventHandlers.swipeAndDrag), { passive: true });
                container.addEventListener('touchend', eventHandlers.swipeAndDrag.handleImageInteraction.bind(eventHandlers.swipeAndDrag));
                container.addEventListener('mousedown', eventHandlers.swipeAndDrag.handleMouseDown.bind(eventHandlers.swipeAndDrag));
                container.addEventListener('mouseup', eventHandlers.swipeAndDrag.handleImageInteraction.bind(eventHandlers.swipeAndDrag));
            });
        },

        initializeThumbsEvents() {
            ['1', '2'].forEach(index => {
                eventHandlers.uiInteractions.safeAddEventListener(`thumbs-up-${index}`, 'click', () => eventHandlers.uiInteractions.handleThumbsUp(index));
                eventHandlers.uiInteractions.safeAddEventListener(`thumbs-down-${index}`, 'click', () => eventHandlers.uiInteractions.handleThumbsDown(index));
            });
        },

        initializeKeyboardEvents() {
            document.addEventListener('keydown', eventHandlers.keyboardShortcuts.debouncedKeyboardHandler);
            document.addEventListener('keydown', this.handleEscapeKey);
        },

        handleEscapeKey(event) {
            if (event.key === 'Escape') {
                dialogManager.closeAllDialogs();
            }
        },

        initializeSearchFunctionality() {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput) {
                searchInput.addEventListener('input', eventHandlers.search.handleSearch.bind(eventHandlers.search));
                searchInput.addEventListener('keydown', eventHandlers.search.handleSearchKeydown.bind(eventHandlers.search));
            }

            const clearSearchButton = document.getElementById('clear-search');
            if (clearSearchButton) {
                clearSearchButton.addEventListener('click', eventHandlers.search.handleClearSearch.bind(eventHandlers.search));
            }
        },

        initializeHelpButton() {
            const helpButton = document.getElementById('help-button');
            if (helpButton) {
                helpButton.addEventListener('click', this.handleHelpButtonClick);
            }
        },

        handleHelpButtonClick(event) {
            event.preventDefault();
            event.stopPropagation();
            if (!ui.isTutorialActive()) {
                const helpDialog = document.getElementById('help-dialog');
                if (helpDialog && !helpDialog.open) {
                    dialogManager.openDialog('help-dialog');
                }
            }
        },

        initializeTutorialButton() {
            const tutorialButton = document.getElementById('start-tutorial-button');
            if (tutorialButton) {
                tutorialButton.addEventListener('click', ui.showTutorial);
            }
        },

        initializeDiscordButton() {
            const discordButton = document.getElementById('discord-help-dialog');
            if (discordButton) {
                discordButton.addEventListener('click', () => {
                    window.open('https://discord.gg/DcWrhYHmeM', '_blank');
                });
            }
        },

        initializeDialogCloseButtons() {
            this.initializeDialogCloseButton('select-set-dialog');
            this.initializeDialogCloseButton('tag-cloud-dialog');
        },

        initializeDialogCloseButton(dialogId) {
            const dialog = document.getElementById(dialogId);
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    dialogManager.closeDialog(dialogId);
                });
            }
        },

        initializeSearchInput() {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput) {
                const debouncedHandleSearch = utils.ui.debounce(eventHandlers.search.handleSearch.bind(eventHandlers.search), 300);
                searchInput.addEventListener('input', debouncedHandleSearch);
                searchInput.addEventListener('keydown', eventHandlers.search.handleSearchKeydown.bind(eventHandlers.search));
            }
        },
    },

    initializeKeyboardShortcuts() {
        this.keyboardShortcuts.initializeSelectSetDialogShortcuts();
        this.keyboardShortcuts.debouncedKeyboardHandler = utils.ui.debounce(
            this.keyboardShortcuts._handleKeyboardShortcuts.bind(this.keyboardShortcuts),
            300
        );
        document.addEventListener('keydown', this.keyboardShortcuts.debouncedKeyboardHandler);
    },

    initializeUIComponents() {
        this.swipeAndDrag.initializeSwipeFunctionality();
        this.uiInteractions.initializeMainMenuListeners();
        this.uiInteractions.initializeLevelIndicator();
        this.uiInteractions.initializeLongPressHandler();
        this.hintButton.initialize();
    },

    // Main initialization method, called from main.js
    initialize() {
        eventHandlers.initializeUIComponents();
        eventHandlers.initializeKeyboardShortcuts();
        eventHandlers.eventInitializer.initialize();
        testingDialog.initialize();
    },             


    // Public API //
    enableKeyboardShortcuts() {
        document.addEventListener('keydown', eventHandlers.keyboardShortcuts.debouncedKeyboardHandler);
    },

    disableKeyboardShortcuts() {
        document.removeEventListener('keydown', eventHandlers.keyboardShortcuts.debouncedKeyboardHandler);
    },
    disableSwipe: function() {
        eventHandlers.swipeDisabled = true;
    },

    enableSwipe: function() {
        eventHandlers.swipeDisabled = false;
    },
   
    setFocusLost(value) {
        eventHandlers.hasLostFocus = value;
    }, 

};

const publicAPI = {
    initialize: eventHandlers.initialize,
    enableKeyboardShortcuts: eventHandlers.enableKeyboardShortcuts,
    disableKeyboardShortcuts: eventHandlers.disableKeyboardShortcuts,
    disableSwipe: eventHandlers.disableSwipe,
    enableSwipe: eventHandlers.enableSwipe,
    setFocusLost: eventHandlers.setFocusLost
};

export default publicAPI;
