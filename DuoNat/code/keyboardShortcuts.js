import ancestryDialog from './ancestryDialog.js';
import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import dragAndDrop from './dragAndDrop.js';
import gameLogic from './gameLogic.js';
import hintSystem from './hintSystem.js';
import infoDialog from './infoDialog.js';
import logger from './logger.js';
import rangeSelector from './rangeSelector.js';
import searchHandler from './searchHandler.js';
import state from './state.js';
import sharing from './sharing.js';
import testingDialog from './testingDialog.js';
import tutorial from './tutorial.js';
import ui from './ui.js';
import utils from './utils.js';

const keyboardShortcuts = {
    isEnabled: true,
    debouncedKeyboardHandler: null,

    initialize() {
        this.initializeSelectPairDialogShortcuts();
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
            'arrowleft': this.handleArrowLeft.bind(this),
            'arrowup': () => dragAndDrop.moveTileToDropZone('left', 'upper'),
            'arrowdown': () => dragAndDrop.moveTileToDropZone('left', 'lower'),
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
            't': testingDialog.openDialog,
            '+': this.incrementPairID.bind(this),
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
            gameLogic.loadNewRandomPair().finally(() => {
                this.isLoadingNewPair = false;
            });
        }
    },

    handleQuestionMark(event) {
        if (event && event.target && !event.target.closest('button')) {
            dialogManager.openDialog('help-dialog');
        }
    },

    incrementPairID() {
        const currentPairID = state.getCurrentTaxonImageCollection()?.pair?.pairID;
        if (currentPairID) {
            const nextPairID = String(Number(currentPairID) + 1);
            gameLogic.loadPairByID(nextPairID, true);
        }
    },

    initializeSelectPairDialogShortcuts() {
        const dialog = document.getElementById('collection-dialog');
        dialog.addEventListener('keydown', this.handleSelectPairDialogKeydown.bind(this));
    },

    handleSelectPairDialogKeydown(event) {
        if (event.altKey) {
            switch (event.key.toLowerCase()) {
                case 't':
                    event.preventDefault();
                    document.getElementById('select-tags-button').click();
                    break;
                case 'f':
                    event.preventDefault();
                    document.getElementById('clear-all-filters').click();
                    break;
                case 'r':
                    event.preventDefault();
                    rangeSelector.openRangeDialog();
                    break;
                case 'p':
                    event.preventDefault();
                    document.getElementById('select-phylogeny-button').click();
                    break;
                case 'l':
                    event.preventDefault();
                    document.getElementById('level-filter-dropdown').focus();
                    break;
                case 's':
                    event.preventDefault();
                    document.getElementById('taxon-search').focus();
                    break;
                case 'c':
                    event.preventDefault();
                    searchHandler.handleClearSearch();
                    break;
            }
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
