// dialogManager.js

import api from './api.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import logger from './logger.js';
import ui from './ui.js';

const dialogManager = {
    activeDialog: null,
    mainEventHandlers: {},
    eventListeners: {},


    isAnyDialogOpen() {
        return !!this.activeDialog;
    },

    openDialog(dialogId) {
        ui.closeFunctionsMenu();
        const dialog = document.getElementById(dialogId);
        if (!dialog) {
            console.error(`Dialog with id ${dialogId} not found`);
            return;
        }

        this.disableMainEventHandlers();

        if (dialog instanceof HTMLElement) {
            if (dialog.tagName.toLowerCase() === 'dialog') {
                dialog.showModal();
            } else {
                dialog.classList.remove('hidden');
                if (dialogId === 'phylogeny-dialog') {
                    dialog.style.display = 'flex';
                }
            }
        }
        this.activeDialog = dialog;

        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
        if (dialog instanceof HTMLElement) {
            dialog.addEventListener('close', () => this.handleDialogClose(dialog));
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.closeDialog());
            }
        }

        logger.debug(`Dialog opened: ${dialogId}`);
    },

    closeDialog() {
        if (this.activeDialog) {
            const dialog = this.activeDialog;
            this.activeDialog = null;

            if (dialog instanceof HTMLElement) {
                if (dialog.tagName.toLowerCase() === 'dialog') {
                    dialog.close();
                } else {
                    dialog.classList.add('hidden');
                }

                if (dialog.id === 'phylogeny-dialog') {
                    dialog.style.display = 'none';
                }
            }
            this.handleDialogClose(dialog);
            
            logger.debug(`Emitting dialogClose event for: ${dialog.id}`);
            this.emit('dialogClose', dialog.id);
        }
    },

    handleDialogClose(dialog) {
        if (!dialog) {
            logger.warn('handleDialogClose called with no dialog');
            return;
        }

        this.enableMainEventHandlers();

        document.removeEventListener('keydown', this.handleEscapeKey);

        if (dialog instanceof HTMLElement) {
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.removeEventListener('click', this.closeDialog);
            }
        }

        this.activeDialog = null;

        ui.resetUIState();
        logger.debug(`Dialog closed: ${dialog.id}`);
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
        logger.debug(`Emitting event: ${eventName}, data: ${data}`);
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(callback => callback(data));
        } else {
            logger.debug(`No listeners for event: ${eventName}`);
        }
    }, 

    handleDialogClose(dialog) {
        if (!dialog) {
            logger.warn('handleDialogClose called with no dialog');
            return;
        }

        // Re-enable main window event handlers
        this.enableMainEventHandlers();

        // Remove event listener
        document.removeEventListener('keydown', this.handleEscapeKey);

        // Remove close button event listener if dialog is an HTMLElement
        if (dialog instanceof HTMLElement) {
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.removeEventListener('click', this.closeDialog);
            }
        }

        // Ensure main event handlers are re-enabled
        this.enableMainEventHandlers();

        // Ensure the UI knows no dialog is open
        this.activeDialog = null;

        // Reset the UI state
        ui.resetUIState();
    },

    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.activeDialog) {
            logger.debug('Escape key pressed, closing dialog');
            this.closeDialog();
        }
    },

    disableMainEventHandlers() {
        // Store and disable main window event handlers
        const mainElements = ['#random-pair-button', '#select-pair-button', '#enter-pair-button', '#share-button', '#help-button'];
        mainElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                this.mainEventHandlers[selector] = element.onclick;
                element.onclick = null;
            }
        });

        // Disable keyboard shortcuts
        document.removeEventListener('keydown', eventHandlers.handleKeyboardShortcuts);
    },

    enableMainEventHandlers() {
        // Re-enable main window event handlers
        Object.entries(this.mainEventHandlers).forEach(([selector, handler]) => {
            const element = document.querySelector(selector);
            if (element) {
                element.onclick = handler;
            }
        });

        // Re-enable keyboard shortcuts
        document.addEventListener('keydown', eventHandlers.handleKeyboardShortcuts);

        this.mainEventHandlers = {};
        logger.debug("Main event handlers re-enabled");
    },

    initializeDialogs() {
        const dialogs = ['select-pair-dialog', 'enter-pair-dialog', 'help-dialog', 'info-dialog', 'phylogeny-dialog', 'inat-down-dialog'];

        dialogs.forEach(dialogId => {
            const dialog = document.getElementById(dialogId);
            const closeButton = dialog.querySelector('.dialog-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.closeDialog());
            }
        });

        // Initialize enter pair dialog elements
        this.enterPairDialog = document.getElementById('enter-pair-dialog');
        this.taxon1Input = document.getElementById('taxon1');
        this.taxon2Input = document.getElementById('taxon2');
        this.dialogMessage = document.getElementById('dialog-message');
        this.submitButton = document.getElementById('submit-dialog');

        // Add event listeners for enter pair dialog
        document.getElementById('enter-pair-button').addEventListener('click', () => this.openDialog('enter-pair-dialog'));
        document.querySelector('#enter-pair-dialog form').addEventListener('submit', this.handleNewPairSubmit.bind(this));

        this.on('dialogClose', (dialogId) => {
            logger.debug(`Dialog closed: ${dialogId}`);
            // Add any specific actions you want to perform when a dialog is closed
        });

        // input validation
        this.taxon1Input.addEventListener('input', () => this.validateInputs());
        this.taxon2Input.addEventListener('input', () => this.validateInputs());
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
