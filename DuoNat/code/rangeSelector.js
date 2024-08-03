import dialogManager from './dialogManager.js';
import { createClickableWorldMap } from './worldMap.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';
import ui from './ui.js';

const rangeSelector = {
    selectedContinents: new Set(),
    
    initialize() {
        const selectRangeButton = document.getElementById('select-range-button');
        const rangeDialog = document.getElementById('range-dialog');
        const doneButton = document.getElementById('range-done-button');
     //   const clearAllRangesButton = document.getElementById('clear-all-ranges');

        selectRangeButton.addEventListener('click', () => this.openRangeDialog());
        doneButton.addEventListener('click', () => this.closeRangeDialog());
    //    clearAllRangesButton.addEventListener('click', () => this.clearAllRanges());

        // Close button functionality
        const closeButton = rangeDialog.querySelector('.dialog-close-button');
        closeButton.addEventListener('click', () => this.closeRangeDialog());
    },

    openRangeDialog() {
        dialogManager.openDialog('range-dialog');
        this.initializeWorldMap();
   //     this.updateActiveRanges();
    },

    initializeWorldMap() {
        const container = document.getElementById('range-map-container');
        createClickableWorldMap(container, this.selectedContinents, (continent) => this.toggleContinent(continent));
    },

    closeRangeDialog() {
        dialogManager.closeDialog('range-dialog');
        logger.debug(`closing with active continents: ${[...this.selectedContinents]}`);
    //    this.updateTaxonList();
    },

    toggleContinent(continent) {
        if (this.selectedContinents.has(continent)) {
            this.selectedContinents.delete(continent);
        } else {
            this.selectedContinents.add(continent);
        }
  //      this.updateActiveRanges();
    },
/*
    updateActiveRanges() {
        const activeRangesContainer = document.getElementById('active-ranges');
        activeRangesContainer.innerHTML = '';

        this.selectedContinents.forEach(continent => {
            const rangeElement = document.createElement('span');
            rangeElement.className = 'active-range';
            rangeElement.textContent = continent;
            activeRangesContainer.appendChild(rangeElement);
        });

        // Show or hide the container based on whether there are active ranges
        const container = document.getElementById('active-ranges-container');
        container.style.display = this.selectedContinents.size > 0 ? 'flex' : 'none';
    },

    clearAllRanges() {
        this.selectedContinents.clear();
        this.updateActiveRanges();
        this.initializeWorldMap(); // Redraw the map with cleared selections
        this.updateTaxonList();
    },
*/
    updateTaxonList() {
        // Integrate with the existing filtering system
        updateGameState({ selectedRanges: Array.from(this.selectedContinents) });
        ui.updateTaxonPairList(); // Assume this function exists and handles filtering based on gameState
    }
};

export default rangeSelector;
