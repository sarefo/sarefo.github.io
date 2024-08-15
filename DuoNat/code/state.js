// DOM elements
const elements = {
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
const GameState = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  READY: 'READY',
  PLAYING: 'PLAYING',
  CHECKING: 'CHECKING',
  PRELOADING: 'PRELOADING',
  PRELOADING_BACKGROUND: 'PRELOADING_BACKGROUND'
};

let gameState = {
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

  currentSetID: null,

  preloadedTaxonImageCollection: null,
  currentTaxonImageCollection: null,
  taxonImageOne: null,
  taxonImageTwo: null,
  taxonLeftName: null,
  taxonRightName: null,
  currentState: GameState.IDLE  // track the current game state
};

// Private functions
function updateGameState(newState) {
  Object.assign(gameState, newState);
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

  getAllElements: () => ({...elements}),

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

  // Game State
  getGameState: () => ({ ...gameState }),
  setGameState: (newState) => updateGameState(newState),
  
  // Game State enum
  GameState: { ...GameState },
  
  // Elements
  getElement: (elementName) => elements[elementName],
  
  // Specific state getters and setters
  getCurrentState: () => gameState.currentState,
  setCurrentState: (state) => {
    if (GameState.hasOwnProperty(state)) {
      gameState.currentState = GameState[state];
    } else {
      console.error(`Invalid game state: ${state}`);
    }
  },

  getCurrentSetID: () => gameState.currentSetID,
  setCurrentSetID: (id) => {
    gameState.currentSetID = id;
  }, 

  getSelectedTags: () => [...gameState.selectedTags],
  setSelectedTags: (tags) => {
    if (Array.isArray(tags)) {
      gameState.selectedTags = [...tags];
    } else {
      console.error('Selected tags must be an array');
    }
  },
  
  getSelectedLevel: () => gameState.selectedLevel,
  setSelectedLevel: (level) => {
    if (typeof level === 'string') {
      gameState.selectedLevel = level;
    } else {
      console.error('Selected level must be a string');
    }
  },
  
  getSelectedRanges: () => [...gameState.selectedRanges],
  setSelectedRanges: (ranges) => {
    if (Array.isArray(ranges)) {
      gameState.selectedRanges = [...ranges];
    } else {
      console.error('Selected ranges must be an array');
    }
  },
  
  getCurrentRound: () => ({ ...gameState.currentRound }),
  setCurrentRound: (round) => {
    if (typeof round === 'object' && round !== null) {
      gameState.currentRound = { ...round };
    } else {
      console.error('Current round must be an object');
    }
  },
  
  getCurrentTaxonImageCollection: () => gameState.currentTaxonImageCollection ? { ...gameState.currentTaxonImageCollection } : null,
  setCurrentTaxonImageCollection: (collection) => {
    if (typeof collection === 'object' && collection !== null) {
      gameState.currentTaxonImageCollection = { ...collection };
    } else {
      console.error('Current taxon image collection must be an object');
    }
  },

  getTaxonImageOne: () => gameState.taxonImageOne,
  setTaxonImageOne: (taxon) => {
    gameState.taxonImageOne = taxon;
  },

  getTaxonImageTwo: () => gameState.taxonImageTwo,
  setTaxonImageTwo: (taxon) => {
    gameState.taxonImageTwo = taxon;
  },

  getTaxonLeftName: () => gameState.taxonLeftName,
  setTaxonLeftName: (name) => {
    gameState.taxonLeftName = name;
  },

  getTaxonRightName: () => gameState.taxonRightName,
  setTaxonRightName: (name) => {
    gameState.taxonRightName = name;
  },

  getIsFirstLoad: () => gameState.isFirstLoad,
  setIsFirstLoad: (value) => {
    if (typeof value === 'boolean') {
      gameState.isFirstLoad = value;
    } else {
      console.error('isFirstLoad must be a boolean');
    }
  },

  getIsInitialLoad: () => gameState.isInitialLoad,
  setIsInitialLoad: (value) => {
    if (typeof value === 'boolean') {
      gameState.isInitialLoad = value;
    } else {
      console.error('isInitialLoad must be a boolean');
    }
  },

  getCurrentSetID: () => gameState.currentSetID,
  setCurrentSetID: (id) => {
    gameState.currentSetID = id;
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
    gameState.usedImages = { taxon1: new Set(), taxon2: new Set() };
  },

  updateGameStateMultiple: (updates) => {
    Object.entries(updates).forEach(([key, value]) => {
      if (gameState.hasOwnProperty(key)) {
        gameState[key] = value;
      } else {
        console.warn(`Attempted to update non-existent gameState property: ${key}`);
      }
    });
  },

  // Utility method to get game state info for reporting
  getGameStateInfo: () => {
    let info = '';
    if (gameState.currentTaxonImageCollection && gameState.currentTaxonImageCollection.pair) {
      const pair = gameState.currentTaxonImageCollection.pair;
      info += `Current Set ID: ${pair.setID}\n`;
      info += `Taxon 1: ${pair.taxon1}\n`;
      info += `Taxon 2: ${pair.taxon2}\n`;
    }
    info += `Selected Level: ${gameState.selectedLevel}\n`;
    info += `Selected Ranges: ${gameState.selectedRanges.join(', ')}\n`;
    info += `Selected Tags: ${gameState.selectedTags.join(', ')}\n`;
    return info;
  },

  // Add more getters and setters as needed for other state properties
};

export default publicAPI;
