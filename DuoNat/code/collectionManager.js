import dialogManager from './dialogManager.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import mainEventHandler from './mainEventHandler.js';
import rangeSelector from './rangeSelector.js';
import setManager from './setManager.js';
import state from './state.js';
import tagCloud from './tagCloud.js';
import ui from './ui.js';

const collectionManager = {
    initialize() {
        this.initializeSelectSetDialog();
        this.initializeFilterSummaryMap();
        this.initializeClearFiltersButton();
        this.initializeSelectSetDoneButton();
    },

    initializeSelectSetDialog() {
        const selectSetButton = document.getElementById('select-set-button');
        selectSetButton.addEventListener('click', () => this.openCollectionManagerDialog());
    },

    initializeFilterSummaryMap() {
        const filterSummaryMap = document.querySelector('.filter-summary__map');
        if (filterSummaryMap) {
            filterSummaryMap.addEventListener('click', () => {
                rangeSelector.openRangeDialog();
            });
        }
    },

    initializeClearFiltersButton() {
        const clearFiltersButton = document.getElementById('clear-all-filters');
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', this.clearAllFilters.bind(this));
        }
    },

    initializeSelectSetDoneButton() {
        const selectSetDoneButton = document.getElementById('select-set-done-button');
        if (selectSetDoneButton) {
            selectSetDoneButton.addEventListener('click', this.handleSelectSetDone.bind(this));
        }
    },

    openCollectionManagerDialog() {
        dialogManager.openDialog('select-set-dialog');
        ui.updateFilterSummary();
        // Reset search and scroll position
         mainEventHandler.resetSearch();
         mainEventHandler.resetScrollPosition();
    },

    setupSelectSetDialog: function() {
        const playButton = document.getElementById('select-set-done-button');
        if (playButton) {
            playButton.addEventListener('click', (event) => {
                event.preventDefault(); // Prevent default button behavior
                collectionManager.handleSelectSetDone();
            });
        } else {
            logger.error('Play button not found in select-set-dialog');
        }
    },
    clearAllFilters() {
        state.setSelectedTags([]);
        state.setSelectedRanges([]);
        state.setSelectedLevel('');
        state.setSearchTerm('');

        const levelDropdown = document.getElementById('level-filter-dropdown');
        if (levelDropdown) {
            levelDropdown.value = '';
        }

        tagCloud.clearAllTags();
        rangeSelector.setSelectedRanges([]);

        mainEventHandler.resetSearch();

        ui.updateTaxonPairList();
        ui.updateFilterSummary();

    },

    handleSelectSetDone() {
        const levelDropdown = document.getElementById('level-filter-dropdown');
        const selectedLevel = levelDropdown ? levelDropdown.value : 'No level dropdown found';
        const searchTerm = state.getSearchTerm();

        gameLogic.applyFilters({
            level: selectedLevel,
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags(),
            searchTerm: searchTerm
        });

        setManager.refreshSubset();

        // Remove this line for now as it might be causing the reload
        // ui.showTaxonPairList();

        dialogManager.closeDialog('select-set-dialog');

        // Add a small delay before setting up the game
        setTimeout(() => {
            gameSetup.setupGame(true);
        }, 100);
    }

};

export default collectionManager;
