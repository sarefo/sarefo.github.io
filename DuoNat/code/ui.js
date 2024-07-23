// UI functions

import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState } from './state.js';
import game from './game.js';
import logger from './logger.js';
import utils from './utils.js';

const ui = {
    isMenuOpen: false,

    resetUIState: function() {
        this.closeFunctionsMenu();
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
    showTaxonPairList: function () {
        api.fetchTaxonPairs().then(taxonPairs => {
            if (taxonPairs.length === 0) {
                logger.error("No taxon pairs available");
                return;
            }

            const list = document.getElementById('taxon-pair-list');
            const searchInput = document.getElementById('taxon-search');
            const clearButton = document.getElementById('clear-search');
            
            // Clear the search input and hide the clear button
            searchInput.value = '';
            clearButton.style.display = 'none';

            list.innerHTML = ''; // Clear existing content

            const createTaxonPairButton = (pair) => {
                const button = document.createElement('button');
                button.innerHTML = `<i>${pair.taxon1}</i> <span class="taxon-pair-versus">vs</span> <i>${pair.taxon2}</i>`;
                button.className = 'taxon-pair-button';
                button.onclick = () => {
                    game.nextSelectedPair = pair;
                    dialogManager.closeDialog();
                    game.setupGame(true);
                };
                return button;
            };

            const renderFilteredList = (filter = '') => {
                const fragment = document.createDocumentFragment();
                taxonPairs.forEach(pair => {
                    if (pair.taxon1.toLowerCase().includes(filter) || pair.taxon2.toLowerCase().includes(filter)) {
                        fragment.appendChild(createTaxonPairButton(pair));
                    }
                });
                list.innerHTML = '';
                list.appendChild(fragment);
            };

            renderFilteredList(); // Initial render with all pairs

            const debouncedFilter = utils.debounce((event) => {
                const filter = event.target.value.toLowerCase();
                renderFilteredList(filter);
            }, 300);

            searchInput.addEventListener('input', (event) => {
                clearButton.style.display = event.target.value ? 'block' : 'none';
                debouncedFilter(event);
            });

            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                clearButton.style.display = 'none';
                renderFilteredList();
                searchInput.focus();
            });

            dialogManager.openDialog('select-pair-dialog');

            // Focus on the search input when the dialog opens
            setTimeout(() => searchInput.focus(), 100);
        });
    },

    showOverlay: function (message = "", color) {
        elements.overlayMessage.innerHTML = message;
        elements.overlay.style.backgroundColor = color;
        elements.overlay.classList.add('show');

        // Adjust font size for longer messages
        if (message.length > 20) {
            elements.overlayMessage.style.fontSize = '1.2em';
        } else {
            elements.overlayMessage.style.fontSize = '2.4em';
        }
    },

    updateOverlayMessage: function (message) {
        elements.overlayMessage.innerHTML = message;
    },

    hideOverlay: function () {
        elements.overlay.classList.remove('show');
    },

    scrollToTop: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null },
            { message: "You'll see two images of different taxa.", highlights: ['#image-container-1', '#image-container-2'] },
            { message: "Drag the name tags from the center<br>to match them with the correct images.", highlight: '.name-pair' },
            { message: "If you're correct,<br>you'll move to the next round.", highlight: null, showNextImages: true },
            { message: "Swipe left on an image<br>for a new set of species.", highlight: '.game-container' },
            { message: "Share your favorite pairs<br>with the share button on top.", highlight: '#share-button' },
            { message: "Scroll down for more functions.", highlight: '.scrollable-content', scroll: true },
            { message: "Ready to start? Let's go!", highlight: null }
        ];

        let currentStep = 0;
        let highlightElements = [];

        const showStep = () => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                this.showOverlay(step.message, config.overlayColors.green);

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

                if (step.scroll) {
                    this.scrollToBottom(() => {
                        setTimeout(() => {
                            this.scrollToTop();
                        }, 1500);
                    });
                }

                if (step.showNextImages) {
                    this.showNextRoundImages();
                } else if (this.originalImages) {
                    this.restoreOriginalImages();
                }

                currentStep++;
                setTimeout(() => {
                    this.hideOverlay();
                    setTimeout(showStep, 500); // Short pause between steps
                }, 4000); // Show each step for 4 seconds
            } else {
                this.hideOverlay();
                highlightElements.forEach(el => el.remove());
                if (this.originalImages) {
                    this.restoreOriginalImages();
                }
                //game.setupGame(true); // Start a new game after the tutorial
            }
        };

        // Close the help dialog before starting the tutorial
        document.getElementById('help-dialog').close();
        showStep();
    },

    scrollToBottom: function (callback) {
        const scrollableContent = document.querySelector('.scrollable-content');
        if (scrollableContent) {
            const scrollOptions = {
                top: scrollableContent.scrollHeight - scrollableContent.clientHeight,
                behavior: 'smooth'
            };
            scrollableContent.scrollTo(scrollOptions);
            setTimeout(callback, 1000); // Wait for scroll to complete
        } else {
            console.warn('Scrollable content not found');
            callback();
        }
    },

                    /*
    scrollToTop: function () {
        const scrollableContent = document.querySelector('.scrollable-content');
        if (scrollableContent) {
            scrollableContent.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            console.warn('Scrollable content not found');
        }
    },
*/
    showNextRoundImages: function () {
        const imageOne = document.getElementById('image-1');
        const imageTwo = document.getElementById('image-2');

        // Store original images if not already stored
        if (!this.originalImages) {
            this.originalImages = {
                one: imageOne.src,
                two: imageTwo.src
            };
        }

        // Show preloaded images for next round
        if (game.preloadedImages && game.preloadedImages.taxon1 && game.preloadedImages.taxon1.length > 0 &&
            game.preloadedImages.taxon2 && game.preloadedImages.taxon2.length > 0) {
            imageOne.src = game.preloadedImages.taxon1[0];
            imageTwo.src = game.preloadedImages.taxon2[0];
        } else {
            console.warn('Preloaded images for the next round are not available.');
        }
    },

    restoreOriginalImages: function () {
        if (this.originalImages) {
            const imageOne = document.getElementById('image-1');
            const imageTwo = document.getElementById('image-2');
            imageOne.src = this.originalImages.one;
            imageTwo.src = this.originalImages.two;
            this.originalImages = null;
        }
    },

    restoreOriginalImages: function () {
        if (this.originalImages) {
            const imageOne = document.getElementById('image-1');
            const imageTwo = document.getElementById('image-2');
            imageOne.src = this.originalImages.one;
            imageTwo.src = this.originalImages.two;
            this.originalImages = null;
        }
    },

    createHighlight: function (targetSelector) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.error(`Target element not found: ${targetSelector}`);
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

        console.log(`Highlight created for: ${targetSelector}`);

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
                't': 'taxon-button'
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

    // functions menu code:
    initializeFunctionsMenu: function() {
        const functionsToggle = document.getElementById('menu-toggle');
        if (functionsToggle) {
            functionsToggle.addEventListener('click', (event) => {
                logger.debug('Functions toggle button or its child clicked');
                event.stopPropagation();
                this.toggleFunctionsMenu();
            });
        } else {
            logger.error('Functions toggle button not found');
        }

        window.addEventListener('resize', this.positionBottomGroup.bind(this));
        
        // Call once to set initial position
        this.positionBottomGroup();

        // Close the dropdown when clicking outside of it
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.functions-menu')) {
                this.closeFunctionsMenu();
            }
        });
    },

    toggleFunctionsMenu: function() {
        logger.debug("toggleFunctionsMenu called");
        this.isMenuOpen = !this.isMenuOpen;
//        logger.debug("Menu is now " + (this.isMenuOpen ? "open" : "closed"));

        const topGroup = document.querySelector('.functions-dropdown.top-group');
        const bottomGroup = document.querySelector('.functions-dropdown.bottom-group');

        if (topGroup && bottomGroup) {
            topGroup.classList.toggle('show');
            bottomGroup.classList.toggle('show');
            logger.debug("Show classes toggled");

            if (this.isMenuOpen) {
                this.positionBottomGroup();
            }
        } else {
            logger.error('Dropdown groups not found');
        }
    },

    positionBottomGroup: function() {
        const bottomGroup = document.querySelector('.functions-dropdown.bottom-group');
        const lowerImageContainer = document.querySelector('#image-container-2');
        
        if (bottomGroup && lowerImageContainer) {
            const rect = lowerImageContainer.getBoundingClientRect();
            bottomGroup.style.top = `${rect.top}px`;
            bottomGroup.style.right = `0px`; // Adjust if needed
        }
    },

    closeFunctionsMenu: function() {
        if (this.isMenuOpen) {
            const topGroup = document.querySelector('.functions-dropdown.top-group');
            const bottomGroup = document.querySelector('.functions-dropdown.bottom-group');
            if (topGroup && bottomGroup) {
                this.isMenuOpen = false;
                topGroup.classList.remove('show');
                bottomGroup.classList.remove('show');
            }
        }
    },

/*    isMenuOpen: function() {
        return isMenuOpen;
    },
*/
    initialize: function () {
//                    logger.debug("initialize ui");
        this.initializeHelpDialog();
        this.initializeInfoDialog();
        this.initializeFunctionsMenu();
        this.closeFunctionsMenu(); // Ensure menu is closed on initialization
        // Close the dropdown when clicking outside of it
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.functions-menu')) {
                this.closeFunctionsMenu();
            }
        });
    },

}; // const ui

export default ui;

