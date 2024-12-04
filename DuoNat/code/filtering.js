import logger from './logger.js';
import state from './state.js';
import utils from './utils.js';

import api from './api.js';

import eventMain from './events/eventMain.js';

import collectionManager from './dialogs/collectionManager.js';
import rangeSelector from './dialogs/rangeSelector.js';
import tagSelector from './dialogs/tagSelector.js';

const filtering = {
    matchCriteria: {
        level: (pair, selectedLevels) => 
            selectedLevels.length === 0 || selectedLevels.includes(Number(pair.level)),

        ranges: (pair, selectedRanges) =>
            !selectedRanges?.length || (pair.range && pair.range.some(r => selectedRanges.includes(r))),

        tags: (pair, selectedTags) =>
            !selectedTags?.length || (pair.tags && selectedTags.every(tag => pair.tags.includes(tag))),

        search: (pair, searchTerm) => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (pair.taxonNames && pair.taxonNames.some(name => name.toLowerCase().includes(term))) ||
                (pair.pairName && pair.pairName.toLowerCase().includes(term)) ||
                (pair.tags && pair.tags.some(tag => tag.toLowerCase().includes(term))) ||
                pair.pairId === searchTerm;
        },

        phylogeny: (pair, phylogenyId, taxonomyHierarchy) => {
            if (!phylogenyId) return true;
            if (!taxonomyHierarchy) {
                logger.debug('Taxonomy hierarchy not loaded, deferring phylogeny filtering');
                return true;
            }
            return pair.taxa.some(taxonId => filtering.isDescendantOf(taxonId, phylogenyId));
        }
    },

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
            filters.phylogenyId === null;
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
        return [...new Set(filteredPairs.flatMap(pair => 
            Array.isArray(pair.taxa) ? pair.taxa.map(String) : []))];
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
        const hierarchy = api.taxonomy.getTaxonomyHierarchy();
        return Object.entries(this.matchCriteria).every(([key, matchFn]) => {
            const filterValue = key === 'phylogeny' ? [filters[key], hierarchy] : filters[key];
            return matchFn(pair, filterValue);
        });
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
        // Just use fetchTaxonPairs since we don't have getAllPairs
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        
        const filtersWithoutLevels = {...filters, levels: []};
        const filteredPairs = this.filterTaxonPairs(taxonPairs, filtersWithoutLevels);
        
        return filteredPairs.reduce((counts, pair) => {
            if (pair.level in counts) {
                counts[pair.level]++;
            }
            return counts;
        }, { '1': 0, '2': 0, '3': 0 });
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
