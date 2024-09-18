import config from './config.js';
import logger from './logger.js';
import state from './state.js';

import ui from './ui.js';

const errorHandling = {
    handleSetupError(error) {
        logger.error("Error setting up game:", error);
        if (error.message === "Failed to select a valid taxon pair") {
            ui.showOverlay("No valid taxon pairs found. Please check your filters and try again.", config.overlayColors.red);
        } else {
            ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
        }
        state.setState(state.GameState.IDLE);
        if (state.getIsInitialLoad()) {
            ui.hideLoadingScreen();
            //state.updateGameStateMultiple({ isInitialLoad: false });
        }
    },

    handleApiError: (error, context) => {
        logger.error(`API Error in ${context}:`, error);
        // Add more sophisticated error handling logic here
    },

    handleUIError: (error, context) => {
        logger.error(`UI Error in ${context}:`, error);
        // Add UI-specific error handling logic here
    },
};

// Bind all methods and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(errorHandling);

const publicAPI = {
    handleSetupError: errorHandling.handleSetupError,
    handleApiError: errorHandling.handleApiError,
    handleUIError: errorHandling.handleUIError,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(errorHandling);
    }
});

export default publicAPI;
