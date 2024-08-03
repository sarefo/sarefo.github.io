import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState } from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import logger, { LogLevel } from './logger.js';
import rangeSelector from './rangeSelector.js';
import tagCloud from './tagCloud.js';
import tooltipManager from './tooltipManager.js';
import ui from './ui.js';
import utils from './utils.js';

(function () {

    // Set the log level based on your config
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
    document.getElementById('version-id').innerHTML = `Version: <i>${document.lastModified}</i>`;

    function initializeApp() {
        logger.info("Initializing app");

  //      dialogManager.openDialog('inat-down-dialog'); // for debugging
        // Check for URL parameters
        const urlParams = utils.getURLParameters();
        if (urlParams.taxon1 && urlParams.taxon2) {
            logger.debug("Taxon parameters found:", urlParams);
            game.nextSelectedPair = {
                taxon1: urlParams.taxon1,
                taxon2: urlParams.taxon2
            };
        }

        // Handle tags from URL
        if (urlParams.tags) {
            const tags = urlParams.tags.split(',');
            tagCloud.setSelectedTags(tags);
            logger.debug("Tags from URL:", tags);
        }

        dialogManager.initializeDialogs();
        game.setupGame(true);
        eventHandlers.initialize();
        ui.initialize();
        tagCloud.initialize();
        rangeSelector.initialize();
        // tooltipManager.init(); /* need to remove bugs first */
        logger.info("App initialization complete");

        // Example of changing log level at runtime
        // Uncomment this line to test changing log level
        // logger.changeLogLevel(LogLevel.WARN);
    }

    // Expose initializeApp to the global scope
    window.initializeApp = initializeApp;

    // Call initialization function
    window.addEventListener('DOMContentLoaded', (event) => {
        window.initializeApp();
    });
})();

