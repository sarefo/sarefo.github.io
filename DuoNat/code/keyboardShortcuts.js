import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import game from './game.js';
import gameLogic from './gameLogic.js';
import hintSystem from './hintSystem.js';
import searchHandler from './searchHandler.js';
import state from './state.js';
import taxaRelationshipViewer from './taxaRelationshipViewer.js';
import testingDialog from './testingDialog.js';
import tutorial from './tutorial.js';
import ui from './ui.js';
import utils from './utils.js';

let shortcutsEnabled = true;

const keyboardShortcuts = {
    debouncedKeyboardHandler: null,

    initialize() {
        this.initializeSelectSetDialogShortcuts();
        this.initializeKeyboardShortcutsButton();
        this.debouncedKeyboardHandler = utils.ui.debounce(
            this._handleKeyboardShortcuts.bind(this),
            300
        );
        document.addEventListener('keydown', this.debouncedKeyboardHandler);
    },

    _handleKeyboardShortcuts(event) {
        if (!shortcutsEnabled || this.shouldIgnoreKeyboardShortcut(event)) return;

        const shortcutActions = {
            'arrowleft': this.handleArrowLeft.bind(this),
            'arrowup': () => this.moveTileToDropZone('left', 'upper'),
            'arrowdown': () => this.moveTileToDropZone('left', 'lower'),
//            'c': ui.showTaxonPairList,
            'c': collectionManager.openCollectionManagerDialog,
            'e': () => dialogManager.openDialog('enter-set-dialog'),
            'i': () => game.showInfoDialog(state.getObservationURL(1), 1),
            'o': () => game.showInfoDialog(state.getObservationURL(2), 2),
            'h': () => hintSystem.showHint(1),
            'j': () => hintSystem.showHint(2),
            'g': taxaRelationshipViewer.showTaxaRelationship,
            '?': () => this.handleQuestionMark(event),
            'k': () => dialogManager.openDialog('keyboard-shortcuts-dialog'),
            'm': ui.toggleMainMenu,
            's': utils.url.shareCurrentPair,
            't': testingDialog.openDialog,
            '+': this.incrementSetID.bind(this),
            'x': () => document.getElementById('surprise-button').click()
        };

        const action = shortcutActions[event.key.toLowerCase()];
        if (action) {
            event.preventDefault();
            action();
        }
    },


    enableShortcuts() {
        shortcutsEnabled = true;
    },

    disableShortcuts() {
        shortcutsEnabled = false;
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

    shouldIgnoreKeyboardShortcut(event) {
        return event.ctrlKey || event.altKey || event.metaKey || 
               tutorial.isActive() ||
               dialogManager.isAnyDialogOpen();  // Ignore all shortcuts when any dialog is open
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

    incrementSetID() {
        const currentSetID = state.getCurrentTaxonImageCollection()?.pair?.setID;
        if (currentSetID) {
            const nextSetID = String(Number(currentSetID) + 1);
            gameLogic.loadSetByID(nextSetID, true);
        }
    },

    initializeSelectSetDialogShortcuts() {
        const dialog = document.getElementById('select-set-dialog');
        dialog.addEventListener('keydown', this.handleSelectSetDialogKeydown.bind(this));
    },

    handleSelectSetDialogKeydown(event) {
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
                    document.getElementById('select-range-button').click();
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

    moveTileToDropZone(tilePosition, dropZonePosition) {
        const tile = document.getElementById(tilePosition === 'left' ? 'left-name' : 'right-name');
        const dropZone = document.getElementById(dropZonePosition === 'upper' ? 'drop-1' : 'drop-2');

        if (tile && dropZone) {
            tile.parentNode.removeChild(tile);
            dropZone.innerHTML = '';
            dropZone.appendChild(tile);
            gameLogic.checkAnswer(dropZone.id);
        }
    },

    enable() {
        document.addEventListener('keydown', this.debouncedKeyboardHandler);
        shortcutsEnabled = true;
    },

    disable() {
        document.removeEventListener('keydown', this.debouncedKeyboardHandler);
        shortcutsEnabled = false;
    }
};

export default keyboardShortcuts;
