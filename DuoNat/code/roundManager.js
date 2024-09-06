import api from './api.js';
import config from './config.js';
import errorHandling from './errorHandling.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';
import worldMap from './worldMap.js';

const roundManager = {

    initialization: {

        // called from
        // - pairManager.loadNewPair()
        // - gameLogic.handleCorrectAnswer()
        async loadNewRound() {
            state.setState(state.GameState.LOADING_ROUND);
            if (!await api.externalAPIs.checkINaturalistReachability()) return;

            try {
                // TODO variable mess
                const pairData = state.getCurrentTaxonImageCollection();
                const pairDataWithImages = { 
                    pair: pairData.pair, 
                    preloadedImages: null,
                    image1URL: pairData.image1URL,
                    image2URL: pairData.image2URL,
                    level: pairData.level,
                    isNewPair: state.isNewPair()
                };

               let  imageData = await this.getAndProcessImages(pairDataWithImages);
                
                this.setObservationURLs(imageData);

                ui.prepareImagesForLoading();

                const { taxonImage1URL, taxonImage2URL, randomized, taxonImage1, taxonImage2 } = imageData;

                // Load images
                await Promise.all([
                    roundManager.setupRoundComponents.loadImage(state.getElement('image1'), taxonImage1URL),
                    roundManager.setupRoundComponents.loadImage(state.getElement('image2'), taxonImage2URL)
                ]);

                // Setup name tiles and world maps
                const [nameTileData, worldMapData] = await Promise.all([
                    roundManager.setupRoundComponents.setupNameTiles(pairData.pair, randomized, taxonImage1, taxonImage2),
                    roundManager.setupRoundComponents.setupWorldMaps(pairData.pair, randomized, taxonImage1, taxonImage2)
                ]);

                // Update game state
                state.updateGameStateForRound(pairData.pair, imageData, nameTileData);

                // Apply world map data
                worldMap.createWorldMap(state.getElement('image1Container'), worldMapData.continents1);
                worldMap.createWorldMap(state.getElement('image2Container'), worldMapData.continents2);

                await ui.updateUIAfterSetup();

                await this.fadeInNewImages();

            } catch (error) {
                errorHandling.handleSetupError(error);
            } finally {
                state.setState(state.GameState.PLAYING);
                state.setIsNewPair(false);
            }
            preloader.preloadForNextRound();
        },

        async getAndProcessImages(pairData) {
            if (!pairData) {
                logger.error('Invalid pairData received in getAndProcessImages');
                throw new Error('Invalid pairData: pairData is undefined');
            }

            let images;
            if (pairData.isNewPair) {
                // For a new pair, use the images from pairData
                images = {
                    taxonA: pairData.image1URL,
                    taxonB: pairData.image2URL
                };
            } else {
                // For subsequent rounds, get preloaded round images or fetch new ones
                images = await this.getImages(pairData);
            }

            return this.randomizeImages(images, pairData.pair);
        },

        randomizeImages(images, pair) {
            const randomized = Math.random() < 0.5;

            return {
                taxonImage1URL: randomized ? images.taxonB : images.taxonA,
                taxonImage2URL: randomized ? images.taxonA : images.taxonB,
                taxonImage1: randomized ? pair.taxonB : pair.taxonA,
                taxonImage2: randomized ? pair.taxonA : pair.taxonB,
                randomized
            };
        },

        async getImages(pairData) {
            if (!pairData || !pairData.pair) {
                logger.error('Invalid pairData received in getImages');
                throw new Error('Invalid pairData: pair is undefined');
            }
            const { pair } = pairData;

            const preloadedRoundImages = preloader.getPreloadedImagesForNextRound();
            if (preloadedRoundImages && preloadedRoundImages.taxonA && preloadedRoundImages.taxonB) {
                //logger.debug(`Using preloaded round images for pair: ${pair.taxonA} / ${pair.taxonB}`);
                preloader.clearPreloadedImagesForNextRound();
                return { taxonA: preloadedRoundImages.taxonA, taxonB: preloadedRoundImages.taxonB };
            }

            //logger.debug(`Fetching new images for pair: ${pair.taxonA} / ${pair.taxonB}`);
            return {
                taxonA: await preloader.fetchDifferentImage(pair.taxonA, null),
                taxonB: await preloader.fetchDifferentImage(pair.taxonB, null)
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

        setObservationURLs(imageData) {
            //logger.debug(`Setting observation URLs: ${imageData.taxonImage1URL} / ${imageData.taxonImage2URL}`);
            state.setObservationURL(imageData.taxonImage1URL, 1);
            state.setObservationURL(imageData.taxonImage2URL, 2);
            // Also update the current round state
            state.updateGameStateMultiple({
                currentRound: {
                    ...state.getCurrentRound(),
                    image1URL: imageData.taxonImage1URL,
                    image2URL: imageData.taxonImage2URL,
                },
            });
            //logger.debug(`Updated current round state with images: ${state.getCurrentRound().image1URL} / ${state.getCurrentRound().image2URL}`);
        },
    },

    setupRoundComponents: {

        // called only from loadNewRound()
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

        // called only from loadNewRound()
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

        // called only from loadNewRound()
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
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(roundManager);
    }
});

export default publicAPI;
