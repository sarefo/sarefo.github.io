import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import eventMain from './eventMain.js';
import logger, { LogLevel } from './logger.js';
import pairManager from './pairManager.js';
import state from './state.js';
import ui from './ui.js';
import url from './url.js';

let isInitialized = false;

async function initializeApp() {
    if (isInitialized) {
        logger.debug("App already initialized, skipping");
        return;
    } else isInitialized = true;

    initializeLogger();

    logger.info("Initializing app");

    url.handleUrlParameters();

    await initializeComponents();

    pairManager.loadNewPair();
    state.setHasKeyboard(hasKeyboard());
    logger.info("App initialization complete");
}

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
};

async function initializeComponents() {
    await api.taxonomy.loadTaxonomyHierarchy();
    ui.initialize();
    await dialogManager.initialize();
    eventMain.initialize();
}

function hasKeyboard() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(navigator.userAgent);
    return !isMobile && !isTablet;
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
