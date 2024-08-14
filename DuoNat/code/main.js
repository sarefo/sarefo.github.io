import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState, updateGameState } from './state.js';
import eventHandlers from './eventHandlers.js';
import gameSetup from './gameSetup.js';
import logger, { LogLevel } from './logger.js';
import rangeSelector from './rangeSelector.js';
import tagCloud from './tagCloud.js';
import tooltipManager from './tooltipManager.js';
import ui from './ui.js';
import utils from './utils.js';

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
    document.getElementById('version-id').innerHTML = `Version: <i>${document.lastModified}</i>`;
};

const handleUrlParameters = () => {
    const urlParams = utils.url.getURLParameters();
    handleLevelParameter(urlParams);
    handleRangesParameter(urlParams);
    handleTagsParameter(urlParams);
    handleSetIDParameter(urlParams);
    updateLevelBasedOnParams(urlParams);
};

const handleLevelParameter = (urlParams) => {
    if (urlParams.level) {
        updateGameState({ selectedLevel: urlParams.level === 'all' ? '' : urlParams.level });
        logger.debug("Skill level from URL:", urlParams.level);
    } else {
        updateGameState({ selectedLevel: '1' });
    }
};

const handleRangesParameter = (urlParams) => {
    if (urlParams.ranges) {
        const ranges = urlParams.ranges.split(',');
        updateGameState({ selectedRanges: ranges });
        rangeSelector.setSelectedRanges(ranges);
        logger.debug("Ranges from URL:", ranges);
        urlParams.level = '';
    }
};

const handleTagsParameter = (urlParams) => {
    if (urlParams.tags) {
        const tags = urlParams.tags.split(',');
        tagCloud.tagSelection.setSelectedTags(tags);
        logger.debug("Tags from URL:", tags);
        urlParams.level = '';
    }
};

const handleSetIDParameter = (urlParams) => {
    if (urlParams.setID) {
        updateGameState({ currentSetID: urlParams.setID });
        logger.debug("Set ID from URL:", urlParams.setID);
        urlParams.level = '';
    }
};

const updateLevelBasedOnParams = (urlParams) => {
    if (urlParams.level || urlParams.ranges || urlParams.tags || urlParams.setID) {
        updateGameState({ selectedLevel: urlParams.level });
    }
    ui.filters.updateLevelDropdown();
};

const initializeComponents = () => {
    dialogManager.initialize();
    eventHandlers.initialize();
    ui.core.initialize();
    tagCloud.initialization.initialize();
    rangeSelector.initialize();
    // tooltipManager.init(); /* need to remove bugs first */
};

const initializeApp = () => {
    logger.info("Initializing app");
    initializeLogger();
    handleUrlParameters();
    initializeComponents();
    gameSetup.setupGame(true, utils.url.getURLParameters());
    logger.info("App initialization complete");
};

// Expose initializeApp to the global scope
window.initializeApp = initializeApp;

// Call initialization function
window.addEventListener('DOMContentLoaded', window.initializeApp);
