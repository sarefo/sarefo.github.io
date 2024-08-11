import dialogManager from './dialogManager.js';
import { createClickableWorldMap, getContinentAbbreviation, getFullContinentName } from './worldMap.js';
import { gameState, updateGameState } from './state.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import ui from './ui.js';
import api from './api.js';

const rangeSelector = {
    selectedContinents: new Set(),

    // Mapping between full names and abbreviations
    continentMap: {
        'North America': 'NA',
        'South America': 'SA',
        'Europe': 'EU',
        'Africa': 'AF',
        'Asia': 'AS',
        'Oceania': 'OC'
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

    openRangeDialog() {
        dialogManager.openDialog('range-dialog');
        this.initializeWorldMap();
    },

    initializeWorldMap() {
        const container = document.getElementById('range-map-container');
        if (!container) {
            console.error('Range map container not found');
            return;
        }
        createClickableWorldMap(container, this.selectedContinents, (continent) => this.toggleContinent(continent));
    },

    closeRangeDialog() {
        dialogManager.closeDialog('range-dialog');
        this.updateTaxonList();
        ui.taxonPairList.updateFilterSummary();
    },

    getSelectedRanges() {
        return Array.from(this.selectedContinents).map(fullName => getContinentAbbreviation(fullName));
    },

    setSelectedRanges(ranges) {
        this.selectedContinents = new Set(ranges.map(abbr => getFullContinentName(abbr)));
        this.initializeWorldMap();
        ui.taxonPairList.updateFilterSummary();
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
        const selectedAbbreviations = Array.from(this.selectedContinents).map(fullName => this.continentMap[fullName]);

        updateGameState({ selectedRanges: selectedAbbreviations });

        try {
            const taxonSets = await api.fetchTaxonPairs();
            const filters = {
                level: gameState.selectedLevel,
                ranges: selectedAbbreviations,
                tags: gameState.selectedTags
            };

            const filteredPairs = gameLogic.filterTaxonPairs(taxonSets, filters);

            ui.taxonPairList.updateTaxonPairList(filteredPairs);
        } catch (error) {
            logger.error("Error updating taxon list:", error);
            ui.taxonPairList.updateTaxonPairList([]);
        }
    }

};

export default rangeSelector;
