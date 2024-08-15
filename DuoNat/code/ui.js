import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState } from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import { createNonClickableWorldMap, getFullContinentName } from './worldMap.js';

const bindAllMethods = (obj) => {
    for (let prop in obj) {
        if (typeof obj[prop] === 'function') {
            obj[prop] = obj[prop].bind(obj);
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            bindAllMethods(obj[prop]);
        }
    }
};

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.vernacular.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName) || 'n/a';
}

const ui = {

    state: {
        isMenuOpen: false,
    },

    core: {
        initialize() {
            this.initializeMenu();
            this.setupOutsideClickHandler(); // Close the dropdown when clicking outside of it
        },

        initializeMenu() {
            ui.menu.initialize();
            ui.menu.close();
        },

        setupOutsideClickHandler() {
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.main-menu')) {
                    ui.menu.close();
                }
            });
        },

        resetUIState() {
            ui.menu.close();
            // Add any other UI state resets here if needed
        },

        resetGameContainerStyle() {
            ['.game-container', '#image-container-1', '#image-container-2'].forEach(selector => 
                this.resetContainerTransform(selector)
            );
        },

        resetContainerTransform(selector) {
            const container = document.querySelector(selector);
            if (container) {
                container.style.transform = '';
                container.style.opacity = '';
            }
        },
    },

    overlay: {
        showOverlay(message = "", color) {
            this.setOverlayContent(message, color);
            this.adjustFontSize(message);
            elements.overlay.classList.add('show');
        },

        setOverlayContent(message, color) {
            elements.overlayMessage.innerHTML = message;
            elements.overlay.style.backgroundColor = color;
        },

        adjustFontSize(message) {
            const fontSize = message.length > 20 ? '1.4em' : '2.4em';
            elements.overlayMessage.style.fontSize = fontSize;
        },

        updateOverlayMessage(message) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.innerHTML = message;
            this.adjustFontSize(message);
        },

        hideOverlay() {
            elements.overlay.classList.remove('show');
        },
    },

    menu: {
        initialize() {
            this.setupMenuToggle();
            this.setupResizeHandler();
            this.setupOutsideClickHandler();
        },

        setupMenuToggle() {
            const menuToggle = document.getElementById('menu-toggle');
            if (menuToggle) {
                menuToggle.addEventListener('click', this.handleMenuToggleClick);
            } else {
                logger.error('Menu toggle button not found');
            }
        },

        setupResizeHandler() {
            window.addEventListener('resize', this.positionBottomGroup);
            this.positionBottomGroup();
        },

        setupOutsideClickHandler() {
            document.addEventListener('click', this.handleOutsideClick);
        },

        handleMenuToggleClick(event) {
            event.stopPropagation();
            this.toggleMainMenu();
        },

        handleOutsideClick(event) {
            if (!event.target.closest('.main-menu')) {
                this.close();
            }
        },

        toggleMainMenu() {
            ui.state.isMenuOpen = !ui.state.isMenuOpen;
            this.toggleDropdownGroups();
        },

        toggleDropdownGroups() {
            const topGroup = document.querySelector('.main-menu__dropdown--top');
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');

            if (topGroup && bottomGroup) {
                topGroup.classList.toggle('show');
                bottomGroup.classList.toggle('show');

                if (ui.state.isMenuOpen) {
                    this.positionBottomGroup();
                }
            } else {
                logger.error('Dropdown groups not found');
            }
        },

        positionBottomGroup() {
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
            const lowerImageContainer = document.querySelector('#image-container-2');

            if (bottomGroup && lowerImageContainer) {
                const rect = lowerImageContainer.getBoundingClientRect();
                bottomGroup.style.top = `${rect.top}px`;
                bottomGroup.style.right = '0px'; // Adjust if needed
            }
        },

        close() {
            if (ui.state.isMenuOpen) {
                this.closeDropdownGroups();
            }
        },

        closeDropdownGroups() {
            const topGroup = document.querySelector('.main-menu__dropdown--top');
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
            if (topGroup && bottomGroup) {
                ui.state.isMenuOpen = false;
                topGroup.classList.remove('show');
                bottomGroup.classList.remove('show');
            }
        },
    },

    taxonPairList: {
        async showTaxonPairList() {
            try {
                const taxonPairs = await this.fetchAndFilterTaxonPairs();
                await this.renderTaxonPairList(taxonPairs);
                this.setupDialogAndFilters();
            } catch (error) {
                logger.error("Error in showTaxonPairList:", error);
            }
        },

        async fetchAndFilterTaxonPairs() {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            if (taxonPairs.length === 0) {
                logger.error("No taxon pairs available");
                return [];
            }

            const filters = this.getCurrentFilters();
            let filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);
            return this.prioritizeCurrentActiveSet(filteredPairs);
        },

        getCurrentFilters() {
            return {
                level: gameState.selectedLevel,
                ranges: gameState.selectedRanges,
                tags: gameState.selectedTags
            };
        },

        prioritizeCurrentActiveSet(filteredPairs) {
            const currentActiveSet = gameState.currentTaxonImageCollection?.pair;
            if (currentActiveSet) {
                const activeSetIndex = filteredPairs.findIndex(pair => 
                    pair.taxonNames[0] === currentActiveSet.taxon1 && 
                    pair.taxonNames[1] === currentActiveSet.taxon2
                );
                if (activeSetIndex !== -1) {
                    const activeSet = filteredPairs.splice(activeSetIndex, 1)[0];
                    filteredPairs.unshift(activeSet);
                }
            }
            return filteredPairs;
        },

        async renderTaxonPairList(pairs) {
            const list = document.getElementById('taxon-set-list');
            if (list) {
                list.innerHTML = '';
            }
            await this.renderVisibleTaxonPairs(pairs);
            this.updateActiveCollectionCount(pairs.length);
        },

        async renderVisibleTaxonPairs(pairs) {
            const list = document.getElementById('taxon-set-list');
            if (!list) return;

            list.innerHTML = '';
            const visiblePairs = pairs.slice(0, 20);

            for (const pair of visiblePairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }

            if (pairs.length > 20) {
                this.addLoadMoreButton(list, pairs);
            }
        },

        addLoadMoreButton(list, pairs) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Load More';
            loadMoreButton.className = 'load-more-button';
            loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, 20));
            list.appendChild(loadMoreButton);
        },

        setupDialogAndFilters() {
            this.setLevelDropdownValue();
            dialogManager.openDialog('select-set-dialog');
            this.updateFilterSummary();
            this.focusSearchInput();
            this.handleExistingSearch();
        },

        setLevelDropdownValue() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.value = gameState.selectedLevel;
            }
        },

        handleExistingSearch() {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput && searchInput.value.trim() !== '') {
                const event = new Event('input', { bubbles: true, cancelable: true });
                searchInput.dispatchEvent(event);
            }
            this.toggleClearButton(searchInput);
        },

        toggleClearButton(searchInput) {
            const clearButton = document.getElementById('clear-search');
            if (clearButton) {
                clearButton.style.display = searchInput.value.trim() !== '' ? 'block' : 'none';
            }
        },

        updateFilterSummary() {
            this.updateMapInFilterSummary();
            this.updateTagsInFilterSummary();
        },

        updateMapInFilterSummary() {
            const mapContainer = document.querySelector('.filter-summary__map');
            if (mapContainer) {
                const currentRanges = JSON.stringify(gameState.selectedRanges);
                if (this.lastDrawnRanges !== currentRanges) {
                    mapContainer.innerHTML = '';
                    const selectedContinents = new Set(gameState.selectedRanges.map(abbr => getFullContinentName(abbr)));
                    createNonClickableWorldMap(mapContainer, selectedContinents);
                    this.lastDrawnRanges = currentRanges;
                }
            }
        },

        updateTagsInFilterSummary() {
            const tagsContainer = document.querySelector('.filter-summary__tags');
            if (tagsContainer) {
                tagsContainer.innerHTML = this.getTagsHTML();
            }
        },

        getTagsHTML() {
            return gameState.selectedTags.length > 0
                ? gameState.selectedTags
                    .map(tag => `<span class="filter-summary__tag">${tag}</span>`)
                    .join('')
                : '<span class="filter-summary__no-tags">No active tags</span>';
        },

        async createTaxonPairButton(pair) {
            const button = document.createElement('button');
            button.className = 'taxon-set-button';

            const vernacular1 = await this.getVernacularName(pair.taxonNames[0]);
            const vernacular2 = await this.getVernacularName(pair.taxonNames[1]);

            button.innerHTML = this.createButtonHTML(pair, vernacular1, vernacular2);
            button.onclick = () => this.handleTaxonPairSelection(pair);

            return button;
        },

        async getVernacularName(taxonName) {
            const result = await getCachedVernacularName(taxonName);
            return result === "n/a" ? "" : result;
        },

        createButtonHTML(pair, vernacular1, vernacular2) {
            return `
                <div class="taxon-set-container">
                    <div class="set-name-container">
                        <div class="taxon-set__set-name">${pair.setName || 'Unnamed Set'}</div>
                        <div class="taxon-set__level-chilis" aria-label="Skill level">${this.getChiliHtml(pair.level)}</div>
                        <div class="taxon-set__tags">${pair.tags.join(', ')}</div>
                    </div>
                    <div class="taxon-items">
                        ${this.createTaxonItemHTML(pair.taxonNames[0], vernacular1)}
                        ${this.createTaxonItemHTML(pair.taxonNames[1], vernacular2)}
                    </div>
                </div>
            `;
        },

        createTaxonItemHTML(taxonName, vernacularName) {
            return `
                <div class="taxon-item">
                    <div class="taxon-name">${taxonName}</div>
                    <div class="vernacular-name">${vernacularName}</div>
                </div>
            `;
        },

        handleTaxonPairSelection(pair) {
            const selectedPair = {
                taxon1: pair.taxonNames[0],
                taxon2: pair.taxonNames[1],
                setName: pair.setName,
                tags: [...pair.tags],
                setID: pair.setID,
                level: pair.level
            };
            game.setNextSelectedPair(selectedPair);
            logger.debug('Selected pair:', selectedPair);
            dialogManager.closeDialog('select-set-dialog');
            setTimeout(() => gameSetup.setupGame(true), 300);
        },

        loadMorePairs: async function (pairs, startIndex) {
            const list = document.getElementById('taxon-set-list');
            const nextPairs = pairs.slice(startIndex, startIndex + 20);

            for (const pair of nextPairs) {
                const button = await this.createTaxonPairButton(pair);
                list.insertBefore(button, list.lastChild);
            }

            this.updateLoadMoreButton(list, pairs, startIndex);
        },

        updateLoadMoreButton(list, pairs, startIndex) {
            if (startIndex + 20 >= pairs.length) {
                list.removeChild(list.lastChild);
            } else {
                const loadMoreButton = list.lastChild;
                loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, startIndex + 20));
            }
        },

        updateTaxonPairList: async function (filteredPairs) {
            const list = document.getElementById('taxon-set-list');
            list.innerHTML = '';

            logger.debug(`Updating taxon set list with ${filteredPairs ? filteredPairs.length : 0} pairs`);

            if (!filteredPairs || filteredPairs.length === 0) {
                this.displayNoResultsMessage(list);
            } else {
                await this.populateListWithPairs(list, filteredPairs);
            }

            this.updateActiveCollectionCount(filteredPairs ? filteredPairs.length : 0);
            this.updateFilterSummary();
        },

        displayNoResultsMessage(list) {
            const noResultsMessage = document.createElement('p');
            noResultsMessage.className = 'no-results-message';
            
            const hasActiveFilters = this.checkForActiveFilters();
            noResultsMessage.innerHTML = this.getNoResultsMessageContent(hasActiveFilters);
            
            list.appendChild(noResultsMessage);
        },

        checkForActiveFilters() {
            return gameState.selectedLevel !== '' || 
                   gameState.selectedRanges.length > 0 || 
                   gameState.selectedTags.length > 0;
        },

        getNoResultsMessageContent(hasActiveFilters) {
            return hasActiveFilters
                ? 'No matching sets found.<br><span class="filter-warning">You have active filters. Try clearing some filters at the top of this dialog to see more results.</span>'
                : 'No matching sets found.';
        },

        async populateListWithPairs(list, pairs) {
            for (const pair of pairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }
        },

        getChiliHtml: function (level) {
            const chiliCount = parseInt(level) || 0;
            return Array(chiliCount).fill('<svg class="icon taxon-set__icon-chili"><use href="./images/icons.svg#icon-spicy"/></svg>').join('');
        },

        focusSearchInput: function () {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    if (searchInput.value.length > 0) {
                        searchInput.select();
                    }
                    eventHandlers.setFocusLost(false);
                }, 100);
            }
        },

        updateActiveCollectionCount: function (count) {
            const countElement = document.getElementById('active-collection-count');
            if (countElement) {
                countElement.textContent = `Active collection: ${count} set${count !== 1 ? 's' : ''}`;
            }
        },

        updateVernacularNames: async function (button, pair) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            const vernacularElements = button.querySelectorAll('.vernacular-name');
            vernacularElements[0].textContent = vernacular1 || '';
            vernacularElements[1].textContent = vernacular2 || '';
        },
    },

    levelIndicator: {
        updateLevelIndicator(level) {
            const indicator = document.getElementById('level-indicator');
            if (!indicator) return;

            indicator.innerHTML = this.generateChiliIcons(level);
            this.adjustIndicatorWidth(indicator, level);
        },

        generateChiliIcons(level) {
            const chiliCount = parseInt(level) || 0;
            return Array(chiliCount).fill().map(() => this.createChiliSVG()).join('');
        },

        createChiliSVG() {
            return `
                <svg class="icon icon-chili" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <use xlink:href="./images/icons.svg#icon-spicy" transform="scale(1.2) translate(-2, -2)"></use>
                </svg>
            `;
        },

        adjustIndicatorWidth(indicator, level) {
            const chiliCount = parseInt(level) || 0;
            indicator.style.width = `${chiliCount * 26 + 16}px`;
        }
    },

    tutorial: {
        isActive: false,
        shouldContinue: false,

        showTutorial: function () {
            this.initializeTutorial();
            this.setupTutorialSteps();
            this.startTutorial();
        },

        initializeTutorial: function() {
            this.isActive = true;
            this.shouldContinue = true;
            this.disableInteractions();
            this.closeHelpDialog();
            this.showInitialOverlay();
            this.addCloseButton();
        },

        closeHelpDialog: function() {
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog && helpDialog.open) {
                helpDialog.close();
            }
        },

        showInitialOverlay: function() {
            ui.overlay.showOverlay("", config.overlayColors.green);
        },

        addCloseButton: function() {
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close Tutorial';
            closeButton.className = 'tutorial-close-button';
            closeButton.addEventListener('click', () => this.endTutorial());
            document.body.appendChild(closeButton);
        },

        setupTutorialSteps: function() {
            this.steps = [
                { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null, duration: 4000 },
                { message: "Learn to distinguish two different taxa.", highlights: ['#image-container-1', '#image-container-2'], duration: 5000 },
                { 
                    message: "Drag a name to the correct image.",
                    highlight: '.name-pair',
                    duration: 5000,
                    action: () => this.animateDragDemo()
                },
                { message: "If correct, play another round of the same set.", highlight: null, duration: 4000 },
                {
                    message: "Swipe left on an image for a new taxon set.",
                    highlight: null,
                    action: () => { this.tiltGameContainer(3200); },
                    duration: 6000
                },
                { message: "Get more info about a taxon.", highlights: ['#info-button-1', '#info-button-2'], duration: 6000 },
                { message: "Share the current set and collection.", highlight: '#share-button', duration: 6000 },
                { message: "Tap the menu for more functions.", highlight: '#menu-toggle', action: () => this.temporarilyOpenMenu(12000), duration: 6000 },
                { message: "Change difficulty, range or tags.", highlights: ['#level-indicator', '#select-set-button'], duration: 5000 },
                { message: "Ready to start?<br>Let's go!", highlight: null, duration: 2000 }
            ];
        },

        startTutorial: function() {
            this.currentStep = 0;
            this.highlightElements = [];
            this.showNextStep();
        },

        showNextStep: function() {
            if (this.currentStep < this.steps.length && this.shouldContinue) {
                const step = this.steps[this.currentStep];
                this.fadeOutOverlayMessage(() => {
                    this.updateStepContent(step);
                    this.fadeInOverlayMessage();
                    this.currentStep++;
                    setTimeout(() => this.showNextStep(), step.duration);
                });
            } else {
                this.endTutorial();
            }
        },

        updateStepContent: function(step) {
            ui.overlay.updateOverlayMessage(step.message);
            this.clearPreviousHighlights();
            this.addNewHighlights(step);
            if (step.action) {
                step.action();
            }
        },

        clearPreviousHighlights: function() {
            this.highlightElements.forEach(el => el.remove());
            this.highlightElements = [];
        },

        addNewHighlights: function(step) {
            if (step.highlight || step.highlights) {
                const highlights = step.highlight ? [step.highlight] : step.highlights;
                highlights.forEach(selector => {
                    const highlight = this.createHighlight(selector, step.duration);
                    if (highlight) this.highlightElements.push(highlight);
                });
            }
        },

        endTutorial: function() {
            this.isActive = false;
            this.shouldContinue = false;
            this.enableInteractions();
            this.fadeOutOverlayMessage(() => {
                ui.overlay.hideOverlay();
                const closeButton = document.querySelector('.tutorial-close-button');
                if (closeButton) closeButton.remove();
            });
            document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());
            
            eventHandlers.enableKeyboardShortcuts();
        },

        disableInteractions: function() {
            // Disable buttons and interactions
            document.querySelectorAll('button, .icon-button, .name-pair__item--draggable').forEach(el => {
                el.disabled = true;
                el.style.pointerEvents = 'none';
            });
            // Disable swipe functionality
            eventHandlers.disableSwipe();

            // Disable level indicator
            const levelIndicator = document.getElementById('level-indicator');
            if (levelIndicator) {
                levelIndicator.style.pointerEvents = 'none';
            }

            // Disable all buttons and clickable elements
            document.body.style.pointerEvents = 'none';

            eventHandlers.disableKeyboardShortcuts();

            // Enable pointer events only for the tutorial close button
            const closeButton = document.querySelector('.tutorial-close-button');
            if (closeButton) {
                closeButton.style.pointerEvents = 'auto';
            }
        },

        enableInteractions: function() {
            // Re-enable buttons and interactions
            document.querySelectorAll('button, .icon-button, .name-pair__item--draggable').forEach(el => {
                el.disabled = false;
                el.style.pointerEvents = 'auto';
            });
            // Re-enable swipe functionality
            eventHandlers.enableSwipe();

            // Re-enable level indicator
            const levelIndicator = document.getElementById('level-indicator');
            if (levelIndicator) {
                levelIndicator.style.pointerEvents = 'auto';
            }

            // Re-enable all buttons and clickable elements
            document.body.style.pointerEvents = 'auto';
        },

        fadeOutOverlayMessage: function (callback) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.style.transition = 'opacity 0.3s ease-out';
            overlayMessage.style.opacity = '0';
            setTimeout(() => {
                if (callback) callback();
            }, 300);
        },

        fadeInOverlayMessage: function () {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.style.transition = 'opacity 0.3s ease-in';
            overlayMessage.style.opacity = '1';
        },

        temporarilyOpenMenu: function (duration) {
            ui.menu.toggleMainMenu(); // Open the menu
            setTimeout(() => {
                ui.menu.close(); // Close the menu after the specified duration
            }, duration);
        },

        animateDragDemo: function() {
            return new Promise((resolve) => {
                const leftName = document.getElementById('left-name');
                const rightName = document.getElementById('right-name');
                const drop1 = document.getElementById('drop-1');
                const drop2 = document.getElementById('drop-2');

                // Store original positions
                const leftOriginalPos = leftName.getBoundingClientRect();
                const rightOriginalPos = rightName.getBoundingClientRect();

                // Function to animate an element
                const animate = (element, target, duration) => {
                    const start = element.getBoundingClientRect();
                    const diffX = target.left - start.left;
                    const diffY = target.top - start.top;

                    element.style.transition = `transform ${duration}ms ease-in-out`;
                    element.style.transform = `translate(${diffX}px, ${diffY}px)`;

                    return new Promise(resolve => setTimeout(resolve, duration));
                };

                // Sequence of animations
                Promise.resolve()
                    .then(() => animate(leftName, drop1.getBoundingClientRect(), 1000))
                    .then(() => animate(rightName, drop2.getBoundingClientRect(), 1000))
                    .then(() => new Promise(resolve => setTimeout(resolve, 1000))) // Pause
                    .then(() => {
                        leftName.style.transition = rightName.style.transition = 'transform 500ms ease-in-out';
                        leftName.style.transform = rightName.style.transform = '';
                    })
                    .then(() => new Promise(resolve => setTimeout(resolve, 500)))
                    .then(() => {
                        leftName.style.transition = rightName.style.transition = '';
                        resolve();
                    });
            });
        },

        // for tutorial demo
        tiltGameContainer: function (duration = 3200) {
            const gameContainer = document.querySelector('.game-container');
            const midpoint = duration / 2;

            // Initial tilt
            gameContainer.style.transition = `transform ${midpoint}ms ease-out, opacity ${midpoint}ms ease-out`;
            gameContainer.style.transform = 'rotate(-3deg) translateX(-50px)';
            gameContainer.style.opacity = '0.7';

            // Return to original position
            setTimeout(() => {
                gameContainer.style.transition = `transform ${midpoint}ms ease-in, opacity ${midpoint}ms ease-in`;
                gameContainer.style.transform = '';
                gameContainer.style.opacity = '';
            }, midpoint);

            // Clean up
            setTimeout(() => {
                gameContainer.style.transition = '';
            }, duration);
        },

        createHighlight: function (targetSelector, duration) {
            const target = document.querySelector(targetSelector);
            if (!target) {
                logger.error(`Target element not found: ${targetSelector}`);
                return null;
            }
            const highlight = document.createElement('div');
            highlight.className = 'tutorial-highlight';
            document.body.appendChild(highlight);
            const targetRect = target.getBoundingClientRect();

            // Set position and size
            highlight.style.width = `${targetRect.width}px`;
            highlight.style.height = `${targetRect.height}px`;
            highlight.style.top = `${targetRect.top}px`;
            highlight.style.left = `${targetRect.left}px`;

            // Calculate animation properties
            const animationDuration = 1; // seconds
            const iterationCount = Math.floor(duration / 1000 / animationDuration);
            
            // Set animation properties
            highlight.style.animationDuration = `${animationDuration}s`;
            highlight.style.animationIterationCount = iterationCount;

            // Special handling for level indicator
            if (targetSelector === '#level-indicator') {
                highlight.style.borderRadius = '20px';
            } else if (target.classList.contains('icon-button')) {
                highlight.style.borderRadius = '50%';
            }

            return highlight;
        },
    },

    notifications: {
        showPopupNotification(message, duration = 3000) {
            const popup = this.createPopup(message);
            this.showPopup(popup);
            this.schedulePopupRemoval(popup, duration);
        },

        createPopup(message) {
            const popup = document.createElement('div');
            popup.className = 'popup-notification';
            popup.textContent = message;
            document.body.appendChild(popup);
            return popup;
        },

        showPopup(popup) {
            // Trigger a reflow before adding the 'show' class
            popup.offsetHeight;
            popup.classList.add('show');
        },

        schedulePopupRemoval(popup, duration) {
            setTimeout(() => {
                this.removePopup(popup);
            }, duration);
        },

        removePopup(popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(popup);
            }, 300); // Wait for the fade out animation to complete
        },
    },

    filters: {
        updateLevelDropdown() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.value = gameState.selectedLevel;
            }
        },

        getLevelText(level) {
            const levelTexts = {
                '1': 'Easy',
                '2': 'Medium',
                '3': 'Hard',
            };
            return levelTexts[level] || 'Unknown';
        },
    },

};

bindAllMethods(ui);

const publicAPI = {
    // Overlay
    showOverlay: ui.overlay.showOverlay,
    updateOverlayMessage: ui.overlay.updateOverlayMessage,
    hideOverlay: ui.overlay.hideOverlay,
    // Taxon pairs
    showTaxonPairList: ui.taxonPairList.showTaxonPairList,
    updateTaxonPairList: ui.taxonPairList.updateTaxonPairList,
    renderTaxonPairList: ui.taxonPairList.renderTaxonPairList,
    // Menu
    toggleMainMenu: ui.menu.toggleMainMenu,
    closeMenu: ui.menu.close,
    //Tutorial
    isTutorialActive() {
        return ui.tutorial.isActive;
    },
    showTutorial: ui.tutorial.showTutorial,
    // Core
    resetUIState: ui.core.resetUIState,
    initialize: ui.core.initialize,
    // Level
    updateLevelIndicator: ui.levelIndicator.updateLevelIndicator,
    updateLevelDropdown: ui.filters.updateLevelDropdown,
    // Misc
    updateFilterSummary: ui.taxonPairList.updateFilterSummary,
    updateActiveCollectionCount: ui.taxonPairList.updateActiveCollectionCount,
    showPopupNotification: ui.notifications.showPopupNotification,
};

export default publicAPI;
//export default ui;

