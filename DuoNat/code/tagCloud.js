import api from './api.js';
import dialogManager from './dialogManager.js';
import gameLogic from './gameLogic.js';
import preloader from './preloader.js';
import state from './state.js';
import ui from './ui.js';
import logger from './logger.js';

const tagCloud = {
    selectedTags: new Set(),
    eventListeners: {},
    filteredPairs: [],

    initialization: {

        async initialize() {
            const tagCloudDialog = document.getElementById('tag-cloud-dialog');

            const selectTagsButton = document.getElementById('select-tags-button');
            selectTagsButton.addEventListener('click', () => tagCloud.openTagCloud());

            const doneButton = document.getElementById('tag-cloud-done-button');
            doneButton.addEventListener('click', () => tagCloud.closeTagCloud());

            // Close button functionality
            const closeButton = tagCloudDialog.querySelector('.dialog-close-button');
            closeButton.addEventListener('click', () => tagCloud.closeTagCloud());

            // TODO not sure this should be in tagCloud.js
            const clearAllFiltersButton = document.getElementById('clear-all-filters');
            clearAllFiltersButton.addEventListener('click', () => dialogManager.clearAllFilters());

            const levelDropdown = document.getElementById('level-filter-dropdown');
            levelDropdown.addEventListener('change', () => tagCloud.updateTaxonList());

            // Initialize filteredPairs
            await tagCloud.dataManager.updateFilteredPairs();
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
            if (tagCloud.selectedTags.has(tag)) {
                tagCloud.selectedTags.delete(tag);
            } else {
                tagCloud.selectedTags.add(tag);
            }
            const newSelectedTags = Array.from(tagCloud.selectedTags);
            state.updateGameStateMultiple({ selectedTags: newSelectedTags });
            await tagCloud.dataManager.updateFilteredPairs();
            ui.updateFilterSummary();
            tagCloud.uiManager.updateMatchingPairsCount();
            
            tagCloud.updateTagCloud();
        },

        getSelectedTags() {
            return Array.from(tagCloud.selectedTags);
        },

        async setSelectedTags(tags) {
            tagCloud.selectedTags = new Set(tags);
            state.updateGameStateMultiple({ selectedTags: tagCloud.tagSelection.getSelectedTags() });
            ui.updateFilterSummary();
            await tagCloud.dataManager.updateFilteredPairs();
            logger.debug("Setting selected tags");
            // Trigger preloading of a new pair based on the selected tags
            preloader.pairPreloader.preloadNewPairWithTags(tagCloud.tagSelection.getSelectedTags(), state.getSelectedLevel(), state.getSelectedRanges() || []);
        },

        async clearAllTags() {
            tagCloud.selectedTags.clear();
            state.updateGameStateMultiple({ selectedTags: [] });
            ui.updateFilterSummary();
            await tagCloud.dataManager.updateFilteredPairs();

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
            tagCloud.selectedTags.forEach(tag => {
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
            
            // Prevent text selection
     //       tagElement.style.userSelect = 'none';
     //       tagElement.style.webkitUserSelect = 'none';
     //       tagElement.style.msUserSelect = 'none';

            if (count === 1) {
                tagElement.classList.add('tag-cloud-item--single');
            }

            if (isSelected) {
                tagElement.classList.add('active');
            }

            tagElement.addEventListener('click', () => tagCloud.tagSelection.toggleTag(tagElement, tag));

            return tagElement;
        },

        updateMatchingPairsCount() {
            const countElement = document.getElementById('matching-pairs-count');
            if (countElement) {
                countElement.textContent = `Matching pairs: ${tagCloud.filteredPairs.length}`;
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
                tags: Array.from(tagCloud.selectedTags) // Use the currently selected tags
            };

            const filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);

            filteredPairs.forEach(pair => {
                pair.tags.forEach(tag => {
                    if (!tagCloud.selectedTags.has(tag)) { // Only count tags that are not already selected
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
                tags: Array.from(tagCloud.selectedTags)
            };

            tagCloud.filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);

            await ui.renderTaxonPairList(tagCloud.filteredPairs);
            ui.updateActiveCollectionCount(tagCloud.filteredPairs.length);
            tagCloud.uiManager.updateMatchingPairsCount();
        },

        filterTaxonPairs(taxonPairs, selectedTags, selectedLevel, selectedRanges) {
            return taxonPairs.filter(pair => {
                const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;
                const matchesTags = selectedTags.length === 0 || pair.tags.some(tag => selectedTags.includes(tag));
                const matchesRanges = selectedRanges.length === 0 ||
                    (pair.range && pair.range.some(range => selectedRanges.includes(range)));
                return matchesLevel && matchesTags && matchesRanges;
            });
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
    async openTagCloud() {
        const tagCounts = await this.dataManager.getTagCounts();
        this.uiManager.renderTagCloud(tagCounts);
        this.uiManager.updateMatchingPairsCount();
        dialogManager.openDialog('tag-cloud-dialog');
    },

    async updateTaxonList() {
        const selectedTags = this.tagSelection.getSelectedTags();
        const selectedLevel = document.getElementById('level-filter-dropdown').value;

        // Update gameState
        state.updateGameStateMultiple({
            selectedTags: selectedTags,
            selectedLevel: selectedLevel
        });

        await this.dataManager.updateFilteredPairs();
    },

    async updateTagCloud() {
        const tagCounts = await this.dataManager.getTagCounts();
        this.uiManager.renderTagCloud(tagCounts);
        this.uiManager.updateMatchingPairsCount();
    },

    closeTagCloud() {
        this.updateTaxonList();
        preloader.pairPreloader.preloadNewPairWithTags(state.getSelectedTags(), state.getSelectedLevel());
        dialogManager.closeDialog('tag-cloud-dialog', true);
        ui.updateFilterSummary();
    },
};

const publicAPI = {
    initialize: tagCloud.initialization.initialize,
    closeTagCloud: tagCloud.closeTagCloud,
    setSelectedTags: tagCloud.tagSelection.setSelectedTags,
    clearAllTags: tagCloud.tagSelection.clearAllTags,
};

export default publicAPI;
