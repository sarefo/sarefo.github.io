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
            ui.menu.initialize();
            ui.menu.close(); // Ensure menu is closed on initialization
            // Close the dropdown when clicking outside of it
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
        initialize() {
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
                    ui.menu.close();
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

        close() {
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

    taxonPairList: {
        // display pair list for selection
        showTaxonPairList: async function () {
            try {
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
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

                // Get the current active set
                const currentActiveSet = gameState.currentTaxonImageCollection?.pair;

                // If there's an active set, move it to the beginning of the list
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

                const taxonSetList = document.getElementById('taxon-set-list');
                if (taxonSetList) {
                    taxonSetList.scrollTop = 0;
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
                    <div class="set-name-container">
                        <div class="taxon-set__set-name">${pair.setName || 'Unnamed Set'}</div>
                        <div class="taxon-set__level-chilis" aria-label="Skill level">${chiliHtml}</div>
                        <div class="taxon-set__tags">${pair.tags.join(', ')}</div>
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

    tutorial: {
        isActive: false,
        shouldContinue: false,

        showTutorial: function () {

            this.isActive = true;
            this.shouldContinue = true;
            this.disableInteractions();

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
                if (currentStep < steps.length && this.shouldContinue) {
                    const step = steps[currentStep];

                    // Fade out current message
                    this.fadeOutOverlayMessage(() => {
                        // Update message content
                        ui.overlay.updateOverlayMessage(step.message);

                        // Clear previous highlights
                        highlightElements.forEach(el => el.remove());
                        highlightElements = [];

                        // Add new highlights
                        if (step.highlight || step.highlights) {
                            const highlights = step.highlight ? [step.highlight] : step.highlights;
                            highlights.forEach(selector => {
                                const highlight = this.createHighlight(selector, step.duration);
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
                    this.endTutorial();
                }
            };

            // Close the help dialog before starting the tutorial
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog && helpDialog.open) {
                helpDialog.close();
            }

            // Show the overlay at the start of the tutorial
            ui.overlay.showOverlay("", config.overlayColors.green);

            // Add close button to the overlay
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close Tutorial';
            closeButton.className = 'tutorial-close-button';
            closeButton.addEventListener('click', () => this.endTutorial());
            document.body.appendChild(closeButton);

            // Start the tutorial
            showStep();
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

    levelIndicator: {
        updateLevelIndicator(level) {
            const indicator = document.getElementById('level-indicator');
            if (!indicator) return;

            const chiliCount = parseInt(level) || 0;
            indicator.innerHTML = ''; // Clear existing content

            for (let i = 0; i < chiliCount; i++) {
                const chiliSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                chiliSvg.classList.add('icon', 'icon-chili');
                chiliSvg.setAttribute('viewBox', '0 0 24 24');

                const useElement = document.createElementNS("http://www.w3.org/2000/svg", "use");
                useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', './images/icons.svg#icon-spicy');

                useElement.setAttribute('transform', 'scale(1.2) translate(-2, -2)'); // enlarge a bit

                chiliSvg.appendChild(useElement);
                indicator.appendChild(chiliSvg);
            }

            // Adjust container width based on number of chilis
            indicator.style.width = `${chiliCount * 26 + 16}px`; // Adjusted width calculation
        }
    },

};

bindAllMethods(ui);

export default ui;
