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

    cache.clearAllData(); // for DEBUG

    initializeLogger();
    logger.info("Initializing app");

    state.setHasKeyboard(hasKeyboard());

    const urlParams = url.handleUrlParameters();


    //await api.taxonomy.fetchTaxonPairs(); // TODO probably remove
    await initializeComponents();

    let initialPair;
    if (urlParams.pairID) {
        initialPair = await pairManager.getPairByID(urlParams.pairID);
    } else {
        initialPair = await api.taxonomy.fetchRandomLevelOnePair();
    }

    await pairManager.loadNewPair(initialPair.pairID);

    // Start background loading of bulk data
    loadBulkDataInBackground();
    await dialogManager.initialize();
    eventMain.initialize();

    pairManager.setHighestPairID(); // only used for "+" pair walking atm
    logger.info("App initialization complete");
}

const initializeLogger = () => {
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
};

async function initializeComponents() {
    ui.initialize();
}

function hasKeyboard() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(navigator.userAgent);
    return !isMobile && !isTablet;
}

function loadBulkDataInBackground() {
    setTimeout(async () => {
        try {
            logger.info("Loading bulk data");
            await api.taxonomy.loadTaxonomyHierarchy();
            await api.taxonomy.loadTaxonInfo();
            //await pairManager.collectionSubsets.refreshCollectionSubset();
            logger.info("Bulk data loaded successfully");
        } catch (error) {
            logger.error("Error loading bulk data in background:", error);
        }
    }, 0);
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
