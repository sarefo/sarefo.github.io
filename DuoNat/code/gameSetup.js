import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import game from './game.js';
import { gameState, updateGameState, GameState, elements } from './state.js';
import logger from './logger.js';
import preloader from './preloader.js';
import setManager from './setManager.js';
import ui from './ui.js';
import utils from './utils.js';
import { createWorldMap, getFullContinentName } from './worldMap.js';
import gameUI from './gameUI.js';

let isSettingUpGame = false;


const gameSetup = {
    initialization: {
        async checkINaturalistReachability() {
            if (!await api.externalAPIs.isINaturalistReachable()) {
                dialogManager.showINatDownDialog();
                game.setState(GameState.IDLE);
                return false;
            }
            dialogManager.hideINatDownDialog();
            return true;
        },

        async runSetupSequence(newPair, urlParams) {
            game.setState(GameState.LOADING);
            if (!await this.initialization.checkINaturalistReachability()) return;

            this.initialization.prepareUIForLoading();

            if (newPair || !gameState.currentTaxonImageCollection) {
                await this.initialization.initializeNewPair(urlParams);
            } else {
                await this.initialization.setupRound();
            }

            this.initialization.updateUIAfterSetup(newPair);
        },

        prepareUIForLoading() {
            utils.game.resetDraggables();
            gameUI.imageHandling.prepareImagesForLoading();
            const startMessage = gameState.isFirstLoad ? "Drag the names!" : game.getLoadingMessage();
            ui.overlay.showOverlay(startMessage, config.overlayColors.green);
            gameState.isFirstLoad = false;
        },

        async initializeNewPair(urlParams) {
            const newPair = await this.initialization.selectNewPair(urlParams);
            const images = await this.initialization.loadImagesForNewPair(newPair);
            this.initialization.updateGameStateForNewPair(newPair, images);
            await this.initialization.setupRound(true);
        },

        async selectNewPair(urlParams) {
            game.resetShownHints();
            let nextSelectedPair = game.getNextSelectedPair();
            if (nextSelectedPair) {
                game.setNextSelectedPair(null);
                return nextSelectedPair;
            }
            return await this.initialization.selectPairFromFilters(urlParams);
        },

        async selectPairFromFilters(urlParams) {
            const filters = this.initialization.createFiltersFromUrlParams(urlParams);
            const filteredPairs = await utils.game.getFilteredTaxonPairs(filters);
            return this.initialization.findOrSelectRandomPair(filteredPairs, urlParams);
        },

        createFiltersFromUrlParams(urlParams) {
            return {
                level: urlParams.level || gameState.selectedLevel,
                ranges: urlParams.ranges ? urlParams.ranges.split(',') : gameState.selectedRanges,
                tags: urlParams.tags ? urlParams.tags.split(',') : gameState.selectedTags,
            };
        },

        findOrSelectRandomPair(filteredPairs, urlParams) {
            let pair = this.initialization.findPairByUrlParams(filteredPairs, urlParams);
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
                return this.initialization.findPairBySetID(filteredPairs, urlParams.setID);
            } else if (urlParams.taxon1 && urlParams.taxon2) {
                return this.initialization.findPairByTaxa(filteredPairs, urlParams.taxon1, urlParams.taxon2);
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
            updateGameState({
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
                currentSetID: newPair.setID || gameState.currentSetID,
            });
            ui.levelIndicator.updateLevelIndicator(newPair.level || '1');
        },

        async setupWithPreloadedPair(preloadedPair) {
            game.resetShownHints();
            logger.debug(`Setting up game with preloaded pair: ${preloadedPair.pair.taxon1} / ${preloadedPair.pair.taxon2}, Skill Level: ${preloadedPair.pair.level}`);
            logger.debug(`Current selected level: ${gameState.selectedLevel}`);

            if (!preloader.pairPreloader.isPairValid(preloadedPair.pair)) {
                logger.warn("Preloaded pair is no longer valid, fetching a new pair");
                await this.initialization.runSetupSequence(true, {});
                return;
            }

            this.initialization.updateGameStateForPreloadedPair(preloadedPair);
            await this.initialization.setupRound(true);
        },

        updateGameStateForPreloadedPair(preloadedPair) {
            updateGameState({
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
            const { pair } = gameState.currentTaxonImageCollection;
            const imageData = await this.initialization.loadAndSetupImages(pair, isNewPair);
            await this.initialization.setupNameTiles(pair, imageData);
            await this.initialization.setupWorldMaps(pair, imageData);
            this.initialization.updateGameStateForRound(pair, imageData);
        },

        async loadAndSetupImages(pair, isNewPair) {
            const imageData = await gameSetup.imageHandling.loadImages(pair, isNewPair);
            game.currentObservationURLs.imageOne = api.utils.getObservationURLFromImageURL(imageData.leftImageSrc);
            game.currentObservationURLs.imageTwo = api.utils.getObservationURLFromImageURL(imageData.rightImageSrc);
            return imageData;
        },

        async setupNameTiles(pair, imageData) {
            const [leftVernacular, rightVernacular] = await Promise.all([
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(imageData.randomized ? pair.taxon1 : pair.taxon2)),
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(imageData.randomized ? pair.taxon2 : pair.taxon1)),
            ]);

            gameUI.nameTiles.setupNameTilesUI(
                imageData.randomized ? pair.taxon1 : pair.taxon2,
                imageData.randomized ? pair.taxon2 : pair.taxon1,
                leftVernacular,
                rightVernacular,
            );

            elements.imageOne.alt = `${imageData.randomized ? pair.taxon1 : pair.taxon2} Image`;
            elements.imageTwo.alt = `${imageData.randomized ? pair.taxon2 : pair.taxon1} Image`;

            return { leftVernacular, rightVernacular };
        },

        async setupWorldMaps(pair, imageData) {
            const leftContinents = await gameSetup.taxonHandling.getContinentForTaxon(imageData.randomized ? pair.taxon1 : pair.taxon2);
            const rightContinents = await gameSetup.taxonHandling.getContinentForTaxon(imageData.randomized ? pair.taxon2 : pair.taxon1);
            createWorldMap(elements.imageOneContainer, leftContinents);
            createWorldMap(elements.imageTwoContainer, rightContinents);
        },

        updateGameStateForRound(pair, imageData) {
            updateGameState({
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
            ui.levelIndicator.updateLevelIndicator(gameState.currentTaxonImageCollection.pair.level);
            if (this.initialization.filtersWereCleared()) {
                this.initialization.updateUIForClearedFilters();
            }
            this.initialization.finishSetup(newPair);
        },

        filtersWereCleared() {
            return gameState.selectedTags.length === 0 &&
                   gameState.selectedRanges.length === 0 &&
                   gameState.selectedLevel === '';
        },

        updateUIForClearedFilters() {
            ui.taxonPairList.updateFilterSummary();
            ui.filters.updateLevelDropdown();
        },

        async finishSetup(newPair) {
            gameUI.layoutManagement.setNamePairHeight();
            game.setState(GameState.PLAYING);
            this.initialization.hideLoadingScreen();
            if (newPair) {
                await setManager.refreshSubset();
            }
            if (gameState.isInitialLoad) {
                updateGameState({ isInitialLoad: false });
            }
            ui.overlay.hideOverlay();
            ui.core.resetUIState();
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
                imageOneURL = gameState.currentTaxonImageCollection.imageOneURL;
                imageTwoURL = gameState.currentTaxonImageCollection.imageTwoURL;
            } else {
                ({ imageOneURL, imageTwoURL } = await this.imageHandling.getImagesForRound(pair));
            }

            const randomized = Math.random() < 0.5;
            const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
            const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

            await game.loadImages(leftImageSrc, rightImageSrc);

            return { leftImageSrc, rightImageSrc, randomized, imageOneURL, imageTwoURL };
        },

        async getImagesForRound(pair) {
            const preloadedImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
            if (preloadedImages && preloadedImages.taxon1 && preloadedImages.taxon2) {
                return { imageOneURL: preloadedImages.taxon1, imageTwoURL: preloadedImages.taxon2 };
            }
            return {
                imageOneURL: await preloader.imageLoader.fetchDifferentImage(pair.taxon1, gameState.currentRound.imageOneURL),
                imageTwoURL: await preloader.imageLoader.fetchDifferentImage(pair.taxon2, gameState.currentRound.imageTwoURL),
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
                return taxonData.range.map(code => getFullContinentName(code));
            }
            logger.debug(`No range data found for ${taxon}. Using placeholder.`);
            return ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
        },
    },

    errorHandling: {
        handleSetupError(error) {
            logger.error("Error setting up game:", error);
            if (error.message === "Failed to select a valid taxon pair") {
                ui.overlay.showOverlay("No valid taxon pairs found. Please check your filters and try again.", config.overlayColors.red);
            } else {
                ui.overlay.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
            }
            game.setState(GameState.IDLE);
            if (gameState.isInitialLoad) {
                gameSetup.initialization.hideLoadingScreen();
                updateGameState({ isInitialLoad: false });
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
            await this.initialization.runSetupSequence(newPair, urlParams);
        } catch (error) {
            this.errorHandling.handleSetupError(error);
        } finally {
            isSettingUpGame = false;
        }
    },

    // used once in gameLogic
    async setupGameWithPreloadedPair(preloadedPair) {
        await this.initialization.setupWithPreloadedPair(preloadedPair);
    },


};

// Bind all methods to ensure correct 'this' context
Object.keys(gameSetup).forEach(key => {
    Object.keys(gameSetup[key]).forEach(methodKey => {
        if (typeof gameSetup[key][methodKey] === 'function') {
            gameSetup[key][methodKey] = gameSetup[key][methodKey].bind(gameSetup);
        }
    });
});

export default gameSetup;

