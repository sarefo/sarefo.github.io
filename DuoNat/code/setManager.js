import api from './api.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import state from './state.js';

const setManager = {
    currentSubset: [],
    usedSets: new Set(),

    async initializeSubset() {
        const allSets = await api.taxonomy.fetchTaxonPairs();
        const filteredSets = this.filterSets(allSets);
        this.currentSubset = this.getRandomSubset(filteredSets, 100);
        this.shuffleArray(this.currentSubset);
        this.usedSets.clear();
        logger.debug('Initialized new subset of sets:', this.currentSubset.length);
    },

    filterSets(sets) {
        const filters = {
            level: state.getSelectedLevel(),
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags()
        };
        return gameLogic.filterTaxonPairs(sets, filters);
    },

    getRandomSubset(array, maxSize) {
        if (array.length <= maxSize) {
            return [...array];
        }
        const subset = new Set();
        while (subset.size < maxSize) {
            const randomIndex = Math.floor(Math.random() * array.length);
            subset.add(array[randomIndex]);
        }
        return Array.from(subset);
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    },

    async getNextSet() {
        if (this.currentSubset.length === 0) {
            await this.initializeSubset();
        }

        const nextSet = this.currentSubset.pop();
        this.usedSets.add(nextSet.setID);

        if (this.currentSubset.length === 0) {
            logger.debug('Subset exhausted, initializing new subset');
            await this.initializeSubset();
        }

        return nextSet;
    },

    async refreshSubset() {
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

const publicAPI = {
    initializeSubset: setManager.initializeSubset.bind(setManager),
    getNextSet: setManager.getNextSet.bind(setManager),
    refreshSubset: setManager.refreshSubset.bind(setManager),
    getSetByID: setManager.getSetByID.bind(setManager),
};

export default publicAPI;
