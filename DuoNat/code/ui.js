import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState } from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import tagCloud from './tagCloud.js';
import utils from './utils.js';

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName) || 'n/a';
}

const ui = {
    isMenuOpen: false,

    resetUIState: function () {
        this.closeMainMenu();
        // Add any other UI state resets here if needed
    },

    resetGameContainerStyle: function () {
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

    // display pair list for selection
    showTaxonPairList: async function () {
        try {
            const taxonPairs = await api.fetchTaxonPairs();
            if (taxonPairs.length === 0) {
                logger.error("No taxon pairs available");
                return;
            }

            const list = document.getElementById('taxon-set-list');
            list.innerHTML = ''; // Clear existing content

            // Filter pairs based on selected tags, level, and ranges
            const selectedTags = gameState.selectedTags;
            const selectedLevel = gameState.selectedLevel;
            const selectedRanges = gameState.selectedRanges || []; // Add this line
            let filteredPairs = tagCloud.filterTaxonPairs(taxonPairs, selectedTags, selectedLevel, selectedRanges);

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

    updateLevelDropdown: function () {
        const levelDropdown = document.getElementById('level-filter-dropdown');
        if (levelDropdown) {
            levelDropdown.value = gameState.selectedLevel;
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
        const visiblePairs = pairs.slice(0, 20); // Render first 20 pairs

        for (const pair of visiblePairs) {
            const button = await this.createTaxonPairButton(pair);
            list.appendChild(button);
        }

        // Implement lazy loading for remaining pairs
        if (pairs.length > 20) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Load More';
            loadMoreButton.className = 'load-more-button'; // Add this line
            loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, 20));
            list.appendChild(loadMoreButton);
        }
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

        logger.debug(`Updating taxon pair list with ${filteredPairs ? filteredPairs.length : 0} pairs`);

        if (!filteredPairs || filteredPairs.length === 0) {
            const noResultsMessage = document.createElement('p');
            noResultsMessage.textContent = 'No matching pairs found.';
            noResultsMessage.className = 'no-results-message';
            list.appendChild(noResultsMessage);
        } else {
            for (const pair of filteredPairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }
        }

        // Update the count
        this.updateActiveCollectionCount(filteredPairs ? filteredPairs.length : 0);
    },

    createTaxonPairButton: async function (pair) {
        const button = document.createElement('button');
        button.className = 'taxon-set-button';

        let result = await getCachedVernacularName(pair.taxon1);
        const vernacular1 = result === "n/a" ? "" : result;

        result = await getCachedVernacularName(pair.taxon2);
        const vernacular2 = result === "n/a" ? "" : result;

        const chiliHtml = this.getChiliHtml(pair.skillLevel);

        button.innerHTML = `
            <div class="taxon-set-container">
                <div class="taxon-set-info">
                    <div class="set-name-container">
                        <div class="set-name">${pair.setName || 'Unnamed Set'}</div>
                        <div class="skill-level-chilis" aria-label="Skill level">${chiliHtml}</div>
                    </div>
                    <div class="tags">${pair.tags.join(', ')}</div>
                </div>
                <div class="taxon-item">
                    <div class="taxon-name">${pair.taxon1}</div>
                    <div class="vernacular-name">${vernacular1}</div>
                </div>
                <div class="taxon-item">
                    <div class="taxon-name">${pair.taxon2}</div>
                    <div class="vernacular-name">${vernacular2}</div>
                </div>
            </div>
        `;

        button.onclick = () => {
            // Create a new object with the pair data to ensure we're not using a reference
            const selectedPair = {
                taxon1: pair.taxon1,
                taxon2: pair.taxon2,
                setName: pair.setName,
                tags: [...pair.tags],
                setID: pair.setID,
                skillLevel: pair.skillLevel
            };

            game.nextSelectedPair = selectedPair;
            logger.debug('Selected pair:', selectedPair);

//            logger.debug('Attempting to close select-set-dialog');
            dialogManager.closeDialog('select-set-dialog');

            setTimeout(() => {
 //               logger.debug('Setting up game after dialog close');
                gameSetup.setupGame(true);
            }, 300);
        };

        return button;
    },

    getChiliHtml: function (skillLevel) {
        const chiliCount = parseInt(skillLevel) || 0;
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

    getLevelText(level) {
        switch (level) {
            case '1': return 'Easy';
            case '2': return 'Medium';
            case '3': return 'Hard';
            default: return 'Unknown';
        }
    },

    updateVernacularNames: async function (button, pair) {
        const vernacular1 = await getCachedVernacularName(pair.taxon1);
        const vernacular2 = await getCachedVernacularName(pair.taxon2);

        const vernacularElements = button.querySelectorAll('.vernacular-name');
        vernacularElements[0].textContent = vernacular1 || '';
        vernacularElements[1].textContent = vernacular2 || '';
    },

    showOverlay: function (message = "", color) {
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

    // Update this method to change only the message, not the visibility
    updateOverlayMessage: function (message) {
        const overlayMessage = document.getElementById('overlay-message');
        overlayMessage.innerHTML = message;

        // Adjust font size for longer messages
        if (message.length > 20) {
            overlayMessage.style.fontSize = '1.6em';
        } else {
            overlayMessage.style.fontSize = '2.4em';
        }
    },

    hideOverlay: function () {
        elements.overlay.classList.remove('show');
    },

    showINatDownDialog: function () {
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
                game.setupGame(true);
            } else {
                this.showINatDownDialog();
            }
        };

        checkStatusBtn.addEventListener('click', checkStatusHandler);
        retryConnectionBtn.addEventListener('click', retryConnectionHandler);
    },

    hideINatDownDialog: function () {
        dialogManager.closeDialog();
    },

  showTutorial: function () {
    const steps = [
      { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null, duration: 4000 },
      { message: "You'll see two images of different taxa.", highlights: ['#image-container-1', '#image-container-2'], duration: 5000 },
      { message: "Drag a name to the correct image.", highlight: '.name-pair', duration: 5000 },
      { message: "If correct, you'll move to the next round.", highlight: null, duration: 4000 },
      {
        message: "Swipe left on an image for a new taxon set.",
        highlight: null,
        action: () => { this.tiltGameContainer(3200); },
        duration: 6000
      },
      { message: "Get more info about a taxon.", highlights: ['#info-button-1', '#info-button-2'], duration: 6000 },
      { message: "Share the current pair and collection", highlight: '#share-button', duration: 6000 },
      { message: "Tap the menu for more functions.", highlight: '#menu-toggle', action: () => this.temporarilyOpenMenu(12000), duration: 6000 },
      { message: "Set difficulty, range or topic here.", highlights: ['#skill-level-indicator', '#select-set-button'], duration: 5000 },
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
        
        if (targetSelector === '#skill-level-indicator') {
            // Create a custom shape for skill-level-indicator
            highlight.style.width = `${targetRect.width}px`;
            highlight.style.height = `${targetRect.height}px`;
            highlight.style.top = `${targetRect.top}px`;
            highlight.style.left = `${targetRect.left}px`;
            highlight.style.borderRadius = '20px'; // Match the skill-level-indicator's border-radius
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

    toggleKeyboardShortcuts: function () {
        logger.debug("toggling Keyboard shortcuts");
        const keyboardShortcutsSection = document.getElementById('keyboard-shortcuts');
        if (utils.hasKeyboard()) {
            keyboardShortcutsSection.style.display = 'block';
        } else {
            keyboardShortcutsSection.style.display = 'none';
        }
    },

    initializeHelpDialog: function () {
        document.getElementById('help-button').addEventListener('click', () => {
            dialogManager.openDialog('help-dialog');
            this.toggleKeyboardShortcuts();
        });
    },

    initializeInfoDialog: function () {
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

    showPopupNotification: function(message, duration = 3000) {
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

    // main menu code:
    initializeMainMenu: function () {
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', (event) => {
                //                logger.debug('Menu toggle button or its child clicked');
                event.stopPropagation();
                this.toggleMainMenu();
            });
        } else {
            logger.error('Menu toggle button not found');
        }

        window.addEventListener('resize', this.positionBottomGroup.bind(this));

        // Call once to set initial position
        this.positionBottomGroup();

        // Close the dropdown when clicking outside of it
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.main-menu')) {
                this.closeMainMenu();
            }
        });
    },

    toggleMainMenu: function () {
        this.isMenuOpen = !this.isMenuOpen;

        const topGroup = document.querySelector('.main-menu__dropdown--top');
        const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');

        if (topGroup && bottomGroup) {
            topGroup.classList.toggle('show');
            bottomGroup.classList.toggle('show');
            //            logger.debug("Show classes toggled");

            if (this.isMenuOpen) {
                this.positionBottomGroup();
            }
        } else {
            logger.error('Dropdown groups not found');
        }
    },

    positionBottomGroup: function () {
        const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
        const lowerImageContainer = document.querySelector('#image-container-2');

        if (bottomGroup && lowerImageContainer) {
            const rect = lowerImageContainer.getBoundingClientRect();
            bottomGroup.style.top = `${rect.top}px`;
            bottomGroup.style.right = `0px`; // Adjust if needed
        }
    },

    closeMainMenu: function () {
        if (this.isMenuOpen) {
            const topGroup = document.querySelector('.main-menu__dropdown--top');
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
            if (topGroup && bottomGroup) {
                this.isMenuOpen = false;
                topGroup.classList.remove('show');
                bottomGroup.classList.remove('show');
            }
        }
    },

    initialize: function () {
        this.initializeHelpDialog();
        this.initializeInfoDialog();
        this.initializeMainMenu();
        this.closeMainMenu(); // Ensure menu is closed on initialization
        // Close the dropdown when clicking outside of it
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.main-menu')) {
                this.closeMainMenu();
            }
        });
    },

};

export default ui;

