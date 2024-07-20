// snapshot 20240712 2247 > stable, but tooo many preload requests
import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import {elements, gameState} from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import logger, { LogLevel } from './logger.js';
import ui from './ui.js';
import utils from './utils.js';

(function() {

    // Set the log level based on your config
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
    document.getElementById('version-id').textContent = `Modified: ${document.lastModified}`;

    function initializeApp() {
        logger.info("Initializing app");
        
        // Check for URL parameters
        const urlParams = utils.getURLParameters();
        if (urlParams) {
            logger.debug("URL parameters found:", urlParams);
            game.nextSelectedPair = urlParams;
        }
        
        dialogManager.initializeEnterPairDialog(); // TODO seems a bit too specific
        game.setupGame(true);
        eventHandlers.initialize();
        ui.initialize();
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
