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

// Game State enum
export const GameState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  READY: 'READY',
  PLAYING: 'PLAYING',
  CHECKING: 'CHECKING',
  PRELOADING: 'PRELOADING',
  PRELOADING_BACKGROUND: 'PRELOADING_BACKGROUND'
};

export const gameState = {
  preloadState: {
    currentRound: {
      taxon1: null,
      taxon2: null
    },
    nextRound: {
      taxon1: null,
      taxon2: null
    },
    nextPair: {
      taxon1: null,
      taxon2: null
    },
  },
  selectedTags: [],
  selectedLevel: '',
  selectedRanges: [],

  // check which of these still used:
  isFirstLoad: true,
  isInitialLoad: true,
  isPreloading: false,
  preloadedPair: null,
  currentSession: 1,
  /*   currentRound: 1, */
  roundPreload: null,
  pairPreload: null,

  currentRound: {
    pair: null,
    imageOneURLs: [],
    imageTwoURLs: [],
    imageOneVernacular: null,
    imageTwoVernacular: null,
    randomized: false
  },

    usedImages: {
        taxon1: new Set(),
        taxon2: new Set()
    },

  preloadedTaxonImageCollection: null,
  currentTaxonImageCollection: null,
  taxonImageOne: null,
  taxonImageTwo: null,
  taxonLeftName: null,
  taxonRightName: null,
  currentState: GameState.IDLE  // track the current game state
};

// Function to update game state
export function updateGameState(newState) {
  Object.assign(gameState, newState);
}
