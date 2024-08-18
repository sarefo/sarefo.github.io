import state from './state.js';
import api from './api.js';
import logger from './logger.js';
import mainEventHandler from './mainEventHandler.js';
import rangeSelector from './rangeSelector.js';
import tagSelector from './tagSelector.js';
import utils from './utils.js';

const filtering = {
    getActiveFilters() {
        return {
            level: state.getSelectedLevel(),
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags(),
            searchTerm: state.getSearchTerm()
        };
    },

    clearAllFilters() {
        state.setSelectedTags([]);
        state.setSelectedRanges([]);
        state.setSelectedLevel('');
        state.setSearchTerm('');

        const levelDropdown = document.getElementById('level-filter-dropdown');
        if (levelDropdown) {
            levelDropdown.value = '';
        }

        tagSelector.clearAllTags();
        rangeSelector.setSelectedRanges([]);

        mainEventHandler.resetSearch();
    },

    filterTaxonPairs(taxonPairs, filters) {
        return taxonPairs.filter(pair => {
            const matchesLevel = filters.level === '' || pair.level === filters.level;
            const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
                (pair.range && pair.range.some(range => filters.ranges.includes(range)));
            const matchesTags = filters.tags.length === 0 ||
                filters.tags.every(tag => pair.tags.includes(tag));
            const matchesSearch = !filters.searchTerm || 
                pair.taxonNames.some(name => name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
                pair.setName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                pair.tags.some(tag => tag.toLowerCase().includes(filters.searchTerm.toLowerCase()));

            return matchesLevel && matchesRanges && matchesTags && matchesSearch;
        });
    },

    pairMatchesFilters(pair, filters) {
        const matchesLevel = !filters.level || pair.level === filters.level;
        const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
            (pair.range && pair.range.some(range => filters.ranges.includes(range)));
        const matchesTags = !filters.tags || filters.tags.length === 0 ||
            pair.tags.some(tag => filters.tags.includes(tag));

        return matchesLevel && matchesRanges && matchesTags;
    },

    /*async getFilteredTaxonPairs() {
        try {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const activeFilters = this.getActiveFilters();
            return this.filterTaxonPairs(taxonPairs, activeFilters);
        } catch (error) {
            logger.error("Error fetching filtered taxon pairs:", error);
            return [];
        }
    },*/

    async getFilteredTaxonPairs(filters = {}) {
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        return taxonPairs.filter(pair => filtering.pairMatchesFilters(pair, filters));
    },

    isPairValidForCurrentFilters(pair) {
        if (!pair) {
            logger.warn("Received undefined pair in isPairValidForCurrentFilters");
            return false;
        }

        const activeFilters = this.getActiveFilters();
        return this.filterTaxonPairs([pair], activeFilters).length > 0;
    }
};

const publicAPI = {
    applyFilters: filtering.applyFilters,
    clearAllFilters: filtering.clearAllFilters,
    filterTaxonPairs: filtering.filterTaxonPairs,
    getActiveFilters: filtering.getActiveFilters,
    getFilteredTaxonPairs: filtering.getFilteredTaxonPairs,
};

export default publicAPI;
