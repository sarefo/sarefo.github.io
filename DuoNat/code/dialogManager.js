import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import gameSetup from './gameSetup.js';
import gameLogic from './gameLogic.js';
import infoDialog from './infoDialog.js';
import logger from './logger.js';
import mainEventHandler from './mainEventHandler.js';
import phylogenySelector from './phylogenySelector.js';
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
        async initializeDialogs() {
            await dialogManager.initialization.loadDialogs();
            dialogManager.initialization.initializeKeyboardShortcutsDialog();

            infoDialog.initialize();
            collectionManager.initialize();
            phylogenySelector.initialize();
            reporting.initialize();
            testingDialog.initialize();

            dialogManager.initialization.initializeHelpDialog();
            dialogManager.initialization.initializeEnterSetDialog();

            dialogManager.initialization.initializeCloseButtons();
            dialogManager.initialization.initializeDialogCloseEvent();
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
                if (utils.device.hasKeyboard()) {
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
                    container.innerHTML = ''; // Remove the button if no keyboard is detected
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

        initializeEnterSetDialog() {
            logger.debug('Initializing Enter Set Dialog');
            const dialog = document.getElementById('enter-set-dialog');
            const form = dialog.querySelector('form');
            const taxon1Input = document.getElementById('taxon1');
            const taxon2Input = document.getElementById('taxon2');
            const submitButton = document.getElementById('submit-dialog');
            const dialogMessage = document.getElementById('dialog-message');

            if (!form || !taxon1Input || !taxon2Input || !submitButton || !dialogMessage) {
                logger.error('One or more elements not found in Enter Set Dialog');
                return;
            }

            form.addEventListener('submit', async (event) => {
                logger.debug('Form submitted');
                event.preventDefault();
                await dialogManager.handlers.handleEnterSetSubmit(taxon1Input.value, taxon2Input.value, dialogMessage, submitButton);
            });

            [taxon1Input, taxon2Input].forEach(input => {
                input.addEventListener('input', () => {
                    submitButton.disabled = !taxon1Input.value || !taxon2Input.value;
                    logger.debug(`Input changed. Submit button disabled: ${submitButton.disabled}`);
                });
            });

            logger.debug('Enter Set Dialog initialized');
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
                //dialogManager.utils.disableMainEventHandlers();
                mainEventHandler.disableKeyboardShortcuts();
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
                    mainEventHandler.enableKeyboardShortcuts();
                }
            } else {
                logger.error(`Dialog element not found or not an HTMLDialogElement: ${dialogId}`);
            }
        },

        isAnyDialogOpen() {
            return dialogManager.openDialogs.length > 0;
        },

        closeAllDialogs() {
            [...dialogManager.openDialogs].forEach(dialogId => dialogManager.core.closeDialog(dialogId));
            mainEventHandler.enableKeyboardShortcuts();
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
            keyboardShortcutsSection.style.display = utils.device.hasKeyboard() ? 'block' : 'none';
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

        addLoadingSpinner() {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            dialogManager.dialogMessage.appendChild(spinner);
        },

        removeLoadingSpinner() {
            const spinner = dialogManager.dialogMessage.querySelector('.loading-spinner');
            if (spinner) {
                spinner.remove();
            }
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
            mainEventHandler.disableKeyboardShortcuts();
        },

        enableMainEventHandlers() {
            Object.entries(dialogManager.mainEventHandlers).forEach(([selector, handler]) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.onclick = handler;
                }
            });
            mainEventHandler.enableKeyboardShortcuts();

            dialogManager.mainEventHandlers = {};
        },
    },

    handlers: {

        async handleNewPairSubmit(event) {
            event.preventDefault();
            const { taxon1, taxon2 } = dialogManager.getAndValidateInputs();
            if (!taxon1 || !taxon2) return;

            dialogManager.setSubmitState(true);

            try {
                const validatedTaxa = await dialogManager.validateTaxa(taxon1, taxon2);
                if (validatedTaxa) {
                    await dialogManager.saveAndSetupNewPair(validatedTaxa);
                } else {
                    dialogManager.displayValidationError();
                }
            } catch (error) {
                dialogManager.handleSubmitError(error);
            } finally {
                dialogManager.setSubmitState(false);
            }
        },

        getAndValidateInputs() {
            const taxon1 = dialogManager.taxon1Input.value.trim();
            const taxon2 = dialogManager.taxon2Input.value.trim();
            if (!taxon1 || !taxon2) {
                dialogManager.dialogMessage.textContent = 'Please enter both taxa.';
            }
            return { taxon1, taxon2 };
        },

        setSubmitState(isSubmitting) {
            dialogManager.dialogMessage.textContent = isSubmitting ? 'Validating taxa...' : '';
            dialogManager.submitButton.disabled = isSubmitting;
            if (isSubmitting) {
                dialogManager.addLoadingSpinner();
            } else {
                dialogManager.removeLoadingSpinner();
            }
        },

        async validateTaxa(taxon1, taxon2) {
            const [validatedTaxon1, validatedTaxon2] = await Promise.all([
                api.taxonomy.validateTaxon(taxon1),
                api.taxonomy.validateTaxon(taxon2)
            ]);
            return validatedTaxon1 && validatedTaxon2 ? { validatedTaxon1, validatedTaxon2 } : null;
        },

        async saveAndSetupNewPair({ validatedTaxon1, validatedTaxon2 }) {
            const newPair = {
                taxon1: validatedTaxon1.name,
                taxon2: validatedTaxon2.name
            };
            dialogManager.dialogMessage.textContent = 'Saving new pair...';
            try {
                await dialogManager.savePairToJson(newPair);
                state.setNextSelectedPair(newPair);
                dialogManager.core.closeDialog();
                gameSetup.setupGame(true);
            } catch (error) {
                throw new Error('Error saving new pair');
            }
        },

        async savePairToJson(newPair) {
            const response = await fetch('./data/taxonPairs.json');
            const taxonPairs = await response.json();
            taxonPairs.push(newPair);
            // Here you would typically save the updated taxonPairs back to the server
            // For now, we'll just simulate that it was saved successfully
        },

        displayValidationError() {
            dialogManager.dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
        },

        handleSubmitError(error) {
            logger.error('Error in handleNewPairSubmit:', error);
            dialogManager.dialogMessage.textContent = 'An error occurred. Please try again.';
        },


        async handleEnterSetSubmit(taxon1, taxon2, messageElement, submitButton) {
            logger.debug(`Handling submit for taxa: ${taxon1}, ${taxon2}`);
            dialogManager.handlers.setSubmitState(messageElement, submitButton, true);

            try {
                const [validatedTaxon1, validatedTaxon2] = await dialogManager.handlers.validateTaxa(taxon1, taxon2);
                dialogManager.handlers.handleValidationResult(validatedTaxon1, validatedTaxon2, messageElement);
            } catch (error) {
                dialogManager.handlers.handleValidationError(error, messageElement);
            } finally {
                dialogManager.handlers.setSubmitState(messageElement, submitButton, false);
            }
        },

        async validateTaxa(taxon1, taxon2) {
            return await Promise.all([
                api.taxonomy.validateTaxon(taxon1),
                api.taxonomy.validateTaxon(taxon2)
            ]);
        },

        handleValidationResult(validatedTaxon1, validatedTaxon2, messageElement) {
            logger.debug(`Validation results: Taxon1: ${JSON.stringify(validatedTaxon1)}, Taxon2: ${JSON.stringify(validatedTaxon2)}`);

            if (validatedTaxon1 && validatedTaxon2) {
                dialogManager.handlers.processValidTaxa(validatedTaxon1, validatedTaxon2);
            } else {
                messageElement.textContent = 'One or both taxa are invalid. Please check and try again.';
                logger.debug('Taxa validation failed');
            }
        },

        processValidTaxa(validatedTaxon1, validatedTaxon2) {
            const newSet = {
                taxon1: validatedTaxon1.name,
                taxon2: validatedTaxon2.name,
                vernacular1: validatedTaxon1.preferred_common_name || '',
                vernacular2: validatedTaxon2.preferred_common_name || ''
            };

            logger.debug('New set created:', newSet);
            state.setNextSelectedPair(newSet);
            dialogManager.core.closeDialog('enter-set-dialog');
            gameSetup.setupGame(true);
        },

        handleValidationError(error, messageElement) {
            logger.error('Error validating taxa:', error);
            messageElement.textContent = 'Error validating taxa. Please try again.';
        },

        setSubmitState(messageElement, submitButton, isSubmitting) {
            messageElement.textContent = isSubmitting ? 'Validating taxa...' : '';
            submitButton.disabled = isSubmitting;
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


    async initialize() {
        dialogManager.bindAllMethods();
        await dialogManager.initialization.initializeDialogs();

        dialogManager.handlers.handleNewPairSubmit = dialogManager.handlers.handleNewPairSubmit.bind(dialogManager.handlers);
        reporting.handleReportSubmit = reporting.handleReportSubmit.bind(reporting);
        dialogManager.handlers.handleEnterSetSubmit = dialogManager.handlers.handleEnterSetSubmit.bind(dialogManager.handlers);
    },

    bindAllMethods() {
        const bindMethodsInObject = (obj) => {
            for (let prop in obj) {
                if (typeof obj[prop] === 'function') {
                    obj[prop] = obj[prop].bind(this);
                } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                    bindMethodsInObject(obj[prop]);
                }
            }
        };

        bindMethodsInObject(this);
    },

    getOpenDialogs() {
        return [...dialogManager.openDialogs];
    },
};

const publicAPI = {
    initialize: dialogManager.initialize,

//    loadDialog: dialogManager.initialization.loadDialog,

    openDialog: dialogManager.core.openDialog,
    closeDialog: dialogManager.core.closeDialog,
    closeAllDialogs: dialogManager.core.closeAllDialogs,

    isAnyDialogOpen: dialogManager.core.isAnyDialogOpen,
    getOpenDialogs: dialogManager.getOpenDialogs,

    showINatDownDialog: dialogManager.specialDialogs.showINatDownDialog,
    hideINatDownDialog: dialogManager.specialDialogs.hideINatDownDialog,
};

export default publicAPI;
