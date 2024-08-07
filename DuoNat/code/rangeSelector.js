import dialogManager from './dialogManager.js';
import { createClickableWorldMap } from './worldMap.js';
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
        createClickableWorldMap(container, this.selectedContinents, (continent) => this.toggleContinent(continent));
    },

    closeRangeDialog() {
        dialogManager.closeDialog('range-dialog');
//        logger.debug(`closing with active continents: ${[...this.selectedContinents]}`);
        this.updateTaxonList();
    },

    getSelectedRanges() {
        return Array.from(this.selectedContinents).map(fullName => this.continentMap[fullName]);
    },

    setSelectedRanges(ranges) {
        this.selectedContinents = new Set(
            ranges.map(abbr => Object.keys(this.continentMap).find(key => this.continentMap[key] === abbr))
        );
        this.initializeWorldMap(); // Redraw the map to reflect the changes
    },

    toggleContinent(continent) {
        if (this.selectedContinents.has(continent)) {
            this.selectedContinents.delete(continent);
        } else {
            this.selectedContinents.add(continent);
        }
        this.initializeWorldMap(); // Redraw the map to reflect the changes
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
            
            ui.updateTaxonPairList(filteredPairs);
        } catch (error) {
            logger.error("Error updating taxon list:", error);
            ui.updateTaxonPairList([]);
        }
    }

};

export default rangeSelector;
