import logger from './logger.js';
// DOM elements
const elements = {
    imageOne: document.getElementById('image-1'),
    imageTwo: document.getElementById('image-2'),
    imageOneContainer: document.getElementById('image-container-1'),
    imageTwoContainer: document.getElementById('image-container-2'),
    namePair: document.querySelector('.name-pair'),
    leftName: document.getElementById('name-x'),
    rightName: document.getElementById('name-y'),
    overlay: document.getElementById('overlay'),
    overlayMessage: document.getElementById('overlay-message'),
    buttons: document.querySelectorAll('.bottom-button')
};

// Game State enum
const GameState = {
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    READY: 'READY',
    PLAYING: 'PLAYING',
    CHECKING: 'CHECKING',
    PRELOADING: 'PRELOADING',
    PRELOADING_BACKGROUND: 'PRELOADING_BACKGROUND',
    NEXT_ROUND: 'NEXT_ROUND',
};

let gameState = {
    currentState: GameState.IDLE,  // track the current game state

    showTaxonomicNames: false,
    hideCollManTaxa: true,
    hasKeyboard: true,

    isInitialLoad: true,

    //infoDialogImageIndex: null,

    // Filters
    currentPairID: null,
    selectedLevel: '',
    selectedRanges: [],
    selectedTags: [],
    phylogenyId: null,
    searchTerm: "",

    currentActiveNodeId: null,

    // Round

    taxonLeftName: null,
    taxonRightName: null,
    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },

    currentTaxonImageCollection: null,

    usedImages: {
        taxonA: new Set(),
        taxonB: new Set()
    },
    taxonImageOne: null,
    taxonImageTwo: null,
    currentRound: {
        pair: null,
        imageOneURLs: [],
        imageTwoURLs: [],
        imageOneVernacular: null,
        imageTwoVernacular: null,
        randomized: false
    },

    // Preloading
    nextSelectedPair: null,
    preloadedPair: null,
    preloadedImages: {
        current: {
            taxonA: [],
            taxonB: []
        },
        next: {
            taxonA: [],
            taxonB: []
        }
    },

    preloadState: {
        currentRound: {
            taxonA: null,
            taxonB: null
        },
        nextRound: {
            taxonA: null,
            taxonB: null
        },
        nextPair: {
            taxonA: null,
            taxonB: null
        },
    },
    
    // Hints
    shownHints: {
        taxonA: [],
        taxonB: []
    },

};

// Private functions
function updateGameState(key, value) {
    if (gameState.hasOwnProperty(key)) {
        const oldValue = gameState[key];
        gameState[key] = value;
        //    logger.debug(`State updated: ${key}`, { oldValue, newValue: value });
    } else {
        logger.warn(`Attempted to update non-existent gameState property: ${key}`);
    }
}


// Public API
const publicAPI = {

    // Elements
    getElement: (elementName) => {
        if (elements.hasOwnProperty(elementName)) {
            return elements[elementName];
        } else {
            console.error(`Element "${elementName}" not found in elements object`);
            return null;
        }
    },

    getAllElements: () => ({ ...elements }),

    // Specific getters for commonly used elements
    getImageOne: () => elements.imageOne,
    getImageTwo: () => elements.imageTwo,
    getImageOneContainer: () => elements.imageOneContainer,
    getImageTwoContainer: () => elements.imageTwoContainer,
    getNamePair: () => elements.namePair,
    getLeftName: () => elements.leftName,
    getRightName: () => elements.rightName,
    getOverlay: () => elements.overlay,
    getOverlayMessage: () => elements.overlayMessage,
    getButtons: () => [...elements.buttons], // Return a copy of the NodeList as an array

    // Utility method to update an element's property
    updateElementProperty: (elementName, property, value) => {
        const element = elements[elementName];
        if (element) {
            element[property] = value;
        } else {
            console.error(`Element "${elementName}" not found in elements object`);
        }
    },

    updateRoundState(pair, images) {
        const { leftImageSrc, rightImageSrc, randomized, taxonImageOne, taxonImageTwo } = images;
        this.updateGameStateMultiple({
            currentTaxonImageCollection: {
                pair,
                imageOneURL: leftImageSrc,
                imageTwoURL: rightImageSrc,
                level: pair.level || '1',
            },
            usedImages: {
                taxonA: new Set([leftImageSrc]),
                taxonB: new Set([rightImageSrc]),
            },
            taxonImageOne: taxonImageOne,
            taxonImageTwo: taxonImageTwo,
            currentRound: {
                pair,
                imageOneURL: leftImageSrc,
                imageTwoURL: rightImageSrc,
                randomized,
            },
        });
        this.setCurrentPairID(pair.pairID || this.getCurrentPairID());
    },

    // Game State
    getGameState: () => ({ ...gameState }),
    setGameState: (newState) => updateGameState(newState),

    // Game State enum
    GameState: { ...GameState },

    // Elements
    getElement: (elementName) => elements[elementName],

    // GameState (IDLE/PLAYING/…)
    getState: () => gameState.currentState,
    setState: (state) => {
        if (GameState.hasOwnProperty(state)) {
            gameState.currentState = GameState[state];
        } else {
            console.error(`Invalid game state: ${state}`);
        }
    },

    // Next Selected Pair
    getNextSelectedPair: () => gameState.nextSelectedPair,
    setNextSelectedPair: (pair) => {
        updateGameState('nextSelectedPair', pair);
    },

    //getObservationURLs: () => ({ ...gameState.currentObservationURLs }),
    // Observation URLs
    getObservationURL: (index) => {
        if (index === 1 || index === 2) {
            const url = gameState.currentObservationURLs[`image${index}`];
            return url;
        } else {
            logger.error(`Invalid index for getObservationURL: ${index}`);
            return null;
        }
    },
    setObservationURL: (url, index) => {
        if (index === 1 || index === 2) {
            const updatedUrls = {
                ...gameState.currentObservationURLs,
                [`image${index}`]: url
            };
            updateGameState('currentObservationURLs', updatedUrls);
        } else {
            logger.error(`Invalid index for setObservationURL: ${index}`);
        }
    },

    // Preloaded Pair
    getPreloadedPair: () => gameState.preloadedPair,
    setPreloadedPair: (pair) => {
        updateGameState('preloadedPair', pair);
    },

    // Preloaded Images
    getPreloadedImages: () => ({ ...gameState.preloadedImages }),
    setPreloadedImages: (images) => {
        updateGameState('preloadedImages', { ...images });
    },

    // Shown Hints
    getShownHints: (taxonIndex) => [...gameState.shownHints[`taxon${taxonIndex}`]],
    addShownHint: (taxonIndex, hint) => {
        gameState.shownHints[`taxon${taxonIndex}`].push(hint);
    },
    areAllHintsShown: (taxonIndex, totalHints) => {
        return gameState.shownHints[`taxon${taxonIndex}`].length >= totalHints;
    },
    resetShownHints: () => {
        gameState.shownHints = {
            taxonA: [],
            taxonB: []
        };
    },

    getSearchTerm: () => gameState.searchTerm,
    setSearchTerm: (searchTerm) => {
        updateGameState('searchTerm', searchTerm);
    },

    getCurrentPairID: () => gameState.currentPairID,
    setCurrentPairID: (id) => {
        updateGameState('currentPairID', id);
    },

    getSelectedTags: () => [...gameState.selectedTags],
    setSelectedTags: (tags) => {
        if (Array.isArray(tags)) {
            updateGameState('selectedTags', [...tags]);
        } else {
            logger.error('Selected tags must be an array');
        }
    },

    getSelectedLevel: () => gameState.selectedLevel,
    setSelectedLevel: (level) => {
        if (level === '' || (typeof level === 'string' && !isNaN(level) && level.trim() !== '')) {
            updateGameState('selectedLevel', level === 'all' ? '' : level);
        } else {
            logger.error('Selected level must be an empty string or a valid number string');
        }
    },

    getSelectedRanges: () => [...gameState.selectedRanges],
    setSelectedRanges: (ranges) => {
        if (Array.isArray(ranges)) {
            updateGameState('selectedRanges', [...ranges]);
        } else {
            logger.error('Selected ranges must be an array');
        }
    },

    getPhylogenyId: () => gameState.phylogenyId,
    setPhylogenyId: (nodeId) => {
        updateGameState('phylogenyId', nodeId);
    },

    getCurrentActiveNodeId: () => gameState.currentActiveNodeId,
    setCurrentActiveNodeId: (nodeId) => {
        updateGameState('currentActiveNodeId', nodeId);
    },

    getCurrentRound: () => ({ ...gameState.currentRound }),
    setCurrentRound: (round) => {
        if (typeof round === 'object' && round !== null) {
            updateGameState('currentRound', { ...round });
        } else {
            logger.error('Current round must be an object');
        }
    },

    getCurrentTaxonImageCollection: () => gameState.currentTaxonImageCollection ? { ...gameState.currentTaxonImageCollection } : null,
    setCurrentTaxonImageCollection: (collection) => {
        if (typeof collection === 'object' && collection !== null) {
            updateGameState('currentTaxonImageCollection', { ...collection });
        } else {
            logger.error('Current taxon image collection must be an object');
        }
    },

    getTaxonImageOne: () => gameState.taxonImageOne,
    setTaxonImageOne: (taxon) => {
        updateGameState('taxonImageOne', taxon);
    },

    getTaxonImageTwo: () => gameState.taxonImageTwo,
    setTaxonImageTwo: (taxon) => {
        updateGameState('taxonImageTwo', taxon);
    },

    getTaxonLeftName: () => gameState.taxonLeftName,
    setTaxonLeftName: (name) => {
        updateGameState('taxonLeftName', name);
    },

    getTaxonRightName: () => gameState.taxonRightName,
    setTaxonRightName: (name) => {
        updateGameState('taxonRightName', name);
    },

    /*getIsFirstLoad: () => gameState.isFirstLoad,
    setIsFirstLoad: (value) => {
        if (typeof value === 'boolean') {
            updateGameState('isFirstLoad', value);
        } else {
            logger.error('isFirstLoad must be a boolean');
        }
    },*/

    getIsInitialLoad: () => gameState.isInitialLoad,
    setIsInitialLoad: (value) => {
        if (typeof value === 'boolean') {
            updateGameState('isInitialLoad', value);
        } else {
            logger.error('isInitialLoad must be a boolean');
        }
    },

    getCurrentPairID: () => gameState.currentPairID,
    setCurrentPairID: (id) => {
        updateGameState('currentPairID', id);
    },

    getShowTaxonomicNames: () => gameState.showTaxonomicNames,
    setShowTaxonomicNames(show) {
        updateGameState('showTaxonomicNames', show);
    },

    getHideCollManTaxa: () => gameState.hideCollManTaxa,
    setHideCollManTaxa(show) {
        updateGameState('hideCollManTaxa', show);
    },

    getHasKeyboard: () => gameState.hasKeyboard,
    setHasKeyboard(show) {
        updateGameState('hasKeyboard', show);
    },

    getUsedImages: () => ({ ...gameState.usedImages }),
    addUsedImage: (taxonKey, imageUrl) => {
        if (gameState.usedImages[taxonKey]) {
            gameState.usedImages[taxonKey].add(imageUrl);
        } else {
            gameState.usedImages[taxonKey] = new Set([imageUrl]);
        }
    },

    clearUsedImages: () => {
        gameState.usedImages = { taxonA: new Set(), taxonB: new Set() };
    },

    updateGameStateMultiple: (updates) => {
        Object.entries(updates).forEach(([key, value]) => {
            if (gameState.hasOwnProperty(key)) {
                updateGameState(key, value);
            } else {
                logger.warn(`Attempted to update non-existent gameState property: ${key}`);
            }
        });
    },

    // Utility method to get game state info for reporting
    getGameStateInfo: () => {
        let info = '';
        if (gameState.currentTaxonImageCollection && gameState.currentTaxonImageCollection.pair) {
            const pair = gameState.currentTaxonImageCollection.pair;
            info += `Current Pair ID: ${pair.pairID}\n`;
            info += `Taxon 1: ${pair.taxonA}\n`;
            info += `Taxon 2: ${pair.taxonB}\n`;
        }
        info += `Selected Level: ${gameState.selectedLevel}\n`;
        info += `Selected Ranges: ${gameState.selectedRanges.join(', ')}\n`;
        info += `Selected Tags: ${gameState.selectedTags.join(', ')}\n`;
        return info;
    },

};

export default publicAPI;
