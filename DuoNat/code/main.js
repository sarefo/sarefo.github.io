import config from './config.js';
import dialogManager from './dialogManager.js';
import gameSetup from './gameSetup.js';
import infoDialog from './infoDialog.js';
import logger, { LogLevel } from './logger.js';
import mainEventHandler from './mainEventHandler.js';
import rangeSelector from './rangeSelector.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import ui from './ui.js';
import utils from './utils.js';

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
};

const handleUrlParameters = () => {
    const urlParams = utils.url.getURLParameters();
    handleLevelParameter(urlParams);
    handleRangesParameter(urlParams);
    handleTagsParameter(urlParams);
    handleSetIDParameter(urlParams);
    //    updateLevelBasedOnParams(urlParams);
};

const handleLevelParameter = (urlParams) => {
    if (urlParams.level) {
        const level = urlParams.level === 'all' ? '' : urlParams.level;
        state.updateGameStateMultiple({ selectedLevel: level });
        logger.debug("Skill level from URL:", urlParams.level);
    } else if (!state.getSelectedLevel()) {
        state.updateGameStateMultiple({ selectedLevel: '1' });
    }
};

const handleRangesParameter = (urlParams) => {
    if (urlParams.ranges) {
        const ranges = urlParams.ranges.split(',');
        state.updateGameStateMultiple({ selectedRanges: ranges });
        logger.debug("Ranges from URL:", ranges);
    }
};

const handleTagsParameter = (urlParams) => {
    if (urlParams.tags) {
        const tags = urlParams.tags.split(',');
        tagSelector.setSelectedTags(tags);
        logger.debug("Tags from URL:", tags);
    }
};

const handleSetIDParameter = (urlParams) => {
    if (urlParams.setID) {
        state.updateGameStateMultiple({ currentSetID: urlParams.setID });
        logger.debug("Set ID from URL:", urlParams.setID);
    }
};

async function initializeComponents() {
    await dialogManager.initialize();
    mainEventHandler.initialize();
    ui.initialize();
    tagSelector.initialize();
    rangeSelector.initialize();
}

async function initializeApp() {
    logger.info("Initializing app");
    initializeLogger();
    handleUrlParameters();
    await initializeComponents();
    gameSetup.setupGame(true, utils.url.getURLParameters());
    logger.info("App initialization complete");
}

initializeApp().catch(error => {
    logger.error('Error initializing app:', error);
});

// Expose initializeApp to the global scope
window.initializeApp = initializeApp;

// Call initialization function
window.addEventListener('DOMContentLoaded', window.initializeApp);
