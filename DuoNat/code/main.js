import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import gameSetup from './gameSetup.js';
import logger, { LogLevel } from './logger.js';
import mainEventHandler from './mainEventHandler.js';
import rangeSelector from './rangeSelector.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import ui from './ui.js';
import url from './url.js';

let isInitialized = false;

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
};


async function initializeComponents() {
    api.taxonomy.getTaxonomyHierarchy();
    await dialogManager.initialize();
    mainEventHandler.initialize();
    ui.initialize();
    tagSelector.initialize();
    rangeSelector.initialize();
}

async function initializeApp() {
    if (isInitialized) {
        logger.debug("App already initialized, skipping");
        return;
    }

    logger.info("Initializing app");
    isInitialized = true;

    initializeLogger();
    url.handleUrlParameters();
    await initializeComponents();
    gameSetup.setupGame(true, url.getURLParameters());
    logger.info("App initialization complete");
}

initializeApp().catch(error => {
    logger.error('Error initializing app:', error);
});

// Expose initializeApp to the global scope
window.initializeApp = initializeApp;

// Call initialization function
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.initializeApp);
} else {
    window.initializeApp();
}
