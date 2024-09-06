import api from './api.js';
import config from './config.js';
import filtering from './filtering.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';
import state from './state.js';
import ui from './ui.js';
import url from './url.js';

const pairManager = {
    currentCollectionSubset: [],
    allFilteredPairs: [],
    usedPairIDs: new Set(),
    lastUsedPairID: null,
    isInitialized: false,

    pairLoading: {

        // called from collMan, iNatDown, enterPair, main
        async loadNewPair (pairID = null) {
            logger.trace("loadNewPair");
            state.setState(state.GameState.LOADING_PAIR);
            if (!await api.externalAPIs.checkINaturalistReachability()) return;

            let newPairData;

            try {
                
                if (pairID) { // If a pairID is provided, load that specific pair
                    newPairData = await this.getPairByID(pairID);
                    if (!newPairData) logger.warn(`Pair with ID ${pairID} not found. Falling back to random selection.`);
                }

                if (!newPairData) // If no specific pair was selected or found, proceed with normal selection
                    newPairData = await this.selectPairForLoading();

                if (!newPairData) {
                    logger.error("Failed to select a pair. Aborting loadNewPair.");
                    //state.setState(state.GameState.PLAYING);
                    return;
                }

                state.setNextSelectedPair(newPairData);
                this.resetUsedImagesForNewPair(newPairData);

                // URLs of both images
                const imageURLs = await this.loadImagesForNewPair(newPairData);
                state.updateGameStateForNewPair(newPairData, imageURLs);

                // For a new pair, use the images that were just loaded
                let imageData = {
                    taxonImage1URL: imageURLs.taxonA,
                    taxonImage2URL: imageURLs.taxonB,
                    taxonImage1: newPairData.taxonA,
                    taxonImage2: newPairData.taxonB,
                };

                // TODO replace with loadNewRound() eventually
                await roundManager.setupRound(newPairData, imageData, true);
                preloader.roundPreloader.preloadForNextRound();

                // Update hint buttons
                await hintSystem.updateAllHintButtons();
                state.setNextSelectedPair(null); // Clear the next selected pair after using it

                // also called in loadNewRound()!!
                await ui.updateUIAfterSetup(true);
                //await roundManager.loadNewRound(); // TODO
            } catch (error) {
                pairManager.errorHandling.handlePairLoadingError(error);
            } finally {
                if (state.getState() !== state.GameState.PLAYING) {
                    state.setState(state.GameState.PLAYING);
                }
                preloader.pairPreloader.preloadForNextPair(); // TODO start pair preloading
                
                ui.setNamePairHeight();
                ui.updateLevelIndicator(newPairData.level);
            }
        },

        // called from
        // - loadNewPair()
        // - loadPairByID()
        // - preloader.preloadPairByID()
        async getPairByID(pairID) {
            const allPairs = await api.taxonomy.fetchTaxonPairs();
            return allPairs.find(pair => pair.pairID === pairID);
        },

        async selectNewPair() {
            state.resetShownHints();
            let nextSelectedPair = state.getNextSelectedPair();
            if (nextSelectedPair) {
                state.setNextSelectedPair(null);
                //logger.debug('Using next selected pair:', nextSelectedPair);
                return nextSelectedPair;
            }
            return await this.selectPairFromFilters();
        },

        async selectPairFromFilters() {
            const filters = filtering.getActiveFilters();
            const filteredPairs = await filtering.getFilteredTaxonPairs(filters);
            return this.findOrSelectRandomPair(filteredPairs);
        },

        findOrSelectRandomPair(filteredPairs) {
            let pair = this.findPairByUrlParams(filteredPairs);
            if (!pair) {
                if (filteredPairs.length > 0) {
                    pair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    //logger.debug("Selected random pair from filtered collection");
                } else {
                    throw new Error("No pairs available in the current filtered collection");
                }
            }
            return pair;
        },

        findPairByUrlParams(filteredPairs) {
            const pairID = state.getCurrentPairID();
            if (pairID) {
                return this.findPairByPairID(filteredPairs, pairID);
            } else {
                const urlParams = url.getUrlParameters();
                if (urlParams.taxonA && urlParams.taxonB) { // not saved in gameState atm
                return this.findPairByTaxa(filteredPairs, urlParams.taxonA, urlParams.taxonB);
                }
            }
            return null;
        },

        findPairByPairID(filteredPairs, pairID) {
            const pair = filteredPairs.find(pair => pair.pairID === pairID);
            if (pair) {
                //logger.debug(`Found pair with pairID: ${pairID}`);
            } else {
                logger.warn(`PairID ${pairID} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        findPairByTaxa(filteredPairs, taxonA, taxonB) {
            const pair = filteredPairs.find(pair =>
                (pair.taxonNames[0] === taxonA && pair.taxonNames[1] === taxonB) ||
                (pair.taxonNames[0] === taxonB && pair.taxonNames[1] === taxonA)
            );
            if (pair) {
                //logger.debug(`Found pair with taxa: ${taxonA} and ${taxonB}`);
            } else {
                logger.warn(`Taxa ${taxonA} and ${taxonB} not found in filtered collection. Selecting random pair.`);
            }
            return pair;
        },

        resetUsedImagesForNewPair(newPair) {
            const currentUsedImages = state.getUsedImages();
            const updatedUsedImages = { ...currentUsedImages };
            delete updatedUsedImages[newPair.taxonA];
            delete updatedUsedImages[newPair.taxonB];
            state.updateGameStateMultiple({
                usedImages: updatedUsedImages
            });
            //logger.debug(`Reset used images for new pair: ${newPair.taxonA} and ${newPair.taxonB}`);
        },

        // only called from initializeNewPair()
        async loadImagesForNewPair(newPair) {
            //const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            let preloadedImages = preloader.pairPreloader.hasPreloadedPair();
            
            if (!preloadedImages || !preloadedImages.pair) {
                preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
            }            

            if (preloadedImages && preloadedImages.pair.pairID === newPair.pairID) {
                logger.debug(`Using preloaded images for pair ID ${newPair.pairID}`);
                // Clear the preloaded images after using them
                preloader.pairPreloader.clearPreloadedPair();
                return {
                    taxonA: preloadedImages.taxonA,
                    taxonB: preloadedImages.taxonB,
                };
            }
            
            //logger.debug(`Fetching new images for pair ID ${newPair.pairID}`);
            const taxonAImage = await preloader.imageLoader.fetchDifferentImage(newPair.taxonA || newPair.taxonNames[0], null);
            const taxonBImage = await preloader.imageLoader.fetchDifferentImage(newPair.taxonB || newPair.taxonNames[1], null);
            
            return {
                taxonA: taxonAImage,
                taxonB: taxonBImage,
            };
        },

        async selectPairForLoading() {
            const preloadedPair = preloader.pairPreloader.getPreloadedImagesForNextPair()?.pair;
            if (preloadedPair) {
                //logger.debug(`Using preloaded pair: ${preloadedPair.pairID}`);
                return preloadedPair;
            } else {
                const selectedPair = await pairManager.pairSelection.selectRandomPair();
                if (selectedPair) {
                    //logger.debug(`Selected random pair: ${selectedPair.pairID}`);
                    return selectedPair;
                } else {
                    logger.warn('No available pairs in the current collection');
                    return null;
                }
            }
        },

        // only called by keyboardShortcuts.incrementPairID()
        async loadPairByID(pairID, clearFilters = false) {
            try {
                if (clearFilters) {
                    filtering.clearAllFilters();
                }

                const newPair = await this.getPairByID(pairID);
                if (newPair) {
                    await this.setupNewPairIDPair(newPair, pairID);
                } else {
                    logger.warn(`Pair with ID ${pairID} not found.`);
                }
            } catch (error) {
                logger.error(`Error loading pair with ID ${pairID}:`, error);
            }
        },

        async setupNewPairIDPair(newPair, pairID) {
            state.setNextSelectedPair(newPair);
            await this.loadNewPair();
            const nextPairID = String(Number(pairID) + 1);
            preloader.pairPreloader.preloadPairByID(nextPairID);
        },
    },

    pairSelection: {

        // called from
        // - selectPairForLoading() < loadNewPair()
        // - preloader.preloadForNextPair()
        async selectRandomPair() {
            //logger.trace("selectRandomPair");
            // First, try to get the next pair from the pairManager
            const nextPair = await this.getNextPairFromCollection();
            
            if (nextPair) {
                //logger.debug(`Selected pair from pairManager: ${nextPair.taxonNames[0]} / ${nextPair.taxonNames[1]}`);
                return nextPair;
            }
            
            // If pairManager doesn't return a pair, fall back to the original method
            logger.warn("No pair available from pairManager, falling back to original method");
            const filters = filtering.getActiveFilters();
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
            
            if (filteredPairs.length === 0) {
                throw new Error("No pairs available in the current collection");
            }
            
            const randomIndex = Math.floor(Math.random() * filteredPairs.length);
            const selectedPair = filteredPairs[randomIndex];
            
            // Inform pairManager about this selection
            pairManager.usedPairIDs.add(selectedPair.pairID);
            
            return selectedPair;
        },

        // called only from selectRandomPair()
        async getNextPairFromCollection() {
            if (!pairManager.isInitialized || pairManager.currentCollectionSubset.length === 0) {
                await pairManager.collectionSubsets.initializeCollectionSubset();
            }

            let nextPair;
            do {
                if (pairManager.currentCollectionSubset.length === 0) {
                    await pairManager.collectionSubsets.initializeCollectionSubset();
                }
                nextPair = pairManager.currentCollectionSubset.pop();
            } while (nextPair && pairManager.usedPairIDs.has(nextPair.pairID));

            if (nextPair) {
                pairManager.usedPairIDs.add(nextPair.pairID);
                pairManager.lastUsedPairID = nextPair.pairID;
                //logger.debug(`Next pair: ${nextPair.pairID}, Remaining pairs in subset: ${pairManager.currentCollectionSubset.length}, Total pairs in collection: ${pairManager.allFilteredPairs.length}`);

                // Reset usedPairIDs if all pairs have been used
                if (pairManager.usedPairIDs.size === pairManager.allFilteredPairs.length) {
                    pairManager.usedPairIDs.clear();
                    pairManager.usedPairIDs.add(nextPair.pairID);  // Keep the current pair in usedPairIDs
                }
            } else {
                logger.warn('No next pair available, this should not happen');
            }

            return nextPair;
        },
    },

    pairManagement: {

    },

    collectionSubsets: {

        // called in
        // - refreshCollectionSubset()
        // - getNextPairFromCollection()
        // - preloader.preloadForNextPair()
        async initializeCollectionSubset() {
            if (this.isInitializing) {
                logger.warn('Collection subset initialization already in progress, skipping');
                return;
            }
            this.isInitialized = true;
            try {
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                const filters = filtering.getActiveFilters();
                pairManager.allFilteredPairs = filtering.filterTaxonPairs(allPairs, filters);
                
                const subsetSize = Math.min(42, pairManager.allFilteredPairs.length);

                // Filter out the last used pair when creating a new subset
                const availablePairs = pairManager.allFilteredPairs.filter(pair => pair.pairID !== this.lastUsedPairID);
                pairManager.currentCollectionSubset = pairManager.utilities.getRandomSubset(availablePairs, subsetSize);
                //logger.debug(`Initialized new collection subset of pairs: ${pairManager.currentCollectionSubset.length}`);
            } finally {
                this.isInitializing = false;
            }
        },

        // called only in collectionManager.handleCollectionManagerDone()
        async refreshCollectionSubset() {
            pairManager.isInitialized = false;
            pairManager.usedPairIDs.clear();
            pairManager.lastUsedPairID = null;
            preloader.pairPreloader.isCollectionSubsetInitialized = false;
            await this.initializeCollectionSubset();
        },
    },

    errorHandling: {
        handlePairLoadingError(error) {
            logger.error("Error loading new pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        },
    },

    utilities: {
        getRandomSubset(array, size) {
            const shuffled = [...array];
            this.shuffleArray(shuffled);
            return shuffled.slice(0, size);
        },

        shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        },
    },
};

// Bind all methods in pairManager and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};
bindMethodsRecursively(pairManager);

const publicAPI = {
    initializeCollectionSubset: pairManager.collectionSubsets.initializeCollectionSubset,
    refreshCollectionSubset: pairManager.collectionSubsets.refreshCollectionSubset,

    loadNewPair: pairManager.pairLoading.loadNewPair,
    getPairByID: pairManager.pairLoading.getPairByID,
    loadPairByID: pairManager.pairLoading.loadPairByID,
    selectRandomPair: pairManager.pairSelection.selectRandomPair,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(pairManager);
    }
});

export default publicAPI;
