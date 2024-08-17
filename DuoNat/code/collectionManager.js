import api from './api.js';
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

    async updateTaxonList() {
        const selectedTags = state.getSelectedTags();
        const selectedLevel = state.getSelectedLevel();
        const selectedRanges = state.getSelectedRanges();
        const searchTerm = state.getSearchTerm();

        try {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filters = {
                level: selectedLevel,
                ranges: selectedRanges,
                tags: selectedTags,
                searchTerm: searchTerm
            };
            const filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);
            ui.updateTaxonPairList(filteredPairs);
            ui.updateFilterSummary();
        } catch (error) {
            logger.error("Error in updateTaxonList:", error);
        }
    },

    /*openCollectionManagerDialog() {
        dialogManager.openDialog('select-set-dialog');
        this.updateCollectionManager();
        mainEventHandler.resetSearch();
        mainEventHandler.resetScrollPosition();
    },*/

    openCollectionManagerDialog() {
        dialogManager.openDialog('select-set-dialog');
        this.updateTaxonList();
        mainEventHandler.resetSearch();
        mainEventHandler.resetScrollPosition();
    },

    updateCollectionManager() {
        this.updateTaxonList();
        ui.updateFilterSummary();
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

        this.updateFilteredList(); // Add this line
    },


    handleSelectSetDone() {
        this.updateTaxonList();
        setManager.refreshSubset();
        dialogManager.closeDialog('select-set-dialog');

        setTimeout(() => {
            gameSetup.setupGame(true);
        }, 100);
    },

    /*handleSelectSetDone() {
        const levelDropdown = document.getElementById('level-filter-dropdown');
        const selectedLevel = levelDropdown ? levelDropdown.value : '';
        const searchTerm = state.getSearchTerm();

        gameLogic.applyFilters({
            level: selectedLevel,
            ranges: state.getSelectedRanges(),
            tags: state.getSelectedTags(),
            searchTerm: searchTerm
        });

        setManager.refreshSubset();

        dialogManager.closeDialog('select-set-dialog');

        setTimeout(() => {
            gameSetup.setupGame(true);
        }, 100);
    },*/

    updateFilteredList() {
        const filteredSets = gameLogic.getFilteredTaxonSets();
        ui.updateTaxonSetList(filteredSets);
        ui.updateFilterSummary();
    },

    async onFiltersChanged() {
        try {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filters = {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: state.getSelectedTags(),
                searchTerm: state.getSearchTerm()
            };
            const filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);
            ui.updateTaxonPairList(filteredPairs);
        } catch (error) {
            logger.error("Error in onFiltersChanged:", error);
        }
    },

};

export default collectionManager;
