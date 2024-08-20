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
import mainButtonEvents from './mainButtonEvents.js';

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
    },

    initializeDragAndDrop() {
        dragAndDrop.initialize();
    },

    initializeTouchEvents() {
        const containers = [state.getElement('imageOneContainer'), state.getElement('imageTwoContainer')];
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
            this.safeAddEventListener(`thumbs-up-${index}`, 'click', () => mainButtonEvents.handleThumbsUp(index));
            this.safeAddEventListener(`thumbs-down-${index}`, 'click', () => mainButtonEvents.handleThumbsDown(index));
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

    initializeTutorialButton() {
        const tutorialButton = document.getElementById('start-tutorial-button');
        if (tutorialButton) {
            tutorialButton.addEventListener('click', () => tutorial.show());
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

    safeAddEventListener(id, eventType, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
        }
    }
};

export default eventInitializer;
// don't call directly; API is in mainEventHandler
