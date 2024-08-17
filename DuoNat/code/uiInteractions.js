import dialogManager from './dialogManager.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import taxaRelationshipViewer from './taxaRelationshipViewer.js';
import testingDialog from './testingDialog.js';
import ui from './ui.js';
import utils from './utils.js';

const uiInteractions = {
    initialize() {
        this.initializeMainMenuListeners();
        this.initializeLevelIndicator();
        this.initializeLongPressHandler();
    },

    safeAddEventListener(id, eventType, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            logger.debug(`Element with id '${id}' not found. Skipping event listener.`);
        }
    },

    initializeMainMenuListeners() {
        this.addMenuButtonListeners();
        this.addShareButtonListener();
    },

    addMenuButtonListeners() {
        const menuActions = {
            'phylogeny-button': taxaRelationshipViewer.showTaxaRelationship,
            'select-set-button': ui.showTaxonPairList,
            'enter-set-button': () => dialogManager.openDialog('enter-set-dialog'),
            'random-pair-button': gameLogic.loadNewRandomPair,
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
        this.safeAddEventListener('share-button', 'click', utils.url.shareCurrentPair);
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
        ui.showTaxonPairList();
    },

    initializeLongPressHandler() {
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

export default uiInteractions;