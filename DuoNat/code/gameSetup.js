import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import iNatDownDialog from './iNatDownDialog.js';
import logger from './logger.js';
import pairManager from './pairManager.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';
import state from './state.js';
import ui from './ui.js';
import url from './url.js';
import utils from './utils.js';

let isSettingUpGame = false;

const gameSetup = {

    initialization: {

        async checkINaturalistReachability() {
            if (!await api.externalAPIs.isINaturalistReachable()) {
                iNatDownDialog.showINatDownDialog();
                state.setState(state.GameState.IDLE);
                return false;
            }
            iNatDownDialog.hideINatDownDialog();
            return true;
        },

        async setupPairOrRound(newPair) {
            logger.debug('setupPairOrRound called with newPair:', newPair);
            state.setState(state.GameState.LOADING);

            if (!await this.checkINaturalistReachability()) return;
            roundManager.prepareImagesForLoading();

            if (newPair || !state.getCurrentTaxonImageCollection()) {
                logger.debug('Initializing new pair');
                await pairManager.initializeNewPair();
            } else {
                logger.debug('Setting up round from game setup');
                await roundManager.setupRoundFromGameSetup();
            }

            this.updateUIAfterSetup(newPair);
            logger.debug('setupPairOrRound completed');
        },

        updateUIAfterSetup(newPair) {
            ui.updateLevelIndicator(state.getCurrentTaxonImageCollection().pair.level);

            if (filtering.areAllFiltersDefault()) {
                collectionManager.updateFilterSummary();
            }

            this.finishSetup(newPair);
        },

        async finishSetup(newPair) {
            ui.setNamePairHeight();
            state.setState(state.GameState.PLAYING);

            if (newPair) {
                await pairManager.refreshCollectionSubset();
            }

            if (state.getIsInitialLoad()) {
                ui.hideLoadingScreen();
                state.setIsInitialLoad(false);
            }
            ui.resetUIState();
            state.setState(state.GameState.PLAYING);
            preloader.startPreloading(newPair);

            // Initialize the collection subset after the game has loaded
            pairManager.initializeCollectionSubset().catch(error => {
                logger.error("Error initializing collection subset:", error);
            });
        },



        /*async setupGameWithPreloadedPair(preloadedPair) {
            state.resetShownHints();
            logger.debug(`Setting up game with preloaded pair: ${preloadedPair.pair.taxonA}
                    / ${preloadedPair.pair.taxonB}, Skill Level: ${preloadedPair.pair.level}`);
            logger.debug(`Current selected level: ${state.getSelectedLevel()}`);

            if (!preloader.pairPreloader.isPairValid(preloadedPair.pair)) {
                logger.warn("Preloaded pair is no longer valid, fetching a new pair");
                await this.setupPairOrRound(newPair = true);
                return;
            }

            this.updateGameStateForPreloadedPair(preloadedPair);
            await roundManager.setupRoundFromGameSetup(true);
        },

        updateGameStateForPreloadedPair(preloadedPair) {
            state.updateGameStateMultiple({
                currentTaxonImageCollection: {
                    pair: preloadedPair.pair,
                    image1URL: preloadedPair.taxonA,
                    image2URL: preloadedPair.taxonB,
                },
                usedImages: {
                    taxonA: new Set([preloadedPair.taxonA]),
                    taxonB: new Set([preloadedPair.taxonB]),
                },
            });
        },*/
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

    errorHandling: {
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
                state.updateGameStateMultiple({ isInitialLoad: false });
            }
        },
    },

    async setupGame(newPair = false) {
        logger.debug('setupGame called with newPair:', newPair);
        if (isSettingUpGame) {
            logger.warn("Setup already in progress, skipping");
            return;
        }

        isSettingUpGame = true;

        try {
            await this.initialization.setupPairOrRound(newPair);
        } catch (error) {
            this.errorHandling.handleSetupError(error);
        } finally {
            isSettingUpGame = false;
            state.setState(state.GameState.PLAYING);
        }
        logger.debug('setupGame completed');
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
    setupGame: gameSetup.setupGame.bind(gameSetup),
    // used once in gameLogic
    // setupGameWithPreloadedPair: gameSetup.initialization.setupGameWithPreloadedPair.bind(this)
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameSetup);
    }
});

export default publicAPI;
