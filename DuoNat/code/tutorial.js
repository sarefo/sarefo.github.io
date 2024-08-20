import config from './config.js';
import eventMain from './eventMain.js';
import ui from './ui.js';

const tutorial = {
    isActive: false,
    shouldContinue: false,
    steps: [],
    currentStep: 0,
    highlightElements: [],

    isMenuForcedOpen: false,

    show() {
        tutorial.initializeTutorial();
        tutorial.setupTutorialSteps();
        tutorial.startTutorial();
    },

    initializeTutorial() {
        tutorial.isActive = true;
        tutorial.shouldContinue = true;
        tutorial.disableInteractions();
        tutorial.closeHelpDialog();
        tutorial.showInitialOverlay();
        tutorial.addCloseButton();
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
        closeButton.addEventListener('click', () => tutorial.endTutorial());
        document.body.appendChild(closeButton);
    },

    setupTutorialSteps() {
        tutorial.steps = [
            { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null, duration: 4000 },
            { message: "Learn to distinguish two different taxa.", highlights: ['#image-container-1', '#image-container-2'], duration: 5000 },
            {
                message: "Drag a name to the correct image.",
                highlight: '.name-pair',
                duration: 5000,
                action: () => tutorial.animateDragDemo()
            },
            { message: "If correct, play another round of the same set.", highlight: null, duration: 4000 },
            {
                message: "Swipe left on an image for a new taxon set.",
                highlight: null,
                action: () => { tutorial.tiltGameContainer(3200); },
                duration: 6000
            },
            { message: "Get more info about a taxon.", highlights: ['#info-button-1', '#info-button-2'], duration: 6000 },
            { message: "Get hints to distinguish taxa.", highlights: ['#hint-button-1', '#hint-button-2'], duration: 6000 },
            { message: "Share the current set and collection.", highlight: '#share-button', duration: 6000 },
            { message: "Tap the menu for more functions.", highlight: '#menu-toggle', action: () => tutorial.temporarilyOpenMenu(12000), duration: 6000 },
            { message: "Change difficulty, range or tags.", highlights: ['#level-indicator', '#collection-button'], duration: 5000 },
            { message: "Ready to start?<br>Let's go!", highlight: null, duration: 2000 }
        ];
    },

    startTutorial() {
        tutorial.currentStep = 0;
        tutorial.highlightElements = [];
        tutorial.showNextStep();
    },

    showNextStep() {
        if (tutorial.currentStep < tutorial.steps.length && tutorial.shouldContinue) {
            const step = tutorial.steps[tutorial.currentStep];
            tutorial.fadeOutOverlayMessage(() => {
                tutorial.updateStepContent(step);
                tutorial.fadeInOverlayMessage();
                tutorial.currentStep++;
                setTimeout(() => tutorial.showNextStep(), step.duration);
            });
        } else {
            tutorial.endTutorial();
        }
    },

    updateStepContent(step) {
        ui.updateOverlayMessage(step.message);
        tutorial.clearPreviousHighlights();
        tutorial.addNewHighlights(step);
        if (step.action) {
            step.action();
        }
    },

    clearPreviousHighlights() {
        tutorial.highlightElements.forEach(el => el.remove());
        tutorial.highlightElements = [];
    },

    addNewHighlights(step) {
        if (step.highlight || step.highlights) {
            const highlights = step.highlight ? [step.highlight] : step.highlights;
            highlights.forEach(selector => {
                const highlight = tutorial.createHighlight(selector, step.duration);
                if (highlight) tutorial.highlightElements.push(highlight);
            });
        }
    },

    endTutorial() {
        tutorial.isActive = false;
        tutorial.shouldContinue = false;
        tutorial.enableInteractions();
        tutorial.fadeOutOverlayMessage(() => {
            ui.hideOverlay();
            const closeButton = document.querySelector('.tutorial-close-button');
            if (closeButton) closeButton.remove();
        });
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.remove());

        eventMain.enableKeyboardShortcuts();
        eventMain.enableSwipe();
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
        tutorial.enableMenu();

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

    fadeInOverlayMessage() {
        const overlayMessage = document.getElementById('overlay-message');
        overlayMessage.style.transition = 'opacity 0.3s ease-in';
        overlayMessage.style.opacity = '1';
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
};

const publicAPI = {
    show: tutorial.show,
    isActive() {
        return tutorial.isActive;
    },
};

export default publicAPI;
