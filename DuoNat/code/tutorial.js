import config from './config.js';
import dialogManager from './dialogManager.js';
import eventMain from './eventMain.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const tutorial = {
    isActive: false,
    shouldContinue: false,
    currentTutorial: null,

    mainTutorial: {
        steps: [],
        currentStep: 0,
        highlightElements: [],

        isMenuForcedOpen: false,

        show() {
            this.initializeTutorial();
            this.setupTutorialSteps();
            this.startTutorial();
        },

        reset() {
            tutorial.isActive = false;
            this.currentStep = 0;
            this.shouldContinue = false;
        },

        initializeTutorial() {
            tutorial.isActive = true;
            this.shouldContinue = true;
            this.disableInteractions();
            this.closeHelpDialog();
            this.showInitialOverlay();
            this.addCloseButton();
        },

        closeHelpDialog() {
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog && helpDialog.open) {
                helpDialog.close();
            }
            dialogManager.resetDialogState();
        },

        showInitialOverlay() {
            ui.showOverlay("", config.overlayColors.green);
        },

        addCloseButton() {
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close Tutorial';
            closeButton.className = 'tutorial-close-button';
            closeButton.addEventListener('click', () => this.endTutorial());
            document.body.appendChild(closeButton);
        },

        setupTutorialSteps() {
            this.steps = [
                { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null, duration: 4000 },
                { message: "Learn to distinguish two different taxa.", highlights: ['#image-container-1', '#image-container-2'], duration: 5000 },
                {
                    message: "Drag a name to the correct image.",
                    highlight: '.name-pair',
                    duration: 5000,
                    action: () => this.animateDragDemo()
                },
                { 
                    message: "If correct, play another round of the same pair.",
                    highlight: null,
                    duration: 6000,
                    action: () => this.demonstrateImageSwitch()
                },
                {
                    message: "Swipe left on an image for a new taxon pair.",
                    highlight: null,
                    action: () => { this.tiltGameContainer(3200); },
                    duration: 6000
                },
                { message: "Get more info about a taxon.", highlights: ['#info-button-1', '#info-button-2'], duration: 6000 },
                /*{ message: "Get hints to distinguish taxa.", highlights: ['#hint-button-1', '#hint-button-2'], duration: 6000 },*/
                { message: "Share the current pair and collection.", highlight: '#share-button', duration: 6000 },
                { message: "Change difficulty, browse or filter.", highlight: '#level-indicator', duration: 5000 },
                { message: "Filter by common ancestry.", highlight: '#ancestry-button', duration: 5000 },
                /*{ message: "Tap the menu for more functions.", highlight: '#menu-toggle', action: () => this.temporarilyOpenMenu(12000), duration: 6000 },*/
                { message: "Ready to start?<br>Let's go!", highlight: null, duration: 2000 }
            ];
        },

        startTutorial() {
            this.currentStep = 0;
            this.highlightElements = [];
            this.showNextStep();
        },

        showNextStep() {
            if (this.currentStep < this.steps.length && this.shouldContinue) {
                const step = this.steps[this.currentStep];
                
                this.fadeOutOverlayMessage(() => {
                    this.updateStepContent(step);
                    this.fadeInOverlayMessage(() => {
                        this.currentStep++;
                        if (step.action) {
                            step.action();
                        }
                        setTimeout(() => {
                            this.showNextStep();
                        }, step.duration);
                    });
                });
            } else {
                this.endTutorial();
            }
        },

        updateStepContent(step) {
            ui.updateOverlayMessage(step.message);
            this.clearPreviousHighlights();
            this.addNewHighlights(step);
        },

        clearPreviousHighlights() {
            this.highlightElements.forEach(el => el.remove());
            this.highlightElements = [];
        },

        addNewHighlights(step) {
            if (step.highlight || step.highlights) {
                const highlights = step.highlight ? [step.highlight] : step.highlights;
                highlights.forEach(selector => {
                    const highlight = this.createHighlight(selector, step.duration);
                    if (highlight) this.highlightElements.push(highlight);
                });
            }
        },

        endTutorial() {
            this.enableInteractions();
            this.fadeOutOverlayMessage(() => {
                ui.hideOverlay();
                const closeButton = document.querySelector('.tutorial-close-button');
                if (closeButton) closeButton.remove();
            });
            document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());

            eventMain.enableKeyboardShortcuts();
            eventMain.enableSwipe();
            this.reset();
        },

        disableInteractions() {
            // Disable buttons and interactions
            document.querySelectorAll('button, .icon-button, .name-pair__item--draggable').forEach(el => {
                el.disabled = true;
                el.style.pointerEvents = 'none';
            });
            eventMain.disableSwipe();

            const levelIndicator = document.getElementById('level-indicator');
            if (levelIndicator) {
                levelIndicator.style.pointerEvents = 'none';
            }

            // Disable all buttons and clickable elements
            document.body.style.pointerEvents = 'none';

            eventMain.disableKeyboardShortcuts();

            // Enable pointer events only for the tutorial close button
            const closeButton = document.querySelector('.tutorial-close-button');
            if (closeButton) {
                closeButton.style.pointerEvents = 'auto';
            }

            // Prevent menu from closing
            const mainMenu = document.querySelector('.main-menu');
            if (mainMenu) {
                mainMenu.style.pointerEvents = 'none';
            }
        },

        enableInteractions() {
            document.querySelectorAll('button, .icon-button, .name-pair__item--draggable').forEach(el => {
                el.disabled = false;
                el.style.pointerEvents = 'auto';
            });
            eventMain.enableSwipe();
            this.enableMenu();

            const levelIndicator = document.getElementById('level-indicator');
            if (levelIndicator) {
                levelIndicator.style.pointerEvents = 'auto';
            }

            document.body.style.pointerEvents = 'auto';

            eventMain.enableKeyboardShortcuts();
        },

        /*
            disableMenu() {
                const menuToggle = document.getElementById('menu-toggle');
                if (menuToggle) {
                    menuToggle.style.pointerEvents = 'none';
                }
                const menuDropdowns = document.querySelectorAll('.main-menu__dropdown');
                menuDropdowns.forEach(dropdown => {
                    dropdown.style.pointerEvents = 'none';
                });
            },
        
            */
        enableMenu() {
            const menuToggle = document.getElementById('menu-toggle');
            if (menuToggle) {
                menuToggle.style.pointerEvents = 'auto';
            }
            const menuDropdowns = document.querySelectorAll('.main-menu__dropdown');
            menuDropdowns.forEach(dropdown => {
                dropdown.style.pointerEvents = 'auto';
            });
        },

        fadeOutOverlayMessage(callback) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.style.transition = 'opacity 0.3s ease-out';
            overlayMessage.style.opacity = '0';
            setTimeout(() => {
                if (callback) callback();
            }, 300);
        },

        fadeInOverlayMessage(callback) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.style.transition = 'opacity 0.3s ease-in';
            overlayMessage.style.opacity = '1';
            setTimeout(() => {
                if (callback) callback();
            }, 300);
        },

        temporarilyOpenMenu(duration) {
            this.isMenuForcedOpen = true;
            ui.openMenu(); // Use a new 'open' method instead of toggle

            // Prevent any clicks from closing the menu
            const preventMenuClose = (event) => {
                event.stopPropagation();
            };

            document.addEventListener('click', preventMenuClose, true);

            setTimeout(() => {
                this.isMenuForcedOpen = false;
                ui.closeMenu();
                document.removeEventListener('click', preventMenuClose, true);
            }, duration);
        },

        animateDragDemo: function () {
            return new Promise((resolve) => {
                const leftName = document.getElementById('left-name');
                const rightName = document.getElementById('right-name');
                const drop1 = document.getElementById('drop-1');
                const drop2 = document.getElementById('drop-2');

                // Store original positions
                const leftOriginalPos = leftName.getBoundingClientRect();
                const rightOriginalPos = rightName.getBoundingClientRect();

                // Function to get the center position of an element
                const getCenterPosition = (element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        left: rect.left + rect.width / 2,
                        top: rect.top + rect.height / 2
                    };
                };

                // Function to animate an element
                const animate = (element, target, duration) => {
                    const start = element.getBoundingClientRect();
                    const diffX = target.left - (start.left + start.width / 2);
                    const diffY = target.top - (start.top + start.height / 2);

                    element.style.transition = `transform ${duration}ms ease-in-out`;
                    element.style.transform = `translate(${diffX}px, ${diffY}px)`;

                    return new Promise(resolve => setTimeout(resolve, duration));
                };

                // Sequence of animations
                Promise.resolve()
                    .then(() => animate(leftName, getCenterPosition(drop1), 1000))
                    .then(() => animate(rightName, getCenterPosition(drop2), 1000))
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

        async demonstrateImageSwitch() {
            const imageOne = state.getElement('imageOne');
            const imageTwo = state.getElement('imageTwo');
            const originalSrcOne = imageOne.src;
            const originalSrcTwo = imageTwo.src;

            // Get the preloaded images for the next round
            const preloadedImages = preloader.roundPreloader.getPreloadedImagesForRoundDemo();

            if (preloadedImages && preloadedImages.taxon1 && preloadedImages.taxon2) {
                // Fade out current images
                imageOne.style.transition = imageTwo.style.transition = 'opacity 0.3s ease-out';
                imageOne.style.opacity = imageTwo.style.opacity = '0';

                await utils.ui.sleep(300); // Wait for fade out

                // Switch to preloaded images
                imageOne.src = preloadedImages.taxon1;
                imageTwo.src = preloadedImages.taxon2;

                // Fade in new images
                imageOne.style.opacity = imageTwo.style.opacity = '1';

                await utils.ui.sleep(3000); // Display for 3 seconds

                // Fade out again
                imageOne.style.opacity = imageTwo.style.opacity = '0';

                await utils.ui.sleep(300); // Wait for fade out

                // Switch back to original images
                imageOne.src = originalSrcOne;
                imageTwo.src = originalSrcTwo;

                // Fade in original images
                imageOne.style.opacity = imageTwo.style.opacity = '1';

                // Clean up transitions
                await utils.ui.sleep(300);
                imageOne.style.transition = imageTwo.style.transition = '';
            } else {
                logger.warn('No preloaded images available for demonstration');
            }
        },

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

    collectionManagerTutorial: {

        steps: [
            { message: "Here you can choose which pairs to play.", highlight: null, duration: 4000 },
            { message: "Easy or hard? Set the level here.", highlight: '#level-filter-dropdown', duration: 5000 },
            { message: "Which part of the Tree of Life do you want to play? Choose here.", highlight: '#select-phylogeny-button', duration: 5000 },
            { message: "You can select tags here.", highlight: '#select-tags-button', duration: 5000 },
            { message: "Click the map to restrict by continent.", highlight: '.filter-summary__map', duration: 5000 },
            { message: "Search by taxon or common name.", highlight: '#taxon-search', duration: 5000 },
            { message: "Clear all filters to access all pairs.", highlight: '#clear-all-filters', duration: 5000 },
            { message: "Click on 'Play' to play your filtered collection.", highlight: '#collection-done-button', duration: 5000 }
        ],
        currentStep: 0,
        highlightElements: [],

        show() {
            this.initializeTutorial();
            this.startTutorial();
        },

        initializeTutorial() {
            tutorial.isActive = true;
            tutorial.shouldContinue = true;
            tutorial.currentTutorial = this;
            this.disableInteractions();
            this.addCloseButton();
            this.createOverlay();
        },

        createOverlay() {
            const collectionDialog = document.getElementById('collection-dialog');
            ui.createCollectionManagerOverlay(collectionDialog);
        },

        updateOverlayMessage(message) {
            ui.updateDialogOverlayMessage(message);
        },

        startTutorial() {
            this.currentStep = 0;
            this.highlightElements = [];
            this.showNextStep();
        },

        showNextStep() {
            if (this.currentStep < this.steps.length && tutorial.shouldContinue) {
                const step = this.steps[this.currentStep];
                this.updateStepContent(step);
                this.currentStep++;
                setTimeout(() => this.showNextStep(), step.duration);
            } else {
                this.endTutorial();
            }
        },

        updateStepContent(step) {
            ui.updateDialogOverlayMessage(step.message);
            this.clearPreviousHighlights();
            if (step.highlight) {
                const highlight = this.createHighlight(step.highlight, step.duration);
                if (highlight) this.highlightElements.push(highlight);
            }
        },

        fadeOutOverlayMessage(callback) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.style.transition = 'opacity 0.3s ease-out';
            overlayMessage.style.opacity = '0';
            setTimeout(() => {
                if (callback) callback();
            }, 300);
        },

        fadeInOverlayMessage() {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.style.transition = 'opacity 0.3s ease-in';
            overlayMessage.style.opacity = '1';
        },

        clearPreviousHighlights() {
            this.highlightElements.forEach(el => el.remove());
            this.highlightElements = [];
        },

        createHighlight: function (targetSelector, duration) {
            const target = document.querySelector(targetSelector);
            if (!target) {
                console.error(`Target element not found: ${targetSelector}`);
                return null;
            }
            const highlight = document.createElement('div');
            highlight.className = 'tutorial-highlight';
            
            // Append to the collection dialog instead of body
            const collectionDialog = document.getElementById('collection-dialog');
            collectionDialog.appendChild(highlight);

            const targetRect = target.getBoundingClientRect();
            const dialogRect = collectionDialog.getBoundingClientRect();

            // Adjust positioning relative to the dialog
            highlight.style.width = `${targetRect.width}px`;
            highlight.style.height = `${targetRect.height}px`;
            highlight.style.top = `${targetRect.top - dialogRect.top}px`;
            highlight.style.left = `${targetRect.left - dialogRect.left}px`;

            const animationDuration = 1; // seconds
            const iterationCount = Math.floor(duration / 1000 / animationDuration);

            highlight.style.animationDuration = `${animationDuration}s`;
            highlight.style.animationIterationCount = iterationCount;

            // Add specific styling for certain elements
            if (targetSelector === '#level-filter-dropdown') {
                highlight.style.borderRadius = '8px';
            } else if (target.classList.contains('collection-dialog__select-buttons')) {
                highlight.style.borderRadius = '8px';
            }

            return highlight;
        },

        disableInteractions() {
            const dialog = document.getElementById('collection-dialog');
            if (dialog) {
                dialog.style.pointerEvents = 'none';
                dialog.querySelectorAll('button, input, select').forEach(el => {
                    el.disabled = true;
                    el.style.pointerEvents = 'none';
                });
            }
            
            // Disable scrolling
            document.body.style.overflow = 'hidden';
        },

        enableInteractions() {
            const dialog = document.getElementById('collection-dialog');
            if (dialog) {
                dialog.style.pointerEvents = 'auto';
                dialog.querySelectorAll('button, input, select').forEach(el => {
                    el.disabled = false;
                    el.style.pointerEvents = 'auto';
                });
            }
            
            // Re-enable scrolling
            document.body.style.overflow = 'auto';
        },

        addCloseButton() {
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close Tutorial';
            closeButton.className = 'tutorial-close-button';
            closeButton.addEventListener('click', () => this.endTutorial());
            
            // Append to the collection dialog instead of body
            const collectionDialog = document.getElementById('collection-dialog');
            collectionDialog.appendChild(closeButton);
        },

        endTutorial() {
            tutorial.isActive = false;
            tutorial.shouldContinue = false;
            tutorial.currentTutorial = null;
            this.enableInteractions();
            this.clearPreviousHighlights();
            ui.removeDialogOverlay();
            const closeButton = document.querySelector('.tutorial-close-button');
            if (closeButton) closeButton.remove();
        },

        removeOverlay() {
            const overlay = document.getElementById('collection-tutorial-overlay');
            if (overlay) overlay.remove();
        },

    },

    infoDialogTutorial: {

        steps: [
            { message: "Get information on this taxon on Wikipedia.", highlight: '#wiki-button', duration: 5000 },
            { message: "Visit photo page on iNaturalist.", highlight: '#photo-button', duration: 5000 },
            { message: "Check out this observation on iNaturalist.", highlight: '#observation-button', duration: 5000 },
            { message: "Visit the iNaturalist page for this taxon.", highlight: '#taxon-button', duration: 5000 },
            { message: "Report a problem with this pair or the app.", highlight: '#report-button', duration: 5000 }
        ],
        currentStep: 0,
        highlightElements: [],

        show() {
            this.initializeTutorial();
            this.startTutorial();
        },

        initializeTutorial() {
            tutorial.isActive = true;
            tutorial.shouldContinue = true;
            tutorial.currentTutorial = this;
            this.disableInteractions();
            this.createOverlay();
            this.addCloseButton();
        },

        createOverlay() {
            const infoDialog = document.getElementById('info-dialog');
            ui.createInfoDialogOverlay(infoDialog);
        },

        updateOverlayMessage(message) {
            ui.updateDialogOverlayMessage(message);
        },

        startTutorial() {
            this.currentStep = 0;
            this.highlightElements = [];
            this.showNextStep();
        },

        showNextStep() {
            if (this.currentStep < this.steps.length && tutorial.shouldContinue) {
                const step = this.steps[this.currentStep];
                this.updateStepContent(step);
                this.currentStep++;
                setTimeout(() => this.showNextStep(), step.duration);
            } else {
                this.endTutorial();
            }
        },

        updateStepContent(step) {
            this.updateOverlayMessage(step.message);
            this.clearPreviousHighlights();
            if (step.highlight) {
                const highlight = this.createHighlight(step.highlight, step.duration);
                if (highlight) this.highlightElements.push(highlight);
            }
        },

        clearPreviousHighlights() {
            this.highlightElements.forEach(el => el.remove());
            this.highlightElements = [];
        },

        createHighlight(targetSelector, duration) {
            const target = document.querySelector(targetSelector);
            if (!target) {
                console.error(`Target element not found: ${targetSelector}`);
                return null;
            }
            const highlight = document.createElement('div');
            highlight.className = 'tutorial-highlight';
            
            const infoDialog = document.getElementById('info-dialog');
            infoDialog.appendChild(highlight);

            const targetRect = target.getBoundingClientRect();
            const dialogRect = infoDialog.getBoundingClientRect();

            highlight.style.width = `${targetRect.width}px`;
            highlight.style.height = `${targetRect.height}px`;
            highlight.style.top = `${targetRect.top - dialogRect.top}px`;
            highlight.style.left = `${targetRect.left - dialogRect.left}px`;

            const animationDuration = 1; // seconds
            const iterationCount = Math.floor(duration / 1000 / animationDuration);

            highlight.style.animationDuration = `${animationDuration}s`;
            highlight.style.animationIterationCount = iterationCount;

            // Add specific styling for round buttons
            if (target.classList.contains('info-dialog__button')) {
                highlight.style.borderRadius = '50%';
            }

            return highlight;
        },

        disableInteractions() {
            const dialog = document.getElementById('info-dialog');
            if (dialog) {
                dialog.style.pointerEvents = 'none';
                dialog.querySelectorAll('button').forEach(el => {
                    el.disabled = true;
                    el.style.pointerEvents = 'none';
                });
            }

            // Ensure the close button is clickable
            const closeButton = document.querySelector('.tutorial-close-button');
            if (closeButton) {
                closeButton.style.pointerEvents = 'auto';
                closeButton.disabled = false;
            }
        },

        enableInteractions() {
            const dialog = document.getElementById('info-dialog');
            if (dialog) {
                dialog.style.pointerEvents = 'auto';
                dialog.querySelectorAll('button').forEach(el => {
                    el.disabled = false;
                    el.style.pointerEvents = 'auto';
                });
            }
        },

        addCloseButton() {
            //const imageIndex = state.getInfoDialogImageIndex();

            // Create and position the "Close Tutorial" button
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close Tutorial';
            closeButton.className = 'tutorial-close-button';
            closeButton.style.position = 'absolute';
            closeButton.style.bottom = '170px';
            closeButton.style.right = '10px';
            closeButton.addEventListener('click', () => tutorial.endCurrentTutorial());
            
            //const imageContainer = document.getElementById(`image-container-${imageIndex}`);
            //imageContainer.appendChild(closeButton);
            const overlay = document.getElementById(`info-dialog-facts`);
            overlay.appendChild(closeButton);
        },

        endTutorial() {
            tutorial.isActive = false;
            tutorial.shouldContinue = false;
            tutorial.currentTutorial = null;
            this.enableInteractions();
            this.clearPreviousHighlights();
            ui.removeDialogOverlay();
            const closeButton = document.querySelector('.tutorial-close-button');
            if (closeButton) closeButton.remove();
        },
    },

    endCurrentTutorial() {
        if (this.currentTutorial) {
            this.currentTutorial.endTutorial();
        }
    }

};

// Bind all methods
Object.keys(tutorial).forEach(key => {
    if (typeof tutorial[key] === 'function') {
        tutorial[key] = tutorial[key].bind(tutorial);
    }
});

Object.keys(tutorial.mainTutorial).forEach(key => {
    if (typeof tutorial.mainTutorial[key] === 'function') {
        tutorial.mainTutorial[key] = tutorial.mainTutorial[key].bind(tutorial.mainTutorial);
    }
});

Object.keys(tutorial.collectionManagerTutorial).forEach(key => {
    if (typeof tutorial.collectionManagerTutorial[key] === 'function') {
        tutorial.collectionManagerTutorial[key] = tutorial.collectionManagerTutorial[key].bind(tutorial.collectionManagerTutorial);
    }
});

Object.keys(tutorial.infoDialogTutorial).forEach(key => {
    if (typeof tutorial.infoDialogTutorial[key] === 'function') {
        tutorial.infoDialogTutorial[key] = tutorial.infoDialogTutorial[key].bind(tutorial.infoDialogTutorial);
    }
});

const publicAPI = {
    showMainTutorial: tutorial.mainTutorial.show,
    showCollectionManagerTutorial: tutorial.collectionManagerTutorial.show,
    showInfoDialogTutorial: tutorial.infoDialogTutorial.show,
    isActive() {
        return tutorial.isActive;
    },
    endCurrentTutorial: tutorial.endCurrentTutorial
};

export default publicAPI;
