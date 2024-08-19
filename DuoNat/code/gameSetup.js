import api from './api.js';
import collectionManager from './collectionManager.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import preloader from './preloader.js';
import setManager from './setManager.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';
import worldMap from './worldMap.js';

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

        async runSetupSequence(newPair, urlParams) {
            state.setState(state.GameState.LOADING);
            if (!await gameSetup.initialization.checkINaturalistReachability()) return;

            gameSetup.initialization.prepareUIForLoading();
            if (newPair || !state.getCurrentTaxonImageCollection()) {
                await gameSetup.initialization.initializeNewPair(urlParams);
            } else {
                await gameSetup.initialization.setupRound();
            }

            gameSetup.initialization.updateUIAfterSetup(newPair);
        },

        prepareUIForLoading() {
            utils.game.resetDraggables();
            ui.prepareImagesForLoading();
            const startMessage = state.getIsFirstLoad() ? "Drag the names!" : utils.ui.getLoadingMessage();
            ui.showOverlay(startMessage, config.overlayColors.green);
            state.setIsFirstLoad(false);
        },

        async initializeNewPair(urlParams) {
            const newPair = await gameSetup.initialization.selectNewPair(urlParams);
            const images = await gameSetup.initialization.loadImagesForNewPair(newPair);
            gameSetup.initialization.updateGameStateForNewPair(newPair, images);
            await gameSetup.initialization.setupRound(true);
        },

        /*async selectNewPair(urlParams) {
            state.resetShownHints();
            let nextSelectedPair = state.getNextSelectedPair();
            if (nextSelectedPair) {
                state.setNextSelectedPair(null);
                return nextSelectedPair;
            }
            return await gameSetup.initialization.selectPairFromFilters(urlParams);
        },*/

        async selectNewPair(urlParams) {
            state.resetShownHints();
            return await gameSetup.initialization.selectPairFromFilters(urlParams);
        },

        async selectPairFromFilters(urlParams) {
            const filters = gameSetup.initialization.createFiltersFromUrlParams(urlParams);
            const filteredPairs = await filtering.getFilteredTaxonPairs(filters);
            return gameSetup.initialization.findOrSelectRandomPair(filteredPairs, urlParams);
        },

        createFiltersFromUrlParams(urlParams) {
            return {
                level: urlParams.level || state.getSelectedLevel(),
                ranges: urlParams.ranges ? urlParams.ranges.split(',') : state.getSelectedRanges(),
                tags: urlParams.tags ? urlParams.tags.split(',') : state.getSelectedTags(),
                phylogenyId: urlParams.phylogenyId || state.getPhylogenyId(),
                searchTerm: urlParams.searchTerm || state.getSearchTerm()
            };
        },

        findOrSelectRandomPair(filteredPairs, urlParams) {
            let pair = gameSetup.initialization.findPairByUrlParams(filteredPairs, urlParams);
            if (!pair) {
                if (filteredPairs.length > 0) {
                    pair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    logger.debug("Selected random pair from filtered collection");
                } else {
                    throw new Error("No pairs available in the current filtered collection");
                }
            }
            return pair;
        },

        findPairByUrlParams(filteredPairs, urlParams) {
            if (urlParams.setID) {
                return gameSetup.initialization.findPairBySetID(filteredPairs, urlParams.setID);
            } else if (urlParams.taxon1 && urlParams.taxon2) {
                return gameSetup.initialization.findPairByTaxa(filteredPairs, urlParams.taxon1, urlParams.taxon2);
            }
            return null;
        },

        findPairBySetID(filteredPairs, setID) {
            const pair = filteredPairs.find(pair => pair.setID === setID);
            if (pair) {
                logger.debug(`Found pair with setID: ${setID}`);
            } else {
                logger.warn(`SetID ${setID} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        findPairByTaxa(filteredPairs, taxon1, taxon2) {
            const pair = filteredPairs.find(pair =>
                (pair.taxonNames[0] === taxon1 && pair.taxonNames[1] === taxon2) ||
                (pair.taxonNames[0] === taxon2 && pair.taxonNames[1] === taxon1)
            );
            if (pair) {
                logger.debug(`Found pair with taxa: ${taxon1} and ${taxon2}`);
            } else {
                logger.warn(`Taxa ${taxon1} and ${taxon2} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        async loadImagesForNewPair(newPair) {
            const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedImages && preloadedImages.pair.setID === newPair.setID) {
                logger.debug(`Using preloaded images for set ID ${newPair.setID}`);
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
            state.setCurrentSetID(newPair.setID || state.getCurrentSetID());
            ui.updateLevelIndicator(newPair.level || '1');
        },

        async setupWithPreloadedPair(preloadedPair) {
            state.resetShownHints();
            logger.debug(`Setting up game with preloaded pair: ${preloadedPair.pair.taxon1} / ${preloadedPair.pair.taxon2}, Skill Level: ${preloadedPair.pair.level}`);
            logger.debug(`Current selected level: ${state.getSelectedLevel()}`);

            if (!preloader.pairPreloader.isPairValid(preloadedPair.pair)) {
                logger.warn("Preloaded pair is no longer valid, fetching a new pair");
                await gameSetup.initialization.runSetupSequence(true, {});
                return;
            }

            gameSetup.initialization.updateGameStateForPreloadedPair(preloadedPair);
            await gameSetup.initialization.setupRound(true);
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
            const imageData = await gameSetup.initialization.loadAndSetupImages(pair, isNewPair);
            await gameSetup.initialization.setupNameTiles(pair, imageData);
            await gameSetup.initialization.setupWorldMaps(pair, imageData);
            gameSetup.initialization.updateGameStateForRound(pair, imageData);
            await hintSystem.updateAllHintButtons();
        },

        async loadAndSetupImages(pair, isNewPair) {
            const imageData = await gameSetup.imageHandling.loadImages(pair, isNewPair);
            state.setObservationURL(imageData.leftImageSrc, 1);
            state.setObservationURL(imageData.rightImageSrc, 2);

            return imageData;
        },

        async setupNameTiles(pair, imageData) {
            const [leftVernacular, rightVernacular] = await Promise.all([
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(imageData.randomized ? pair.taxon1 : pair.taxon2)),
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(imageData.randomized ? pair.taxon2 : pair.taxon1)),
            ]);

            ui.setupNameTilesUI(
                imageData.randomized ? pair.taxon1 : pair.taxon2,
                imageData.randomized ? pair.taxon2 : pair.taxon1,
                leftVernacular,
                rightVernacular,
            );

            state.getElement('imageOne').alt = `${imageData.randomized ? pair.taxon1 : pair.taxon2} Image`;
            state.getElement('imageTwo').alt = `${imageData.randomized ? pair.taxon2 : pair.taxon1} Image`;

            return { leftVernacular, rightVernacular };
        },

        async setupWorldMaps(pair, imageData) {
            const leftContinents = await gameSetup.taxonHandling.getContinentForTaxon(imageData.randomized ? pair.taxon1 : pair.taxon2);
            const rightContinents = await gameSetup.taxonHandling.getContinentForTaxon(imageData.randomized ? pair.taxon2 : pair.taxon1);
            worldMap.createWorldMap(state.getElement('imageOneContainer'), leftContinents);
            worldMap.createWorldMap(state.getElement('imageTwoContainer'), rightContinents);
        },

        updateGameStateForRound(pair, imageData) {
            state.updateGameStateMultiple({
                taxonImageOne: imageData.randomized ? pair.taxon1 : pair.taxon2,
                taxonImageTwo: imageData.randomized ? pair.taxon2 : pair.taxon1,
                currentRound: {
                    pair,
                    imageOneURL: imageData.imageOneURL,
                    imageTwoURL: imageData.imageTwoURL,
                    imageOneVernacular: imageData.leftVernacular,
                    imageTwoVernacular: imageData.rightVernacular,
                    randomized: imageData.randomized,
                },
            });
        },

        updateUIAfterSetup(newPair) {
            ui.updateLevelIndicator(state.getCurrentTaxonImageCollection().pair.level);
            if (gameSetup.initialization.filtersWereCleared()) {
                collectionManager.updateUIForClearedFilters();
            }
            gameSetup.initialization.finishSetup(newPair);
        },

        filtersWereCleared() {
            return state.getSelectedTags().length === 0 &&
                state.getSelectedRanges().length === 0 &&
                state.getSelectedLevel() === '';
        },



        async finishSetup(newPair) {
            ui.setNamePairHeight();
            state.setState(state.GameState.PLAYING);
            gameSetup.initialization.hideLoadingScreen();
            if (newPair) {
                await setManager.refreshSubset();
            }
            if (state.getIsInitialLoad()) {
                state.updateGameStateMultiple({ isInitialLoad: false });
            }
            ui.hideOverlay();
            ui.resetUIState();
            state.setState(state.GameState.PLAYING);
            preloader.startPreloading(newPair);
        },

        hideLoadingScreen() {
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
            }, 500);
        },
    },

    imageHandling: {
        async loadImages(pair, isNewPair) {
            let imageOneURL, imageTwoURL;

            if (isNewPair) {
                imageOneURL = state.getCurrentTaxonImageCollection().imageOneURL;
                imageTwoURL = state.getCurrentTaxonImageCollection().imageTwoURL;
            } else {
                ({ imageOneURL, imageTwoURL } = await gameSetup.imageHandling.getImagesForRound(pair));
            }

            const randomized = Math.random() < 0.5;
            const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
            const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

            await Promise.all([
                gameSetup.imageHandling.loadImageAndRemoveLoadingClass(state.getElement('imageOne'), leftImageSrc),
                gameSetup.imageHandling.loadImageAndRemoveLoadingClass(state.getElement('imageTwo'), rightImageSrc)
            ]);

            return { leftImageSrc, rightImageSrc, randomized, imageOneURL, imageTwoURL };
        },

        async loadImageAndRemoveLoadingClass(imgElement, src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    imgElement.src = src;
                    imgElement.classList.remove('image-container__image--loading');
                    setTimeout(() => {
                        imgElement.classList.add('image-container__image--loaded');
                        resolve();
                    }, 50); // 50ms delay to ensure the browser has time to apply the new src
                };
                img.src = src;
            });
        },

        async getImagesForRound(pair) {
            const preloadedImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
            if (preloadedImages && preloadedImages.taxon1 && preloadedImages.taxon2) {
                return { imageOneURL: preloadedImages.taxon1, imageTwoURL: preloadedImages.taxon2 };
            }
            return {
                imageOneURL: await preloader.imageLoader.fetchDifferentImage(pair.taxon1, state.getCurrentRound().imageOneURL),
                imageTwoURL: await preloader.imageLoader.fetchDifferentImage(pair.taxon2, state.getCurrentRound().imageTwoURL),
            };
        },
    },

    taxonHandling: {
        async getPairBySetID(setID) {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            return taxonPairs.find(pair => pair.setID === setID);
        },

        async getContinentForTaxon(taxon) {
            const taxonInfo = await api.taxonomy.loadTaxonInfo();
            const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

            if (taxonData && taxonData.range && taxonData.range.length > 0) {
                return taxonData.range.map(code => worldMap.getFullContinentName(code));
            }
            logger.debug(`No range data found for ${taxon}. Using placeholder.`);
            return []; // no continents
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


    // Public API //

    async setupGame(newPair = false, urlParams = {}) {
        if (isSettingUpGame) {
            logger.debug("Setup already in progress, skipping");
            return;
        }
        isSettingUpGame = true;

        try {
            await gameSetup.initialization.runSetupSequence(newPair, urlParams);
        } catch (error) {
            gameSetup.errorHandling.handleSetupError(error);
        } finally {
            isSettingUpGame = false;
        }
    },

};

const publicAPI = {
    setupGame: gameSetup.setupGame.bind(gameSetup),
    // used once in gameLogic
    setupGameWithPreloadedPair: gameSetup.initialization.setupWithPreloadedPair.bind(this)
};

export default publicAPI;
