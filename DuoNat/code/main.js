import config from './config.js';
import logger, { LogLevel } from './logger.js';
import state from './state.js';

import api from './api.js';
import cache from './cache.js';
import filtering from './filtering.js';
import ui from './ui.js';
import url from './url.js';

import eventMain from './events/eventMain.js';

import pairManager from './pairManager.js';

import dialogManager from './dialogs/dialogManager.js';

let isInitialized = false;

async function initializeApp() {
    if (isInitialized) {
        logger.debug("App already initialized, skipping");
        return;
    } else isInitialized = true;

    initializeLogger();

    logger.info("Initializing app");

    state.setHasKeyboard(hasKeyboard());

    const urlParams = url.handleUrlParameters();

    //cache.clearAllData(); // DEBUG

    await api.taxonomy.fetchTaxonPairs();
    await initializeComponents();

    // Check if a pairID was provided in the URL
    if (urlParams.pairID) {
        pairManager.loadNewPair(urlParams.pairID);
    } else {
        pairManager.loadNewPair();
    }

    pairManager.setHighestPairID(); // only used for "+" pair walking atm
    await api.taxonomy.loadTaxonomyHierarchy(); // TODO defer or avoid?
    logger.info("App initialization complete");
}

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
};

async function initializeComponents() {
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
