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

(function () {

    // Set the log level based on your config
    logger.setLevel(config.debug ? LogLevel.DEBUG : LogLevel.INFO);
    document.getElementById('version-id').innerHTML = `Version: <i>${document.lastModified}</i>`;

    function initializeApp() {
        logger.info("Initializing app");

        //      dialogManager.openDialog('inat-down-dialog'); // for debugging

        // Check for URL parameters
        const urlParams = utils.url.getURLParameters();
        /*
                if (urlParams.taxon1 && urlParams.taxon2) {
                    logger.debug("Taxon parameters found:", urlParams);
                    game.nextSelectedPair = {
                        taxon1: urlParams.taxon1,
                        taxon2: urlParams.taxon2,
                    };
                }
        */
        if (urlParams.level) {
            if (urlParams.level === 'all') {
                urlParams.level = '';
            }
            updateGameState({ selectedLevel: urlParams.level });
            logger.debug("Skill level from URL:", urlParams.level);
        } else {
            updateGameState({ selectedLevel: '1' }); // set default initial level here!
        }

        if (urlParams.ranges) {
            const ranges = urlParams.ranges.split(',');
            updateGameState({ selectedRanges: ranges });
            rangeSelector.setSelectedRanges(ranges);
            logger.debug("Ranges from URL:", ranges);
            urlParams.level = ''; // reset level
        }

        if (urlParams.tags) {
            const tags = urlParams.tags.split(',');
            tagCloud.setSelectedTags(tags);
            logger.debug("Tags from URL:", tags);
            urlParams.level = ''; // reset level
        }

        if (urlParams.setID) {
            updateGameState({ currentSetID: urlParams.setID });
            logger.debug("Set ID from URL:", urlParams.setID);
            urlParams.level = ''; // reset level
        }

        if (urlParams.level || urlParams.ranges || urlParams.tags || urlParams.setID) {
            updateGameState({ selectedLevel: urlParams.level }); // set the initial level as "all"
        }
        ui.filters.updateLevelDropdown(); // display the current level

        dialogManager.initialize();
        gameSetup.setupGame(true, urlParams);
        eventHandlers.initialize();
        ui.core.initialize();
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

