import config from './config.js';
import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import eventMain from './eventMain.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

class Tutorial {
    constructor() {
        this.isActive = false;
        this.shouldContinue = false;
        this.currentTutorial = null;
        this.highlightElements = [];
    }

    initializeTutorial(tutorialType) {
        this.isActive = true;
        this.shouldContinue = true;
        this.currentTutorial = tutorialType;
        this.disableInteractions();
        this.addCloseButton(tutorialType);
        
        if (tutorialType === 'main') {
            this.closeHelpDialog();
            this.showInitialOverlay();
        } else if (tutorialType === 'collectionManager') {
            this.expandTaxonPairs();
            this.createOverlay('collection-dialog');
        } else if (tutorialType === 'infoDialog') {
            this.createOverlay('info-dialog');
        }
    }

    closeHelpDialog() {
        const helpDialog = document.getElementById('help-dialog');
        if (helpDialog && helpDialog.open) {
            helpDialog.close();
        }
        dialogManager.resetDialogState();
    }

    showInitialOverlay() {
        ui.showOverlay("", config.overlayColors.green);
    }

    expandTaxonPairs() {
        state.setHideCollManTaxa(false);
        collectionManager.syncTaxonInfoVisibility();
    }

    createOverlay(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialogId === 'collection-dialog') {
            ui.createCollectionManagerOverlay(dialog);
        } else if (dialogId === 'info-dialog') {
            ui.createInfoDialogOverlay(dialog);
        }
    }

    addCloseButton(tutorialType) {
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close Tutorial';
        closeButton.className = 'tutorial-close-button';
        closeButton.addEventListener('click', () => this.endTutorial());
        
        if (tutorialType === 'main') {
            document.body.appendChild(closeButton);
        } else if (tutorialType === 'collectionManager') {
            const collectionDialog = document.getElementById('collection-dialog');
            closeButton.style.bottom = '55px';
            closeButton.style.right = '20px';
            collectionDialog.appendChild(closeButton);
        } else if (tutorialType === 'infoDialog') {
            const infoDialogFacts = document.getElementById('info-dialog-facts');
            closeButton.style.bottom = '170px';
            infoDialogFacts.appendChild(closeButton);
        }
    }

    startTutorial(steps) {
        this.currentStep = 0;
        this.steps = steps;
        this.showNextStep();
    }

    showNextStep() {
        if (this.currentStep < this.steps.length && this.shouldContinue) {
            const step = this.steps[this.currentStep];
            this.updateStepContent(step);
            this.currentStep++;
            if (step.action) {
                step.action();
            }
            setTimeout(() => this.showNextStep(), step.duration);
        } else {
            this.endTutorial();
        }
    }

    updateStepContent(step) {
        this.updateOverlayMessage(step.message);
        this.clearPreviousHighlights();
        if (step.highlight || step.highlights) {
            const highlights = step.highlight ? [step.highlight] : step.highlights;
            highlights.forEach(selector => {
                const highlight = this.createHighlight(selector, step.duration);
                if (highlight) this.highlightElements.push(highlight);
            });
        }
    }

    updateOverlayMessage(message) {
        if (this.currentTutorial === 'main') {
            ui.updateOverlayMessage(message);
        } else {
            ui.updateDialogOverlayMessage(message);
        }
    }

    clearPreviousHighlights() {
        this.highlightElements.forEach(el => el.remove());
        this.highlightElements = [];
    }

    createHighlight(targetSelector, duration) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            logger.error(`Target element not found: ${targetSelector}`);
            return null;
        }
        const highlight = document.createElement('div');
        highlight.className = 'tutorial-highlight';

        let container;
        if (this.currentTutorial === 'main') {
            container = document.body;
        } else if (this.currentTutorial === 'collectionManager') {
            container = document.getElementById('collection-dialog');
        } else if (this.currentTutorial === 'infoDialog') {
            container = document.getElementById('info-dialog');
        }
        container.appendChild(highlight);

        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        highlight.style.width = `${targetRect.width}px`;
        highlight.style.height = `${targetRect.height}px`;
        highlight.style.top = `${targetRect.top - containerRect.top}px`;
        highlight.style.left = `${targetRect.left - containerRect.left}px`;

        const animationDuration = 1; // seconds
        const iterationCount = Math.floor(duration / 1000 / animationDuration);

        highlight.style.animationDuration = `${animationDuration}s`;
        highlight.style.animationIterationCount = iterationCount;

        // Add specific styling for certain elements
        if (targetSelector === '#level-filter-dropdown' || target.classList.contains('collection-dialog__select-buttons')) {
            highlight.style.borderRadius = '8px';
        } else if (targetSelector === '#level-indicator') {
            highlight.style.borderRadius = '20px';
        } else if (target.classList.contains('icon-button') || target.classList.contains('info-dialog__button')) {
            highlight.style.borderRadius = '50%';
        }

        return highlight;
    }

    disableInteractions() {
        if (this.currentTutorial === 'main') {
            document.querySelectorAll('button, .icon-button, .name-pair__item--draggable').forEach(el => {
                el.disabled = true;
                el.style.pointerEvents = 'none';
            });
            eventMain.disableSwipe();
            eventMain.disableKeyboardShortcuts();
            document.body.style.pointerEvents = 'none';
        } else {
            const dialog = document.getElementById(this.currentTutorial === 'collectionManager' ? 'collection-dialog' : 'info-dialog');
            if (dialog) {
                dialog.style.pointerEvents = 'none';
                dialog.querySelectorAll('button, input, select').forEach(el => {
                    el.disabled = true;
                    el.style.pointerEvents = 'none';
                });
            }
        }

        // Ensure the close button is clickable
        const closeButton = document.querySelector('.tutorial-close-button');
        if (closeButton) {
            closeButton.style.pointerEvents = 'auto';
            closeButton.disabled = false;
        }
    }

    enableInteractions() {
        if (this.currentTutorial === 'main') {
            document.querySelectorAll('button, .icon-button, .name-pair__item--draggable').forEach(el => {
                el.disabled = false;
                el.style.pointerEvents = 'auto';
            });
            eventMain.enableSwipe();
            eventMain.enableKeyboardShortcuts();
            document.body.style.pointerEvents = 'auto';
        } else {
            const dialog = document.getElementById(this.currentTutorial === 'collectionManager' ? 'collection-dialog' : 'info-dialog');
            if (dialog) {
                dialog.style.pointerEvents = 'auto';
                dialog.querySelectorAll('button, input, select').forEach(el => {
                    el.disabled = false;
                    el.style.pointerEvents = 'auto';
                });
            }
        }
    }

    endTutorial() {
        this.isActive = false;
        this.shouldContinue = false;
        this.enableInteractions();
        this.clearPreviousHighlights();
        
        if (this.currentTutorial === 'main') {
            ui.hideOverlay();
        } else {
            ui.removeDialogOverlay();
        }
        
        const closeButton = document.querySelector('.tutorial-close-button');
        if (closeButton) closeButton.remove();
        
        this.currentTutorial = null;
    }

    // Specific tutorial methods
        animateDragDemo() {
            return new Promise((resolve) => {
                const nameX = document.getElementById('name-x');
                const nameY = document.getElementById('name-y');
                const drop1 = document.getElementById('drop-1');
                const drop2 = document.getElementById('drop-2');

                // Store original positions
                //const leftOriginalPos = nameX.getBoundingClientRect();
                //const rightOriginalPos = nameY.getBoundingClientRect();

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
                    .then(() => animate(nameX, getCenterPosition(drop1), 1000))
                    .then(() => animate(nameY, getCenterPosition(drop2), 1000))
                    .then(() => new Promise(resolve => setTimeout(resolve, 1000))) // Pause
                    .then(() => {
                        nameX.style.transition = nameY.style.transition = 'transform 500ms ease-in-out';
                        nameX.style.transform = nameY.style.transform = '';
                    })
                    .then(() => new Promise(resolve => setTimeout(resolve, 500)))
                    .then(() => {
                        nameX.style.transition = nameY.style.transition = '';
                        resolve();
                    });
            });
        }

        async demonstrateImageSwitch() {
            const image1 = state.getElement('image1');
            const image2 = state.getElement('image2');
            const originalSrc1 = image1.src;
            const originalSrc2 = image2.src;

            // Get the preloaded images for the next round
            const preloadedImages = preloader.getPreloadedImagesForRoundDemo();

            if (preloadedImages && preloadedImages.taxonA && preloadedImages.taxonB) {
                // Fade out
                image1.classList.add('image-container__image--fade');
                image2.classList.add('image-container__image--fade');

                await utils.ui.sleep(300); // Wait for fade out

                // Switch to preloaded images
                image1.src = preloadedImages.taxonA;
                image2.src = preloadedImages.taxonB;

                // Fade in new images
                image1.classList.remove('image-container__image--fade');
                image2.classList.remove('image-container__image--fade');

                await utils.ui.sleep(3000); // Display for 3 seconds

                // Fade out again
                image1.classList.add('image-container__image--fade');
                image2.classList.add('image-container__image--fade');

                await utils.ui.sleep(300); // Wait for fade out

                // Switch back to original images
                image1.src = originalSrc1;
                image2.src = originalSrc2;

                // Fade in original images
                image1.classList.remove('image-container__image--fade');
                image2.classList.remove('image-container__image--fade');

                // Clean up
                await utils.ui.sleep(300);
            } else {
                logger.warn('No preloaded images available for demonstration');
            }

            // Ensure no inline styles are left
            image1.removeAttribute('style');
            image2.removeAttribute('style');
        }

        tiltGameContainer(duration = 3200) {
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
        }
}

const tutorial = new Tutorial();

// Define the steps for each tutorial
const mainTutorialSteps = [
    { message: "Welcome to DuoNat!<br>Let's learn how to play.", highlight: null, duration: 4000 },
    { message: "Learn to distinguish two different taxa.", highlights: ['#image-container-1', '#image-container-2'], duration: 5000 },
    { message: "Drag a name to the correct image.", highlight: '.name-pair', duration: 5000, action: () => tutorial.animateDragDemo() },
    { message: "If correct, play another round of the same pair.", highlight: null, duration: 6000, action: () => tutorial.demonstrateImageSwitch() },
    { message: "Swipe left on an image for a new taxon pair.", highlight: null, action: () => { tutorial.tiltGameContainer(3200); }, duration: 6000 },
    { message: "Get more info about a taxon.", highlights: ['#info-button-1', '#info-button-2'], duration: 6000 },
    { message: "Share the current pair and collection.", highlight: '#share-button', duration: 6000 },
    { message: "Change difficulty, browse or filter.", highlight: '#level-indicator', duration: 5000 },
    { message: "Filter by common ancestry.", highlight: '#ancestry-button', duration: 5000 },
    { message: "Ready to start?<br>Let's go!", highlight: null, duration: 2000 }
];

const collectionManagerTutorialSteps = [
    { message: "Here you can choose which pairs to play.", highlight: null, duration: 4000 },
    { message: "Easy or hard? Set the level here.", highlight: '#level-filter-dropdown', duration: 5000 },
    { message: "Which part of the Tree of Life do you want to play? Choose here.", highlight: '#select-phylogeny-button', duration: 5000 },
    { message: "You can select tags here.", highlight: '#select-tags-button', duration: 5000 },
    { message: "Click the map to restrict by continent.", highlight: '.filter-summary__map', duration: 5000 },
    { message: "Search by taxon or common name.", highlight: '#taxon-search', duration: 5000 },
    { message: "Clear all filters to access all pairs.", highlight: '#clear-all-filters', duration: 5000 },
    { message: "Click on 'Play' to play your filtered collection.", highlight: '#collection-done-button', duration: 5000 }
];

const infoDialogTutorialSteps = [
    { message: "Get information on this taxon on Wikipedia.", highlight: '#wiki-button', duration: 5000 },
    { message: "Visit photo page on iNaturalist.", highlight: '#photo-button', duration: 5000 },
    { message: "Check out this observation on iNaturalist.", highlight: '#observation-button', duration: 5000 },
    { message: "Visit the iNaturalist page for this taxon.", highlight: '#taxon-button', duration: 5000 },
    { message: "Report a problem with this pair or the app.", highlight: '#report-button', duration: 5000 }
];

// Public API
const publicAPI = {
    showMainTutorial: () => {
        tutorial.initializeTutorial('main');
        tutorial.startTutorial(mainTutorialSteps);
    },
    showCollectionManagerTutorial: () => {
        tutorial.initializeTutorial('collectionManager');
        tutorial.startTutorial(collectionManagerTutorialSteps);
    },
    showInfoDialogTutorial: () => {
        tutorial.initializeTutorial('infoDialog');
        tutorial.startTutorial(infoDialogTutorialSteps);
    },
    isActive: () => tutorial.isActive,
    endCurrentTutorial: () => tutorial.endTutorial()
};

export default publicAPI;
