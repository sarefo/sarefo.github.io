// dialogManager.js

import eventHandlers from './eventHandlers.js';

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
    }
};

export default dialogManager;
