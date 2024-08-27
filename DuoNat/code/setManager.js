import api from './api.js';
import filtering from './filtering.js';
import logger from './logger.js';
import state from './state.js';

const setManager = {
    currentSubset: [],
    allFilteredSets: [],
    usedSetIDs: new Set(),
    isInitialized: false,

    async initializeSubset() {
        logger.debug('Initializing subset');
        const allSets = await api.taxonomy.fetchTaxonPairs();
        const filters = filtering.getActiveFilters();
        this.allFilteredSets = filtering.filterTaxonPairs(allSets, filters);
        
        logger.debug(`Total filtered sets: ${this.allFilteredSets.length}`);

        // Reset usedSetIDs if all sets have been used
        if (this.usedSetIDs.size >= this.allFilteredSets.length) {
            this.usedSetIDs.clear();
            logger.debug('Reset used sets');
        }

        // Create a new subset with unused sets
        this.currentSubset = this.allFilteredSets.filter(set => !this.usedSetIDs.has(set.setID));
        this.shuffleArray(this.currentSubset);

        logger.debug(`Initialized new subset of sets: ${this.currentSubset.length}`);
        this.isInitialized = true;
    },

    async getNextSet() {
        if (!this.isInitialized || this.currentSubset.length === 0) {
            await this.initializeSubset();
        }

        if (this.currentSubset.length === 0) {
            logger.debug('All sets have been used, resetting');
            this.usedSetIDs.clear();
            await this.initializeSubset();
        }

        const nextSet = this.currentSubset.pop();
        if (nextSet) {
            this.usedSetIDs.add(nextSet.setID);
            logger.debug(`Next set: ${nextSet.setID}, Remaining sets: ${this.currentSubset.length}, Used sets: ${this.usedSetIDs.size}, Total sets: ${this.allFilteredSets.length}`);
        } else {
            logger.warn('No next set available');
        }

        return nextSet;
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    async refreshSubset() {
        this.isInitialized = false;
        this.usedSetIDs.clear();
        await this.initializeSubset();
    },

    isSetUsed(setID) {
        return this.usedSetIDs.has(setID);
    },

    async getSetByID(setID) {
        const allSets = await api.taxonomy.fetchTaxonPairs();
        return allSets.find(set => set.setID === setID);
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(setManager).forEach(key => {
    if (typeof setManager[key] === 'function') {
        setManager[key] = setManager[key].bind(setManager);
    }
});

const publicAPI = {
    initializeSubset: setManager.initializeSubset.bind(setManager),
    getNextSet: setManager.getNextSet.bind(setManager),
    refreshSubset: setManager.refreshSubset.bind(setManager),
    getSetByID: setManager.getSetByID.bind(setManager),
};

export default publicAPI;
