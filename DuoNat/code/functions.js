// snapshot 20240712 2247 > stable, but tooo many preload requests
import api from './api.js';
import config from './config.js';
import {elements, gameState} from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import ui from './ui.js';
import utils from './utils.js';

(function() {

    document.getElementById('version-id').textContent = `Modified: ${document.lastModified}`;

    function initializeApp() {
        console.log("Initializing app");
        
        // Check for URL parameters
        const urlParams = utils.getURLParameters();
        if (urlParams) {
            console.log("URL parameters found:", urlParams);
            game.nextSelectedPair = urlParams;
        }
        
        game.setupGame(true);
        eventHandlers.initialize();
        console.log("App initialization complete");
    }

    // Expose initializeApp to the global scope
    window.initializeApp = initializeApp;

    // Call initialization function
    window.addEventListener('DOMContentLoaded', (event) => {
        window.initializeApp();
    });
})();
