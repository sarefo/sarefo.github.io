import dialogManager from './dialogManager.js';
import logger from './logger.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import utils from './utils.js';

const url = {
    read: {
         getUrlParameters() {
            const params = new URLSearchParams(window.location.search);
            return {
                level: params.get('level'),
                setID: params.get('setID'),
                taxon1: params.get('taxon1'),
                taxon2: params.get('taxon2'),
                ranges: params.get('ranges'),
                tags: params.get('tags'),
                phylogenyID: params.get('phylogenyID'),
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
                const level = params.level === 'all' ? '' : params.level;
                state.setSelectedLevel(level);
                logger.debug("Skill level from URL:", level);
            } else if (Object.values(params).some(value => value !== null)) {
                state.setSelectedLevel('');
                logger.debug("Cleared default level due to URL parameters");
            } else {
                state.setSelectedLevel('1');
                logger.debug("Set default skill level to 1");
            }

            // Handle other parameters
            if (params.setID) state.setCurrentSetID(params.setID);
            if (params.ranges) state.setSelectedRanges(params.ranges.split(','));
            if (params.tags) state.setSelectedTags(params.tags.split(','));
            if (params.phylogenyID) state.setPhylogenyId(params.phylogenyID);
            if (params.searchTerm) state.setSearchTerm(params.searchTerm);
        },

        createFilters(params) {
            return {
                level: state.getSelectedLevel(),
                setID: params.setID,
                /*taxon1: params.taxon1,
                taxon2: params.taxon2,*/
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
                const { setID, taxon1, taxon2 } = currentTaxonImageCollection.pair;
                if (setID) currentUrl.searchParams.set('setID', setID);
                currentUrl.searchParams.set('taxon1', taxon1);
                currentUrl.searchParams.set('taxon2', taxon2);
            }

            this.addOptionalParameters(currentUrl);
            return currentUrl.toString();
        },

        addOptionalParameters(url) {
            const activeTags = state.getSelectedTags();
            if (activeTags && activeTags.length > 0) {
                url.searchParams.set('tags', activeTags.join(','));
            }

            const selectedLevel = state.getSelectedLevel();
            if (selectedLevel && selectedLevel !== '') {
                url.searchParams.set('level', selectedLevel);
            }

            const selectedRanges = state.getSelectedRanges();
            if (selectedRanges && selectedRanges.length > 0) {
                url.searchParams.set('ranges', selectedRanges.join(','));
            }

            const phylogenyID = state.getPhylogenyId();
            if (phylogenyID) {
                url.searchParams.set('phylogenyID', phylogenyID);
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
