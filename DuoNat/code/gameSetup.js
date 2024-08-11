import api from './api.js';
import config from './config.js';
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

    async checkINaturalistReachability() {
        if (!await api.isINaturalistReachable()) {
            ui.dialogs.showINatDownDialog();
            game.setState(GameState.IDLE);
            return false;
        }
        ui.dialogs.hideINatDownDialog();
        return true;
    },

    async setupGame(newPair = false, urlParams = {}) {
        if (isSettingUpGame) {
            logger.debug("Setup already in progress, skipping");
            return;
        }
        isSettingUpGame = true;

        try {
            game.setState(GameState.LOADING);

            if (!await this.checkINaturalistReachability()) { return; }

            this.prepareUIForLoading();

            try {
                if (newPair || !gameState.currentTaxonImageCollection) {
                    await this.initializeNewPair(urlParams);
                } else {
                    await this.setupRound();
                }

                // Update skill level indicator
                const level = gameState.currentTaxonImageCollection.pair.level;
                ui.levelIndicator.updateLevelIndicator(level);

                // If filters were cleared (which happens when '+' is pressed), update the UI
                if (gameState.selectedTags.length === 0 && gameState.selectedRanges.length === 0 && gameState.selectedLevel === '') {
                    ui.taxonPairList.updateFilterSummary();
                    ui.filters.updateLevelDropdown();
                }

                this.finishSetup();
                gameUI.layoutManagement.setNamePairHeight();

                game.setState(GameState.PLAYING);
                game.hideLoadingScreen();

                if (newPair) {
                    await setManager.refreshSubset();
                }

                if (gameState.isInitialLoad) {
                    updateGameState({ isInitialLoad: false });
                }

                ui.overlay.hideOverlay();
                ui.core.resetUIState();

                // Start preloading asynchronously
                preloader.startPreloading(newPair);
            } catch (error) {
                this.handleSetupError(error);
            }

        } finally {
            isSettingUpGame = false;
        }
    },

    async setupGameWithPreloadedPair(preloadedPair) {
        logger.debug(`Setting up game with preloaded pair: ${preloadedPair.pair.taxon1} / ${preloadedPair.pair.taxon2}, Skill Level: ${preloadedPair.pair.level}`);
        logger.debug(`Current selected level: ${gameState.selectedLevel}`);

        if (!preloader.isPairValid(preloadedPair.pair)) {
            logger.warn("Preloaded pair is no longer valid, fetching a new pair");
            await this.setupGame(true);
            return;
        }

        updateGameState({
            currentTaxonImageCollection: {
                pair: preloadedPair.pair,
                imageOneURL: preloadedPair.taxon1,
                imageTwoURL: preloadedPair.taxon2
            },
            usedImages: {
                taxon1: new Set([preloadedPair.taxon1]),
                taxon2: new Set([preloadedPair.taxon2])
            }
        });

        await this.setupRound(true);
    },

    prepareUIForLoading() {
        utils.resetDraggables();
        gameUI.imageHandling.prepareImagesForLoading();
        var startMessage = gameState.isFirstLoad ? "Drag the names!" : `${game.loadingMessage}`;
        ui.overlay.showOverlay(startMessage, config.overlayColors.green);
        gameState.isFirstLoad = false;
    },

    async initializeNewPair(urlParams = {}) {
        let newPair, imageOneURL, imageTwoURL;

        if (game.nextSelectedPair) {
            newPair = game.nextSelectedPair;
            game.nextSelectedPair = null;
            logger.debug(`Using selected pair: ${newPair.taxon1} / ${newPair.taxon2}`);
        } else {
            const filters = {
                level: urlParams.level || gameState.selectedLevel,
                ranges: urlParams.ranges ? urlParams.ranges.split(',') : gameState.selectedRanges,
                tags: urlParams.tags ? urlParams.tags.split(',') : gameState.selectedTags
            };

            const filteredPairs = await utils.getFilteredTaxonPairs(filters);

            if (urlParams.setID) {
                newPair = filteredPairs.find(pair => pair.setID === urlParams.setID);
                if (newPair) {
                    logger.debug(`Found pair with setID: ${urlParams.setID}`);
                } else {
                    logger.warn(`SetID ${urlParams.setID} not found in filtered collection. Selecting random pair.`);
                }
            } else if (urlParams.taxon1 && urlParams.taxon2) {
                newPair = filteredPairs.find(pair =>
                    (pair.taxonNames[0] === urlParams.taxon1 && pair.taxonNames[1] === urlParams.taxon2) ||
                    (pair.taxonNames[0] === urlParams.taxon2 && pair.taxonNames[1] === urlParams.taxon1)
                );
                if (newPair) {
                    logger.debug(`Found pair with taxa: ${urlParams.taxon1} and ${urlParams.taxon2}`);
                } else {
                    logger.warn(`Taxa ${urlParams.taxon1} and ${urlParams.taxon2} not found in filtered collection. Selecting random pair.`);
                }
            }

            if (!newPair) {
                if (filteredPairs.length > 0) {
                    newPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    logger.debug("Selected random pair from filtered collection");
                } else {
                    throw new Error("No pairs available in the current filtered collection");
                }
            }
        }

        const preloadedImages = preloader.getPreloadedImagesForNextPair();
        if (preloadedImages && preloadedImages.pair.setID === newPair.setID) {
            imageOneURL = preloadedImages.taxon1;
            imageTwoURL = preloadedImages.taxon2;
            logger.debug(`Using preloaded images for set ID ${newPair.setID}`);
        } else {
            [imageOneURL, imageTwoURL] = await Promise.all([
                preloader.fetchDifferentImage(newPair.taxon1 || newPair.taxonNames[0], null),
                preloader.fetchDifferentImage(newPair.taxon2 || newPair.taxonNames[1], null)
            ]);
        }

        updateGameState({
            currentTaxonImageCollection: {
                pair: newPair,
                imageOneURL,
                imageTwoURL,
                level: newPair.level || '1' // Default to level 1 if not specified
            },
            usedImages: {
                taxon1: new Set([imageOneURL]),
                taxon2: new Set([imageTwoURL])
            },
            currentSetID: newPair.setID || gameState.currentSetID
        });

        // Update the skill level indicator
        ui.levelIndicator.updateLevelIndicator(newPair.level || '1');

        await this.setupRound(true);
    },

    async getPairBySetID(setID) {
        const taxonPairs = await api.fetchTaxonPairs();
        return taxonPairs.find(pair => pair.setID === setID);
    },

    async getContinentForTaxon(taxon) {
        const taxonInfo = await api.loadTaxonInfo();
        const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

        if (taxonData && taxonData.range && taxonData.range.length > 0) {
            // Convert the continent codes to full names
            return taxonData.range.map(code => getFullContinentName(code));
        } else {
            logger.debug(`No range data found for ${taxon}. Using placeholder.`);
            return ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
        }
    },

    async setupRound(isNewPair = false) {
        const { pair } = gameState.currentTaxonImageCollection;
        const randomized = Math.random() < 0.5;

        let imageOneURL, imageTwoURL;

        if (isNewPair) {
            imageOneURL = gameState.currentTaxonImageCollection.imageOneURL;
            imageTwoURL = gameState.currentTaxonImageCollection.imageTwoURL;
        } else {
            const preloadedImages = preloader.getPreloadedImagesForNextRound();
            if (preloadedImages && preloadedImages.taxon1 && preloadedImages.taxon2) {
                imageOneURL = preloadedImages.taxon1;
                imageTwoURL = preloadedImages.taxon2;
            } else {
                [imageOneURL, imageTwoURL] = await Promise.all([
                    preloader.fetchDifferentImage(pair.taxon1, gameState.currentRound.imageOneURL),
                    preloader.fetchDifferentImage(pair.taxon2, gameState.currentRound.imageTwoURL)
                ]);
            }
        }

        const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
        const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

        await game.loadImages(leftImageSrc, rightImageSrc);

        // Set the observation URLs
        game.currentObservationURLs.imageOne = api.getObservationURLFromImageURL(leftImageSrc);
        game.currentObservationURLs.imageTwo = api.getObservationURLFromImageURL(rightImageSrc);

        const [leftVernacular, rightVernacular] = await Promise.all([
            utils.capitalizeFirstLetter(await api.fetchVernacular(randomized ? pair.taxon1 : pair.taxon2)),
            utils.capitalizeFirstLetter(await api.fetchVernacular(randomized ? pair.taxon2 : pair.taxon1))
        ]);

        gameUI.nameTiles.setupNameTilesUI(
            randomized ? pair.taxon1 : pair.taxon2,
            randomized ? pair.taxon2 : pair.taxon1,
            leftVernacular,
            rightVernacular
        );

        // Add world maps
        const leftContinents = await this.getContinentForTaxon(randomized ? pair.taxon1 : pair.taxon2);
        const rightContinents = await this.getContinentForTaxon(randomized ? pair.taxon2 : pair.taxon1);
        createWorldMap(elements.imageOneContainer, leftContinents);
        createWorldMap(elements.imageTwoContainer, rightContinents);

        updateGameState({
            taxonImageOne: randomized ? pair.taxon1 : pair.taxon2,
            taxonImageTwo: randomized ? pair.taxon2 : pair.taxon1,
            currentRound: {
                pair,
                imageOneURL,
                imageTwoURL,
                imageOneVernacular: leftVernacular,
                imageTwoVernacular: rightVernacular,
                randomized
            }
        });

        setTimeout(() => gameUI.layoutManagement.setNamePairHeight(), 100);
    },

    finishSetup() {
        ui.overlay.hideOverlay();
    },

    handleSetupError(error) {
        logger.error("Error setting up game:", error);
        if (error.message === "Failed to select a valid taxon pair") {
            ui.overlay.showOverlay("No valid taxon pairs found. Please check your filters and try again.", config.overlayColors.red);
        } else {
            ui.overlay.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
        }
        game.setState(GameState.IDLE);
        if (gameState.isInitialLoad) {
            game.hideLoadingScreen();
            updateGameState({ isInitialLoad: false });
        }
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(gameSetup).forEach(key => {
    if (typeof gameSetup[key] === 'function') {
        gameSetup[key] = gameSetup[key].bind(gameSetup);
    }
});

export default gameSetup;
