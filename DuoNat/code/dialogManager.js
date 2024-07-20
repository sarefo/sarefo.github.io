// dialogManager.js

import api from './api.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import logger from './logger.js';

const dialogManager = {
    activeDialog: null,
    mainEventHandlers: {},

    openDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (!dialog) {
            console.error(`Dialog with id ${dialogId} not found`);
            return;
        }

        // Disable main window event handlers
        this.disableMainEventHandlers();

        // Show the dialog
        if (dialog.tagName.toLowerCase() === 'dialog') {
            dialog.showModal();
        } else {
            // For non-dialog elements like the relationship graph container
            dialog.classList.remove('hidden');
        }
        this.activeDialog = dialog;

        // Add event listeners
        dialog.addEventListener('close', this.handleDialogClose.bind(this));
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));

        const closeButton = dialog.querySelector('.dialog-close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeDialog());
        }

        // Clear inputs after the dialog is shown
        if (dialogId === 'enter-pair-dialog') {
            setTimeout(() => {
                this.clearEnterPairInputs();
            }, 0);
        }
    },

    closeDialog() {
        if (this.activeDialog) {
            if (this.activeDialog.tagName.toLowerCase() === 'dialog') {
                this.activeDialog.close();
            } else {
                // For non-dialog elements like the relationship graph container
                this.activeDialog.classList.add('hidden');
                this.handleDialogClose();
            }
        }
    },

    handleDialogClose() {
        if (!this.activeDialog) {
            logger.warn('handleDialogClose called with no active dialog');
            return;
        }
        // Re-enable main window event handlers
        this.enableMainEventHandlers();

        // Remove event listeners
        document.removeEventListener('keydown', this.handleEscapeKey);

        // Remove close button event listener
        const closeButton = this.activeDialog.querySelector('.dialog-close-button');
        if (closeButton) {
            closeButton.removeEventListener('click', () => this.closeDialog());
        }

        this.activeDialog = null;
    },

    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.activeDialog) {
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
