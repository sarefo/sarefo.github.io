import api from './api.js';
import filtering from './filtering.js';
import logger from './logger.js';
import preloader from './preloader.js';
import roundManager from './roundManager.js';
import state from './state.js';
import ui from './ui.js';

const pairManager = {
    currentCollectionSubset: [],
    allFilteredPairs: [],
    usedPairIDs: new Set(),
    lastUsedPairID: null,
    isInitialized: false,

    async getNextPair(isNewPair) {
        if (isNewPair) {
            const preloadedPair = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair && this.isPairValid(preloadedPair.pair)) {
                return { pair: preloadedPair.pair, preloadedImages: preloadedPair };
            }
            return { pair: await this.getNextPairFromCollection(), preloadedImages: null };
        }
        return { pair: state.getCurrentTaxonImageCollection().pair, preloadedImages: null };
    },

    isPairValid(pair) {
        const filters = filtering.getActiveFilters();
        return filtering.pairMatchesFilters(pair, filters);
    },

    async initializeCollectionSubset() {
        if (this.isInitializing) {
            logger.debug('Collection subset initialization already in progress, skipping');
            return;
        }
        this.isInitialized = true;
        logger.debug('Initializing collection subset');
        try {
            const allPairs = await api.taxonomy.fetchTaxonPairs();
            const filters = filtering.getActiveFilters();
            this.allFilteredPairs = filtering.filterTaxonPairs(allPairs, filters);
            
            logger.debug(`Total filtered pairs in collection: ${this.allFilteredPairs.length}`);

            const subsetSize = Math.min(42, this.allFilteredPairs.length);

            // Filter out the last used pair when creating a new subset
            const availablePairs = this.allFilteredPairs.filter(pair => pair.pairID !== this.lastUsedPairID);
            this.currentCollectionSubset = this.getRandomSubset(availablePairs, subsetSize);
            logger.debug(`Initialized new collection subset of pairs: ${this.currentCollectionSubset.length}`);
        } finally {
            this.isInitializing = false;
        }
    },

    getRandomSubset(array, size) {
        const shuffled = [...array];
        this.shuffleArray(shuffled);
        return shuffled.slice(0, size);
    },

    async selectRandomPairFromCurrentCollection() {
        // First, try to get the next pair from the pairManager
        const nextPair = await pairManager.getNextPairFromCollection();
        
        if (nextPair) {
            logger.debug(`Selected pair from pairManager: ${nextPair.taxonNames[0]} / ${nextPair.taxonNames[1]}`);
            return nextPair;
        }
        
        // If pairManager doesn't return a pair, fall back to the original method
        logger.debug("No pair available from pairManager, falling back to original method");
        const filters = filtering.getActiveFilters();
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
        
        if (filteredPairs.length === 0) {
            throw new Error("No pairs available in the current collection");
        }
        
        const randomIndex = Math.floor(Math.random() * filteredPairs.length);
        const selectedPair = filteredPairs[randomIndex];
        
        logger.debug(`Selected pair from fallback: ${selectedPair.taxonNames[0]} / ${selectedPair.taxonNames[1]}`);
        
        // Inform pairManager about this selection
        pairManager.usedPairIDs.add(selectedPair.pairID);
        
        return selectedPair;
    },

    async getNextPairFromCollection() {
        if (!this.isInitialized || this.currentCollectionSubset.length === 0) {
            await this.initializeCollectionSubset();
        }

        let nextPair;
        do {
            if (this.currentCollectionSubset.length === 0) {
                await this.initializeCollectionSubset();
            }
            nextPair = this.currentCollectionSubset.pop();
        } while (nextPair && this.usedPairIDs.has(nextPair.pairID));

        if (nextPair) {
            this.usedPairIDs.add(nextPair.pairID);
            this.lastUsedPairID = nextPair.pairID;
            logger.debug(`Next pair: ${nextPair.pairID}, Remaining pairs in subset: ${this.currentCollectionSubset.length}, Total pairs in collection: ${this.allFilteredPairs.length}`);

            // Reset usedPairIDs if all pairs have been used
            if (this.usedPairIDs.size === this.allFilteredPairs.length) {
                this.usedPairIDs.clear();
                this.usedPairIDs.add(nextPair.pairID);  // Keep the current pair in usedPairIDs
            }
        } else {
            logger.warn('No next pair available, this should not happen');
        }

        return nextPair;
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    prepareForNewPair() {
        state.setState(state.GameState.LOADING);
        ui.prepareImagesForLoading();
        preloader.roundPreloader.clearPreloadedImagesForNextRound();
    },

    async loadNewRandomPair(usePreloadedPair = true) {
        this.prepareForNewPair();

        try {
            await this.attemptToLoadNewPair(usePreloadedPair);
        } catch (error) {
            this.handlePairLoadingError(error);
        } finally {
            this.finalizePairLoading();
        }
    },

    // TODO FIX maybe should not call roundManager
    async attemptToLoadNewPair(usePreloadedPair) {
        await roundManager.loadNewRound(true);

        if (state.getState() !== state.GameState.PLAYING) {
            await this.fallbackPairLoading(usePreloadedPair);
        }

        const newPair = state.getCurrentTaxonImageCollection().pair;
        this.updateUIForNewPair(newPair);
    },

    loadNewPair() {
        try {
            this.loadNewRandomPair();
        } catch (error) {
            logger.error("Error loading new pair:", error);
        }
    },

    async fallbackPairLoading(usePreloadedPair) {
        let newPair;
        if (usePreloadedPair) {
            newPair = await this.loadPreloadedPair();
        }
        if (!newPair) {
            newPair = await this.selectAndSetupRandomPair();
        }
        return newPair;
    },

    async loadPreloadedPair() {
        const preloadedImages = preloader.pairPreloader.getPreloadedImagesForNextPair();
        if (preloadedImages && preloadedImages.pair && filtering.isPairValidForCurrentFilters(preloadedImages.pair)) {
            await gameSetup.setupGameWithPreloadedPair(preloadedImages);
            return preloadedImages.pair;
        }
        return null;
    },

    async loadPairByID(pairID, clearFilters = false) {
        try {
            if (clearFilters) {
                filtering.clearAllFilters();
            }

            const newPair = await pairManager.getPairByID(pairID);
            if (newPair) {
                await this.setupNewPair(newPair, pairID);
            } else {
                logger.warn(`Pair with ID ${pairID} not found.`);
            }
        } catch (error) {
            logger.error(`Error loading pair with ID ${pairID}:`, error);
        }
    },

    async setupNewPair(newPair, pairID) {
        state.setNextSelectedPair(newPair);
        await gameSetup.setupGame(true);
        const nextPairID = String(Number(pairID) + 1);
        preloader.pairPreloader.preloadPairByID(nextPairID);
    },

    async selectAndSetupRandomPair() {
        const newPair = await pairManager.selectRandomPairFromCurrentCollection();
        if (newPair) {
            state.setNextSelectedPair(newPair);
            await gameSetup.setupGame(true);
            return newPair;
        }
        throw new Error("No pairs available in the current collection");
    },

    updateUIForNewPair(newPair) {
        ui.hideOverlay();
        if (newPair) {
            ui.updateLevelIndicator(newPair.level);
        }
    },

    handlePairLoadingError(error) {
        logger.error("Error loading new pair:", error);
        ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
    },

    finalizePairLoading() {
        if (state.getState() !== state.GameState.PLAYING) {
            state.setState(state.GameState.PLAYING);
        }
        preloader.startPreloading(true);
    },

    /*async loadRandomPairFromCurrentCollection() {
        logger.debug(`Loading pair. Selected level: ${state.getSelectedLevel()}`);

        const isCurrentPairValid = this.isCurrentPairInCollection();
        logger.debug(`Is current pair valid for new filters: ${isCurrentPairValid}`);

        if (!isCurrentPairValid) {
            logger.debug("Current pair is not in collection. Determining new pair based on filters.");
            const newPair = await pairManager.selectRandomPairFromCurrentCollection();
            if (newPair) {
                logger.debug("New pair selected:", newPair);
                state.setNextSelectedPair(newPair);
                await gameSetup.setupGame(true);
            } else {
                logger.warn("No pairs available in the current filtered collection");
                ui.showOverlay("No pairs available for the current filters. Please adjust your selection.", config.overlayColors.red);
            }
        } else {
            logger.debug("Current pair is in collection. Keeping current pair.");
            if (!preloader.pairPreloader.hasPreloadedPair() || 
                !filtering.isPairValidForCurrentFilters(preloader.pairPreloader.getPreloadedImagesForNextPair().pair)) {
                await preloader.pairPreloader.preloadForNextPair();
            }
            // Update UI to reflect any changes in filters
            ui.updateLevelIndicator(state.getCurrentTaxonImageCollection().pair.level);
            ui.hideOverlay();
        }
    },*/

    /*isCurrentPairInCollection() {
        logger.debug("starting isCurrentPairInCollection()");
        const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        if (!currentTaxonImageCollection || !currentTaxonImageCollection.pair) {
            return false;
        }

        const currentPair = currentTaxonImageCollection.pair;
        return filtering.isPairValidForCurrentFilters(currentPair);
    },*/

    async refreshCollectionSubset() {
        this.isInitialized = false;
        this.usedPairIDs.clear();
        this.lastUsedPairID = null;
        preloader.pairPreloader.isCollectionSubsetInitialized = false;
        await this.initializeCollectionSubset();
    },

    isPairUsed(pairID) {
        return this.usedPairIDs.has(pairID);
    },

    async getPairByID(pairID) {
        const allPairs = await api.taxonomy.fetchTaxonPairs();
        return allPairs.find(pair => pair.pairID === pairID);
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(pairManager).forEach(key => {
    if (typeof pairManager[key] === 'function') {
        pairManager[key] = pairManager[key].bind(pairManager);
    }
});

const publicAPI = {
    initializeCollectionSubset: pairManager.initializeCollectionSubset,
    getNextPair: pairManager.getNextPair,
    getNextPairFromCollection: pairManager.getNextPairFromCollection,
    //isCurrentPairInCollection: pairManager.isCurrentPairInCollection,
    //loadRandomPairFromCurrentCollection: pairManager.loadRandomPairFromCurrentCollection,
    loadNewPair: pairManager.loadNewPair,
    loadNewRandomPair: pairManager.loadNewRandomPair,
    refreshCollectionSubset: pairManager.refreshCollectionSubset,
    getPairByID: pairManager.getPairByID,
    loadPairByID: pairManager.loadPairByID, // TODO double?
    selectRandomPairFromCurrentCollection: pairManager.selectRandomPairFromCurrentCollection,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(pairManager);
    }
});

export default publicAPI;
