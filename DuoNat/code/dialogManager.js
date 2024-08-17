import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import mainEventHandler from './mainEventHandler.js';
import gameSetup from './gameSetup.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import setManager from './setManager.js';
import state from './state.js';
import tagCloud from './tagCloud.js';
import tutorial from './tutorial.js';
import ui from './ui.js';
import utils from './utils.js';

const dialogManager = {
    mainEventHandlers: {},
    eventListeners: {},
    openDialogs: [],

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

        openDialog: function(dialogId) {
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
                dialogManager.utils.disableMainEventHandlers();
                mainEventHandler.disableShortcuts();
            }

            if (dialogId === 'help-dialog') {
                dialogManager.initialization.updateKeyboardShortcutsButton();
            }

            if (dialogId === 'select-set-dialog') {
//                collectionManager.openCollectionManagerDialog();
                collectionManager.setupSelectSetDialog();
            }

            if (dialogId === 'report-dialog') {
                dialogManager.reporting.resetReportDialog();
            }
        },

        closeDialog: function(dialogId) {
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
                    dialogManager.utils.enableMainEventHandlers();
                    mainEventHandler.enableShortcuts();
                }
            } else {
                logger.error(`Dialog element not found or not an HTMLDialogElement: ${dialogId}`);
            }
        },

        isAnyDialogOpen() {
            return dialogManager.openDialogs.size > 0;
        },

        closeAllDialogs() {
            [...dialogManager.openDialogs].forEach(dialogId => dialogManager.core.closeDialog(dialogId));
            mainEventHandler.enableShortcuts();
        },

        handleDialogKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                const topDialogId = dialogManager.openDialogs[dialogManager.openDialogs.length - 1];
                if (topDialogId === 'tag-cloud-dialog') {
                    tagCloud.closeTagCloud();
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

    initialization: {
        initializeDialogs() {
            dialogManager.initialization.initializeHelpDialog();
            dialogManager.initialization.initializeKeyboardShortcutsDialog();
            dialogManager.initialization.initializeInfoDialog();
            dialogManager.initialization.initializeReportDialog();
            dialogManager.initialization.initializeEnterSetDialog();
            dialogManager.initialization.initializeCloseButtons();
            dialogManager.initialization.initializeDialogCloseEvent();
        },

        initializeCloseButtons() {
            const dialogs = ['select-set-dialog', 'tag-cloud-dialog', 'range-dialog',
                  'enter-set-dialog', 'qr-dialog', 'help-dialog', 'info-dialog',
                  'report-dialog', 'phylogeny-dialog', 'inat-down-dialog'];
            dialogs.forEach(dialogId => {
                const dialog = document.getElementById(dialogId);
                const closeButton = dialog.querySelector('.dialog-close-button');
                if (closeButton) {
                    closeButton.addEventListener('click', () => dialogManager.core.closeDialog(dialogId));
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
                    dialogManager.updateKeyboardShortcutsButton();
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

        initializeInfoDialog() {
            const infoDialog = document.getElementById('info-dialog');
            dialogManager.initialization.addKeyboardClass();
            dialogManager.initialization.addInfoDialogKeyListener(infoDialog);
            dialogManager.initialization.initializeReportButton();
        },

        addKeyboardClass() {
            if (utils.device.hasKeyboard()) {
                document.body.classList.add('has-keyboard');
            }
        },

        addInfoDialogKeyListener(infoDialog) {
            const handleKeyPress = dialogManager.initialization.createInfoDialogKeyPressHandler(infoDialog);
            document.addEventListener('keydown', handleKeyPress);
        },

        createInfoDialogKeyPressHandler(infoDialog) {
            return (event) => {
                if (!infoDialog.open) return;
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
                if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;

                event.stopPropagation();
                const key = event.key.toLowerCase();
                dialogManager.initialization.handleInfoDialogKeyPress(key, event, infoDialog);
            };
        },

        handleInfoDialogKeyPress(key, event, infoDialog) {
            const buttonMap = {
                'p': 'photo-button',
                'h': 'hints-button',
                'o': 'observation-button',
                't': 'taxon-button',
                'w': 'wiki-button',
                'r': 'report-button'
            };

            if (buttonMap[key]) {
                event.preventDefault();
                document.getElementById(buttonMap[key]).click();
            } else if (key === 'escape') {
                event.preventDefault();
                infoDialog.close();
            }
        },

        initializeReportButton() {
            const reportButton = document.getElementById('report-button');
            reportButton.addEventListener('click', () => {
                dialogManager.core.closeDialog('info-dialog');
                dialogManager.core.openDialog('report-dialog');
            });
        },

        initializeReportDialog: function () {
            const reportDialog = document.getElementById('report-dialog');
            if (!reportDialog) {
                logger.error('Report dialog not found in the DOM');
                return;
            }

            const reportForm = reportDialog.querySelector('#report-dialog__form');
            if (!reportForm) {
                logger.error('Report form not found in the report dialog');
                return;
            }

            const reportOptions = reportForm.querySelectorAll('input[name="report-type"]');
            const reportDetails = reportDialog.querySelector('#report-dialog__details');

            if (!reportDetails) {
                logger.error('Report details textarea not found in the report dialog');
                return;
            }

            reportOptions.forEach(option => {
                option.addEventListener('change', () => {
                    const isOtherChecked = Array.from(reportOptions).some(opt => opt.value === 'other' && opt.checked);
                    reportDetails.style.display = isOtherChecked ? 'block' : 'none';
                });
            });

            reportForm.addEventListener('submit', dialogManager.handlers.handleReportSubmit.bind(this));
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
            const mainElements = ['#random-pair-button', '#select-set-button', '#enter-set-button', '#share-button', '#help-button'];
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

        handleReportSubmit: function (event) {
            event.preventDefault();
            const reportData = dialogManager.handlers.collectReportData(event.target);
            if (!dialogManager.handlers.validateReportData(reportData)) return;

            const emailBody = dialogManager.handlers.constructEmailBody(reportData);
            dialogManager.reporting.sendReportEmail(emailBody);
        },

        collectReportData(form) {
            const formData = new FormData(form);
            return {
                reportTypes: formData.getAll('report-type'),
                details: document.getElementById('report-dialog__details').value
            };
        },

        validateReportData(reportData) {
            if (reportData.reportTypes.length === 0) {
                ui.showPopupNotification("Please select at least one issue to report.", 3000);
                return false;
            }
            return true;
        },

        constructEmailBody(reportData) {
            let emailBody = "Report Types:\n";
            reportData.reportTypes.forEach(type => {
                emailBody += `- ${dialogManager.reporting.getReportTypeText(type)}\n`;
            });

            if (reportData.details.trim() !== '') {
                emailBody += `\nAdditional Details:\n${reportData.details}\n`;
            }

            emailBody += dialogManager.handlers.getGameStateInfo();
            emailBody += dialogManager.handlers.getCurrentImageURLs();

            return emailBody;
        },

        getGameStateInfo() {
            let info = "\nGame State Information:\n";
            let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            if (currentTaxonImageCollection && currentTaxonImageCollection.pair) {
                const pair = currentTaxonImageCollection.pair;
                info += `Taxon 1: ${pair.taxon1}\n`;
                info += `Taxon 2: ${pair.taxon2}\n`;
                info += `Set Name: ${pair.setName || 'N/A'}\n`;
                info += `Set ID: ${pair.setID || 'N/A'}\n`;
                info += `Level: ${pair.level || 'N/A'}\n`;
            } else {
                info += "Current taxon pair information not available\n";
            }
            return info;
        },

        getCurrentImageURLs() {
            let urls = "";
            logger.debug("in getCurrentImageURLs");
            let currentObservationURLs = state.getObservationURLs();
            if (currentObservationURLs) {
                urls += `Image 1 URL: ${currentObservationURLs.imageOne || 'N/A'}\n`;
                urls += `Image 2 URL: ${currentObservationURLs.imageTwo || 'N/A'}\n`;
            } else {
                urls += "Current image URLs not available\n";
            }
            return urls;
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

    reporting: {

        sendReportEmail: function (body) {
            const subject = "DuoNat Report";
            const recipient = "sarefo@gmail.com";
            const fullEmailContent = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;

            // Copy to clipboard
            dialogManager.reporting.copyToClipboard(fullEmailContent);

            // Attempt to open email client
            const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoLink;

            // Show popup notification
            ui.showPopupNotification(
                "Attempting to open your email client. If it doesn't open, the report has been copied to your clipboard. Please paste it into your email client and send to " + recipient,
                6000  // Increased duration to 6 seconds for longer message
            );

            // Log the actions for debugging
            logger.debug('Report content copied to clipboard and mailto link opened');

            // Close the report dialog and reset it
            setTimeout(() => {
                dialogManager.core.closeDialog('report-dialog');
                dialogManager.reporting.resetReportDialog();
            }, 6000);  // Increased to match notification duration
        },

        copyToClipboard: function (text) {
            if (navigator.clipboard && window.isSecureContext) {
                // Use the Clipboard API when available
                navigator.clipboard.writeText(text).then(() => {
                    logger.debug('Text successfully copied to clipboard using Clipboard API');
                }).catch(err => {
                    logger.error('Failed to copy text using Clipboard API: ', err);
                    dialogManager.reporting.fallbackCopyToClipboard(text);
                });
            } else {
                // Fallback to older method
                dialogManager.reporting.fallbackCopyToClipboard(text);
            }
        },

        fallbackCopyToClipboard: function (text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";  // Avoid scrolling to bottom
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                const msg = successful ? 'successful' : 'unsuccessful';
                logger.debug('Fallback: Copying text command was ' + msg);
            } catch (err) {
                logger.error('Fallback: Unable to copy to clipboard', err);
                dialogManager.reporting.showPopupNotification("Failed to copy report. Please try again.");
            }
            document.body.removeChild(textArea);
        },

        resetReportDialog: function () {
            const reportForm = document.getElementById('report-dialog__form');
            const reportOptions = reportForm.querySelectorAll('input[name="report-type"]');
            const reportDetails = document.getElementById('report-dialog__details');

            // Uncheck all checkboxes
            reportOptions.forEach(option => {
                option.checked = false;
            });

            // Clear the details textarea
            reportDetails.value = '';

            // Hide the details textarea
            reportDetails.style.display = 'none';
        },

        getReportTypeText: function (type) {
            const typeMap = {
                'wrong-image': 'The image is wrong',
                'wrong-range': 'Range is wrong',
                'wrong-name': 'Name is wrong',
                'wrong-info': 'Info is wrong',
                'other': 'Something else is wrong'
            };
            return typeMap[type] || type;
        },
    },

    initialize() {
        dialogManager.bindAllMethods();
        dialogManager.initialization.initializeDialogs();

        dialogManager.handlers.handleNewPairSubmit = dialogManager.handlers.handleNewPairSubmit.bind(dialogManager.handlers);
        dialogManager.handlers.handleReportSubmit = dialogManager.handlers.handleReportSubmit.bind(dialogManager.handlers);
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
    openDialog: dialogManager.core.openDialog,
    closeDialog: dialogManager.core.closeDialog,
    getOpenDialogs: dialogManager.getOpenDialogs,
    isAnyDialogOpen: dialogManager.core.isAnyDialogOpen,
    closeAllDialogs: dialogManager.core.closeAllDialogs,
    showINatDownDialog: dialogManager.specialDialogs.showINatDownDialog,
    hideINatDownDialog: dialogManager.specialDialogs.hideINatDownDialog,
};

export default publicAPI;
