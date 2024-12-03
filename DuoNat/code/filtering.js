import logger from './logger.js';
import state from './state.js';
import utils from './utils.js';

import api from './api.js';

import eventMain from './events/eventMain.js';

import collectionManager from './dialogs/collectionManager.js';
import rangeSelector from './dialogs/rangeSelector.js';
import tagSelector from './dialogs/tagSelector.js';

const filtering = {
    getActiveFilters() {
        return {
            levels: state.getSelectedLevels(),
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags(),
            phylogenyId: state.getPhylogenyId(),
        };
    },

    areAllFiltersDefault() {
        const filters = this.getActiveFilters();
        return filters.tags.length === 0 &&
            filters.ranges.length === 0 &&
            filters.level === '' &&
            filters.phylogenyId === null &&
            filters.searchTerm === '';
    },

    clearAllFilters() {
        state.setSelectedTags([]);
        state.setSelectedRanges([]);
        state.setSelectedLevels([]);
        state.setPhylogenyId(null);
        state.setSearchTerm('');

        const levelDropdown = document.getElementById('level-filter-dropdown');
        if (levelDropdown) {
            levelDropdown.value = '';
        }

        tagSelector.clearTagsInCloud();
        rangeSelector.setSelectedRanges([]);

        eventMain.resetSearch();
        collectionManager.updateLevelCounts();
        collectionManager.updateFilterSummary();
        collectionManager.onFiltersChanged();
    },

    haveFiltersChanged(currentFilters, previousFilters) {
        const levelsChanged = !utils.array.arraysEqual(currentFilters.levels, previousFilters.levels);
        const rangesChanged = !utils.array.arraysEqual(currentFilters.ranges, previousFilters.ranges);
        const tagsChanged = !utils.array.arraysEqual(currentFilters.tags, previousFilters.tags);
        const phylogenyChanged = currentFilters.phylogenyId !== previousFilters.phylogenyId;

        logger.debug('Levels changed:', levelsChanged);
        logger.debug('Ranges changed:', rangesChanged);
        logger.debug('Tags changed:', tagsChanged);
        logger.debug('Phylogeny changed:', phylogenyChanged);

        return levelsChanged || rangesChanged || tagsChanged || phylogenyChanged;
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
            return true; // Allow through if hierarchy not loaded
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

    checkAllFilterCriteria(pair, filters) {
        return this.matchesLevel(pair, filters.level) &&
            this.matchesTags(pair, filters.tags) &&
            this.matchesRanges(pair, filters.ranges) &&
            this.matchesPhylogeny(pair, filters.phylogenyId);
    },

    matchesLevel(pair, selectedLevels) {
        return selectedLevels.length === 0 || selectedLevels.includes(Number(pair.level));
    },

    matchesTags(pair, selectedTags) {
        return selectedTags.length === 0 ||
            (pair.tags && selectedTags.every(tag => pair.tags.includes(tag)));
    },

    matchesRanges(pair, selectedRanges) {
        return selectedRanges.length === 0 ||
            (pair.range && pair.range.some(range => selectedRanges.includes(range)));
    },

    matchesSearch(pair, searchTerm) {
        if (!searchTerm) return true;
        const lowercaseSearch = searchTerm.toLowerCase();
        return (pair.taxonNames && pair.taxonNames.some(name => name.toLowerCase().includes(lowercaseSearch))) ||
            (pair.pairName && pair.pairName.toLowerCase().includes(lowercaseSearch)) ||
            (pair.tags && pair.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch)));
    },

    matchesPhylogeny(pair, phylogenyId) {
        if (!phylogenyId) return true;
        
        const hierarchy = api.taxonomy.getTaxonomyHierarchy();
        if (!hierarchy) {
            logger.debug('Taxonomy hierarchy not loaded yet, deferring phylogeny filtering');
            return true; // Allow all pairs through until hierarchy is loaded
        }
        
        return pair.taxa.some(taxonId => this.isDescendantOf(taxonId, phylogenyId));
    },

    filterTaxonPairs(pairs, filters, searchTerm) {
        return pairs.filter(pair => {
            const matchesLevels = filters.levels.length === 0 || filters.levels.includes(Number(pair.level));
            const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
                (pair.range && pair.range.some(r => filters.ranges.includes(r)));
            const matchesTags = !filters.tags || filters.tags.length === 0 ||
                (pair.tags && filters.tags.every(tag => pair.tags.includes(tag)));
            const matchesPhylogeny = !filters.phylogenyId ||
                pair.taxa.some(taxonId => this.isDescendantOf(taxonId, filters.phylogenyId));
            const matchesSearch = !searchTerm ||
                pair.taxonNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                pair.pairName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (pair.tags && pair.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) ||
                pair.pairId === searchTerm;

            return matchesLevels && matchesRanges && matchesTags && matchesPhylogeny && matchesSearch;
        });
    },

    pairMatchesPhylogeny(pair, phylogenyId) {
        if (!phylogenyId) return true;
        return pair.taxa.some(taxonId => this.isDescendantOf(taxonId, phylogenyId));
    },

    pairMatchesFilters(pair, filters) {
        const matchesLevels = filters.levels.length === 0 || filters.levels.includes(Number(pair.level));
        const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
            (pair.range && pair.range.some(range => filters.ranges.includes(range)));
        const matchesTags = !filters.tags || filters.tags.length === 0 ||
            pair.tags.some(tag => filters.tags.includes(tag));
        const matchesPhylogeny = !filters.phylogenyId ||
            pair.taxa.some(taxonId => this.isDescendantOf(taxonId, filters.phylogenyId));

        return matchesLevels && matchesRanges && matchesTags && matchesPhylogeny;
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

        const filters = filtering.getActiveFilters();
        return filtering.checkAllFilterCriteria(pair, filters);
    },

    async countPairsPerLevel(filters) {
        const taxonPairs = await api.taxonomy.fetchTaxonPairs(); // TODO why
        
        // Create a copy of filters without the levels
        const filtersWithoutLevels = {...filters, levels: []};
        
        const filteredPairs = this.filterTaxonPairs(taxonPairs, filtersWithoutLevels);
        
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
    areAllFiltersDefault: filtering.areAllFiltersDefault,
    clearAllFilters: filtering.clearAllFilters,
    haveFiltersChanged: filtering.haveFiltersChanged,
    filterTaxonPairs: filtering.filterTaxonPairs,
    getActiveFilters: filtering.getActiveFilters,
    getFilteredTaxonPairs: filtering.getFilteredTaxonPairs,
    pairMatchesFilters: filtering.pairMatchesFilters,
    getAvailableTaxonIds: filtering.getAvailableTaxonIds,
    isPairValidForCurrentFilters: filtering.isPairValidForCurrentFilters,
    isDescendantOf: filtering.isDescendantOf,
    countPairsPerLevel: filtering.countPairsPerLevel.bind(filtering),
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(filtering);
    }
});

export default publicAPI;
