import logger from '../logger.js';
import state from '../state.js';
import ui from '../ui.js';
import utils from '../utils.js';

import dragAndDrop from './dragAndDrop.js';

import hintSystem from '../hintSystem.js';
import pairManager from '../pairManager.js';
import preloader from '../preloader.js';
import searchHandler from '../searchHandler.js';
import sharing from '../sharing.js';
import tutorial from '../tutorial.js';

import ancestryDialog from '../dialogs/ancestryDialog.js';
import collectionManager from '../dialogs/collectionManager.js';
import dialogManager from '../dialogs/dialogManager.js';
import infoDialog from '../dialogs/infoDialog.js';
import rangeSelector from '../dialogs/rangeSelector.js';

const keyboardShortcuts = {
    isEnabled: true,
    debouncedKeyboardHandler: null,

    initialize() {
        this.initializeKeyboardShortcutsButton();
        this.debouncedKeyboardHandler = utils.ui.debounce(
            this.handleKeyboardShortcuts.bind(this),
            300
        );
        this.enable(); // Call enable instead of directly adding the listener
    },

    handleKeyboardShortcuts(event) {
        const isDialogOpen = dialogManager.isAnyDialogOpen();
        if (!this.isEnabled || this.shouldIgnoreKeyboardShortcut(event) || isDialogOpen) {
            //logger.debug(`Keyboard shortcut ignored. isEnabled: ${this.isEnabled}, shouldIgnore: ${this.shouldIgnoreKeyboardShortcut(event)}, isDialogOpen: ${isDialogOpen}`);
            return;
        }

        const shortcutActions = {
            'n': this.handleArrowLeft.bind(this),
            'arrowup': () => dragAndDrop.moveTileToDropZone('left', 'upper'),
            'arrowleft': () => dragAndDrop.moveTileToDropZone('left', 'upper'),
            'arrowdown': () => dragAndDrop.moveTileToDropZone('left', 'lower'),
            'arrowright': () => dragAndDrop.moveTileToDropZone('left', 'lower'),
            'c': collectionManager.openCollectionManagerDialog,
            'e': () => dialogManager.openDialog('enter-pair-dialog'),
            'i': () => infoDialog.showInfoDialog(1),
            'o': () => infoDialog.showInfoDialog(2),
            'h': () => hintSystem.showHint(1),
            'j': () => hintSystem.showHint(2),
            'a': ancestryDialog.showTaxaRelationship,
            '?': () => this.handleQuestionMark(event),
            'k': () => dialogManager.openDialog('keyboard-shortcuts-dialog'),
            'm': ui.toggleMainMenu,
            's': sharing.shareCurrentPair,
            '+': this.incrementPairId.bind(this),
            'x': () => document.getElementById('surprise-button').click()
        };

        const action = shortcutActions[event.key.toLowerCase()];
        if (action) {
            event.preventDefault();
            action();
        }
    },

    enable() {
        if (!this.isEnabled) {
            this.isEnabled = true;
            document.addEventListener('keydown', this.debouncedKeyboardHandler);
            //logger.debug('Keyboard shortcuts enabled');
        }
    },

    disable() {
        if (this.isEnabled) {
            this.isEnabled = false;
            document.removeEventListener('keydown', this.debouncedKeyboardHandler);
            //logger.debug('Keyboard shortcuts disabled');
        }
    },

    shouldIgnoreKeyboardShortcut(event) {
        return event.ctrlKey || event.altKey || event.metaKey || tutorial.isActive() || dialogManager.isAnyDialogOpen();
    },

    initializeKeyboardShortcutsButton() {
        const keyboardShortcutsButton = document.getElementById('keyboard-shortcuts-button');
        if (keyboardShortcutsButton) {
            keyboardShortcutsButton.addEventListener('click', () => {
                /*dialogManager.closeDialog('help-dialog');*/
                dialogManager.openDialog('keyboard-shortcuts-dialog');
            });
        }
    },
    handleArrowLeft() {
        if (!this.isLoadingNewPair) {
            this.isLoadingNewPair = true;
            pairManager.loadNewPair().finally(() => {
                this.isLoadingNewPair = false;
            });
        }
    },

    handleQuestionMark(event) {
        if (event && event.target && !event.target.closest('button')) {
            dialogManager.openDialog('help-dialog');
        }
    },

    async incrementPairId() {
        const currentPairId = state.getCurrentTaxonImageCollection()?.pair?.pairId;
        if (!currentPairId) {
            logger.warn("No current pair ID found");
            return;
        }

        try {
            const highestPairId = state.getHighestPairId();

            let nextPairId;
            let attempts = 0;
            const maxAttempts = 10;

            do {
                if (currentPairId === highestPairId || attempts >= maxAttempts) {
                    nextPairId = "1";
                } else {
                    nextPairId = String(Number(currentPairId) + 1);
                }
                const nextPair = await pairManager.getPairById(nextPairId);
                if (nextPair) {
                    logger.debug(`Incrementing from pair ID ${currentPairId} to ${nextPairId}`);
                    state.setPreloadNextPairId(true);
                    await pairManager.loadPairById(nextPairId, true);

                    // Preload the next pair ID
                    let preloadPairId = String(Number(nextPairId) + 1);
                    if (preloadPairId > highestPairId) {
                        preloadPairId = "1";
                    }
                    const preloadPair = await pairManager.getPairById(preloadPairId);
                    if (preloadPair) {
                        await preloader.preloadPairById(preloadPairId);
                    }
                    return;
                }
                attempts++;
            } while (attempts < maxAttempts);

            logger.warn(`Could not find a valid pair after ${maxAttempts} attempts. Loading a random pair.`);
            await pairManager.loadNewPair();
        } catch (error) {
            logger.error("Error incrementing pair ID:", error);
        }
    },

};

// Bind all methods in keyboardShortcuts
Object.keys(keyboardShortcuts).forEach(key => {
    if (typeof keyboardShortcuts[key] === 'function') {
        keyboardShortcuts[key] = keyboardShortcuts[key].bind(keyboardShortcuts);
    }
});

export default keyboardShortcuts;
// don't call directly; API is in eventMain
