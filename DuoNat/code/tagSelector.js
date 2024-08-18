import api from './api.js';
import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import preloader from './preloader.js';
import state from './state.js';
import ui from './ui.js';
import logger from './logger.js';

const tagSelector = {
    selectedTags: new Set(),
    eventListeners: {},
    filteredPairs: [],

    initialization: {

        async initialize() {
            const tagSelectorDialog = document.getElementById('tag-cloud-dialog');

            const selectTagsButton = document.getElementById('select-tags-button');
            selectTagsButton.addEventListener('click', () => tagSelector.openTagSelector());

            const doneButton = document.getElementById('tag-cloud-done-button');
            doneButton.addEventListener('click', () => tagSelector.closeTagSelector());

            // Close button functionality
            const closeButton = tagSelectorDialog.querySelector('.dialog-close-button');
            closeButton.addEventListener('click', () => tagSelector.closeTagSelector());

            // TODO not sure this should be in tagSelector.js
            const clearAllFiltersButton = document.getElementById('clear-all-filters');
            clearAllFiltersButton.addEventListener('click', () => filtering.clearAllFilters());

            const levelDropdown = document.getElementById('level-filter-dropdown');
            levelDropdown.addEventListener('change', () => collectionManager.updateTaxonList());

            // Initialize filteredPairs
            await tagSelector.dataManager.updateFilteredPairs();
        },

        on(eventName, callback) {
            if (!this.eventListeners[eventName]) {
                this.eventListeners[eventName] = [];
            }
            this.eventListeners[eventName].push(callback);
        },

        emit(eventName, data) {
            if (this.eventListeners[eventName]) {
                this.eventListeners[eventName].forEach(callback => callback(data));
            }
        },

    },

    tagSelection: {

        async toggleTag(element, tag) {
            element.classList.toggle('active');
            if (tagSelector.selectedTags.has(tag)) {
                tagSelector.selectedTags.delete(tag);
            } else {
                tagSelector.selectedTags.add(tag);
            }
            const newSelectedTags = Array.from(tagSelector.selectedTags);
            state.updateGameStateMultiple({ selectedTags: newSelectedTags });
            await tagSelector.dataManager.updateFilteredPairs();
            collectionManager.updateFilterSummary();
            tagSelector.uiManager.updateMatchingPairsCount();
            
            tagSelector.updateTagCloud();
        },

        getSelectedTags() {
            return Array.from(tagSelector.selectedTags);
        },

        async setSelectedTags(tags) {
            tagSelector.selectedTags = new Set(tags);
            state.updateGameStateMultiple({ selectedTags: tagSelector.tagSelection.getSelectedTags() });
            collectionManager.updateFilterSummary();
            await tagSelector.dataManager.updateFilteredPairs();
//            logger.debug("Setting selected tags");
            // Trigger preloading of a new pair based on the selected tags
            preloader.pairPreloader.preloadNewPairWithTags(tagSelector.tagSelection.getSelectedTags(), state.getSelectedLevel(), state.getSelectedRanges() || []);
        },

        async clearAllTags() {
            tagSelector.selectedTags.clear();
            state.updateGameStateMultiple({ selectedTags: [] });
            collectionManager.updateFilterSummary();
            await tagSelector.dataManager.updateFilteredPairs();

            // Trigger preloading of a random pair from all available pairs
            preloader.pairPreloader.preloadNewPairWithTags([], state.getSelectedLevel(), state.getSelectedRanges());

        },

    },

    uiManager: {

        async renderTagCloud(tagCounts) {
            const container = document.getElementById('tag-cloud-container');
            container.innerHTML = '';
            const maxCount = Math.max(...Object.values(tagCounts));

            // Add currently selected tags first
            tagSelector.selectedTags.forEach(tag => {
                const tagElement = this.createTagElement(tag, maxCount, true);
                container.appendChild(tagElement);
            });

            // Add other available tags
            Object.entries(tagCounts).forEach(([tag, count]) => {
                const tagElement = this.createTagElement(tag, count, false, maxCount);
                container.appendChild(tagElement);
            });
        },

        createTagElement(tag, count, isSelected, maxCount) {
            const size = 14 + (count / maxCount) * 24;
            const tagElement = document.createElement('span');
            tagElement.textContent = tag;
            tagElement.className = 'tag-cloud-item';
            tagElement.style.fontSize = `${size}px`;
            
            if (count === 1) {
                tagElement.classList.add('tag-cloud-item--single');
            }

            if (isSelected) {
                tagElement.classList.add('active');
            }

            tagElement.addEventListener('click', () => tagSelector.tagSelection.toggleTag(tagElement, tag));

            return tagElement;
        },

        updateMatchingPairsCount() {
            const countElement = document.getElementById('matching-pairs-count');
            if (countElement) {
                countElement.textContent = `Matching pairs: ${tagSelector.filteredPairs.length}`;
            }
        },
    },

    dataManager: {

        async getTagCounts() {
            const tagCounts = {};
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filters = {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: Array.from(tagSelector.selectedTags) // Use the currently selected tags
            };

            const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);

            filteredPairs.forEach(pair => {
                pair.tags.forEach(tag => {
                    if (!tagSelector.selectedTags.has(tag)) { // Only count tags that are not already selected
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    }
                });
            });
            return tagCounts;
        },

        async updateFilteredPairs() {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            const filters = {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: Array.from(tagSelector.selectedTags),
                searchTerm: state.getSearchTerm()
            };

            tagSelector.filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);

            await collectionManager.renderTaxonPairList(tagSelector.filteredPairs);
            collectionManager.updateActiveCollectionCount(tagSelector.filteredPairs.length);
            tagSelector.uiManager.updateMatchingPairsCount();
        },

        filterPairsByLevel(taxonPairs, selectedLevel) {
            return taxonPairs.filter(pair => selectedLevel === '' || pair.level === selectedLevel);
        },

        filterPairsByTags(pairs, selectedTags) {
            return pairs.filter(pair =>
                selectedTags.length === 0 || pair.tags.some(tag => selectedTags.includes(tag))
            );
        },

        filterPairsByRanges(pairs, selectedRanges) {
            return pairs.filter(pair =>
                selectedRanges.length === 0 || pair.range.some(range => selectedRanges.includes(range))
            );
        },

    },

    // Functions that don't fit neatly into the above categories can remain at the top level
    async openTagSelector() {
        const tagCounts = await this.dataManager.getTagCounts();
        this.uiManager.renderTagCloud(tagCounts);
        this.uiManager.updateMatchingPairsCount();
        dialogManager.openDialog('tag-cloud-dialog');
    },

    async updateTagCloud() {
        const tagCounts = await this.dataManager.getTagCounts();
        this.uiManager.renderTagCloud(tagCounts);
        this.uiManager.updateMatchingPairsCount();
    },

    closeTagSelector() {
        collectionManager.updateTaxonList();
        dialogManager.closeDialog('tag-cloud-dialog', true);
    },

  /*closeTagSelector() {
        tagSelector.updateTaxonList();
        preloader.pairPreloader.preloadNewPairWithTags(state.getSelectedTags(), state.getSelectedLevel());
        dialogManager.closeDialog('tag-cloud-dialog', true);
        collectionManager.updateFilterSummary();
    },*/
};

const publicAPI = {
    initialize: tagSelector.initialization.initialize,
    closeTagSelector: tagSelector.closeTagSelector,
    setSelectedTags: tagSelector.tagSelection.setSelectedTags,
    clearAllTags: tagSelector.tagSelection.clearAllTags,
};

export default publicAPI;
