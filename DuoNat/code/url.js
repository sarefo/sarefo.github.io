import logger from './logger.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import utils from './utils.js';

const url = {

    handleUrlParameters() {
        const urlParams = utils.url.getURLParameters();
        url.handleLevelParameter(urlParams);
        url.handleRangesParameter(urlParams);
        url.handleTagsParameter(urlParams);
        url.handleSetIDParameter(urlParams);
        url.handlePhylogenyIDParameter(urlParams)
    },

    handleLevelParameter(urlParams) {
        if (urlParams.level) {
            // If a level is explicitly provided in the URL, use it
            const level = urlParams.level === 'all' ? '' : urlParams.level;
            state.setSelectedLevel(level);
            logger.debug("Skill level from URL:", urlParams.level);
        } else if (Object.keys(urlParams).some(key => urlParams[key])) {
            // If any URL parameters are provided but level is not specified, clear the default level
            state.setSelectedLevel('');
            logger.debug("Cleared default level due to URL parameters");
        } else {
            // If no URL parameters are provided, set the default level to '1'
            state.setSelectedLevel('1');
            logger.debug("Set default skill level to 1");
        }
    },

    handleRangesParameter(urlParams) {
        if (urlParams.ranges) {
            const ranges = urlParams.ranges.split(',');
            state.updateGameStateMultiple({ selectedRanges: ranges });
            logger.debug("Ranges from URL:", ranges);
        }
    },

    handleTagsParameter(urlParams) {
        if (urlParams.tags) {
            const tags = urlParams.tags.split(',');
            tagSelector.setSelectedTags(tags);
            logger.debug("Tags from URL:", tags);
        }
    },

    handleSetIDParameter(urlParams) {
        if (urlParams.setID) {
            state.updateGameStateMultiple({ currentSetID: urlParams.setID });
            logger.debug("Set ID from URL:", urlParams.setID);
        }
    },

    handlePhylogenyIDParameter(urlParams) {
        if (urlParams.phylogenyID) {
            state.setPhylogenyId(urlParams.phylogenyID);
            logger.debug("Phylogeny ID from URL:", urlParams.phylogenyID);
        }
    },

};

const publicAPI = {
    handleUrlParameters: url.handleUrlParameters,
};

export default publicAPI;
