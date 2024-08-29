import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import gameSetup from './gameSetup.js';
import logger, { LogLevel } from './logger.js';
import eventMain from './eventMain.js';
import ui from './ui.js';
import url from './url.js';

let isInitialized = false;

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
};

async function initializeComponents() {
    await api.taxonomy.loadTaxonomyHierarchy();
    ui.initialize();
    await dialogManager.initialize();
    eventMain.initialize();
}

async function initializeApp() {
    if (isInitialized) {
        logger.debug("App already initialized, skipping");
        return;
    }

    initializeLogger();

    logger.info("Initializing app");

    url.handleUrlParameters();

    await initializeComponents();

    gameSetup.setupGame(true, url.getURLParameters());

    isInitialized = true;
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
