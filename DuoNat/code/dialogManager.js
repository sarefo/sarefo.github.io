import api from './api.js';
import config from './config.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import { gameState, updateGameState } from './state.js';
import tagCloud from './tagCloud.js';
import ui from './ui.js';

const dialogManager = {
  /*  activeDialog: null,*/
    mainEventHandlers: {},
    eventListeners: {},
    openDialogs: [],

    openDialog(dialogId) {
        if (this.openDialogs.includes(dialogId)) {
            return;
        }

        const dialog = document.getElementById(dialogId);
        if (dialog && dialog.tagName.toLowerCase() === 'dialog') {
            dialog.showModal();
            this.openDialogs.push(dialogId);
            
            // Remove any existing event listener before adding a new one
            dialog.removeEventListener('keydown', this.handleDialogKeydown);
            dialog.addEventListener('keydown', this.handleDialogKeydown.bind(this));

            if (this.openDialogs.length === 1) {
                this.disableMainEventHandlers();
            }
        }

        if (dialogId === 'report-dialog') {
            this.resetReportDialog();
        }

    },

    closeDialog(dialogId, fromTagCloud = false) {
        const index = this.openDialogs.indexOf(dialogId);
        if (index === -1) {
            return;
        }

        const dialog = document.getElementById(dialogId);
        if (dialog && dialog.tagName.toLowerCase() === 'dialog') {
            if (dialogId === 'tag-cloud-dialog' && !fromTagCloud) {
                tagCloud.closeTagCloud();
                return;
            }

            dialog.close();
            this.openDialogs.splice(index, 1);
            
            dialog.removeEventListener('keydown', this.handleDialogKeydown);

            this.handleDialogClose(dialog);
            this.emit('dialogClose', dialogId);

            if (this.openDialogs.length === 0) {
                this.enableMainEventHandlers();
            }
        }
    },

    handleDialogKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            const topDialogId = this.openDialogs[this.openDialogs.length - 1];
            if (topDialogId === 'tag-cloud-dialog') {
                tagCloud.closeTagCloud();
            } else {
                this.closeDialog(topDialogId);
            }
        }
    },

    handleDialogClose(dialog) {
        // Any additional cleanup needed when a dialog is closed
        ui.resetUIState();
    },

    isAnyDialogOpen() {
        return this.openDialogs.size > 0;
    },

    closeAllDialogs() {
        [...this.openDialogs].forEach(dialogId => this.closeDialog(dialogId));
    },

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

    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.activeDialog) {
            this.closeDialog();
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

    initializeDialogs() {
        const dialogs = ['select-set-dialog', 'tag-cloud-dialog', 'enter-set-dialog', 'qr-dialog', 'help-dialog', 'info-dialog', 'report-dialog', 'phylogeny-dialog', 'inat-down-dialog'];
        dialogs.forEach(dialogId => {
            const dialog = document.getElementById(dialogId);
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.closeDialog(dialogId));
            }
        });

        // TODO should be in its own module somewhere I think
        const selectSetDoneButton = document.getElementById('select-set-done-button');
        if (selectSetDoneButton) {
            selectSetDoneButton.addEventListener('click', this.handleSelectSetDone.bind(this));
        }

        this.on('dialogClose', (dialogId) => {
            // Add any specific actions you want to perform when a dialog is closed
        });

        this.initializeReportDialog();

    },

    handleSelectSetDone() {
        const levelDropdown = document.getElementById('level-filter-dropdown');
        const selectedLevel = levelDropdown.value;
        
        updateGameState({ selectedLevel: selectedLevel });
        ui.updateLevelDropdown();
        
        this.closeDialog('select-set-dialog');
        if (!gameLogic.isCurrentPairInCollection()) {
            gameLogic.loadRandomPairFromCurrentCollection();
        } else {
            logger.debug("Current pair is already in the collection. No new pair loaded.");
        }
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
                api.validateTaxon(taxon1),
                api.validateTaxon(taxon2)
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
                    game.setupGame(true);
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

    initializeReportDialog: function() {
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

        reportForm.addEventListener('submit', this.handleReportSubmit.bind(this));
    },

    initializeReportDialog: function() {
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

        reportForm.addEventListener('submit', this.handleReportSubmit.bind(this));
    },

    handleReportSubmit: function(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const reportTypes = formData.getAll('report-type');
        const details = document.getElementById('report-dialog__details').value;

        if (reportTypes.length === 0) {
            ui.showOverlay("Please select at least one issue to report.", config.overlayColors.red);
            setTimeout(() => ui.hideOverlay(), 2000);
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
            emailBody += `Skill Level: ${pair.skillLevel || 'N/A'}\n`;
        } else {
            emailBody += "Current taxon pair information not available\n";
        }

        if (gameState.currentObservationURLs) {
            emailBody += `Image 1 URL: ${gameState.currentObservationURLs.imageOne || 'N/A'}\n`;
            emailBody += `Image 2 URL: ${gameState.currentObservationURLs.imageTwo || 'N/A'}\n`;
        } else {
            emailBody += "Current image URLs not available\n";
        }

        this.sendReportEmail(emailBody);
    },

    sendReportEmail: function(body) {
        const subject = "DuoNat Report";
        const recipient = "sarefo@gmail.com";
        const fullEmailContent = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;

        this.copyToClipboard(fullEmailContent);

        // Log the action for debugging
        logger.debug('Report content copied to clipboard');

        // Show message to user
        this.showNotification("Report copied to clipboard. Please paste it into your email client and send to " + recipient);
        
        // Set a timeout to hide the notification and reset the dialog
        setTimeout(() => {
            this.hideNotification();
            this.closeDialog('report-dialog');
            this.resetReportDialog();
        }, 6000);  // 6 seconds should be enough time for users to read the message
    },

    showNotification: function(message) {
        logger.debug('Attempting to show notification:', message);
        
        // Try using ui.showOverlay first
        if (ui && typeof ui.showOverlay === 'function') {
            ui.showOverlay(message, config.overlayColors.green);
            logger.debug('Notification shown using ui.showOverlay');
        } else {
            // Fallback to creating a custom notification element
            logger.debug('ui.showOverlay not available, using fallback notification');
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.backgroundColor = 'rgba(116, 172, 0, 0.9)';
            notification.style.color = 'white';
            notification.style.padding = '10px 20px';
            notification.style.borderRadius = '5px';
            notification.style.zIndex = '10000';
            document.body.appendChild(notification);
            this.currentNotification = notification;
        }
    },

    hideNotification: function() {
        if (ui && typeof ui.hideOverlay === 'function') {
            ui.hideOverlay();
        } else if (this.currentNotification) {
            document.body.removeChild(this.currentNotification);
            this.currentNotification = null;
        }
    },

    copyToClipboard: function(text) {
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

    fallbackCopyToClipboard: function(text) {
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
            this.showNotification("Failed to copy report. Please try again.");
        }
        document.body.removeChild(textArea);
    },

    resetReportDialog: function() {
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

    getReportTypeText: function(type) {
        const typeMap = {
            'wrong-image': 'The image is wrong',
            'wrong-range': 'Range is wrong',
            'wrong-name': 'Name is wrong',
            'wrong-info': 'Info is wrong',
            'other': 'Something else is wrong'
        };
        return typeMap[type] || type;
    },

};

export default dialogManager;
