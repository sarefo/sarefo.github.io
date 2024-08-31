import api from './api.js';
import filtering from './filtering.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';

const pairManager = {
    currentCollectionSubset: [],
    allFilteredPairs: [],
    usedPairIDs: new Set(),
    isInitialized: false,

    async getNextPair(isNewPair) {
        if (isNewPair) {
            const preloadedPair = preloader.pairPreloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair && this.isPairValid(preloadedPair.pair)) {
                return { pair: preloadedPair.pair, preloadedImages: preloadedPair };
            }
            return { pair: await this.getNextSet(), preloadedImages: null };
        }
        return { pair: state.getCurrentTaxonImageCollection().pair, preloadedImages: null };
    },

    isPairValid(pair) {
        const filters = filtering.getActiveFilters();
        return filtering.pairMatchesFilters(pair, filters);
    },

    async initializeCollectionSubset() {
        logger.debug('Initializing collection subset');
        const allPairs = await api.taxonomy.fetchTaxonPairs();
        const filters = filtering.getActiveFilters();
        this.allFilteredPairs = filtering.filterTaxonPairs(allPairs, filters);
        
        logger.debug(`Total filtered pairs in collection: ${this.allFilteredPairs.length}`);

        const subsetSize = 42;

        if (this.allFilteredPairs.length <= subsetSize) {
            // For collections of 42 or fewer pairs, use all pairs
            this.currentCollectionSubset = [...this.allFilteredPairs];
        } else {
            // For larger collections, randomly select 42 pairs
            this.currentCollectionSubset = this.getRandomSubset(this.allFilteredPairs, subsetSize);
        }

        this.shuffleArray(this.currentCollectionSubset);

        logger.debug(`Initialized new collection subset of pairs: ${this.currentCollectionSubset.length}`);
        this.isInitialized = true;
    },

    getRandomSubset(array, size) {
        const shuffled = [...array];
        this.shuffleArray(shuffled);
        return shuffled.slice(0, size);
    },

    async getNextSet() {
        if (!this.isInitialized || this.currentCollectionSubset.length === 0) {
            await this.initializeCollectionSubset();
        }

        const nextPair = this.currentCollectionSubset.pop();
        if (nextPair) {
            logger.debug(`Next pair: ${nextPair.pairID}, Remaining pairs in subset: ${this.currentCollectionSubset.length}, Total pairs in collection: ${this.allFilteredPairs.length}`);
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
    getNextSet: pairManager.getNextSet.bind(pairManager),
    refreshCollectionSubset: pairManager.refreshCollectionSubset.bind(pairManager),
    getPairByID: pairManager.getPairByID.bind(pairManager),
};

export default publicAPI;
