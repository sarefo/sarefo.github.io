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

            state.setIsNewPair(true);
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
                //this.resetUsedImagesForNewPair(newPairData);

                let preloadedImages = preloader.hasPreloadedPair();
                
                if (!preloadedImages || !preloadedImages.pair) {
                    preloadedImages = preloader.getPreloadedImagesForNextPair();
                }            

                let imageURLs;
                if (preloadedImages && preloadedImages.pair.pairID === newPairData.pairID) {
                    preloader.clearPreloadedPair(); // Clear the preloaded images after using them
                    imageURLs = {taxonA: preloadedImages.taxonA, taxonB: preloadedImages.taxonB}
                } else {
                    const taxonAImage = await preloader.fetchDifferentImage(newPairData.taxonA || newPairData.taxonNames[0], null);
                    const taxonBImage = await preloader.fetchDifferentImage(newPairData.taxonB || newPairData.taxonNames[1], null);
                    imageURLs = {taxonA: taxonAImage, taxonB: taxonBImage};
                }

                state.updateGameStateForNewPair(newPairData, imageURLs);

                state.updateGameStateMultiple({
                    taxonImage1: newPairData.taxonA,
                    taxonImage2: newPairData.taxonB,
                    },
                );

                state.setNextSelectedPair(null); // Clear the next selected pair after using it

                await pairManager.collectionSubsets.refreshCollectionSubset();
                await roundManager.loadNewRound();
                await hintSystem.updateAllHintButtons();

            } catch (error) {
                pairManager.errorHandling.handlePairLoadingError(error);
            } finally {
                //if (state.getState() !== state.GameState.PLAYING) state.setState(state.GameState.PLAYING);

                preloader.preloadForNextPair();
                ui.setNamePairHeight();
                ui.updateLevelIndicator(newPairData.level);
                state.setState(state.GameState.PLAYING);
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

        /*resetUsedImagesForNewPair(newPair) {
            const currentUsedImages = state.getUsedImages();
            const updatedUsedImages = { ...currentUsedImages };
            delete updatedUsedImages[newPair.taxonA];
            delete updatedUsedImages[newPair.taxonB];
            state.updateGameStateMultiple({
                usedImages: updatedUsedImages
            });
        },*/

        async selectPairForLoading() {
            const preloadedPair = preloader.getPreloadedImagesForNextPair()?.pair;
            if (preloadedPair) {
                return preloadedPair;
            } else {
                const selectedPair = await pairManager.pairSelection.selectRandomPair();
                if (selectedPair) {
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
            preloader.preloadPairByID(nextPairID);
        },
    },

    pairSelection: {

        // called from
        // - selectPairForLoading() < loadNewPair()
        // - preloader.preloadForNextPair()
        async selectRandomPair() {

            // First, try to get the next pair from the pairManager
            const nextPair = await this.getNextPairFromCollection();
            if (nextPair) return nextPair;
            
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
            } finally {
                this.isInitializing = false;
            }
        },

        // called from:
        // loadNewPair()
        // - collectionManager.handleCollectionManagerDone()
        async refreshCollectionSubset() {
            pairManager.isInitialized = false;
            pairManager.usedPairIDs.clear();
            pairManager.lastUsedPairID = null;
            preloader.isCollectionSubsetInitialized = false;
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
