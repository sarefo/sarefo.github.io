import api from './api.js';
import dialogManager from './dialogManager.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import state from './state.js';
import ui from './ui.js';
import worldMap from './worldMap.js';

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

    async updateTaxonList() {
        const selectedAbbreviations = Array.from(this.selectedContinents).map(fullName => worldMap.getContinentAbbreviation(fullName));

        state.updateGameStateMultiple({ selectedRanges: selectedAbbreviations });

        try {
            const taxonSets = await api.taxonomy.fetchTaxonPairs();
            const filters = {
                level: state.getSelectedLevel(),
                ranges: selectedAbbreviations,
                tags: state.getSelectedTags(),
                searchTerm: state.getSearchTerm()
            };

            const filteredPairs = gameLogic.filterTaxonPairs(taxonSets, filters);

            ui.updateTaxonPairList(filteredPairs);
        } catch (error) {
            logger.error("Error updating taxon list:", error);
            ui.updateTaxonPairList([]);
        }
    },

    closeRangeDialog() {
        dialogManager.closeDialog('range-dialog');
        this.updateTaxonList();
        ui.updateFilterSummary();
    },

    getSelectedRanges() {
        return Array.from(this.selectedContinents).map(fullName => worldMap.getContinentAbbreviation(fullName));
    },

    setSelectedRanges(ranges) {
        this.selectedContinents = new Set(ranges.map(abbr => worldMap.getFullContinentName(abbr)));
        this.initializeWorldMap();
        ui.updateFilterSummary();
    },

    openRangeDialog() {
        dialogManager.openDialog('range-dialog');
        // We'll initialize the world map here, keeping this logic within rangeSelector
        this.initializeWorldMap();
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

const publicAPI = {
    initialize: rangeSelector.initialize.bind(rangeSelector),
    getSelectedRanges: rangeSelector.getSelectedRanges.bind(rangeSelector),
    setSelectedRanges: rangeSelector.setSelectedRanges.bind(rangeSelector),
    openRangeDialog: rangeSelector.openRangeDialog.bind(rangeSelector),
};

export default publicAPI;
