import dialogManager from './dialogManager.js';
import { createClickableWorldMap, getContinentAbbreviation, getFullContinentName } from './worldMap.js';
import { gameState, updateGameState } from './state.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import ui from './ui.js';
import api from './api.js';

const rangeSelector = {
    selectedContinents: new Set(),

    initializeWorldMap() {
        const container = document.getElementById('range-map-container');
        if (!container) {
            console.error('Range map container not found');
            return;
        }
        createClickableWorldMap(container, this.selectedContinents, (continent) => this.toggleContinent(continent));
    },

    toggleContinent(continent) {
        if (this.selectedContinents.has(continent)) {
            this.selectedContinents.delete(continent);
        } else {
            this.selectedContinents.add(continent);
        }
        this.initializeWorldMap(); // Redraw the map to reflect the changes

        // Update the gameState with the new selected ranges
        gameState.selectedRanges = this.getSelectedRanges();
    },

    async updateTaxonList() {
        const selectedAbbreviations = Array.from(this.selectedContinents).map(fullName => getContinentAbbreviation(fullName));

        updateGameState({ selectedRanges: selectedAbbreviations });

        try {
            const taxonSets = await api.taxonomy.fetchTaxonPairs();
            const filters = {
                level: gameState.selectedLevel,
                ranges: selectedAbbreviations,
                tags: gameState.selectedTags
            };

            const filteredPairs = gameLogic.filterTaxonPairs(taxonSets, filters);

            ui.updateTaxonPairList(filteredPairs);
        } catch (error) {
            logger.error("Error updating taxon list:", error);
            ui.updateTaxonPairList([]);
        }
    },

    // Not sure these two should be in public API
    openRangeDialog() {
        dialogManager.openDialog('range-dialog');
        this.initializeWorldMap();
    },

    closeRangeDialog() {
        dialogManager.closeDialog('range-dialog');
        this.updateTaxonList();
        ui.updateFilterSummary();
    },

    // Public API:

    getSelectedRanges() {
        return Array.from(this.selectedContinents).map(fullName => getContinentAbbreviation(fullName));
    },

    setSelectedRanges(ranges) {
        this.selectedContinents = new Set(ranges.map(abbr => getFullContinentName(abbr)));
        this.initializeWorldMap();
        ui.updateFilterSummary();
    },

    initialize() {
        const selectRangeButton = document.getElementById('select-range-button');
        const rangeDialog = document.getElementById('range-dialog');
        const doneButton = document.getElementById('range-done-button');

        selectRangeButton.addEventListener('click', () => this.openRangeDialog());
        doneButton.addEventListener('click', () => this.closeRangeDialog());

        // Close button functionality
        const closeButton = rangeDialog.querySelector('.dialog-close-button');
        closeButton.addEventListener('click', () => this.closeRangeDialog());
    },
};

export default rangeSelector;
