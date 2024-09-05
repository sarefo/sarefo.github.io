import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import errorHandling from './errorHandling.js';
import filtering from './filtering.js';
import logger from './logger.js';
import pairManager from './pairManager.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';
import state from './state.js';
import ui from './ui.js';

let isSettingUpGame = false;

const gameSetup = {

    initialization: {

        // called from:
        // - pairManager.loadNewPair()
        // - roundManager.loadNewRound()
        async updateUIAfterSetup(newPair = false) {

            if (filtering.areAllFiltersDefault()) collectionManager.updateFilterSummary();

            //ui.setNamePairHeight();
            state.setState(state.GameState.PLAYING);

            if (newPair) await pairManager.refreshCollectionSubset();

            if (state.getIsInitialLoad()) {
                ui.hideLoadingScreen();
                state.setIsInitialLoad(false);
            }
            ui.resetUIState();
            state.setState(state.GameState.PLAYING);
            //preloader.startPreloading(newPair);

            // Initialize the collection subset after the game has loaded
            pairManager.initializeCollectionSubset().catch(error => {
                logger.error("Error initializing collection subset:", error);
            });
        },
    },

    imageHandling: {
        async loadImages(pair, isNewPair) {
            let image1URL, image2URL;

            if (isNewPair) {
                image1URL = state.getCurrentTaxonImageCollection().image1URL;
                image2URL = state.getCurrentTaxonImageCollection().image2URL;
            } else {
                ({ image1URL, image2URL } = await roundManager.getImagesForRound(pair));
            }

            const randomized = Math.random() < 0.5;
            const taxonImage1Src = randomized ? image1URL : image2URL;
            const taxonImage2Src = randomized ? image2URL : image1URL;

            await Promise.all([
                this.loadImageAndRemoveLoadingClass(state.getElement('image1'), taxonImage1Src),
                this.loadImageAndRemoveLoadingClass(state.getElement('image2'), taxonImage2Src)
            ]);

            return { taxonImage1Src, taxonImage2Src, randomized, image1URL, image2URL };
        },

        async loadImageAndRemoveLoadingClass(imgElement, src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    imgElement.classList.add('image-container__image--fade');
                    imgElement.src = src;
                    imgElement.classList.remove('image-container__image--loading');
                    
                    // Use requestAnimationFrame to ensure the fade class is applied before fading in
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            imgElement.classList.add('image-container__image--fade-in');
                            setTimeout(() => {
                                imgElement.classList.remove('image-container__image--fade');
                                imgElement.classList.remove('image-container__image--fade-in');
                                resolve();
                            }, 300); // This should match the transition duration in CSS
                        });
                    });
                };
                img.src = src;
            });
        },
    },

};

// Bind all methods in gameSetup and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(gameSetup);

const publicAPI = {
    //setupPairOrRound: gameSetup.initialization.setupPairOrRound,
    updateUIAfterSetup: gameSetup.initialization.updateUIAfterSetup,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameSetup);
    }
});

export default publicAPI;
