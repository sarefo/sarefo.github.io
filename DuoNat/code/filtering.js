import api from './api.js';
import collectionManager from './collectionManager.js';
import eventMain from './eventMain.js';
import logger from './logger.js';
import rangeSelector from './rangeSelector.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import utils from './utils.js';

const filtering = {
    getActiveFilters() {
        return {
            level: state.getSelectedLevel(),
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags(),
            phylogenyId: state.getPhylogenyId()
        };
    },

    clearAllFilters() {
        state.setSelectedTags([]);
        state.setSelectedRanges([]);
        state.setSelectedLevel('');
        state.setSearchTerm('');
        state.setPhylogenyId(null);

        const levelDropdown = document.getElementById('level-filter-dropdown');
        if (levelDropdown) {
            levelDropdown.value = '';
        }

        tagSelector.clearAllTags();
        rangeSelector.setSelectedRanges([]);

        eventMain.resetSearch();
        collectionManager.updateLevelCounts();
    },

    getAvailableTaxonIds(filteredPairs) {
        const taxonIds = new Set();
        filteredPairs.forEach(pair => {
            if (Array.isArray(pair.taxa)) {
                pair.taxa.forEach(taxonId => taxonIds.add(taxonId.toString()));
            }
        });
        return Array.from(taxonIds);
    },

    isDescendantOf(taxonId, ancestorId) {
        const hierarchy = api.taxonomy.getTaxonomyHierarchy();
        if (!hierarchy) {
            logger.error('Taxonomy hierarchy not loaded');
            return false;
        }

        let currentNode = hierarchy.getTaxonById(taxonId);
        while (currentNode) {
            if (currentNode.id === ancestorId) {
                return true;
            }
            currentNode = hierarchy.getTaxonById(currentNode.parentId);
        }

        return false;
    },

    filterTaxonPairs(taxonPairs, filters) {
        return taxonPairs.filter(pair => {
            const matchesLevel = filters.level === '' || pair.level === filters.level;
            const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
                (pair.range && pair.range.some(range => filters.ranges.includes(range)));
            const matchesTags = filters.tags.length === 0 ||
                filters.tags.every(tag => pair.tags.includes(tag));
            const matchesPhylogeny = !filters.phylogenyId ||
                pair.taxa.some(taxonId => this.isDescendantOf(taxonId, filters.phylogenyId));

            // Remove searchTerm matching from here

            return matchesLevel && matchesRanges && matchesTags && matchesPhylogeny;
        });
    },

    pairMatchesFilters(pair, filters) {
        const matchesLevel = filters.level === '' || pair.level === filters.level;
        const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
            (pair.range && pair.range.some(range => filters.ranges.includes(range)));
        const matchesTags = !filters.tags || filters.tags.length === 0 ||
            pair.tags.some(tag => filters.tags.includes(tag));
        const matchesPhylogeny = !filters.phylogenyId ||
            pair.taxa.some(taxonId => this.isDescendantOf(taxonId, filters.phylogenyId));

        // Remove searchTerm matching from here

        return matchesLevel && matchesRanges && matchesTags && matchesPhylogeny;
    },

    async getFilteredTaxonPairs(filters = {}) {
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        
        const filteredPairs = taxonPairs.filter(pair => this.pairMatchesFilters(pair, filters));
        
        if (filteredPairs.length === 0) {
            logger.warn('No pairs match the current filters');
        }
        
        return filteredPairs;
    },

    isPairValidForCurrentFilters(pair) {
        if (!pair) {
            logger.warn("Received undefined pair in isPairValidForCurrentFilters");
            return false;
        }

        const activeFilters = this.getActiveFilters();
        return this.filterTaxonPairs([pair], activeFilters).length > 0;
    },

    async countSetsPerLevel(filters) {
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        
        // Create a copy of filters without the level
        const filtersWithoutLevel = {...filters, level: ''};
        
        const filteredPairs = this.filterTaxonPairs(taxonPairs, filtersWithoutLevel);
        
        const counts = {
            '1': 0,
            '2': 0,
            '3': 0
        };

        filteredPairs.forEach(pair => {
            if (pair.level in counts) {
                counts[pair.level]++;
            }
        });

        return counts;
    },

};

// Bind all methods in filtering
Object.keys(filtering).forEach(key => {
    if (typeof filtering[key] === 'function') {
        filtering[key] = filtering[key].bind(filtering);
    }
});

const publicAPI = {
    applyFilters: filtering.applyFilters,
    clearAllFilters: filtering.clearAllFilters,
    filterTaxonPairs: filtering.filterTaxonPairs,
    getActiveFilters: filtering.getActiveFilters,
    getFilteredTaxonPairs: filtering.getFilteredTaxonPairs,
    pairMatchesFilters: filtering.pairMatchesFilters,
    getAvailableTaxonIds: filtering.getAvailableTaxonIds,
    isDescendantOf: filtering.isDescendantOf,
    countSetsPerLevel: filtering.countSetsPerLevel.bind(filtering),
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(filtering);
    }
});

export default publicAPI;
