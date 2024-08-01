import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState } from './state.js';
import game from './game.js';
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

    resetUIState: function() {
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

            const list = document.getElementById('taxon-pair-list');
            list.innerHTML = ''; // Clear existing content

            // Filter pairs based on selected tags
            const selectedTags = tagCloud.getSelectedTags();
            let filteredPairs = taxonPairs;
            if (selectedTags.length > 0) {
                filteredPairs = taxonPairs.filter(pair => 
                    pair.tags.some(tag => selectedTags.includes(tag))
                );
            }

            // Render only visible pairs initially
            await this.renderVisibleTaxonPairs(filteredPairs);

            dialogManager.openDialog('select-pair-dialog');
        } catch (error) {
            logger.error("Error in showTaxonPairList:", error);
        }
    },

    renderTaxonPairList: async function(pairs) {
        const list = document.getElementById('taxon-pair-list');
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
    },

    renderVisibleTaxonPairs: async function(pairs) {
        const list = document.getElementById('taxon-pair-list');
        const visiblePairs = pairs.slice(0, 20); // Render first 20 pairs

        for (const pair of visiblePairs) {
            const button = await this.createTaxonPairButton(pair);
            list.appendChild(button);
        }

        // Implement lazy loading for remaining pairs
        if (pairs.length > 20) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Load More';
            loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, 20));
            list.appendChild(loadMoreButton);
        }
    },

    loadMorePairs: async function(pairs, startIndex) {
        const list = document.getElementById('taxon-pair-list');
        const nextPairs = pairs.slice(startIndex, startIndex + 20);

        for (const pair of nextPairs) {
            const button = await this.createTaxonPairButton(pair);
            list.insertBefore(button, list.lastChild);
        }

        if (startIndex + 20 >= pairs.length) {
            list.removeChild(list.lastChild); // Remove "Load More" button
        } else {
            list.lastChild.addEventListener('click', () => this.loadMorePairs(pairs, startIndex + 20));
        }
    },

    updateTaxonPairList: async function(filteredPairs) {
        const list = document.getElementById('taxon-pair-list');
        list.innerHTML = ''; // Clear existing content
        
        if (filteredPairs.length === 0) {
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
    },

    createTaxonPairButton: async function(pair) {
        const button = document.createElement('button');
        button.className = 'taxon-set-button';

        let result = await getCachedVernacularName(pair.taxon1);
        const vernacular1 = result === "n/a" ? "" : result;

        result = await getCachedVernacularName(pair.taxon2);
        const vernacular2 = result === "n/a" ? "" : result;

        button.innerHTML = `
            <div class="taxon-set-container">
                <div class="taxon-set-info">
                    <div class="set-name">${pair.setName || 'Unnamed Set'}</div>
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
                setID: pair.setID
            };
            
            game.nextSelectedPair = selectedPair;
            logger.debug('Selected pair:', selectedPair);
            
            setTimeout(() => {
                dialogManager.closeDialog('select-pair-dialog');
                game.setupGame(true);
            }, 300);
        };

        return button;
    },

    updateVernacularNames: async function(button, pair) {
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
            { message: "Tap the menu for more functions.", highlight: '#menu-toggle', action: () => this.temporarilyOpenMenu(6000), duration: 6000 },
            { message: "Ready to start?<br>Let's go!", highlight: null, duration: 2000 }
        ];

        let currentStep = 0;
        let highlightElements = [];

        const showStep = () => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                this.updateOverlayMessage(step.message);

                highlightElements.forEach(el => el.remove());
                highlightElements = [];

                if (step.highlight) {
                    const highlight = this.createHighlight(step.highlight);
                    if (highlight) highlightElements.push(highlight);
                } else if (step.highlights) {
                    step.highlights.forEach(selector => {
                        const highlight = this.createHighlight(selector);
                        if (highlight) highlightElements.push(highlight);
                    });
                }

                if (step.action) {
                    step.action();
                }

                currentStep++;
                setTimeout(showStep, step.duration); // Use the step's duration
            } else {
                this.hideOverlay();
                highlightElements.forEach(el => el.remove());
            }
        };

        // Close the help dialog before starting the tutorial
        document.getElementById('help-dialog').close();
        
        // Show the overlay at the start of the tutorial
        this.showOverlay("", config.overlayColors.green);
        
        // Start the tutorial
        showStep();
    },

    temporarilyOpenMenu: function(duration) {
      this.toggleMainMenu(); // Open the menu
      setTimeout(() => {
        this.closeMainMenu(); // Close the menu after the specified duration
      }, duration);
    },

    // for tutorial demo
    tiltGameContainer: function(duration = 3200) {
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
        highlight.style.width = `${targetRect.width}px`;
        highlight.style.height = `${targetRect.height}px`;
        highlight.style.top = `${targetRect.top}px`;
        highlight.style.left = `${targetRect.left}px`;

        return highlight;
    },

    toggleKeyboardShortcuts: function () {
        const keyboardShortcutsSection = document.getElementById('keyboard-shortcuts');
        if (utils.hasKeyboard()) {
            keyboardShortcutsSection.style.display = 'block';
        } else {
            keyboardShortcutsSection.style.display = 'none';
        }
    },

    initializeHelpDialog: function () {
        document.getElementById('help-button').addEventListener('click', () => {
            this.toggleKeyboardShortcuts();
            dialogManager.openDialog('help-dialog');
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

        document.addEventListener('keydown', handleKeyPress);
    },

    // main menu code:
    initializeMainMenu: function() {
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

    toggleMainMenu: function() {
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

    positionBottomGroup: function() {
        const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
        const lowerImageContainer = document.querySelector('#image-container-2');
        
        if (bottomGroup && lowerImageContainer) {
            const rect = lowerImageContainer.getBoundingClientRect();
            bottomGroup.style.top = `${rect.top}px`;
            bottomGroup.style.right = `0px`; // Adjust if needed
        }
    },

    closeMainMenu: function() {
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

