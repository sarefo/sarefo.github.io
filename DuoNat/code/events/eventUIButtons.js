import logger from '../logger.js';
import ui from '../ui.js';
import utils from '../utils.js';

import pairManager from '../pairManager.js';
import sharing from '../sharing.js';

import ancestryDialog from '../dialogs/ancestryDialog.js';
import collectionManager from '../dialogs/collectionManager.js';
import dialogManager from '../dialogs/dialogManager.js';

const eventUIButtons = {
    initialize() {
        this.initializeMainMenuListeners();
        this.initializeLevelIndicator();
        //this.initializeLongPressHandler();
        this.initializeNextPairButton();
    },

    safeAddEventListener(id, eventType, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            //logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
        }
    },

    initializeMainMenuListeners() {
        this.addMenuButtonListeners();
        this.addShareButtonListener();
    },

    addMenuButtonListeners() {
        const menuActions = {
            'ancestry-button': ancestryDialog.showTaxaRelationship,
            'collection-button': collectionManager.openCollectionManagerDialog,
            'enter-pair-button': () => dialogManager.openDialog('enter-pair-dialog'),
            'random-pair-button': pairManager.loadNewPair,
            'like-button': this.likePair.bind(this),
            'trash-button': this.trashPair.bind(this),
            'surprise-button': utils.sound.surprise
        };

        Object.entries(menuActions).forEach(([buttonId, action]) => {
            this.addMenuListener(buttonId, action);
        });
    },

    addMenuListener(buttonId, action) {
        this.safeAddEventListener(buttonId, 'click', () => {
            action();
            ui.closeMenu();
        });
    },

    addShareButtonListener() {
        this.safeAddEventListener('share-button', 'click', sharing.shareCurrentPair);
    },

    initializeLevelIndicator() {
        const levelIndicator = document.getElementById('level-indicator');
        if (levelIndicator) {
            levelIndicator.addEventListener('click', this.handleLevelIndicatorClick);
            levelIndicator.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleLevelIndicatorClick();
                }
            });
        }
    },

    handleLevelIndicatorClick() {
        collectionManager.openCollectionManagerDialog();
    },

    /*initializeLongPressHandler() {
        const levelIndicator = document.getElementById('level-indicator');
        let longPressTimer;

        levelIndicator.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                testingDialog.openDialog();
            }, 1500);
        }, { passive: true });

        levelIndicator.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
        }, { passive: true });

        levelIndicator.addEventListener('touchmove', (e) => {
            clearTimeout(longPressTimer);
        }, { passive: true });
    },*/

    initializeNextPairButton() {
        const nextPairButton = document.getElementById('next-pair-button');
        if (nextPairButton) {
            nextPairButton.addEventListener('click', this.handleNextPairClick.bind(this));
        } else {
            logger.warn('Next pair button not found');
        }
    },

    handleNextPairClick() {
        if (!this.isLoadingNewPair) {
            this.isLoadingNewPair = true;
            pairManager.loadNewPair().finally(() => {
                this.isLoadingNewPair = false;
            });
        }
    },

    handleThumbsUp(index) {
        logger.debug(`Thumbs up clicked for image ${index}`);
        // Add implementation here
    },

    handleThumbsDown(index) {
        logger.debug(`Thumbs down clicked for image ${index}`);
        // Add implementation here
    },

    likePair() {
        logger.debug('Like pair clicked');
        // Add implementation here
    },

    trashPair() {
        logger.debug('Trash pair clicked');
        // Add implementation here
    }
};

// Bind all methods in eventUIButtons
Object.keys(eventUIButtons).forEach(key => {
    if (typeof eventUIButtons[key] === 'function') {
        eventUIButtons[key] = eventUIButtons[key].bind(eventUIButtons);
    }
});

export default eventUIButtons;
// don't call directly; API is in eventMain
