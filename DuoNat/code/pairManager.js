import api from './api.js';
import filtering from './filtering.js';
import logger from './logger.js';
import preloader from './preloader.js';
import state from './state.js';

const pairManager = {
    currentSubset: [],
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

    async initializeSubset() {
        logger.debug('Initializing subset');
        const allPairs = await api.taxonomy.fetchTaxonPairs();
        const filters = filtering.getActiveFilters();
        this.allFilteredPairs = filtering.filterTaxonPairs(allPairs, filters);
        
        logger.debug(`Total filtered pairs: ${this.allFilteredPairs.length}`);

        // Reset usedPairIDs if all pairs have been used
        if (this.usedPairIDs.size >= this.allFilteredPairs.length) {
            this.usedPairIDs.clear();
            logger.debug('Reset used pairs');
        }

        // Create a new subset with unused pairs
        this.currentSubset = this.allFilteredPairs.filter(pair => !this.usedPairIDs.has(pair.pairID));
        this.shuffleArray(this.currentSubset);

        logger.debug(`Initialized new subset of pairs: ${this.currentSubset.length}`);
        this.isInitialized = true;
    },

    async getNextSet() {
        if (!this.isInitialized || this.currentSubset.length === 0) {
            await this.initializeSubset();
        }

        if (this.currentSubset.length === 0) {
            logger.debug('All pairs have been used, resetting');
            this.usedPairIDs.clear();
            await this.initializeSubset();
        }

        const nextPair = this.currentSubset.pop();
        if (nextPair) {
            this.usedPairIDs.add(nextPair.pairID);
            logger.debug(`Next pair: ${nextPair.pairID}, Remaining pairs: ${this.currentSubset.length}, Used pairs: ${this.usedPairIDs.size}, Total pairs: ${this.allFilteredPairs.length}`);
        } else {
            logger.warn('No next pair available');
        }

        return nextPair;
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    async refreshSubset() {
        this.isInitialized = false;
        this.usedPairIDs.clear();
        await this.initializeSubset();
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
    initializeSubset: pairManager.initializeSubset.bind(pairManager),
    getNextPair: pairManager.getNextPair.bind(pairManager),
    getNextSet: pairManager.getNextSet.bind(pairManager),
    refreshSubset: pairManager.refreshSubset.bind(pairManager),
    getPairByID: pairManager.getPairByID.bind(pairManager),
};

export default publicAPI;
