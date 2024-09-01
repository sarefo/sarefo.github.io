import api from './api.js';
import filtering from './filtering.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';

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
    initializeCollectionSubset: pairManager.initializeCollectionSubset.bind(pairManager),
    getNextPair: pairManager.getNextPair.bind(pairManager),
    getNextPairFromCollection: pairManager.getNextPairFromCollection.bind(pairManager),
    refreshCollectionSubset: pairManager.refreshCollectionSubset.bind(pairManager),
    getPairByID: pairManager.getPairByID.bind(pairManager),
};

export default publicAPI;