import api from './api.js';
import config from './config.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import gameSetup from './gameSetup.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import { gameState, updateGameState } from './state.js';
import rangeSelector from './rangeSelector.js';
import setManager from './setManager.js';
import tagCloud from './tagCloud.js';
import ui from './ui.js';
import utils from './utils.js';

const dialogManager = {
    mainEventHandlers: {},
    eventListeners: {},
    openDialogs: [],

    events: {
        on(eventName, callback) {
            if (!this.eventListeners[eventName]) {
                this.eventListeners[eventName] = [];
            }
            this.eventListeners[eventName].push(callback);
        },

        off(eventName, callback) {
            if (this.eventListeners[eventName]) {
                this.eventListeners[eventName] = this.eventListeners[eventName].filter(
                    listener => listener !== callback
                );
            }
        },

        emit(eventName, data) {
            if (this.eventListeners[eventName]) {
                this.eventListeners[eventName].forEach(callback => callback(data));
            } else {
                //logger.debug(`No listeners for event: ${eventName}`);
            }
        },
    },

    core: {

        openDialog: function(dialogId) {
            if (ui.tutorial.isActive && dialogId !== 'help-dialog') {
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
            this.openDialogs.push(dialogId);

            dialog.removeEventListener('keydown', dialogManager.core.handleDialogKeydown);
            dialog.addEventListener('keydown', dialogManager.core.handleDialogKeydown.bind(this));

            if (this.openDialogs.length === 1) {
                dialogManager.utils.disableMainEventHandlers();
            }

            if (dialogId === 'select-set-dialog') {
                ui.taxonPairList.updateFilterSummary();
            }

            if (dialogId === 'report-dialog') {
                this.resetReportDialog();
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
                this.openDialogs.splice(index, 1);

                dialog.removeEventListener('keydown', dialogManager.core.handleDialogKeydown);

                if (this.openDialogs.length === 0) {
                    this.utils.enableMainEventHandlers();
                }
            }
        },

        isAnyDialogOpen() {
            return dialogManager.openDialogs.size > 0;
        },

        closeAllDialogs() {
            [...dialogManager.openDialogs].forEach(dialogId => this.closeDialog(dialogId));
        },

        handleDialogKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                const topDialogId = dialogManager.openDialogs[dialogManager.openDialogs.length - 1];
                if (topDialogId === 'tag-cloud-dialog') {
                    tagCloud.closeTagCloud();
                } else {
                    this.closeDialog(topDialogId);
                }
            }
        },

        handleDialogClose(dialog) {
            // Any additional cleanup needed when a dialog is closed
            ui.core.resetUIState();
        },
    },

    initialization: {

        initializeDialogs() {
            this.initialization.initializeHelpDialog();
            this.initialization.initializeInfoDialog();
            this.initialization.initializeReportDialog();
            this.initialization.initializeEnterSetDialog();

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

            // TODO should be in its own module somewhere I think
            const filterSummaryMap = document.querySelector('.filter-summary__map');
            if (filterSummaryMap) {
                filterSummaryMap.addEventListener('click', () => {
                    rangeSelector.openRangeDialog();
                });
            }

            const clearFiltersButton = document.getElementById('clear-all-filters');
            if (clearFiltersButton) {
                clearFiltersButton.addEventListener('click', dialogManager.handlers.clearAllFilters.bind(this));
            }
            const selectSetDoneButton = document.getElementById('select-set-done-button');
            if (selectSetDoneButton) {
                selectSetDoneButton.addEventListener('click', dialogManager.handlers.handleSelectSetDone.bind(this));
            }


            dialogManager.events.on('dialogClose', (dialogId) => {
                // Add any specific actions you want to perform when a dialog is closed
            });

            this.initialization.initializeReportDialog();

        },

        initializeHelpDialog() {
            document.getElementById('help-button').addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!ui.tutorial.isActive) {
                    dialogManager.core.openDialog('help-dialog');
                    dialogManager.utils.toggleKeyboardShortcuts();
                } else {
                    logger.debug("Tutorial is active, help dialog not opened");
                }
            });
        },

        initializeInfoDialog() {
            const infoDialog = document.getElementById('info-dialog');

            // Check if the device has a keyboard
            if (utils.device.hasKeyboard()) {
                document.body.classList.add('has-keyboard');
            }

            const handleKeyPress = (event) => {
                if (!infoDialog.open) return; // Only handle keypresses when the dialog is open

                // Ignore keypress events if the active element is a text input or textarea
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                    return;
                }

                if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
                    return; // Exit the function if any modifier key is pressed
                }

                event.stopPropagation();
                const key = event.key.toLowerCase();
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
            };

            const reportButton = document.getElementById('report-button');
            reportButton.addEventListener('click', () => {
                dialogManager.core.closeDialog('info-dialog');
                dialogManager.core.openDialog('report-dialog');
            });

            document.addEventListener('keydown', handleKeyPress);
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
            const isValid = this.taxon1Input.value.trim() !== '' && this.taxon2Input.value.trim() !== '';
            this.submitButton.disabled = !isValid;
        },

        clearEnterPairInputs() {
            const taxon1Input = document.getElementById('taxon1');
            const taxon2Input = document.getElementById('taxon2');
            const dialogMessage = document.getElementById('dialog-message');
            taxon1Input.value = '';
            taxon2Input.value = '';
            dialogMessage.textContent = '';
            this.validateInputs();
        },

        addLoadingSpinner() {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            this.dialogMessage.appendChild(spinner);
        },

        removeLoadingSpinner() {
            const spinner = this.dialogMessage.querySelector('.loading-spinner');
            if (spinner) {
                spinner.remove();
            }
        },

        disableMainEventHandlers() {
            //logger.debug('Disabling main event handlers');
            const mainElements = ['#random-pair-button', '#select-set-button', '#enter-set-button', '#share-button', '#help-button'];
            mainElements.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    this.mainEventHandlers[selector] = element.onclick;
                    element.onclick = null;
                }
            });

            document.removeEventListener('keydown', eventHandlers.debouncedKeyboardHandler);
            //logger.debug('Removed keydown event listener');
        },

        enableMainEventHandlers() {
            //logger.debug('Enabling main event handlers');
            Object.entries(this.mainEventHandlers).forEach(([selector, handler]) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.onclick = handler;
                }
            });

            document.addEventListener('keydown', eventHandlers.debouncedKeyboardHandler);
            //logger.debug('Added keydown event listener');

            this.mainEventHandlers = {};
        },
    },

    handlers: {

        async handleNewPairSubmit(event) {
            event.preventDefault();

            const taxon1 = this.taxon1Input.value.trim();
            const taxon2 = this.taxon2Input.value.trim();

            if (!taxon1 || !taxon2) {
                this.dialogMessage.textContent = 'Please enter both taxa.';
                return;
            }

            this.dialogMessage.textContent = 'Validating taxa...';
            this.submitButton.disabled = true;
            this.addLoadingSpinner();

            try {
                const [validatedTaxon1, validatedTaxon2] = await Promise.all([
                    api.taxonomy.validateTaxon(taxon1),
                    api.taxonomy.validateTaxon(taxon2)
                ]);

                if (validatedTaxon1 && validatedTaxon2) {
                    const newPair = {
                        taxon1: validatedTaxon1.name,
                        taxon2: validatedTaxon2.name
                    };

                    this.dialogMessage.textContent = 'Saving new pair...';

                    try {
                        const response = await fetch('./data/taxonPairs.json');
                        const taxonPairs = await response.json();
                        taxonPairs.push(newPair);

                        game.nextSelectedPair = newPair;
                        this.closeDialog();
                        gameSetup.setupGame(true);
                    } catch (error) {
                        logger.error('Error updating taxonPairs.json:', error);
                        this.dialogMessage.textContent = 'Error saving new pair. Please try again.';
                    }
                } else {
                    this.dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
                }
            } catch (error) {
                logger.error('Error validating taxa:', error);
                this.dialogMessage.textContent = 'Error validating taxa. Please try again.';
            } finally {
                this.submitButton.disabled = false;
                this.removeLoadingSpinner();
            }
        },

        handleReportSubmit: function (event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            const reportTypes = formData.getAll('report-type');
            const details = document.getElementById('report-dialog__details').value;

            if (reportTypes.length === 0) {
                ui.notifications.showPopupNotification("Please select at least one issue to report.", 3000);
                return;
            }

            let emailBody = "Report Types:\n";
            reportTypes.forEach(type => {
                emailBody += `- ${this.getReportTypeText(type)}\n`;
            });

            if (details.trim() !== '') {
                emailBody += `\nAdditional Details:\n${details}\n`;
            }

            emailBody += "\nGame State Information:\n";
            if (gameState.currentTaxonImageCollection && gameState.currentTaxonImageCollection.pair) {
                const pair = gameState.currentTaxonImageCollection.pair;
                emailBody += `Taxon 1: ${pair.taxon1}\n`;
                emailBody += `Taxon 2: ${pair.taxon2}\n`;
                emailBody += `Set Name: ${pair.setName || 'N/A'}\n`;
                emailBody += `Set ID: ${pair.setID || 'N/A'}\n`;
                emailBody += `Level: ${pair.level || 'N/A'}\n`;
            } else {
                emailBody += "Current taxon pair information not available\n";
            }

            // Include current image URLs
            if (game.currentObservationURLs) {
                emailBody += `Image 1 URL: ${game.currentObservationURLs.imageOne || 'N/A'}\n`;
                emailBody += `Image 2 URL: ${game.currentObservationURLs.imageTwo || 'N/A'}\n`;
            } else {
                emailBody += "Current image URLs not available\n";
            }

            this.sendReportEmail(emailBody);
        },

        async handleEnterSetSubmit(taxon1, taxon2, messageElement, submitButton) {
            logger.debug(`Handling submit for taxa: ${taxon1}, ${taxon2}`);
            messageElement.textContent = 'Validating taxa...';
            submitButton.disabled = true;

            try {
                const [validatedTaxon1, validatedTaxon2] = await Promise.all([
                    api.taxonomy.validateTaxon(taxon1),
                    api.taxonomy.validateTaxon(taxon2)
                ]);

                logger.debug(`Validation results: Taxon1: ${JSON.stringify(validatedTaxon1)}, Taxon2: ${JSON.stringify(validatedTaxon2)}`);

                if (validatedTaxon1 && validatedTaxon2) {
                    const newSet = {
                        taxon1: validatedTaxon1.name,
                        taxon2: validatedTaxon2.name,
                        vernacular1: validatedTaxon1.preferred_common_name || '',
                        vernacular2: validatedTaxon2.preferred_common_name || ''
                    };

                    logger.debug('New set created:', newSet);

                    // Set the new pair as the next selected pair
                    game.nextSelectedPair = newSet;

                    this.closeDialog('enter-set-dialog');
                    gameSetup.setupGame(true);
                } else {
                    messageElement.textContent = 'One or both taxa are invalid. Please check and try again.';
                    logger.debug('Taxa validation failed');
                }
            } catch (error) {
                logger.error('Error validating taxa:', error);
                messageElement.textContent = 'Error validating taxa. Please try again.';
            } finally {
                submitButton.disabled = false;
            }
        },

        clearAllFilters() {
            gameState.selectedTags = [];
            gameState.selectedRanges = [];
            gameState.selectedLevel = '';

            // Reset the level dropdown
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.value = '';
            }

            // Clear tags
            tagCloud.clearAllTags();

            // Clear ranges
            rangeSelector.setSelectedRanges([]);

            // Update the UI
            ui.taxonPairList.updateTaxonPairList();
            ui.taxonPairList.updateFilterSummary();

            // Optionally, you can add a notification here
            ui.notifications.showPopupNotification('All filters cleared');
        },

        handleSelectSetDone() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            const selectedLevel = levelDropdown.value;

            gameLogic.applyFilters({
                level: selectedLevel,
                ranges: gameState.selectedRanges,
                tags: gameState.selectedTags
            });

            setManager.refreshSubset();

            this.closeDialog('select-set-dialog');
        },
    },

    specialDialogs: {

        showINatDownDialog() {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }

            dialogManager.openDialog('inat-down-dialog');

            const checkStatusBtn = document.getElementById('check-inat-status');
            const retryConnectionBtn = document.getElementById('retry-connection');

            const checkStatusHandler = () => {
                window.open('https://inaturalist.org', '_blank');
            };

            const retryConnectionHandler = async () => {
                dialogManager.closeDialog();
                if (await api.externalAPIs.isINaturalistReachable()) {
                    gameSetup.setupGame(true);
                } else {
                    this.showINatDownDialog();
                }
            };

            checkStatusBtn.addEventListener('click', checkStatusHandler);
            retryConnectionBtn.addEventListener('click', retryConnectionHandler);
        },

        hideINatDownDialog() {
            dialogManager.closeDialog();
        },
    },

    reporting: {

        sendReportEmail: function (body) {
            const subject = "DuoNat Report";
            const recipient = "sarefo@gmail.com";
            const fullEmailContent = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;

            // Copy to clipboard
            this.copyToClipboard(fullEmailContent);

            // Attempt to open email client
            const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = mailtoLink;

            // Show popup notification
            ui.notifications.showPopupNotification(
                "Attempting to open your email client. If it doesn't open, the report has been copied to your clipboard. Please paste it into your email client and send to " + recipient,
                6000  // Increased duration to 6 seconds for longer message
            );

            // Log the actions for debugging
            logger.debug('Report content copied to clipboard and mailto link opened');

            // Close the report dialog and reset it
            setTimeout(() => {
                this.closeDialog('report-dialog');
                this.resetReportDialog();
            }, 6000);  // Increased to match notification duration
        },

        copyToClipboard: function (text) {
            if (navigator.clipboard && window.isSecureContext) {
                // Use the Clipboard API when available
                navigator.clipboard.writeText(text).then(() => {
                    logger.debug('Text successfully copied to clipboard using Clipboard API');
                }).catch(err => {
                    logger.error('Failed to copy text using Clipboard API: ', err);
                    this.fallbackCopyToClipboard(text);
                });
            } else {
                // Fallback to older method
                this.fallbackCopyToClipboard(text);
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
                this.showPopupNotification("Failed to copy report. Please try again.");
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

    // Public API
    initialize() {
        this.bindAllMethods();
        this.initialization.initializeDialogs();

        this.handlers.handleNewPairSubmit = this.handlers.handleNewPairSubmit.bind(this.handlers);
        this.handlers.handleReportSubmit = this.handlers.handleReportSubmit.bind(this.handlers);
        this.handlers.handleEnterSetSubmit = this.handlers.handleEnterSetSubmit.bind(this.handlers);
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

    openDialog(dialogId) {
        this.core.openDialog(dialogId);
    },
    closeDialog(dialogId, fromTagCloud = false) {
        this.core.closeDialog(dialogId, fromTagCloud);
    },

    isAnyDialogOpen() {
        return this.core.isAnyDialogOpen();
    },
    closeAllDialogs() {
        this.core.closeAllDialogs();
    },

    showINatDownDialog() {
        this.specialDialogs.showINatDownDialog();
    },
    hideINatDownDialog() {
        this.specialDialogs.hideINatDownDialog();
    },

    clearAllFilters() {
        dialogManager.handlers.clearAllFilters();
    }
};

export default dialogManager;
