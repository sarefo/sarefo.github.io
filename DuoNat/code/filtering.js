// reset here
import api from './api.js';
import logger from './logger.js';
import mainEventHandler from './mainEventHandler.js';
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
            searchTerm: state.getSearchTerm(),
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

        mainEventHandler.resetSearch();
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
            const matchesSearch = !filters.searchTerm ||
                pair.taxonNames.some(name => name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
                pair.setName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                pair.tags.some(tag => tag.toLowerCase().includes(filters.searchTerm.toLowerCase()));
            
            const matchesPhylogeny = !filters.phylogenyId ||
                pair.taxa.some(taxonId => filtering.isDescendantOf(taxonId, filters.phylogenyId));

            return matchesLevel && matchesRanges && matchesTags && matchesSearch && matchesPhylogeny;
        });
    },

    pairMatchesFilters(pair, filters) {
        const matchesLevel = filters.level === '' || filters.level === 'all' || pair.level === filters.level;
        if (!matchesLevel) logger.debug(`Pair ${pair.setID} excluded due to level mismatch. Pair level: ${pair.level}, Filter level: ${filters.level}`);

        const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
            (pair.range && pair.range.some(range => filters.ranges.includes(range)));
        if (!matchesRanges) logger.debug(`Pair ${pair.setID} excluded due to range mismatch`);

        const matchesTags = !filters.tags || filters.tags.length === 0 ||
            pair.tags.some(tag => filters.tags.includes(tag));
        if (!matchesTags) logger.debug(`Pair ${pair.setID} excluded due to tag mismatch`);

        const matchesPhylogeny = !filters.phylogenyId ||
            pair.taxa.some(taxonId => filtering.isDescendantOf(taxonId, filters.phylogenyId));
        if (!matchesPhylogeny) logger.debug(`Pair ${pair.setID} excluded due to phylogeny mismatch`);

        const matchesSearch = !filters.searchTerm ||
            pair.taxonNames.some(name => name.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
            pair.setName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
            pair.tags.some(tag => tag.toLowerCase().includes(filters.searchTerm.toLowerCase()));
        if (!matchesSearch) logger.debug(`Pair ${pair.setID} excluded due to search term mismatch`);

        return matchesLevel && matchesRanges && matchesTags && matchesPhylogeny && matchesSearch;
    },

    async getFilteredTaxonPairs(filters = {}) {
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        logger.debug('Fetched taxon pairs:', taxonPairs.length);
        logger.debug('Applied filters:', JSON.stringify(filters));
        logger.debug('Level filter value:', filters.level);
        
        const filteredPairs = taxonPairs.filter(pair => filtering.pairMatchesFilters(pair, filters));
        logger.debug('Filtered pairs:', filteredPairs.length);
        
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

        const activeFilters = filtering.getActiveFilters();
        return filtering.filterTaxonPairs([pair], activeFilters).length > 0;
    }
};

const publicAPI = {
    applyFilters: filtering.applyFilters,
    clearAllFilters: filtering.clearAllFilters,
    filterTaxonPairs: filtering.filterTaxonPairs,
    getActiveFilters: filtering.getActiveFilters,
    getFilteredTaxonPairs: filtering.getFilteredTaxonPairs,
    getAvailableTaxonIds: filtering.getAvailableTaxonIds,
    isDescendantOf: filtering.isDescendantOf,
};

export default publicAPI;
