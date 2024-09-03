import api from './api.js';
import config from './config.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import preloader from './preloader.js';
import pairManager from './pairManager.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';
import worldMap from './worldMap.js';

const roundManager = {
    initialization: {
        async loadNewRound(isNewPair = false) {
            //logger.warn(`Starting loadNewRound. isNewPair: ${isNewPair}`);
            this.initializeRoundLoading();

            try {
                const pairData = await this.getPairData(isNewPair);
                const images = await roundManager.imageHandling.getAndProcessImages(pairData, isNewPair);
                await roundManager.setupComponents.setupRoundComponents(pairData.pair, images);
                roundManager.stateManagement.updateGameState(pairData.pair, images);
                roundManager.uiManagement.finalizeRoundLoading(isNewPair);
            } catch (error) {
                this.handleError(error);
            } finally {
                this.setGameStateToPlaying();
            }
        },

        initializeRoundLoading() {
            state.setState(state.GameState.LOADING);
            ui.prepareImagesForLoading();
        },

        async getPairData(isNewPair) {
            const pairData = await pairManager.getNextPair(isNewPair);
            
            if (!pairData || !pairData.pair) {
                logger.error('Invalid pairData structure received from pairManager.getNextPair');
                throw new Error('Invalid pairData: missing pair property');
            }
            
            return pairData;
        },

        setGameStateToPlaying() {
            state.setState(state.GameState.PLAYING);
            //logger.debug(`loadNewRound complete. Game state set to PLAYING`);
        },

        handleError(error) {
            logger.error("Error loading round:", error);
            ui.showOverlay("Error loading round. Please try again.", config.overlayColors.red);
        }
    },

    imageHandling: {
        async getAndProcessImages(pairData, isNewPair) {
            if (!pairData) {
                logger.error('Invalid pairData received in getAndProcessImages');
                throw new Error('Invalid pairData: pairData is undefined');
            }

            const images = await this.getImages(pairData, isNewPair);
            return this.randomizeImages(images, pairData.pair);
        },

        randomizeImages(images, pair) {
            const randomized = Math.random() < 0.5;

            return {
                leftImageSrc: randomized ? images.taxonB : images.taxonA,
                rightImageSrc: randomized ? images.taxonA : images.taxonB,
                taxonImageOne: randomized ? pair.taxonB : pair.taxonA,
                taxonImageTwo: randomized ? pair.taxonA : pair.taxonB,
                randomized
            };
        },

        async getImages(pairData, isNewPair) {
            if (!pairData || !pairData.pair) {
                logger.error('Invalid pairData received in getImages');
                throw new Error('Invalid pairData: pair is undefined');
            }
            const { pair, preloadedImages } = pairData;
            if (isNewPair && preloadedImages) {
                //logger.debug(`Using preloaded images for pair: ${pair.taxonA} / ${pair.taxonB}`);
                return { taxonA: preloadedImages.taxonA, taxonB: preloadedImages.taxonB };
            }

            const preloadedRoundImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
            if (preloadedRoundImages && preloadedRoundImages.taxonA && preloadedRoundImages.taxonB) {
                //logger.debug(`Using preloaded round images for pair: ${pair.taxonA} / ${pair.taxonB}`);
                preloader.roundPreloader.clearPreloadedImagesForNextRound();
                return { taxonA: preloadedRoundImages.taxonA, taxonB: preloadedRoundImages.taxonB };
            }

            //logger.debug(`Fetching new images for pair: ${pair.taxonA} / ${pair.taxonB}`);
            return {
                taxonA: await preloader.imageLoader.fetchDifferentImage(pair.taxonA, null),
                taxonB: await preloader.imageLoader.fetchDifferentImage(pair.taxonB, null)
            };
        },

        async loadImage(imgElement, src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    imgElement.src = src;
                    imgElement.classList.remove('image-container__image--loading');
                    setTimeout(() => {
                        imgElement.classList.add('image-container__image--loaded');
                        resolve();
                    }, 50);
                };
                img.src = src;
            });
        },

        async loadAndSetupImages(pair, isNewPair) {
            let imageOneURL, imageTwoURL;

            if (isNewPair) {
                imageOneURL = state.getCurrentTaxonImageCollection().imageOneURL;
                imageTwoURL = state.getCurrentTaxonImageCollection().imageTwoURL;
            } else {
                // Check for preloaded images
                const preloadedImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
                if (preloadedImages && preloadedImages.taxonA && preloadedImages.taxonB) {
                    //logger.debug("Using preloaded images for next round");
                    imageOneURL = preloadedImages.taxonA;
                    imageTwoURL = preloadedImages.taxonB;
                    // Clear the preloaded images after use
                    preloader.roundPreloader.clearPreloadedImagesForNextRound();
                } else {
                    //logger.debug("No preloaded images available, fetching new images");
                    [imageOneURL, imageTwoURL] = await Promise.all([
                        preloader.imageLoader.fetchDifferentImage(pair.taxonA, state.getCurrentRound().imageOneURL),
                        preloader.imageLoader.fetchDifferentImage(pair.taxonB, state.getCurrentRound().imageTwoURL)
                    ]);
                }
            }

            const randomized = Math.random() < 0.5;

            const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
            const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

            await Promise.all([
                this.loadImage(state.getElement('imageOne'), leftImageSrc),
                this.loadImage(state.getElement('imageTwo'), rightImageSrc)
            ]);

            state.setObservationURL(leftImageSrc, 1);
            state.setObservationURL(rightImageSrc, 2);

            return { leftImageSrc, rightImageSrc, randomized, imageOneURL, imageTwoURL };
        },

        async getImagesForRound(pair) {
            const preloadedImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
            if (preloadedImages && preloadedImages.taxonA && preloadedImages.taxonB) {
                return { imageOneURL: preloadedImages.taxonA, imageTwoURL: preloadedImages.taxonB };
            }
            return {
                imageOneURL: await preloader.imageLoader.fetchDifferentImage(pair.taxonA, state.getCurrentRound().imageOneURL),
                imageTwoURL: await preloader.imageLoader.fetchDifferentImage(pair.taxonB, state.getCurrentRound().imageTwoURL),
            };
        },
    },

    setupComponents: {
        async setupRoundComponents(pair, imageData) {
            this.setObservationURLs(imageData);
            logger.debug("problem in setupRoundComponents: sets imageData = leftImageSrc=1 rightImageSrc=2");
            await this.setupRound(pair, imageData);
            //logger.debug(`Round setup complete`);
        },

        setObservationURLs(imageData) {
            state.setObservationURL(imageData.leftImageSrc, 1);
            state.setObservationURL(imageData.rightImageSrc, 2);
            // Also update the current round state
            state.updateGameStateMultiple({
                currentRound: {
                    ...state.getCurrentRound(),
                    imageOneURL: imageData.leftImageSrc,
                    imageTwoURL: imageData.rightImageSrc,
                },
            });
        },

    async setupRound(pair, imageData) {
        const { leftImageSrc, rightImageSrc, randomized, taxonImageOne, taxonImageTwo } = imageData;

        // Load images
        await Promise.all([
            roundManager.imageHandling.loadImage(state.getElement('imageOne'), leftImageSrc),
            roundManager.imageHandling.loadImage(state.getElement('imageTwo'), rightImageSrc)
        ]);

        // Setup name tiles and world maps
        const [nameTileData, worldMapData] = await Promise.all([
            this.setupNameTiles(pair, randomized, taxonImageOne, taxonImageTwo),
            this.setupWorldMaps(pair, randomized, taxonImageOne, taxonImageTwo)
        ]);

        // Update game state
        roundManager.stateManagement.updateGameStateForRound(pair, imageData, nameTileData);

        // Update hint buttons
        await hintSystem.updateAllHintButtons();

        // Apply world map data
        worldMap.createWorldMap(state.getElement('imageOneContainer'), worldMapData.leftContinents);
        worldMap.createWorldMap(state.getElement('imageTwoContainer'), worldMapData.rightContinents);

        return { nameTileData, worldMapData };
    },

        async setupRoundFromGameSetup(isNewPair = false) {
            const { pair } = state.getCurrentTaxonImageCollection();
            
            // Use getAndProcessImages instead of loadAndSetupImages
            const pairData = { pair, preloadedImages: null };
            const imageData = await roundManager.imageHandling.getAndProcessImages(pairData, isNewPair);
            
            logger.debug("setupRoundFromGameSetup: imageData processed with consistent randomization");

            // Explicitly set the observation URLs before setting up the round
            this.setObservationURLs(imageData);

            const { nameTileData, worldMapData } = await this.setupRound(pair, imageData, isNewPair);

            return { imageData, nameTileData, worldMapData };
        },

        async setupNameTiles(pair, randomized, taxonImageOne, taxonImageTwo) {
            logger.warn("setupNameTiles");
            const [leftVernacular, rightVernacular] = await Promise.all([
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(taxonImageOne)),
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(taxonImageTwo))
            ]);

            ui.setupNameTilesUI(
                taxonImageOne,
                taxonImageTwo,
                leftVernacular,
                rightVernacular
            );

            state.getElement('imageOne').alt = `${taxonImageOne} Image`;
            state.getElement('imageTwo').alt = `${taxonImageTwo} Image`;

            return { leftVernacular, rightVernacular };
        },

        async setupWorldMaps(pair, randomized) {
            const [leftContinents, rightContinents] = await Promise.all([
                this.getContinentForTaxon(randomized ? pair.taxonA : pair.taxonB),
                this.getContinentForTaxon(randomized ? pair.taxonB : pair.taxonA)
            ]);

            return { leftContinents, rightContinents };
        },

        async getContinentForTaxon(taxon) {
            const taxonInfo = await api.taxonomy.loadTaxonInfo();
            const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

            if (taxonData && taxonData.range && taxonData.range.length > 0) {
                return taxonData.range.map(code => worldMap.getFullContinentName(code));
            }
            logger.debug(`No range data found for ${taxon}. Using placeholder.`);
            return [];
        },
    },

    stateManagement: {
        updateGameState(pair, images) {
            this.updateState(pair, images);
            //logger.debug(`State updated`);
        },

        updateGameStateForRound(pair, imageData, nameTileData) {
            const { leftImageSrc, rightImageSrc, randomized, taxonImageOne, taxonImageTwo } = imageData;

            state.updateGameStateMultiple({
                taxonImageOne: taxonImageOne,
                taxonImageTwo: taxonImageTwo,
                currentRound: {
                    pair,
                    imageOneURL: leftImageSrc,
                    imageTwoURL: rightImageSrc,
                    imageOneVernacular: nameTileData.leftVernacular,
                    imageTwoVernacular: nameTileData.rightVernacular,
                    randomized: randomized,
                },
            });
        },

        updateState(pair, images) {
            state.updateRoundState(pair, images);
            ui.updateLevelIndicator(pair.level || '1');
        },
    },

    uiManagement: {
        finalizeRoundLoading(isNewPair) {
            //logger.debug(`Preloading started`);
            ui.hideOverlay();
            ui.resetUIState();
            //logger.debug(`UI reset complete`);
            preloader.startPreloading(isNewPair);
        },

        resetDraggables() {
            const leftNameContainer = document.getElementsByClassName('name-pair__container--x')[0];
            const rightNameContainer = document.getElementsByClassName('name-pair__container--y')[0];
            const dropOne = document.getElementById('drop-1');
            const dropTwo = document.getElementById('drop-2');

            leftNameContainer.appendChild(document.getElementById('name-x'));
            rightNameContainer.appendChild(document.getElementById('name-y'));

            dropOne.innerHTML = '';
            dropTwo.innerHTML = '';
        },
    },
};

// Bind all methods in roundManager and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(roundManager);

const publicAPI = {
    loadNewRound: roundManager.initialization.loadNewRound,
    setupRound: roundManager.setupComponents.setupRound,
    setupRoundFromGameSetup: roundManager.setupComponents.setupRoundFromGameSetup,
    resetDraggables: roundManager.uiManagement.resetDraggables,
    // just temporarily public during refactoring:
    getImagesForRound: roundManager.imageHandling.getImagesForRound,
    loadAndSetupImages: roundManager.imageHandling.loadAndSetupImages,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(roundManager);
    }
});

export default publicAPI;
