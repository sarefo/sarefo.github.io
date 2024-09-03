import dragAndDrop from './dragAndDrop.js';
import dialogManager from './dialogManager.js';
import state from './state.js';
import tutorial from './tutorial.js';
import ui from './ui.js';
import utils from './utils.js';
import logger from './logger.js';

import keyboardShortcuts from './keyboardShortcuts.js';
import searchHandler from './searchHandler.js';
import swipeHandler from './swipeHandler.js';
import eventUIButtons from './eventUIButtons.js';

const eventInitializer = {
    initialize() {
        this.initializeDragAndDrop();
        this.initializeTouchEvents();
        this.initializeThumbsEvents();
        this.initializeKeyboardEvents();
        this.initializeSearchFunctionality();
        this.initializeHelpButton();
        this.initializeTutorialButton();
        this.initializeDiscordButton();
        this.initializeDialogCloseButtons();
        this.initializeSearchInput();
        this.initializeHelpButtons();
    },

    initializeDragAndDrop() {
        dragAndDrop.initialize();
    },

    initializeTouchEvents() {
        const containers = [state.getElement('image1Container'), state.getElement('image2Container')];
        containers.forEach(container => {
            if (container) {
                container.addEventListener('mousedown', (e) => swipeHandler.handleMouseDown(e));
                container.addEventListener('touchstart', (e) => swipeHandler.handleTouchStart(e), { passive: true });
                container.addEventListener('mousemove', (e) => swipeHandler.handleDragMove(e));
                container.addEventListener('touchmove', (e) => swipeHandler.handleDragMove(e), { passive: true });
                container.addEventListener('mouseup', (e) => swipeHandler.handleSwipeOrDrag(e));
                container.addEventListener('touchend', (e) => swipeHandler.handleSwipeOrDrag(e));
            } else {
                logger.warn('Image container not found');
            }
        });
    },

    initializeThumbsEvents() {
        ['1', '2'].forEach(index => {
            this.safeAddEventListener(`thumbs-up-${index}`, 'click', () => eventUIButtons.handleThumbsUp(index));
            this.safeAddEventListener(`thumbs-down-${index}`, 'click', () => eventUIButtons.handleThumbsDown(index));
        });
    },

    initializeKeyboardEvents() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.handleEscapeKey(event);
            } else if (!dialogManager.isAnyDialogOpen()) {
                keyboardShortcuts.debouncedKeyboardHandler(event);
            }
        });
    },

    handleEscapeKey(event) {
        if (dialogManager.isAnyDialogOpen()) {
            dialogManager.closeAllDialogs();
            event.preventDefault();
        }
    },

    initializeSearchFunctionality() {
        searchHandler.initialize();
    },

    initializeHelpButton() {
        const helpButton = document.getElementById('help-button');
        if (helpButton) {
            helpButton.addEventListener('click', this.handleHelpButtonClick);
        }
    },

    handleHelpButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!tutorial.isActive()) {
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog && !helpDialog.open) {
                dialogManager.openDialog('help-dialog');
            }
        }
    },

    // weirdly, this button always gets invoked twice. temporary workaround crap to prevent this
    initializeTutorialButton() {
        const tutorialButton = document.getElementById('start-tutorial-button');
        if (tutorialButton) {
            let isTutorialStarting = false;
            
            const startTutorial = () => {
                if (!isTutorialStarting && !tutorial.isActive()) {
                    isTutorialStarting = true;
                    //logger.debug('Tutorial button clicked');
                    tutorial.showMainTutorial();
                    
                    // Reset the flag after a short delay
                    setTimeout(() => {
                        isTutorialStarting = false;
                    }, 1000);
                } else {
                    logger.debug('Tutorial start prevented: already starting or active');
                }
            };

            tutorialButton.addEventListener('click', startTutorial);
        } else {
            logger.warn('Tutorial button not found');
        }
    },

    initializeDiscordButton() {
        const discordButton = document.getElementById('discord-help-dialog');
        if (discordButton) {
            discordButton.addEventListener('click', () => {
                window.open('https://discord.gg/DcWrhYHmeM', '_blank');
            });
        }
    },

    initializeDialogCloseButtons() {
        this.initializeDialogCloseButton('collection-dialog');
        this.initializeDialogCloseButton('tag-dialog');
    },

    initializeDialogCloseButton(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    dialogManager.closeDialog(dialogId);
                });
            }
        }
    },

    initializeSearchInput() {
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            const debouncedHandleSearch = utils.ui.debounce(searchHandler.handleSearch.bind(searchHandler), 300);
            searchInput.addEventListener('input', debouncedHandleSearch);
            searchInput.addEventListener('keydown', searchHandler.handleSearchKeydown.bind(searchHandler));
        }
    },

    initializeHelpButtons() {
        const collHelpButton = document.getElementById('collection-help-button');
        if (collHelpButton) {
            collHelpButton.addEventListener('click', this.handleCollectionHelpButtonClick);
        }
        const infoHelpButton = document.getElementById('info-help-button');
        if (infoHelpButton) {
            infoHelpButton.addEventListener('click', this.handleInfoHelpButtonClick);
        }
    },

    handleCollectionHelpButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        tutorial.showCollectionManagerTutorial();
    },

    handleInfoHelpButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        tutorial.showInfoDialogTutorial();
    },

    safeAddEventListener(id, eventType, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            //logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
        }
    }
};

// Bind all methods in eventInitializer
Object.keys(eventInitializer).forEach(key => {
    if (typeof eventInitializer[key] === 'function') {
        eventInitializer[key] = eventInitializer[key].bind(eventInitializer);
    }
});

export default eventInitializer;
// don't call directly; API is in eventMain
