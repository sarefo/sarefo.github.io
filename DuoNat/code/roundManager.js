import config from './config.js';
import logger from './logger.js';
import state from './state.js';
import utils from './utils.js';

import api from './api.js';
import ui from './ui.js';

import errorHandling from './errorHandling.js';
import hintSystem from './hintSystem.js';
import preloader from './preloader.js';
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
                const pairData = await this.getPairData();
                const imageData = await this.getAndProcessImages(pairData);
                this.setObservationURLs(imageData);
                
                await this.loadAndSetupImages(imageData);
                const nameTileData = await this.setupNameTilesAndWorldMaps(pairData, imageData);
                
                state.updateGameStateForRound(pairData.pair, imageData, nameTileData);
                await ui.updateUIAfterSetup();

            } catch (error) {
                errorHandling.handleSetupError(error);
            } finally {
                this.finalizeRoundSetup();
            }
            preloader.preloadForNextRound();
        },

        async getPairData() {
            const pairData = state.getCurrentTaxonImageCollection();
            return { 
                pair: pairData.pair, 
                preloadedImages: null,
                image1URL: pairData.image1URL,
                image2URL: pairData.image2URL,
                level: pairData.level,
                isNewPair: state.isNewPair()
            };
        },

        async loadAndSetupImages(imageData) {
            this.prepareImagesForLoading();
            const { taxonImage1URL, taxonImage2URL, isNewPair } = imageData;
            await Promise.all([
                this.loadImage(state.getElement('image1'), taxonImage1URL, isNewPair),
                this.loadImage(state.getElement('image2'), taxonImage2URL, isNewPair)
            ]);
        },

        async loadImage(imgElement, src, isNewPair) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    if (!isNewPair) {
                        // For subsequent rounds in the same pair, fade out first
                        imgElement.classList.add('image-container__image--fade-out');
                        setTimeout(() => {
                            setNewImage();
                        }, 300); // Match the CSS transition duration for fade-out
                    } else {
                        // For new pairs, immediately set and fade in the new image
                        setNewImage();
                    }
                };

                function setNewImage() {
                    imgElement.src = src;
                    imgElement.classList.remove('image-container__image--loading', 'image-container__image--fade-out');
                    
                    // Trigger reflow to ensure the browser recognizes the change
                    void imgElement.offsetWidth;

                    imgElement.classList.add('image-container__image--fade-in');

                    // Remove the fade-in class after the transition is complete
                    setTimeout(() => {
                        imgElement.classList.remove('image-container__image--fade-in');
                        resolve();
                    }, 300); // Match the CSS transition duration
                }

                img.src = src;
            });
        },

        async setupNameTilesAndWorldMaps(pairData, imageData) {
            const { randomized, taxonImage1, taxonImage2 } = imageData;
            const [nameTileData, worldMapData] = await Promise.all([
                roundManager.setupRoundComponents.setupNameTiles(pairData.pair, randomized, taxonImage1, taxonImage2),
                roundManager.setupRoundComponents.setupWorldMaps(pairData.pair, randomized)
            ]);

            worldMap.createWorldMap(state.getElement('image1Container'), worldMapData.continents1);
            worldMap.createWorldMap(state.getElement('image2Container'), worldMapData.continents2);

            return nameTileData;
        },

        finalizeRoundSetup() {
            state.setState(state.GameState.PLAYING);
            state.setIsNewPair(false);
        },

        async getAndProcessImages(pairData) {
            if (!pairData) {
                logger.error('Invalid pairData received in getAndProcessImages');
                throw new Error('Invalid pairData: pairData is undefined');
            }

            let images = pairData.isNewPair 
                ? this.getNewPairImages(pairData)
                : await this.getExistingPairImages(pairData);

            return {
                ...this.randomizeImages(images, pairData.pair),
                isNewPair: pairData.isNewPair
            };
        },

        getNewPairImages(pairData) {
            return {
                taxonA: pairData.image1URL,
                taxonB: pairData.image2URL
            };
        },

        async getExistingPairImages(pairData) {
            return await this.getImages(pairData);
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
                // check to ensure the preloaded images are for the current pair
                if (preloadedRoundImages.pairId === pair.pairId) {
                    preloader.clearPreloadedRound();
                    return { taxonA: preloadedRoundImages.taxonA, taxonB: preloadedRoundImages.taxonB };
                } else {
                    logger.warn('Preloaded images do not match current pair, fetching new images');
                }
            }

            return {
                taxonA: await preloader.fetchDifferentImage(pair.taxonA, null),
                taxonB: await preloader.fetchDifferentImage(pair.taxonB, null)
            };
        },

        setObservationURLs(imageData) {
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
        },

        prepareImagesForLoading() {
            const image1 = state.getElement('image1');
            const image2 = state.getElement('image2');
            
            image1.classList.remove('image-container__image--fade-in', 'image-container__image--fade-out');
            image2.classList.remove('image-container__image--fade-in', 'image-container__image--fade-out');
            image1.classList.add('image-container__image--loading');
            image2.classList.add('image-container__image--loading');
        },

    },

    setupRoundComponents: {

        // called only from loadNewRound()
        async setupNameTiles(pair, randomized, taxonImage1, taxonImage2) {
            const [vernacularX, vernacularY] = await this.fetchVernacularNames(taxonImage1, taxonImage2);

            ui.setupNameTilesUI(
                taxonImage1,
                taxonImage2,
                vernacularX,
                vernacularY
            );

            this.setImageAlts(taxonImage1, taxonImage2);

            return { vernacularX, vernacularY };
        },

        async fetchVernacularNames(taxon1, taxon2) {
            return await Promise.all([
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(taxon1)),
                utils.string.capitalizeFirstLetter(await api.vernacular.fetchVernacular(taxon2))
            ]);
        },

        setImageAlts(taxon1, taxon2) {
            state.getElement('image1').alt = `${taxon1} Image`;
            state.getElement('image2').alt = `${taxon2} Image`;
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
            if (config.useMongoDB) {
                try {
                    const taxonInfo = await api.taxonomy.fetchTaxonInfoFromMongoDB(taxon);
                    if (taxonInfo && taxonInfo.range && taxonInfo.range.length > 0) {
                        return taxonInfo.range.map(code => worldMap.getFullContinentName(code));
                    }
                } catch (error) {
                    logger.error(`Error fetching continent for taxon ${taxon}:`, error);
                }
            } else {
                // Existing code for JSON file
                const taxonInfo = await api.taxonomy.loadTaxonInfo();
                const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

                if (taxonData && taxonData.range && taxonData.range.length > 0) {
                    return taxonData.range.map(code => worldMap.getFullContinentName(code));
                }
            }
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
        publicAPI[key] = publicAPI[key].bind(roundManager.initialization);
    }
});

export default publicAPI;
