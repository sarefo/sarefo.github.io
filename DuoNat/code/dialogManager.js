import api from './api.js';
import collectionManager from './collectionManager.js';
import enterPair from './enterPair.js';
import iNatDownDialog from './iNatDownDialog.js';
import infoDialog from './infoDialog.js';
import logger from './logger.js';
import eventMain from './eventMain.js';
import phylogenySelector from './phylogenySelector.js';
import rangeSelector from './rangeSelector.js';
import reporting from './reporting.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import testingDialog from './testingDialog.js';
import tutorial from './tutorial.js';
import ui from './ui.js';

const dialogManager = {
    dialogIds: [
        'ancestry-dialog',
        'ancestry-popup',
        'collection-dialog',
        'enter-pair-dialog',
        'help-dialog',
        'inat-down-dialog',
        'info-dialog',
        'keyboard-shortcuts-dialog',
        'phylogeny-dialog',
        'qr-dialog',
        'range-dialog',
        'report-dialog',
        'tag-dialog',
    ],

    mainEventHandlers: {},
    eventListeners: {},
    openDialogs: [],

    initialization: {

        async initialize() {
            if (!Array.isArray(dialogManager.openDialogs)) {
                dialogManager.openDialogs = [];
            }
            await this.initializeDialogs();
        },

        async initializeDialogs() {
            await this.loadDialogs();
            this.initializeKeyboardShortcutsDialog();

            infoDialog.initialize();
            collectionManager.initialize();
            tagSelector.initialize();
            rangeSelector.initialize();
            phylogenySelector.initialize();
            reporting.initialize();
            testingDialog.initialize();
            enterPair.initialize();

            this.initializeHelpDialog();

            this.initializeCloseButtons();
            this.initializeDialogCloseEvent();
        },

        initializeCloseButtons() {
            dialogManager.dialogIds.forEach(dialogId => {
                const dialog = document.getElementById(dialogId);
                if (dialog) {
                    const closeButton = dialog.querySelector('.dialog-close-button');
                    if (closeButton) {
                        closeButton.addEventListener('click', () => dialogManager.core.closeDialog(dialogId));
                    }
                } else {
                    logger.warn(`Dialog with id "${dialogId}" not found in the DOM`);
                }
            });
        },

        initializeDialogCloseEvent() {
            dialogManager.events.on('dialogClose', (dialogId) => {
                // Add any specific actions you want to perform when a dialog is closed
            });
        },

        initializeHelpDialog() {
            document.getElementById('help-button').addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!tutorial.isActive()) {
                    dialogManager.core.openDialog('help-dialog');
                    dialogManager.initialization.updateKeyboardShortcutsButton();
                } else {
                    logger.debug("Tutorial is active, help dialog not opened");
                }
            });
        },

        updateKeyboardShortcutsButton() {
            const container = document.getElementById('keyboard-shortcuts-button-container');
            if (container) {
                if (state.getHasKeyboard()) {
                    container.innerHTML = `
                        <button id="keyboard-shortcuts-button" class="dialog-button help-dialog__button">
                            Keyboard Shortcuts
                        </button>
                    `;
                    const button = document.getElementById('keyboard-shortcuts-button');
                    button.addEventListener('click', () => {
                        dialogManager.core.closeDialog('help-dialog');
                        dialogManager.core.openDialog('keyboard-shortcuts-dialog');
                    });
                } else {
                    container.remove(); // Remove the button if no keyboard is detected
                }
            }
        },

        initializeKeyboardShortcutsDialog() {
            const dialog = document.getElementById('keyboard-shortcuts-dialog');
            if (dialog) {
                const closeButton = dialog.querySelector('.dialog-close-button');
                if (closeButton) {
                    closeButton.addEventListener('click', () => dialogManager.core.closeDialog('keyboard-shortcuts-dialog'));
                }
            }
        },

        loadDialogs: async function () {
            const loadPromises = dialogManager.dialogIds.map(id => dialogManager.initialization.loadDialog(id));
            await Promise.all(loadPromises);
        },

        loadDialog: async function (id) {
            const response = await fetch(`./html/dialogs/${id}.html`);
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);
        },
    },

    events: {
        on(eventName, callback) {
            if (!dialogManager.eventListeners[eventName]) {
                dialogManager.eventListeners[eventName] = [];
            }
            dialogManager.eventListeners[eventName].push(callback);
        },

        off(eventName, callback) {
            if (dialogManager.eventListeners[eventName]) {
                dialogManager.eventListeners[eventName] = dialogManager.eventListeners[eventName].filter(
                    listener => listener !== callback
                );
            }
        },

        emit(eventName, data) {
            if (dialogManager.eventListeners[eventName]) {
                dialogManager.eventListeners[eventName].forEach(callback => callback(data));
            } else {
                //logger.debug(`No listeners for event: ${eventName}`);
            }
        },
    },

    core: {

        openDialog: function (dialogId) {
            if (tutorial.isActive() && dialogId !== 'help-dialog') {
                return;
            }

            const dialog = document.getElementById(dialogId);
            if (!dialog) {
                return;
            }

            if (dialog.open) {
                return;
            }

            dialog.showModal();
            dialogManager.openDialogs.push(dialogId);

            dialog.removeEventListener('keydown', dialogManager.core.handleDialogKeydown);
            dialog.addEventListener('keydown', dialogManager.core.handleDialogKeydown.bind(this));

            if (dialogManager.openDialogs.length === 1) {
                eventMain.disableKeyboardShortcuts();
            }

            if (dialogId === 'help-dialog') {
                dialogManager.initialization.updateKeyboardShortcutsButton();
            }

            if (dialogId === 'collection-dialog') {
                collectionManager.setupCollectionManagerDialog();
            }

            if (dialogId === 'phylogeny-dialog') {
                phylogenySelector.updateGraph();
                if (state.getHasKeyboard()) {
                    setTimeout(() => phylogenySelector.focusSearchInput(), 100);
                }
            }

            if (dialogId === 'report-dialog') {
                reporting.resetReportDialog();
            }
        },

        closeDialog: function (dialogId) {
            const index = dialogManager.openDialogs.indexOf(dialogId);
            if (index === -1) {
                return;
            }

            const dialog = document.getElementById(dialogId);
            if (dialog && dialog instanceof HTMLDialogElement) {
                dialog.close();
                dialogManager.openDialogs.splice(index, 1);

                dialog.removeEventListener('keydown', dialogManager.core.handleDialogKeydown);

                if (dialogManager.openDialogs.length === 0) {
                    eventMain.enableKeyboardShortcuts();
                }
            } else {
                logger.error(`Dialog element not found or not an HTMLDialogElement: ${dialogId}`);
            }
        },

        isAnyDialogOpen() {
            // Check actual DOM state of dialogs
            const openDialogs = dialogManager.dialogIds.filter(id => {
                const dialog = document.getElementById(id);
                return dialog && dialog.open;
            });

            // Update internal state
            this.openDialogs = openDialogs;

            const isOpen = openDialogs.length > 0;
            return isOpen;
        },

        closeAllDialogs() {
            [...dialogManager.openDialogs].forEach(dialogId => dialogManager.core.closeDialog(dialogId));
            eventMain.enableKeyboardShortcuts();
        },

        getOpenDialogs() {
            return [...dialogManager.openDialogs];
        },

        handleDialogKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                const topDialogId = dialogManager.openDialogs[dialogManager.openDialogs.length - 1];
                if (topDialogId === 'tag-dialog') {
                    tagSelector.closeTagSelector();
                } else {
                    dialogManager.core.closeDialog(topDialogId);
                }
            }
        },

        handleDialogClose(dialog) {
            // Any additional cleanup needed when a dialog is closed
            ui.resetUIState();
        },

        resetDialogState() {
            const actualOpenDialogs = dialogManager.dialogIds.filter(id => {
                const dialog = document.getElementById(id);
                return dialog && dialog.open;
            });

            this.openDialogs = actualOpenDialogs;

            if (this.openDialogs.length === 0) {
                eventMain.enableKeyboardShortcuts();
            }

            //logger.debug(`Dialog state reset. Open dialogs: ${this.openDialogs.join(', ')}`);
        },
    },

    utils: {
        toggleKeyboardShortcuts() {
            const keyboardShortcutsSection = document.getElementById('keyboard-shortcuts');
            if (!keyboardShortcutsSection) {
                return;
            }
            keyboardShortcutsSection.style.display = state.getHasKeyboard() ? 'block' : 'none';
        },

        validateInputs() {
            const isValid = dialogManager.taxonAInput.value.trim() !== '' && dialogManager.taxonBInput.value.trim() !== '';
            dialogManager.submitButton.disabled = !isValid;
        },

        clearEnterPairInputs() {
            const taxonAInput = document.getElementById('taxonA');
            const taxonBInput = document.getElementById('taxonB');
            const dialogMessage = document.getElementById('dialog-message');
            taxonAInput.value = '';
            taxonBInput.value = '';
            dialogMessage.textContent = '';
            dialogManager.validateInputs();
        },


        disableMainEventHandlers() {
            const mainElements = ['#random-pair-button', '#collection-button', '#enter-pair-button', '#share-button', '#help-button'];
            mainElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    dialogManager.mainEventHandlers[selector] = element.onclick;
                    element.onclick = null;
                }
            });
            eventMain.disableKeyboardShortcuts();
        },

        enableMainEventHandlers() {
            Object.entries(dialogManager.mainEventHandlers).forEach(([selector, handler]) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.onclick = handler;
                }
            });
            eventMain.enableKeyboardShortcuts();

            dialogManager.mainEventHandlers = {};
        },
    },
};

const bindAllMethods = (obj) => {
    for (let prop in obj) {
        if (typeof obj[prop] === 'function') {
            obj[prop] = obj[prop].bind(obj);
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            bindAllMethods(obj[prop]);
        }
    }
};

bindAllMethods(dialogManager);

const publicAPI = {
    initialize: dialogManager.initialization.initialize,

    openDialog: dialogManager.core.openDialog,
    closeDialog: dialogManager.core.closeDialog,
    closeAllDialogs: dialogManager.core.closeAllDialogs,
    resetDialogState: dialogManager.core.resetDialogState,

    isAnyDialogOpen: dialogManager.core.isAnyDialogOpen,
    getOpenDialogs: dialogManager.core.getOpenDialogs,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(dialogManager);
    }
});

export default publicAPI;
