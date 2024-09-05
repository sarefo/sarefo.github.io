import api from './api.js';
import config from './config.js';
import errorHandling from './errorHandling.js';
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

        async loadNewRound() {
            //logger.debug("loadNewRound");
            state.setState(state.GameState.LOADING_ROUND);
            if (!await api.externalAPIs.checkINaturalistReachability()) return;

            try {
                roundManager.imageHandling.prepareImagesForLoading();
                if (!state.getCurrentTaxonImageCollection()) { // TODO no idea what this really does yet
                    await pairManager.initializeNewPair(); // TODO not sure if great
                } else {
                    await roundManager.setupComponents.setupRoundFromGameSetup();
                }
                await roundManager.imageHandling.fadeInNewImages();
            } catch (error) {
                errorHandling.handleSetupError(error);
            } finally {
                state.setState(state.GameState.PLAYING);
            }
            // also called in loadNewPair()!!
            await ui.updateUIAfterSetup(false); // TODO
        },
    },

    imageHandling: {
        prepareImagesForLoading() {
            const image1 = state.getElement('image1');
            const image2 = state.getElement('image2');
            
            image1.classList.remove('image-container__image--fade-in');
            image2.classList.remove('image-container__image--fade-in');
            
            image1.classList.add('image-container__image--loading');
            image2.classList.add('image-container__image--loading');
        },

        // called from:
        // - setupRoundFromGameSetup()
        // - pairManager.loadNewRandomPair() > eliminate
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
                taxonImage1Src: randomized ? images.taxonB : images.taxonA,
                taxonImage2Src: randomized ? images.taxonA : images.taxonB,
                taxonImage1: randomized ? pair.taxonB : pair.taxonA,
                taxonImage2: randomized ? pair.taxonA : pair.taxonB,
                randomized
            };
        },

        // called from getAndProcessImages()
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

        async fadeInNewImages() {
            const image1 = state.getElement('image1');
            const image2 = state.getElement('image2');
            
            image1.classList.add('image-container__image--fade-in');
            image2.classList.add('image-container__image--fade-in');
            
            await new Promise(resolve => setTimeout(resolve, 300)); // Match CSS transition

            image1.classList.remove('image-container__image--fade-in');
            image2.classList.remove('image-container__image--fade-in');
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

        async getImagesForRound(pair) {
            const preloadedImages = preloader.roundPreloader.getPreloadedImagesForNextRound();
            if (preloadedImages && preloadedImages.taxonA && preloadedImages.taxonB) {
                return { image1URL: preloadedImages.taxonA, image2URL: preloadedImages.taxonB };
            }
            return {
                image1URL: await preloader.imageLoader.fetchDifferentImage(pair.taxonA, state.getCurrentRound().image1URL),
                image2URL: await preloader.imageLoader.fetchDifferentImage(pair.taxonB, state.getCurrentRound().image2URL),
            };
        },
    },

    setupComponents: {
        setObservationURLs(imageData) {
            //logger.debug(`Setting observation URLs: ${imageData.taxonImage1Src} / ${imageData.taxonImage2Src}`);
            state.setObservationURL(imageData.taxonImage1Src, 1);
            state.setObservationURL(imageData.taxonImage2Src, 2);
            // Also update the current round state
            state.updateGameStateMultiple({
                currentRound: {
                    ...state.getCurrentRound(),
                    image1URL: imageData.taxonImage1Src,
                    image2URL: imageData.taxonImage2Src,
                },
            });
            //logger.debug(`Updated current round state with images: ${state.getCurrentRound().image1URL} / ${state.getCurrentRound().image2URL}`);
        },

        async setupRound(pair, imageData) {
            const { taxonImage1Src, taxonImage2Src, randomized, taxonImage1, taxonImage2 } = imageData;

            // Load images
            await Promise.all([
                roundManager.imageHandling.loadImage(state.getElement('image1'), taxonImage1Src),
                roundManager.imageHandling.loadImage(state.getElement('image2'), taxonImage2Src)
            ]);

            // Setup name tiles and world maps
            const [nameTileData, worldMapData] = await Promise.all([
                this.setupNameTiles(pair, randomized, taxonImage1, taxonImage2),
                this.setupWorldMaps(pair, randomized, taxonImage1, taxonImage2)
            ]);

            // Update game state
            roundManager.stateManagement.updateGameStateForRound(pair, imageData, nameTileData);

            // Update hint buttons
            await hintSystem.updateAllHintButtons();

            // Apply world map data
            worldMap.createWorldMap(state.getElement('image1Container'), worldMapData.continents1);
            worldMap.createWorldMap(state.getElement('image2Container'), worldMapData.continents2);

            return { nameTileData, worldMapData };
        },

        async setupRoundFromGameSetup(isNewPair = false) {
            const { pair } = state.getCurrentTaxonImageCollection();
            
            let imageData;
            if (isNewPair) {
                // For a new pair, use the images that were just loaded
                imageData = {
                    taxonImage1Src: state.getCurrentTaxonImageCollection().image1URL,
                    taxonImage2Src: state.getCurrentTaxonImageCollection().image2URL,
                    taxonImage1: pair.taxonA,
                    taxonImage2: pair.taxonB,
                };
                //logger.debug(`Using new pair images: ${imageData.taxonImage1Src} / ${imageData.taxonImage2Src}`);
            } else {
                // For existing pairs, use getAndProcessImages as before
                const pairData = { pair, preloadedImages: null };
                imageData = await roundManager.imageHandling.getAndProcessImages(pairData, isNewPair);
            }
            
            //logger.debug(`Setting up round with images: ${imageData.taxonImage1Src} / ${imageData.taxonImage2Src}`);
            
            this.setObservationURLs(imageData);

            const { nameTileData, worldMapData } = await this.setupRound(pair, imageData, isNewPair);

            //logger.debug(`Round setup complete. Image1: ${state.getCurrentRound().image1URL}, Image2: ${state.getCurrentRound().image2URL}`);

            return { imageData, nameTileData, worldMapData };
        },

        async setupNameTiles(pair, randomized, taxonImage1, taxonImage2) {
            const [vernacularX, vernacularY] = await Promise.all([
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(taxonImage1)),
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(taxonImage2))
            ]);

            ui.setupNameTilesUI(
                taxonImage1,
                taxonImage2,
                vernacularX,
                vernacularY
            );

            state.getElement('image1').alt = `${taxonImage1} Image`;
            state.getElement('image2').alt = `${taxonImage2} Image`;

            return { vernacularX, vernacularY };
        },

        async setupWorldMaps(pair, randomized) {
            const [continents1, continents2] = await Promise.all([
                this.getContinentForTaxon(randomized ? pair.taxonB : pair.taxonA),
                this.getContinentForTaxon(randomized ? pair.taxonA : pair.taxonB)
            ]);

            return { continents1, continents2 };
        },

        async getContinentForTaxon(taxon) {
            const taxonInfo = await api.taxonomy.loadTaxonInfo();
            const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

            if (taxonData && taxonData.range && taxonData.range.length > 0) {
                return taxonData.range.map(code => worldMap.getFullContinentName(code));
            }
            //logger.debug(`No range data found for ${taxon}. Using placeholder.`);
            return [];
        },
    },

    stateManagement: {

        updateGameStateForRound(pair, imageData, nameTileData) {
            const { taxonImage1Src, taxonImage2Src, randomized, taxonImage1, taxonImage2 } = imageData;

            state.updateGameStateMultiple({
                taxonImage1: taxonImage1,
                taxonImage2: taxonImage2,
                currentRound: {
                    pair,
                    image1URL: taxonImage1Src,
                    image2URL: taxonImage2Src,
                    image1Vernacular: nameTileData.vernacularX,
                    image2Vernacular: nameTileData.vernacularY,
                    randomized: randomized,
                },
            });
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
    OLDloadNewRound: roundManager.initialization.OLDloadNewRound,
    loadNewRound: roundManager.initialization.loadNewRound,
    setupRound: roundManager.setupComponents.setupRound,
    setupRoundFromGameSetup: roundManager.setupComponents.setupRoundFromGameSetup,
    // just temporarily public during refactoring:
    getImagesForRound: roundManager.imageHandling.getImagesForRound,
    getAndProcessImages: roundManager.imageHandling.getAndProcessImages,
    //loadAndSetupImages: roundManager.imageHandling.loadAndSetupImages,
    prepareImagesForLoading: roundManager.imageHandling.prepareImagesForLoading,
    setObservationURLs: roundManager.setupComponents.setObservationURLs,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(roundManager);
    }
});

export default publicAPI;
