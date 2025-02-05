import config from './config.js';
import logger from './logger.js';
import state from './state.js';
import url from './url.js';

import api from './api.js';
import cache from './cache.js';
import ui from './ui.js';

import filtering from './filtering.js';
import hintSystem from './hintSystem.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';

const pairManager = {
    currentCollectionSubset: [],
    allFilteredPairs: [],
    usedPairIds: new Set(),
    lastUsedPairId: null,
    isInitialized: false,

    pairLoading: {

        // called from collMan, iNatDown, enterPair, main
        async loadNewPair(pairId = null, preloadedImages = null) {
            state.setIsNewPair(true);
            state.setState(state.GameState.LOADING_PAIR);

            let newPairData;
            try {
                //await this.checkINaturalistReachability();
                newPairData = await this.selectPair(pairId);
                
                if (!newPairData) {
                    throw new Error("Failed to select a valid pair");
                }
                
                state.setCurrentPairId(newPairData.pairId);

                //const imageURLs = await this.getImageURLs(newPairData);
                const imageURLs = preloadedImages || await this.getImageURLs(newPairData);
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
        async loadInitialPair(pairId = null) {
            let initialPair, initialImages;
            const filters = filtering.getActiveFilters();

            // Case 1: Specific pair ID provided
            if (pairId) {
                initialPair = await this.getPairById(pairId);
                if (!initialPair || !filtering.pairMatchesFilters(initialPair, filters)) {
                    logger.warn(`Pair with ID ${pairId} not found or doesn't match filters. Falling back to filtered random selection.`);
                    initialPair = null;
                }
            }

            // Case 2: Try cached pair if no specific pair ID or specified pair was invalid
            if (!initialPair) {
                const cachedInitialPair = await cache.getInitialPair();
                if (cachedInitialPair && filtering.pairMatchesFilters(cachedInitialPair.pairData, filters)) {
                    logger.debug("Using cached initial pair that matches filters");
                    initialPair = cachedInitialPair.pairData;
                    initialImages = cachedInitialPair.images;
                }
            }

            // Case 3: Fall back to random filtered pair if needed
            if (!initialPair) {
                logger.debug("Fetching random initial pair matching filters");
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                const filteredPairs = filtering.filterTaxonPairs(allPairs, filters);
                
                if (filteredPairs.length === 0) {
                    logger.warn("No pairs match current filters, falling back to unfiltered selection");
                    initialPair = await api.taxonomy.fetchRandomLevelOnePair();
                } else {
                    const randomIndex = Math.floor(Math.random() * filteredPairs.length);
                    initialPair = filteredPairs[randomIndex];
                }
            }

            // Get images if not already loaded from cache
            if (!initialImages) {
                initialImages = await this.getImageURLs(initialPair);
            }

            await this.loadNewPair(initialPair.pairId, initialImages);
            
            // After loading the initial pair, cache a different filtered pair for next session
            this.cacheNextInitialPair();
        },

        async cacheNextInitialPair() {
            try {
                const filters = filtering.getActiveFilters();
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                const filteredPairs = filtering.filterTaxonPairs(allPairs, filters);
                
                if (filteredPairs.length > 0) {
                    const nextPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    const nextImages = await this.getImageURLs(nextPair);
                    await cache.cacheInitialPair(nextPair, nextImages);
                }
            } catch (error) {
                logger.error("Error caching next initial pair:", error);
            }
        },

        async checkINaturalistReachability() {
            if (!await api.externalAPIs.checkINaturalistReachability()) {
                throw new Error("iNaturalist is not reachable");
            }
        },

        async selectPair(pairId) {
            let newPairData;

            // Always select a new pair when pairId is null
            if (pairId === null) {
                newPairData = await this.selectPairForLoading();
            } else {
                newPairData = await this.getPairById(pairId);
                if (!newPairData) {
                    logger.warn(`Pair with ID ${pairId} not found. Falling back to random selection.`);
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

            if (preloadedImages && preloadedImages.pair && preloadedImages.pair.pairId === newPairData.pairId) {
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
            ui.setNamePairHeight();
            await hintSystem.updateAllHintButtons();
        },

        finalizePairLoading(newPairData) {
            preloader.preloadForNextPair();
            ui.updateLevelIndicator(newPairData.level);
            state.setState(state.GameState.PLAYING);
        },

        // called from
        // - loadNewPair()
        // - loadPairById()
        // - preloader.preloadPairById()
        async getPairById(pairId) {
            if (config.useMongoDB) {
                return await api.taxonomy.fetchPairById(pairId);
            } else {
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                return allPairs.find(pair => pair.pairId === pairId);
            }
        },

        async selectPairForLoading() {
            const preloadedPair = preloader.getPreloadedImagesForNextPair()?.pair;
            if (preloadedPair && this.isPairInCurrentCollection(preloadedPair)) {
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

        isPairInCurrentCollection(pair) {
            const filters = filtering.getActiveFilters();
            return filtering.pairMatchesFilters(pair, filters);
        },

        // only called by keyboardShortcuts.incrementPairId()
        async loadPairById(pairId, clearFilters = false) {
            try {
                if (clearFilters) {
                    filtering.clearAllFilters();
                }

                const newPair = await this.getPairById(pairId);
                if (newPair) {
                    await this.loadNewPair(pairId);  // Pass the pairId here
                    //const nextPairId = String(Number(pairId) + 1);
                    //preloader.preloadPairById(nextPairId);
                } else {
                    logger.warn(`Pair with ID ${pairId} not found.`);
                }
            } catch (error) {
                logger.error(`Error loading pair with ID ${pairId}:`, error);
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
            pairManager.usedPairIds.add(selectedPair.pairId);
            
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
            } while (nextPair && pairManager.usedPairIds.has(nextPair.pairId));

            if (nextPair) {
                pairManager.usedPairIds.add(nextPair.pairId);
                pairManager.lastUsedPairId = nextPair.pairId;

                // Reset usedPairIds if all pairs have been used
                if (pairManager.usedPairIds.size === pairManager.allFilteredPairs.length) {
                    pairManager.usedPairIds.clear();
                    pairManager.usedPairIds.add(nextPair.pairId);  // Keep the current pair in usedPairIds
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
                const availablePairs = filteredPairs.filter(pair => pair.pairId !== this.lastUsedPairId);
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
            pairManager.usedPairIds.clear();
            pairManager.lastUsedPairId = null;
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

        async getAllPairIds() {
            try {
                const allPairs = await api.taxonomy.fetchTaxonPairs(); // TODO
                return allPairs.map(pair => pair.pairId);
            } catch (error) {
                logger.error("Error fetching all pair IDs:", error);
                return [];
            }
        },

        async setHighestPairId() {
            const allPairIds = await this.getAllPairIds();
            const sortedPairIds = allPairIds.sort((a, b) => Number(a) - Number(b));
            const highestPairId = sortedPairIds[sortedPairIds.length - 1];
            state.setHighestPairId(highestPairId);
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
    getPairById: pairManager.pairLoading.getPairById,
    loadPairById: pairManager.pairLoading.loadPairById,
    loadInitialPair: pairManager.pairLoading.loadInitialPair,
    selectRandomPair: pairManager.pairSelection.selectRandomPair,
    setHighestPairId: pairManager.utilities.setHighestPairId,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(pairManager);
    }
});

export default publicAPI;
