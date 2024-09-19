import config from './config.js';
import logger from './logger.js';
import state from './state.js';
import url from './url.js';

import api from './api.js';
import ui from './ui.js';

import filtering from './filtering.js';
import hintSystem from './hintSystem.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';

const pairManager = {
    currentCollectionSubset: [],
    allFilteredPairs: [],
    usedPairIDs: new Set(),
    lastUsedPairID: null,
    isInitialized: false,

    pairLoading: {

        // called from collMan, iNatDown, enterPair, main
        async loadNewPair(pairID = null) {
            state.setIsNewPair(true);
            state.setState(state.GameState.LOADING_PAIR);

            let newPairData;
            try {
                //await this.checkINaturalistReachability();
                newPairData = await this.selectPair(pairID);
                
                if (!newPairData) {
                    throw new Error("Failed to select a valid pair");
                }
                
                state.setCurrentPairID(newPairData.pairID);

                const imageURLs = await this.getImageURLs(newPairData);
                await this.updateStateForNewPair(newPairData, imageURLs);
                await this.performPostPairLoadingTasks(newPairData);
            } catch (error) {
                logger.error("Error in loadNewPair:", error);
                pairManager.errorHandling.handlePairLoadingError(error);
            } finally {
                this.finalizePairLoading(newPairData);
            }
        },

        // called in main.initializeApp()
        async loadInitialPair(pairID = null) {
            let initialPair;
            if (pairID) {
                initialPair = await this.getPairByID(pairID);
            } else {
                // TODO consider preloaded pair from previous session
                initialPair = await api.taxonomy.fetchRandomLevelOnePair();
            }
            // TODO minimize number of external calls for initial pair
            await this.loadNewPair(initialPair.pairID);
        },

        async checkINaturalistReachability() {
            if (!await api.externalAPIs.checkINaturalistReachability()) {
                throw new Error("iNaturalist is not reachable");
            }
        },

        async selectPair(pairID) {
            let newPairData;

            // Always select a new pair when pairID is null
            if (pairID === null) {
                newPairData = await this.selectPairForLoading();
            } else {
                newPairData = await this.getPairByID(pairID);
                if (!newPairData) {
                    logger.warn(`Pair with ID ${pairID} not found. Falling back to random selection.`);
                    newPairData = await this.selectPairForLoading();
                }
            } 

            if (!newPairData) {
                throw new Error("Failed to select a pair");
            }

            // Map taxonNames to taxonA and taxonB if they're not present
            // TODO this seems like a hack and should be cleaned up
            if (!newPairData.taxonA && !newPairData.taxonB && newPairData.taxonNames) {
                newPairData.taxonA = newPairData.taxonNames[0];
                newPairData.taxonB = newPairData.taxonNames[1];
            }

            return newPairData;
        },

        async getImageURLs(newPairData) {
            if (!newPairData || !newPairData.taxonNames || newPairData.taxonNames.length < 2) {
                throw new Error("Invalid pair data: missing taxon information");
            }

            let preloadedImages = preloader.hasPreloadedPair() ? preloader.getPreloadedImagesForNextPair() : null;

            if (preloadedImages && preloadedImages.pair && preloadedImages.pair.pairID === newPairData.pairID) {
                preloader.clearPreloadedPair();
                return {taxonA: preloadedImages.taxonA, taxonB: preloadedImages.taxonB};
            } else {
                const taxonAImage = await preloader.fetchDifferentImage(newPairData.taxonNames[0], null);
                const taxonBImage = await preloader.fetchDifferentImage(newPairData.taxonNames[1], null);
                return {taxonA: taxonAImage, taxonB: taxonBImage};
            }
        },

        async updateStateForNewPair(newPairData, imageURLs) {
            state.updateGameStateForNewPair(newPairData, imageURLs);
            state.updateGameStateMultiple({
                taxonImage1: newPairData.taxonNames[0],
                taxonImage2: newPairData.taxonNames[1],
            });
        },

        async performPostPairLoadingTasks(newPairData) {
            await pairManager.collectionSubsets.refreshCollectionSubset();
            await roundManager.loadNewRound();
            await hintSystem.updateAllHintButtons();
        },

        finalizePairLoading(newPairData) {
            preloader.preloadForNextPair();
            ui.setNamePairHeight();
            ui.updateLevelIndicator(newPairData.level);
            state.setState(state.GameState.PLAYING);
        },

        // called from
        // - loadNewPair()
        // - loadPairByID()
        // - preloader.preloadPairByID()
        async getPairByID(pairID) {
            if (config.useMongoDB) {
                return await api.taxonomy.fetchPairByID(pairID);
            } else {
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                return allPairs.find(pair => pair.pairID === pairID);
            }
        },

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
                    await this.loadNewPair(pairID);  // Pass the pairID here
                    //const nextPairID = String(Number(pairID) + 1);
                    //preloader.preloadPairByID(nextPairID);
                } else {
                    logger.warn(`Pair with ID ${pairID} not found.`);
                }
            } catch (error) {
                logger.error(`Error loading pair with ID ${pairID}:`, error);
            }
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
                logger.error("No pairs available in the current collection");
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
            //logger.debug(`initializeCollectionSubset called. useMongoDB: ${config.useMongoDB}`);
            if (this.isInitializing) {
                logger.warn('Collection subset initialization already in progress, skipping');
                return;
            }
            this.isInitialized = true;
            this.isInitializing = true;
            try {
                let filteredPairs;
                if (config.useMongoDB) {
                    const filters = filtering.getActiveFilters();
                    const { results, totalCount } = await api.taxonomy.fetchPaginatedTaxonPairs(filters, '', 1, 42);
                    filteredPairs = results;
                    //logger.debug(`Fetched ${filteredPairs.length} filtered pairs out of ${totalCount} total`);
                } else {
                    const allPairs = await api.taxonomy.fetchTaxonPairs();
                    const filters = filtering.getActiveFilters();
                    filteredPairs = filtering.filterTaxonPairs(allPairs, filters);
                    //logger.debug(`Filtered ${filteredPairs.length} pairs out of ${allPairs.length} total`);
                }
                
                pairManager.allFilteredPairs = filteredPairs;
                
                const subsetSize = Math.min(42, filteredPairs.length);

                // Filter out the last used pair when creating a new subset
                const availablePairs = filteredPairs.filter(pair => pair.pairID !== this.lastUsedPairID);
                pairManager.currentCollectionSubset = pairManager.utilities.getRandomSubset(availablePairs, subsetSize);
                //logger.debug(`Created subset of ${pairManager.currentCollectionSubset.length} pairs`);
            } catch (error) {
                logger.error('Error initializing collection subset:', error);
            } finally {
                this.isInitializing = false;
            }
        },

        // called from:
        // loadNewPair()
        // - collectionManager.handleCollectionManagerDone()
        async refreshCollectionSubset() {
            //logger.trace("refreshCollectionSubset()");
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

        async getAllPairIDs() {
            try {
                const allPairs = await api.taxonomy.fetchTaxonPairs(); // TODO
                return allPairs.map(pair => pair.pairID);
            } catch (error) {
                logger.error("Error fetching all pair IDs:", error);
                return [];
            }
        },

        async setHighestPairID() {
            const allPairIDs = await this.getAllPairIDs();
            const sortedPairIDs = allPairIDs.sort((a, b) => Number(a) - Number(b));
            const highestPairID = sortedPairIDs[sortedPairIDs.length - 1];
            state.setHighestPairID(highestPairID);
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
    loadInitialPair: pairManager.pairLoading.loadInitialPair,
    selectRandomPair: pairManager.pairSelection.selectRandomPair,
    setHighestPairID: pairManager.utilities.setHighestPairID,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(pairManager);
    }
});

export default publicAPI;
