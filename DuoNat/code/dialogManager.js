import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import enterSet from './enterSet.js';
import gameSetup from './gameSetup.js';
import gameLogic from './gameLogic.js';
import infoDialog from './infoDialog.js';
import logger from './logger.js';
import eventMain from './eventMain.js';
import phylogenySelector from './phylogenySelector.js';
import rangeSelector from './rangeSelector.js';
import reporting from './reporting.js';
import setManager from './setManager.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import testingDialog from './testingDialog.js';
import tutorial from './tutorial.js';
import ui from './ui.js';
import utils from './utils.js';

const dialogManager = {
    dialogIds: [
        'ancestry-dialog',
        'ancestry-popup',
        'collection-dialog',
        'enter-set-dialog',
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
            enterSet.initialize();

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
                //                collectionManager.openCollectionManagerDialog();
                collectionManager.setupSelectSetDialog();
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
                    //dialogManager.utils.enableMainEventHandlers();
                    eventMain.enableKeyboardShortcuts();
                }
            } else {
                logger.error(`Dialog element not found or not an HTMLDialogElement: ${dialogId}`);
            }
        },

        isAnyDialogOpen() {
            return Array.isArray(dialogManager.openDialogs) && dialogManager.openDialogs.length > 0;
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
            const isValid = dialogManager.taxon1Input.value.trim() !== '' && dialogManager.taxon2Input.value.trim() !== '';
            dialogManager.submitButton.disabled = !isValid;
        },

        clearEnterPairInputs() {
            const taxon1Input = document.getElementById('taxon1');
            const taxon2Input = document.getElementById('taxon2');
            const dialogMessage = document.getElementById('dialog-message');
            taxon1Input.value = '';
            taxon2Input.value = '';
            dialogMessage.textContent = '';
            dialogManager.validateInputs();
        },


        disableMainEventHandlers() {
            const mainElements = ['#random-pair-button', '#collection-button', '#enter-set-button', '#share-button', '#help-button'];
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


    specialDialogs: {
        showINatDownDialog() {
            dialogManager.specialDialogs.hideLoadingScreen();
            dialogManager.specialDialogs.openINatDownDialog();
            dialogManager.specialDialogs.setupINatDownDialogButtons();
        },

        hideLoadingScreen() {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
        },

        openINatDownDialog() {
            dialogManager.openDialog('inat-down-dialog');
        },

        setupINatDownDialogButtons() {
            const checkStatusBtn = document.getElementById('check-inat-status');
            const retryConnectionBtn = document.getElementById('retry-connection');

            checkStatusBtn.addEventListener('click', dialogManager.specialDialogs.handleCheckStatus);
            retryConnectionBtn.addEventListener('click', dialogManager.specialDialogs.handleRetryConnection);
        },

        handleCheckStatus() {
            window.open('https://inaturalist.org', '_blank');
        },

        async handleRetryConnection() {
            dialogManager.core.closeDialog();
            if (await api.externalAPIs.isINaturalistReachable()) {
                gameSetup.setupGame(true);
            } else {
                dialogManager.specialDialogs.showINatDownDialog();
            }
        },

        hideINatDownDialog() {
            dialogManager.core.closeDialog();
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

    isAnyDialogOpen: dialogManager.core.isAnyDialogOpen,
    getOpenDialogs: dialogManager.core.getOpenDialogs,

    showINatDownDialog: dialogManager.specialDialogs.showINatDownDialog,
    hideINatDownDialog: dialogManager.specialDialogs.hideINatDownDialog,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(dialogManager);
    }
});

export default publicAPI;
