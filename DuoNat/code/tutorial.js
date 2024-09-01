import config from './config.js';
import eventMain from './eventMain.js';
import logger from './logger.js';
import ui from './ui.js';

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
            // Add any other state resets here
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
                { message: "If correct, play another round of the same pair.", highlight: null, duration: 4000 },
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
                { message: "Tap the menu for more functions.", highlight: '#menu-toggle', action: () => this.temporarilyOpenMenu(12000), duration: 6000 },
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
                logger.debug(`Starting step ${this.currentStep}: ${step.message}`);
                
                this.fadeOutOverlayMessage(() => {
                    logger.debug(`Faded out step ${this.currentStep}`);
                    this.updateStepContent(step);
                    this.fadeInOverlayMessage(() => {
                        logger.debug(`Faded in step ${this.currentStep}`);
                        this.currentStep++;
                        if (step.action) {
                            logger.debug(`Executing action for step: ${step.message}`);
                            step.action();
                        }
                        setTimeout(() => {
                            logger.debug(`Timeout finished for step ${this.currentStep - 1}`);
                            this.showNextStep();
                        }, step.duration);
                    });
                });
            } else {
                logger.debug('Ending tutorial');
                this.endTutorial();
            }
        },

        updateStepContent(step) {
            logger.debug(`Updating content for step: ${step.message}`);
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
            logger.debug('Ending tutorial');
            this.enableInteractions();
            this.fadeOutOverlayMessage(() => {
                logger.debug('Fading out tutorial overlay');
                ui.hideOverlay();
                const closeButton = document.querySelector('.tutorial-close-button');
                if (closeButton) closeButton.remove();
            });
            document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());

            eventMain.enableKeyboardShortcuts();
            eventMain.enableSwipe();
            logger.debug('Tutorial ended');
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
            { message: "Here you can choose which taxa to play.", highlight: null, duration: 4000 },
            { message: "Easy or hard? Set the level here.", highlight: '#level-filter-dropdown', duration: 5000 },
            { message: "Which part of the Tree of Life do you want to play? Choose here.", highlight: '#select-phylogeny-button', duration: 5000 },
            { message: "You can select tags here.", highlight: '#select-tags-button', duration: 5000 },
            { message: "Click the map to restrict by continent.", highlight: '.filter-summary__map', duration: 5000 },
            { message: "Search by taxon or common name.", highlight: '#taxon-search', duration: 5000 },
            { message: "Clear all filters to access all taxa.", highlight: '#clear-all-filters', duration: 5000 },
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
            ui.createDialogOverlay(collectionDialog);
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
                logger.debug(`now at step ${step}`);
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

const publicAPI = {
    showMainTutorial: tutorial.mainTutorial.show,
    showCollectionManagerTutorial: tutorial.collectionManagerTutorial.show,
    isActive() {
        return tutorial.isActive;
    },
    endCurrentTutorial: tutorial.endCurrentTutorial
};

export default publicAPI;
