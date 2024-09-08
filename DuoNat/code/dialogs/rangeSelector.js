import api from '../api.js';
import logger from '../logger.js';
import state from '../state.js';
import ui from '../ui.js';

import filtering from '../filtering.js';
import gameLogic from '../gameLogic.js';
import worldMap from '../worldMap.js';

import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';

const rangeSelector = {
    selectedContinents: new Set(),

    initializeWorldMap() {
        const container = document.getElementById('range-map-container');
        if (!container) {
            console.error('Range map container not found');
            return;
        }
        worldMap.createClickableWorldMap(container, this.selectedContinents, (continent) => this.toggleContinent(continent));
    },

    toggleContinent(continent) {
        if (this.selectedContinents.has(continent)) {
            this.selectedContinents.delete(continent);
        } else {
            this.selectedContinents.add(continent);
        }
        this.initializeWorldMap(); // Redraw the map to reflect the changes

        // Update the gameState with the new selected ranges
        state.setSelectedRanges(this.getSelectedRanges());
    },

    closeRangeDialog() {
        dialogManager.closeDialog('range-dialog');
        collectionManager.updateTaxonList();
        collectionManager.updateFilterSummary();
    },

    getSelectedRanges() {
        return Array.from(this.selectedContinents).map(fullName => worldMap.getContinentAbbreviation(fullName));
    },

    setSelectedRanges(ranges) {
        this.selectedContinents = new Set(ranges.map(abbr => worldMap.getFullContinentName(abbr)));
        this.initializeWorldMap();
        collectionManager.updateFilterSummary();
    },

    openRangeDialog() {
        dialogManager.openDialog('range-dialog');
        // We'll initialize the world map here, keeping this logic within rangeSelector
        this.initializeWorldMap();
    },

    initialize() {
        //const selectRangeButton = document.getElementById('select-range-button');
        const rangeDialog = document.getElementById('range-dialog');
        const doneButton = document.getElementById('range-done-button');

        //selectRangeButton.addEventListener('click', () => this.openRangeDialog());
        doneButton.addEventListener('click', () => this.closeRangeDialog());

        // Close button functionality
        const closeButton = rangeDialog.querySelector('.dialog-close-button');
        closeButton.addEventListener('click', () => this.closeRangeDialog());

        // Initialize the selected continents from the game state
        this.syncWithGameState();
    },

    syncWithGameState() {
        const selectedRanges = state.getSelectedRanges();
        this.selectedContinents = new Set(selectedRanges.map(abbr => worldMap.getFullContinentName(abbr)));
        this.initializeWorldMap();
    },

};

// Bind all methods in rangeSelector and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(rangeSelector);

const publicAPI = {
    initialize: rangeSelector.initialize,
    getSelectedRanges: rangeSelector.getSelectedRanges,
    setSelectedRanges: rangeSelector.setSelectedRanges,
    openRangeDialog: rangeSelector.openRangeDialog,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(rangeSelector);
    }
});

export default publicAPI;
