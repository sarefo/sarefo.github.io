import api from './api.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import logger from './logger.js';
import ui from './ui.js';

const dialogManager = {
  /*  activeDialog: null,*/
    mainEventHandlers: {},
   eventListeners: {},
    openDialogs: new Set(),

    openDialog(dialogId) {
        if (this.openDialogs.has(dialogId)) {
            //logger.debug(`Dialog ${dialogId} is already open. Skipping.`);
            return;
        }

        const dialog = document.getElementById(dialogId);
        if (dialog && dialog.tagName.toLowerCase() === 'dialog') {
            dialog.showModal();
            this.openDialogs.add(dialogId);
            
            dialog.addEventListener('keydown', (event) => this.handleDialogKeydown(event, dialogId));

            if (this.openDialogs.size === 1) {
                this.disableMainEventHandlers();
            }

        }
    },

    closeDialog(dialogId) {
        //logger.debug(`Attempting to close dialog: ${dialogId}`);
        if (!this.openDialogs.has(dialogId)) {
            //logger.debug(`Dialog ${dialogId} is not open. Skipping.`);
            return;
        }

        const dialog = document.getElementById(dialogId);
        if (dialog && dialog.tagName.toLowerCase() === 'dialog') {
            dialog.close();
            this.openDialogs.delete(dialogId);
            
            dialog.removeEventListener('keydown', (event) => this.handleDialogKeydown(event, dialogId));

            this.handleDialogClose(dialog);
            this.emit('dialogClose', dialogId);

            if (this.openDialogs.size === 0) {
                this.enableMainEventHandlers();
            }

            //logger.debug(`Closed dialog: ${dialogId}. Remaining open dialogs: ${Array.from(this.openDialogs)}`);
        } else {
            logger.error(`Failed to close dialog: ${dialogId}. Dialog element not found or not a dialog.`);
        }
    },

    handleDialogKeydown(event, dialogId) {
        if (event.key === 'Escape') {
            this.closeDialog(dialogId);
        }
        // Allow default behavior for input fields
        if (event.target.tagName.toLowerCase() === 'input') {
            return;
        }
        // Prevent propagation for other elements
        event.stopPropagation();
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
        const dialogs = ['select-set-dialog', 'tag-cloud-dialog', 'enter-set-dialog', 'help-dialog', 'info-dialog', 'phylogeny-dialog', 'inat-down-dialog'];
        dialogs.forEach(dialogId => {
            const dialog = document.getElementById(dialogId);
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.closeDialog(dialogId));
            }
        });

        this.on('dialogClose', (dialogId) => {
            // Add any specific actions you want to perform when a dialog is closed
        });

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

};

export default dialogManager;
