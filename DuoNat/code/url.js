import logger from './logger.js';
import state from './state.js';
import utils from './utils.js';

import dialogManager from './dialogs/dialogManager.js';
import tagSelector from './dialogs/tagSelector.js';

const url = {
    read: {
         getUrlParameters() {
            const params = new URLSearchParams(window.location.search);
            return {
                level: params.get('level'),
                pairId: params.get('pairId'),
                taxonA: params.get('taxonA'),
                taxonB: params.get('taxonB'),
                ranges: params.get('ranges'),
                tags: params.get('tags'),
                phylogenyId: params.get('phylogenyId'),
                searchTerm: params.get('searchTerm')
            };
        },

        handleUrlParameters() {
            const params = this.getUrlParameters()
            this.updateState(params);
            return this.createFilters(params);
        },

        updateState(params) {
            // Handle level
            if (params.level) {
                const levels = params.level === 'all' ? [] : params.level.split(',').map(Number);
                state.setSelectedLevels(levels);
                logger.debug("Skill levels from URL:", levels);
            } else if (Object.values(params).some(value => value !== null)) {
                state.setSelectedLevels([]);
                logger.debug("Cleared default levels due to URL parameters");
            } else {
                state.setSelectedLevels([1]);
                logger.debug("Set default skill level to 1");
            }

            // Handle other parameters
            if (params.pairId) state.setCurrentPairId(params.pairId);
            /*if (params.taxonA && params.taxonB) {
                // You might want to add a new state method to handle taxa from URL
                state.setTaxaFromUrl(params.taxonA, params.taxonB);
                logger.debug("Set taxa from URL:", params.taxonA, params.taxonB);
            }*/
            if (params.ranges) state.setSelectedRanges(params.ranges.split(','));
            if (params.tags) state.setSelectedTags(params.tags.split(','));
            if (params.phylogenyId) state.setPhylogenyId(params.phylogenyId);
            if (params.searchTerm) state.setSearchTerm(params.searchTerm);
        },

        createFilters(params) {
            return {
                level: state.getSelectedLevel(),
                pairId: params.pairId,
                /*taxonA: params.taxonA,
                taxonB: params.taxonB,*/
                ranges: state.getSelectedRanges(),
                tags: state.getSelectedTags(),
                phylogenyId: state.getPhylogenyId(),
                searchTerm: state.getSearchTerm(),
            };
    }
    },
    write: {
        buildShareUrl() {
            let currentUrl = new URL(window.location.href);
            currentUrl.search = ''; // Clear existing parameters
            let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();

            if (currentTaxonImageCollection && currentTaxonImageCollection.pair) {
                const { pairId, taxonA, taxonB } = currentTaxonImageCollection.pair;
                if (pairId) currentUrl.searchParams.set('pairId', pairId);
                /*currentUrl.searchParams.set('taxonA', taxonA);
                currentUrl.searchParams.set('taxonB', taxonB);*/
            }

            this.addOptionalParameters(currentUrl);
            return currentUrl.toString();
        },

        addOptionalParameters(url) {
            const activeTags = state.getSelectedTags();
            if (activeTags && activeTags.length > 0) {
                url.searchParams.set('tags', activeTags.join(','));
            }

            const selectedLevels = state.getSelectedLevels();
            if (selectedLevels && selectedLevels.length > 0) {
                url.searchParams.set('level', selectedLevels.join(','));
            } else {
                // If no levels are selected, explicitly set 'all'
                url.searchParams.set('level', 'all');
            }

            const selectedRanges = state.getSelectedRanges();
            if (selectedRanges && selectedRanges.length > 0) {
                url.searchParams.set('ranges', selectedRanges.join(','));
            }

            const phylogenyId = state.getPhylogenyId();
            if (phylogenyId) {
                url.searchParams.set('phylogenyId', phylogenyId);
            }
        },
    },
};

// Bind all methods in nested objects
['read', 'write'].forEach(nestedObj => {
    Object.keys(url[nestedObj]).forEach(key => {
        if (typeof url[nestedObj][key] === 'function') {
            url[nestedObj][key] = url[nestedObj][key].bind(url[nestedObj]);
        }
    });
});

const publicAPI = {
    handleUrlParameters: url.read.handleUrlParameters,
    getUrlParameters: url.read.getUrlParameters,

    buildShareUrl: url.write.buildShareUrl,
};

export default publicAPI;
