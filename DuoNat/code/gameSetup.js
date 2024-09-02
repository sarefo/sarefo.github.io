import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
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
                dialogManager.showINatDownDialog();
                state.setState(state.GameState.IDLE);
                return false;
            }
            dialogManager.hideINatDownDialog();
            return true;
        },

        async runSetupSequence(newPair) {
            state.setState(state.GameState.LOADING);
            if (!await this.checkINaturalistReachability()) return;

            this.prepareUIForLoading();
            if (newPair || !state.getCurrentTaxonImageCollection()) {
                await this.initializeNewPair();
            } else {
                await this.setupRound();
            }

            this.updateUIAfterSetup(newPair);
        },

        prepareUIForLoading() {
            roundManager.resetDraggables();
            ui.prepareImagesForLoading();
        },

        async initializeNewPair() {
            const newPair = await pairManager.selectNewPair();
            const images = await this.loadImagesForNewPair(newPair);
            this.updateGameStateForNewPair(newPair, images);
            await this.setupRound(true);
        },

        async loadImagesForNewPair(newPair) {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair.pairID === newPair.pairID) {
                logger.debug(`Using preloaded images for pair ID ${newPair.pairID}`);
                return preloadedImages;
            }
            return {
                taxon1: await preloader.imageLoader.fetchDifferentImage(newPair.taxon1 || newPair.taxonNames[0], null),
                taxon2: await preloader.imageLoader.fetchDifferentImage(newPair.taxon2 || newPair.taxonNames[1], null),
            };
        },

        updateGameStateForNewPair(newPair, images) {
            state.updateGameStateMultiple({
                currentTaxonImageCollection: {
                    pair: newPair,
                    imageOneURL: images.taxon1,
                    imageTwoURL: images.taxon2,
                    level: newPair.level || '1',
                },
                usedImages: {
                    taxon1: new Set([images.taxon1]),
                    taxon2: new Set([images.taxon2]),
                },
            });
            state.setCurrentPairID(newPair.pairID || state.getCurrentPairID());
            ui.updateLevelIndicator(newPair.level || '1');
        },

        async setupGameWithPreloadedPair(preloadedPair) {
            state.resetShownHints();
            logger.debug(`Setting up game with preloaded pair: ${preloadedPair.pair.taxon1} / ${preloadedPair.pair.taxon2}, Skill Level: ${preloadedPair.pair.level}`);
            logger.debug(`Current selected level: ${state.getSelectedLevel()}`);

            if (!preloader.pairPreloader.isPairValid(preloadedPair.pair)) {
                logger.warn("Preloaded pair is no longer valid, fetching a new pair");
                await this.runSetupSequence(true);
                return;
            }

            this.updateGameStateForPreloadedPair(preloadedPair);
            await this.setupRound(true);
        },

        updateGameStateForPreloadedPair(preloadedPair) {
            state.updateGameStateMultiple({
                currentTaxonImageCollection: {
                    pair: preloadedPair.pair,
                    imageOneURL: preloadedPair.taxon1,
                    imageTwoURL: preloadedPair.taxon2,
                },
                usedImages: {
                    taxon1: new Set([preloadedPair.taxon1]),
                    taxon2: new Set([preloadedPair.taxon2]),
                },
            });
        },

        async setupRound(isNewPair = false) {
            const { pair } = state.getCurrentTaxonImageCollection();
            
            const imageData = await this.loadAndSetupImages(pair, isNewPair);
            
            const { nameTileData, worldMapData } = await roundManager.setupRound(pair, imageData, isNewPair);
        },

        async loadAndSetupImages(pair, isNewPair) {
            let imageOneURL, imageTwoURL;

            if (isNewPair) {
                imageOneURL = state.getCurrentTaxonImageCollection().imageOneURL;
                imageTwoURL = state.getCurrentTaxonImageCollection().imageTwoURL;
            } else {
                // Check for preloaded images
                const preloadedImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
                if (preloadedImages && preloadedImages.taxon1 && preloadedImages.taxon2) {
                    logger.debug("Using preloaded images for next round");
                    imageOneURL = preloadedImages.taxon1;
                    imageTwoURL = preloadedImages.taxon2;
                    // Clear the preloaded images after use
                    preloader.roundPreloader.clearPreloadedImagesForNextRound();
                } else {
                    logger.debug("No preloaded images available, fetching new images");
                    [imageOneURL, imageTwoURL] = await Promise.all([
                        preloader.imageLoader.fetchDifferentImage(pair.taxon1, state.getCurrentRound().imageOneURL),
                        preloader.imageLoader.fetchDifferentImage(pair.taxon2, state.getCurrentRound().imageTwoURL)
                    ]);
                }
            }

            const randomized = Math.random() < 0.5;
            //logger.debug(`Image randomization: ${randomized ? "swapped" : "not swapped"}`);

            const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
            const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

            await Promise.all([
                gameSetup.imageHandling.loadImageAndRemoveLoadingClass(state.getElement('imageOne'), leftImageSrc),
                gameSetup.imageHandling.loadImageAndRemoveLoadingClass(state.getElement('imageTwo'), rightImageSrc)
            ]);

            state.setObservationURL(leftImageSrc, 1);
            state.setObservationURL(rightImageSrc, 2);

            return { leftImageSrc, rightImageSrc, randomized, imageOneURL, imageTwoURL };
        },

        updateUIAfterSetup(newPair) {
            ui.updateLevelIndicator(state.getCurrentTaxonImageCollection().pair.level);
            if (this.filtersWereCleared()) {
                collectionManager.updateUIForClearedFilters();
            }
            this.finishSetup(newPair);
        },

        filtersWereCleared() {
            return state.getSelectedTags().length === 0 &&
                state.getSelectedRanges().length === 0 &&
                state.getSelectedLevel() === '';
        },

        async finishSetup(newPair) {
            ui.setNamePairHeight();
            state.setState(state.GameState.PLAYING);

            if (newPair) {
                await pairManager.refreshCollectionSubset();
            }

            if (state.getIsInitialLoad()) {
                this.hideLoadingScreen();
                state.updateGameStateMultiple({ isInitialLoad: false });
            }
            ui.resetUIState();
            state.setState(state.GameState.PLAYING);
            preloader.startPreloading(newPair);

            // Initialize the collection subset after the game has loaded
            pairManager.initializeCollectionSubset().catch(error => {
                logger.error("Error initializing collection subset:", error);
            });
        },

        hideLoadingScreen() {
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('loading-screen--fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                loadingScreen.remove();
            }, 500); // This matches the transition duration in CSS
        },

    },

    imageHandling: {
        async loadImages(pair, isNewPair) {
            let imageOneURL, imageTwoURL;

            if (isNewPair) {
                imageOneURL = state.getCurrentTaxonImageCollection().imageOneURL;
                imageTwoURL = state.getCurrentTaxonImageCollection().imageTwoURL;
            } else {
                ({ imageOneURL, imageTwoURL } = await roundManager.getImagesForRound(pair));
            }

            const randomized = Math.random() < 0.5;
            const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
            const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

            await Promise.all([
                this.loadImageAndRemoveLoadingClass(state.getElement('imageOne'), leftImageSrc),
                this.loadImageAndRemoveLoadingClass(state.getElement('imageTwo'), rightImageSrc)
            ]);

            return { leftImageSrc, rightImageSrc, randomized, imageOneURL, imageTwoURL };
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

    taxonHandling: {
        async getPairByPairID(pairID) {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            return taxonPairs.find(pair => pair.pairID === pairID);
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
                gameSetup.initialization.hideLoadingScreen();
                state.updateGameStateMultiple({ isInitialLoad: false });
            }
        },
    },

    async setupGame(newPair = false) {
        if (isSettingUpGame) {
            logger.debug("Setup already in progress, skipping");
            return;
        }
        isSettingUpGame = true;

        try {
            const nextPair = state.getNextSelectedPair();
            if (newPair && nextPair) {
                logger.debug(`Setting up new pair: ${nextPair.taxon1} / ${nextPair.taxon2}`);
                await this.initialization.runSetupSequence(true);
            } else {
                await this.initialization.runSetupSequence(newPair);
            }
        } catch (error) {
            this.errorHandling.handleSetupError(error);
        } finally {
            isSettingUpGame = false;
        }
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
    //setupRound: gameSetup.initialization.setupRound.bind(gameSetup),
    // used once in gameLogic
    setupGameWithPreloadedPair: gameSetup.initialization.setupGameWithPreloadedPair.bind(this)
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameSetup);
    }
});

export default publicAPI;
