import api from './api.js';
import filtering from './filtering.js';
import logger from './logger.js';
import state from './state.js';

const setManager = {
    currentSubset: [],
    allFilteredSets: [],
    usedSets: new Set(),
    isInitialized: false,

    async initializeSubset() {
        logger.debug('Initializing subset');
        const allSets = await api.taxonomy.fetchTaxonPairs();
        const filters = filtering.getActiveFilters();
        this.allFilteredSets = filtering.filterTaxonPairs(allSets, filters);
        
        logger.debug(`Total filtered sets: ${this.allFilteredSets.length}`);

        // Reset usedSets if all sets have been used
        if (this.usedSets.size >= this.allFilteredSets.length) {
            this.usedSets.clear();
            logger.debug('Reset used sets');
        }

        // Create a new subset with unused sets
        this.currentSubset = this.allFilteredSets.filter(set => !this.usedSets.has(set.setID));
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
            this.usedSets.clear();
            await this.initializeSubset();
        }

        const nextSet = this.currentSubset.pop();
        if (nextSet) {
            this.usedSets.add(nextSet.setID);
            logger.debug(`Next set: ${nextSet.setID}, Remaining sets: ${this.currentSubset.length}, Used sets: ${this.usedSets.size}`);
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
        this.usedSets.clear();
        await this.initializeSubset();
    },

    isSetUsed(setID) {
        return this.usedSets.has(setID);
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
