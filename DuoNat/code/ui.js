import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState } from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import tagCloud from './tagCloud.js';
import utils from './utils.js';
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
        const vernacularName = await api.fetchVernacular(taxonName);
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
            ui.dialogs.initializeHelpDialog();
            ui.dialogs.initializeInfoDialog();
            ui.menu.initializeMainMenu();
            ui.menu.closeMainMenu(); // Ensure menu is closed on initialization
            // Close the dropdown when clicking outside of it
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.main-menu')) {
                    ui.menu.closeMainMenu();
                }
            });
        },

        resetUIState() {
            ui.menu.closeMainMenu();
            // Add any other UI state resets here if needed
        },

        resetGameContainerStyle() {
            const gameContainer = document.querySelector('.game-container');
            if (gameContainer) {
                gameContainer.style.transform = '';
                gameContainer.style.opacity = '';
            }
            elements.imageOneContainer.style.transform = '';
            elements.imageOneContainer.style.opacity = '';
            elements.imageTwoContainer.style.transform = '';
            elements.imageTwoContainer.style.opacity = '';
        },
    },

    overlay: {
        showOverlay(message = "", color) {
            elements.overlayMessage.innerHTML = message;
            elements.overlay.style.backgroundColor = color;
            elements.overlay.classList.add('show');

            // Adjust font size for longer messages
            if (message.length > 20) {
                elements.overlayMessage.style.fontSize = '1.4em';
            } else {
                elements.overlayMessage.style.fontSize = '2.4em';
            }
        },

        updateOverlayMessage(message) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.innerHTML = message;

            // Adjust font size for longer messages
            if (message.length > 20) {
                overlayMessage.style.fontSize = '1.6em';
            } else {
                overlayMessage.style.fontSize = '2.4em';
            }
        },

        hideOverlay() {
            elements.overlay.classList.remove('show');
        },
    },

    menu: {
        initializeMainMenu() {
            const menuToggle = document.getElementById('menu-toggle');
            if (menuToggle) {
                menuToggle.addEventListener('click', (event) => {
                    event.stopPropagation();
                    ui.menu.toggleMainMenu();
                });
            } else {
                logger.error('Menu toggle button not found');
            }

            window.addEventListener('resize', () => ui.menu.positionBottomGroup());

            // Call once to set initial position
            ui.menu.positionBottomGroup();

            // Close the dropdown when clicking outside of it
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.main-menu')) {
                    ui.menu.closeMainMenu();
                }
            });
        },

        toggleMainMenu() {
            ui.state.isMenuOpen = !ui.state.isMenuOpen;

            const topGroup = document.querySelector('.main-menu__dropdown--top');
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');

            if (topGroup && bottomGroup) {
                topGroup.classList.toggle('show');
                bottomGroup.classList.toggle('show');

                if (ui.state.isMenuOpen) {
                    ui.menu.positionBottomGroup();
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
                bottomGroup.style.right = `0px`; // Adjust if needed
            }
        },

        closeMainMenu() {
            if (ui.state.isMenuOpen) {
                const topGroup = document.querySelector('.main-menu__dropdown--top');
                const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
                if (topGroup && bottomGroup) {
                    ui.state.isMenuOpen = false;
                    topGroup.classList.remove('show');
                    bottomGroup.classList.remove('show');
                }
            }
        },
    },

    dialogs: {
        initializeHelpDialog() {
            document.getElementById('help-button').addEventListener('click', () => {
                dialogManager.openDialog('help-dialog');
                this.toggleKeyboardShortcuts();
            });
        },

        initializeInfoDialog() {
            const infoDialog = document.getElementById('info-dialog');

            // Check if the device has a keyboard
            if (utils.hasKeyboard()) {
                document.body.classList.add('has-keyboard');
            }

            const handleKeyPress = (event) => {
                if (!infoDialog.open) return; // Only handle keypresses when the dialog is open

                // Ignore keypress events if the active element is a text input or textarea
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                    return;
                }

                if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
                    return; // Exit the function if any modifier key is pressed
                }

                event.stopPropagation();
                const key = event.key.toLowerCase();
                const buttonMap = {
                    'p': 'photo-button',
                    'h': 'hints-button',
                    'o': 'observation-button',
                    't': 'taxon-button',
                    'w': 'wiki-button',
                    'r': 'report-button'
                };

                if (buttonMap[key]) {
                    event.preventDefault();
                    document.getElementById(buttonMap[key]).click();
                } else if (key === 'escape') {
                    event.preventDefault();
                    infoDialog.close();
                }
            };

            const reportButton = document.getElementById('report-button');
            reportButton.addEventListener('click', () => {
                dialogManager.closeDialog('info-dialog');
                dialogManager.openDialog('report-dialog');
            });

            document.addEventListener('keydown', handleKeyPress);
        },

        toggleKeyboardShortcuts() {
            logger.debug("toggling Keyboard shortcuts");
            const keyboardShortcutsSection = document.getElementById('keyboard-shortcuts');
            if (utils.hasKeyboard()) {
                keyboardShortcutsSection.style.display = 'block';
            } else {
                keyboardShortcutsSection.style.display = 'none';
            }
        },

        showINatDownDialog() {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }

            dialogManager.openDialog('inat-down-dialog');

            const checkStatusBtn = document.getElementById('check-inat-status');
            const retryConnectionBtn = document.getElementById('retry-connection');

            const checkStatusHandler = () => {
                window.open('https://inaturalist.org', '_blank');
            };

            const retryConnectionHandler = async () => {
                dialogManager.closeDialog();
                if (await api.isINaturalistReachable()) {
                    gameSetup.setupGame(true);
                } else {
                    this.showINatDownDialog();
                }
            };

            checkStatusBtn.addEventListener('click', checkStatusHandler);
            retryConnectionBtn.addEventListener('click', retryConnectionHandler);
        },

        hideINatDownDialog() {
            dialogManager.closeDialog();
        },
    },

    taxonPairList: {
        // display pair list for selection
        showTaxonPairList: async function () {
            try {
                const taxonPairs = await api.fetchTaxonPairs();
                if (taxonPairs.length === 0) {
                    logger.error("No taxon pairs available");
                    return;
                }

                const filters = {
                    level: gameState.selectedLevel,
                    ranges: gameState.selectedRanges,
                    tags: gameState.selectedTags
                };

                let filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);

                const list = document.getElementById('taxon-set-list');
                if (list) {
                    list.innerHTML = '';
                }

                // Render only visible pairs initially
                await this.renderVisibleTaxonPairs(filteredPairs);

                // Update the count
                this.updateActiveCollectionCount(filteredPairs.length);

                // Set the correct value in the level dropdown
                const levelDropdown = document.getElementById('level-filter-dropdown');
                if (levelDropdown) {
                    levelDropdown.value = gameState.selectedLevel;
                }

                dialogManager.openDialog('select-set-dialog');
                this.updateFilterSummary();
                // Focus on the search input after opening the dialog
                this.focusSearchInput();

                // Trigger the search if there's text in the search input
                const searchInput = document.getElementById('taxon-search');
                if (searchInput && searchInput.value.trim() !== '') {
                    const event = new Event('input', { bubbles: true, cancelable: true });
                    searchInput.dispatchEvent(event);
                }

                // Show/hide clear button based on search input content
                const clearButton = document.getElementById('clear-search');
                if (clearButton) {
                    clearButton.style.display = searchInput.value.trim() !== '' ? 'block' : 'none';
                }
            } catch (error) {
                logger.error("Error in showTaxonPairList:", error);
            }
        },

        renderTaxonPairList: async function (pairs) {
            const list = document.getElementById('taxon-set-list');
            list.innerHTML = ''; // Clear existing content

            if (pairs.length === 0) {
                const noResultsMessage = document.createElement('p');
                noResultsMessage.textContent = 'No matching pairs found.';
                noResultsMessage.className = 'no-results-message';
                list.appendChild(noResultsMessage);
            } else {
                for (const pair of pairs) {
                    const button = await this.createTaxonPairButton(pair);
                    list.appendChild(button);
                }
            }

            // Update the count
            this.updateActiveCollectionCount(pairs.length);
        },

        renderVisibleTaxonPairs: async function (pairs) {
            const list = document.getElementById('taxon-set-list');
            if (!list) return;

            // Clear the list again, just to be safe
            list.innerHTML = '';

            const visiblePairs = pairs.slice(0, 20); // Render first 20 pairs

            for (const pair of visiblePairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }

            // Implement lazy loading for remaining pairs
            if (pairs.length > 20) {
                const loadMoreButton = document.createElement('button');
                loadMoreButton.textContent = 'Load More';
                loadMoreButton.className = 'load-more-button';
                loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, 20));
                list.appendChild(loadMoreButton);
            }
        },

        updateFilterSummary() {
            const mapContainer = document.querySelector('.filter-summary__map');
            const tagsContainer = document.querySelector('.filter-summary__tags');

            if (mapContainer) {
                // Only redraw the map if the selected ranges have changed
                const currentRanges = JSON.stringify(gameState.selectedRanges);
                if (this.lastDrawnRanges !== currentRanges) {
                    mapContainer.innerHTML = '';
                    const selectedContinents = new Set(gameState.selectedRanges.map(abbr => getFullContinentName(abbr)));
                    createNonClickableWorldMap(mapContainer, selectedContinents);
                    this.lastDrawnRanges = currentRanges;
                }
            }

            if (tagsContainer) {
                tagsContainer.innerHTML = gameState.selectedTags.length > 0
                    ? gameState.selectedTags
                        .map(tag => `<span class="filter-summary__tag">${tag}</span>`)
                        .join('')
                    : '<span class="filter-summary__no-tags">No active tags</span>';
            }
        },

        createTaxonPairButton: async function (pair) {
            const button = document.createElement('button');
            button.className = 'taxon-set-button';

            let result = await getCachedVernacularName(pair.taxonNames[0]);
            const vernacular1 = result === "n/a" ? "" : result;

            result = await getCachedVernacularName(pair.taxonNames[1]);
            const vernacular2 = result === "n/a" ? "" : result;

            const chiliHtml = this.getChiliHtml(pair.level);

            button.innerHTML = `
                <div class="taxon-set-container">
                    <div class="taxon-set-info">
                        <div class="set-name-container">
                            <div class="taxon-set__set-name">${pair.setName || 'Unnamed Set'}</div>
                            <div class="taxon-set__level-chilis" aria-label="Skill level">${chiliHtml}</div>
                            <div class="taxon-set__tags">${pair.tags.join(', ')}</div>
                        </div>
                    </div>
                    <div class="taxon-items">
                        <div class="taxon-item">
                            <div class="taxon-name">${pair.taxonNames[0]}</div>
                            <div class="vernacular-name">${vernacular1}</div>
                        </div>
                        <div class="taxon-item">
                            <div class="taxon-name">${pair.taxonNames[1]}</div>
                            <div class="vernacular-name">${vernacular2}</div>
                        </div>
                    </div>
                </div>
            `;

            button.onclick = () => {
                // Create a new object with the pair data to ensure we're not using a reference
                const selectedPair = {
                    taxon1: pair.taxonNames[0],
                    taxon2: pair.taxonNames[1],
                    setName: pair.setName,
                    tags: [...pair.tags],
                    setID: pair.setID,
                    level: pair.level
                };

                game.nextSelectedPair = selectedPair;
                logger.debug('Selected pair:', selectedPair);

                dialogManager.closeDialog('select-set-dialog');

                setTimeout(() => {
                    gameSetup.setupGame(true);
                }, 300);
            };

            return button;
        },

        loadMorePairs: async function (pairs, startIndex) {
            const list = document.getElementById('taxon-set-list');
            const nextPairs = pairs.slice(startIndex, startIndex + 20);

            for (const pair of nextPairs) {
                const button = await this.createTaxonPairButton(pair);
                list.insertBefore(button, list.lastChild);
            }

            if (startIndex + 20 >= pairs.length) {
                list.removeChild(list.lastChild); // Remove "Load More" button
            } else {
                const loadMoreButton = list.lastChild;
                loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, startIndex + 20));
            }
        },

        updateTaxonPairList: async function (filteredPairs) {
            const list = document.getElementById('taxon-set-list');
            list.innerHTML = ''; // Clear existing content

            logger.debug(`Updating taxon set list with ${filteredPairs ? filteredPairs.length : 0} pairs`);

            if (!filteredPairs || filteredPairs.length === 0) {
                const noResultsMessage = document.createElement('p');
                noResultsMessage.className = 'no-results-message';
                
                // Check if any filters are active
                const hasActiveFilters = gameState.selectedLevel !== '' || 
                                         gameState.selectedRanges.length > 0 || 
                                         gameState.selectedTags.length > 0;

                if (hasActiveFilters) {
                    noResultsMessage.innerHTML = 'No matching sets found.<br><span class="filter-warning">You have active filters. Try clearing some filters at the top of this dialog to see more results.</span>';
                } else {
                    noResultsMessage.textContent = 'No matching sets found.';
                }
                
                list.appendChild(noResultsMessage);
            } else {
                for (const pair of filteredPairs) {
                    const button = await this.createTaxonPairButton(pair);
                    list.appendChild(button);
                }
            }

            // Update the count
            this.updateActiveCollectionCount(filteredPairs ? filteredPairs.length : 0);
            this.updateFilterSummary();
        },

        getChiliHtml: function (level) {
            const chiliCount = parseInt(level) || 0;
            let chiliHtml = '';
            for (let i = 0; i < chiliCount; i++) {
                chiliHtml += '<svg class="icon taxon-set__icon-chili"><use href="./images/icons.svg#icon-spicy"/></svg>';
            }
            return chiliHtml;
        },

        focusSearchInput: function () {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    if (searchInput.value.length > 0) {
                        searchInput.select();
                    }
                    // Assuming eventHandlers is accessible here, if not, you may need to expose this flag differently
                    eventHandlers.hasLostFocus = false;
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

    tutorial: {
        showTutorial: function () {
            const steps = [
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

            let currentStep = 0;
            let highlightElements = [];

            const showStep = () => {
                if (currentStep < steps.length) {
                    const step = steps[currentStep];

                    // Fade out current message
                    this.fadeOutOverlayMessage(() => {
                        // Update message content
                        this.updateOverlayMessage(step.message);

                        // Clear previous highlights
                        highlightElements.forEach(el => el.remove());
                        highlightElements = [];

                        // Add new highlights
                        if (step.highlight) {
                            const highlight = this.createHighlight(step.highlight);
                            if (highlight) highlightElements.push(highlight);
                        } else if (step.highlights) {
                            step.highlights.forEach(selector => {
                                const highlight = this.createHighlight(selector);
                                if (highlight) highlightElements.push(highlight);
                            });
                        }

                        // Perform any additional actions
                        if (step.action) {
                            step.action();
                        }

                        // Fade in new message
                        this.fadeInOverlayMessage();

                        currentStep++;
                        setTimeout(showStep, step.duration);
                    });
                } else {
                    this.fadeOutOverlayMessage(() => {
                        this.hideOverlay();
                        highlightElements.forEach(el => el.remove());
                    });
                }
            };

            // Close the help dialog before starting the tutorial
            //document.getElementById('help-dialog').close();
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog && helpDialog.open) {
                helpDialog.close();
                // If you have any custom close logic, call it here
                // For example: dialogManager.handleDialogClose('help-dialog');
            }
            // Show the overlay at the start of the tutorial
            this.showOverlay("", config.overlayColors.green);

            // Start the tutorial
            showStep();
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
            this.toggleMainMenu(); // Open the menu
            setTimeout(() => {
                this.closeMainMenu(); // Close the menu after the specified duration
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

        createHighlight: function (targetSelector) {
            const target = document.querySelector(targetSelector);
            if (!target) {
                logger.error(`Target element not found: ${targetSelector}`);
                return null;
            }
            const highlight = document.createElement('div');
            highlight.className = 'tutorial-highlight';
            document.body.appendChild(highlight);
            const targetRect = target.getBoundingClientRect();

            if (targetSelector === '#level-indicator') {
                // Create a custom shape for level-indicator
                highlight.style.width = `${targetRect.width}px`;
                highlight.style.height = `${targetRect.height}px`;
                highlight.style.top = `${targetRect.top}px`;
                highlight.style.left = `${targetRect.left}px`;
                highlight.style.borderRadius = '20px'; // Match the level-indicator's border-radius
            } else {
                // Default highlight behavior for other elements
                highlight.style.width = `${targetRect.width}px`;
                highlight.style.height = `${targetRect.height}px`;
                highlight.style.top = `${targetRect.top}px`;
                highlight.style.left = `${targetRect.left}px`;

                if (target.classList.contains('icon-button')) {
                    highlight.style.borderRadius = '50%';
                }
                highlight.style.animation = 'pulse-highlight 1.5s infinite';
            }

            return highlight;
        },

    },

    notifications: {
        showPopupNotification(message, duration = 3000) {
            const popup = document.createElement('div');
            popup.className = 'popup-notification';
            popup.textContent = message;

            document.body.appendChild(popup);

            // Trigger a reflow before adding the 'show' class
            popup.offsetHeight;

            popup.classList.add('show');

            setTimeout(() => {
                popup.classList.remove('show');
                setTimeout(() => {
                    document.body.removeChild(popup);
                }, 300); // Wait for the fade out animation to complete
            }, duration);
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
            switch (level) {
                case '1': return 'Easy';
                case '2': return 'Medium';
                case '3': return 'Hard';
                default: return 'Unknown';
            }
        },
    },

};

bindAllMethods(ui);

export default ui;
