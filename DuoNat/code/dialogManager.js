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
        // Re-enable main window event handlers
        this.enableMainEventHandlers();

        // Remove event listeners
        this.activeDialog.removeEventListener('close', this.handleDialogClose);
        document.removeEventListener('keydown', this.handleEscapeKey);

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

    // Enter pair dialog functionality:
    initializeEnterPairDialog() {
        // Existing initialization code
        // ...

        // Initialize enter pair dialog elements
        this.enterPairDialog = document.getElementById('enter-pair-dialog');
        this.taxon1Input = document.getElementById('taxon1');
        this.taxon2Input = document.getElementById('taxon2');
        this.dialogMessage = document.getElementById('dialog-message');

        // Add event listeners for enter pair dialog
        document.getElementById('enter-pair-button').addEventListener('click', () => this.openDialog('enter-pair-dialog'));
        document.getElementById('close-dialog').addEventListener('click', () => this.closeDialog());
        document.querySelector('#enter-pair-dialog form').addEventListener('submit', this.handleNewPairSubmit.bind(this));
    },

    clearEnterPairInputs() {
        const taxon1Input = document.getElementById('taxon1');
        const taxon2Input = document.getElementById('taxon2');
        const dialogMessage = document.getElementById('dialog-message');
        taxon1Input.value = '';
        taxon2Input.value = '';
        dialogMessage.textContent = '';
    },

    async handleNewPairSubmit(event) {
        event.preventDefault();

        const taxon1Input = document.getElementById('taxon1');
        const taxon2Input = document.getElementById('taxon2');
        const dialogMessage = document.getElementById('dialog-message');

        const taxon1 = this.taxon1Input.value;
        const taxon2 = this.taxon2Input.value;
        
        dialogMessage.textContent = 'Validating taxa...';
        
        const [validatedTaxon1, validatedTaxon2] = await Promise.all([
            api.validateTaxon(taxon1),
            api.validateTaxon(taxon2)
        ]);
        
        if (validatedTaxon1 && validatedTaxon2) {
            const newPair = {
                taxon1: validatedTaxon1.name,
                taxon2: validatedTaxon2.name
            };
        
            try {
                const response = await fetch('./data/taxonPairs.json');
                const taxonPairs = await response.json();
                taxonPairs.push(newPair);
        
                // Set the new pair as the next pair to be used
                game.nextSelectedPair = newPair;
                
                // Close the dialog
                this.closeDialog();
                
                // Set up the game with the new pair
                game.setupGame(true);
            } catch (error) {
                logger.error('Error updating taxonPairs.json:', error);
                this.dialogMessage.textContent = 'Error saving new pair. Please try again.';
            }
        } else {
            this.dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
        }
    },

};

export default dialogManager;
