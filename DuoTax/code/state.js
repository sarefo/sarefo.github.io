// Elements and game state

// DOM elements
export const elements = {
    imageOne: document.getElementById('image-1'),
    imageTwo: document.getElementById('image-2'),
    imageOneContainer: document.getElementById('image-container-1'),
    imageTwoContainer: document.getElementById('image-container-2'),
    namePair: document.querySelector('.name-pair'),
    leftName: document.getElementById('left-name'),
    rightName: document.getElementById('right-name'),
    overlay: document.getElementById('overlay'),
    overlayMessage: document.getElementById('overlay-message'),
    buttons: document.querySelectorAll('.bottom-button')
};


// Game state
/*export const gameState = {
    currentPair: null,
};*/

export const gameState = {
    isFirstLoad: true,
    isInitialLoad: true,
    hasLoadedFullSet: false,
    isPreloading: false,
    preloadedPair: null,
    currentRound: {
        pair: null,
        imageOneURLs: [],
        imageTwoURLs: [],
        imageOneVernacular: null,
        imageTwoVernacular: null,
        randomized: false
    },
    preloadedTaxonImageCollection: null,
    currentTaxonImageCollection: null,
    taxonImageOne: null,
    taxonImageTwo: null,
    taxonLeftName: null,
    taxonRightName: null
};

// Function to update game state
export function updateGameState(newState) {
    Object.assign(gameState, newState);
}
