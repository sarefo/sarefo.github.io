import dialogManager from './dialogManager.js';
import { createClickableWorldMap } from './worldMap.js';
import { gameState, updateGameState } from './state.js';
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
        logger.debug(`closing with active continents: ${[...this.selectedContinents]}`);
        this.updateTaxonList();
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
        // Convert full names to abbreviations
        const selectedAbbreviations = Array.from(this.selectedContinents).map(fullName => this.continentMap[fullName]);
        
        logger.debug(`Selected abbreviations: ${selectedAbbreviations}`);
        
        updateGameState({ selectedRanges: selectedAbbreviations });
        
        try {
            const taxonSets = await api.fetchTaxonPairs();
            logger.debug(`Total taxon pairs: ${taxonSets.length}`);
            
            // Fetch the original taxon sets data
            const response = await fetch('./data/taxonSets.json');
            const originalTaxonSets = await response.json();
            
            const filteredPairs = taxonSets.filter(pair => {
                // Find the corresponding original set
                const originalSet = originalTaxonSets.find(set => set.setID === pair.setID);
                if (!originalSet || !originalSet.range) {
                    logger.debug(`Set without range: ${pair.setName}`);
                    return false;
                }
                const matches = selectedAbbreviations.length === 0 || 
                    originalSet.range.some(range => selectedAbbreviations.includes(range));
                if (matches) {
                    logger.debug(`Matched set: ${pair.setName}, Range: ${originalSet.range}`);
                } else {
                    logger.debug(`Unmatched set: ${pair.setName}, Range: ${originalSet.range}`);
                }
                return matches;
            });
            
            logger.debug(`Filtered pairs: ${filteredPairs.length}`);
            ui.updateTaxonPairList(filteredPairs);
        } catch (error) {
            logger.error("Error updating taxon list:", error);
            ui.updateTaxonPairList([]);
        }
    }

};

export default rangeSelector;
