import config from '../config.js';
import state from '../state.js';
import logger from '../logger.js';

import api from '../api.js';
import filtering from '../filtering.js';

import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';

const tagSelector = {
    selectedTags: new Set(),
    eventListeners: {},
    filteredPairs: [],

    initialization: {

        async initialize() {
            const tagSelectorDialog = document.getElementById('tag-dialog');

            const doneButton = document.getElementById('tag-done-button');
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
            //await tagSelector.dataManager.updateFilteredPairs();
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
            //await tagSelector.dataManager.updateFilteredPairs();
            collectionManager.updateFilterSummary();
            await tagSelector.uiManager.updateMatchingPairsCount();

            tagSelector.updateTagCloud();
        },

        getSelectedTags() {
            return Array.from(tagSelector.selectedTags);
        },

        /*async setSelectedTags(tags) {
            tagSelector.selectedTags = new Set(tags);
            state.updateGameStateMultiple({ selectedTags: this.getSelectedTags() });
            collectionManager.updateFilterSummary();
            await tagSelector.dataManager.updateFilteredPairs();
        },*/
    },

    uiManager: {

        calculateTotalPairs(tagCounts) {
            return Object.values(tagCounts).reduce((sum, count) => sum + count, 0);
        },

        renderTagCloud(tagCounts) {
            logger.debug('Rendering tag cloud with counts:', tagCounts);
            const container = document.getElementById('tag-container');
            container.innerHTML = '';
            
            if (Object.keys(tagCounts).length === 0) {
                container.innerHTML = '<p>No tags found for the current selection.</p>';
                return;
            }

            const totalPairs = this.calculateTotalPairs(tagCounts);
            const maxCount = Math.max(...Object.values(tagCounts));

            // Add total pairs count
            /*const totalElement = document.createElement('div');
            totalElement.className = 'total-pairs-count';
            totalElement.textContent = `Total pairs: ${totalPairs}`;
            container.appendChild(totalElement);*/

            // Add currently selected tags first
            tagSelector.selectedTags.forEach(tag => {
                const tagElement = this.createTagElement(tag, tagCounts[tag] || 0, true, maxCount);
                container.appendChild(tagElement);
            });

            // Add other available tags
            Object.entries(tagCounts).forEach(([tag, count]) => {
                if (!tagSelector.selectedTags.has(tag) && tag !== 'untagged') {
                    const tagElement = this.createTagElement(tag, count, false, maxCount);
                    container.appendChild(tagElement);
                }
            });

            // Add untagged count if present
            if (tagCounts.untagged) {
                const untaggedElement = document.createElement('div');
                untaggedElement.className = 'untagged-count';
                untaggedElement.textContent = `Untagged: ${tagCounts.untagged}`;
                container.appendChild(untaggedElement);
            }

            logger.debug('Tag cloud rendered');
        },

        createTagElement(tag, count, isSelected, maxCount) {
            const size = 14 + (count / maxCount) * 24;
            const tagElement = document.createElement('span');
            tagElement.textContent = tag;
            tagElement.className = 'tag-item';
            tagElement.style.fontSize = `${size}px`;

            if (count === 1) {
                tagElement.classList.add('tag-item--single');
            }

            if (isSelected) {
                tagElement.classList.add('active');
            }

            tagElement.addEventListener('click', () => tagSelector.tagSelection.toggleTag(tagElement, tag));

            return tagElement;
        },

        async updateMatchingPairsCount() {
            const countElement = document.getElementById('matching-pairs-count');
            if (countElement) {
                const filters = filtering.getActiveFilters();
                logger.debug('Filters for matching pairs count:', filters);
                const filteredPairs = await filtering.getFilteredTaxonPairs(filters);
                logger.debug('Filtered pairs count:', filteredPairs.length);
                countElement.textContent = `Matching pairs: ${filteredPairs.length}`;
            }
        },
    },

    dataManager: {

        async getTagCounts() {
            if (config.useMongoDB) {
                logger.debug('Using MongoDB for tag counts');
                const filters = filtering.getActiveFilters();
                logger.debug('Filters for tag counts:', filters);
                try {
                    const response = await fetch(`${config.serverUrl}/api/tagCounts?filters=${encodeURIComponent(JSON.stringify(filters))}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const tagCounts = await response.json();
                    logger.debug('Received tag counts from MongoDB:', tagCounts);
                    return tagCounts;
                } catch (error) {
                    logger.error('Error fetching tag counts from MongoDB:', error);
                    return {};
                }
            } else {
                const tagCounts = {};
                const filters = filtering.getActiveFilters();
                const filteredPairs = await filtering.getFilteredTaxonPairs(filters);

                filteredPairs.forEach(pair => {
                    pair.tags.forEach(tag => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                });
                return tagCounts;
            }
        },

        async clearTagsInCloud() {
            tagSelector.selectedTags.clear();
        },

    },

    // Functions that don't fit neatly into the above categories can remain at the top level
    async openTagSelector() {
        logger.debug('Opening tag selector');
        const tagCounts = await this.dataManager.getTagCounts();
        logger.debug('Tag counts:', tagCounts);
        this.uiManager.renderTagCloud(tagCounts);
        await this.uiManager.updateMatchingPairsCount();
        dialogManager.openDialog('tag-dialog');
    },

    async updateTagCloud() {
        const tagCounts = await this.dataManager.getTagCounts();
        this.uiManager.renderTagCloud(tagCounts);
        this.uiManager.updateMatchingPairsCount();
    },

    closeTagSelector() {
        const currentFilters = filtering.getActiveFilters();
        const previousFilters = state.getPreviousFilters();

        logger.debug('Current filters:', currentFilters);
        logger.debug('Previous filters:', previousFilters);

        const filtersChanged = filtering.haveFiltersChanged(currentFilters, previousFilters);
        logger.debug('Filters changed:', filtersChanged);

        if (filtersChanged) {
            logger.debug('Updating taxon list due to filter changes');
            collectionManager.updateTaxonList();
            collectionManager.updateLevelCounts();
            state.setPreviousFilters(currentFilters);
        } else {
            logger.debug('Skipping taxon list update as filters have not changed');
        }

        collectionManager.updateFilterSummary();
        dialogManager.closeDialog('tag-dialog', true);
    },

};

// Bind all methods in nested objects
['initialization', 'tagSelection', 'uiManager', 'dataManager'].forEach(nestedObj => {
    Object.keys(tagSelector[nestedObj]).forEach(key => {
        if (typeof tagSelector[nestedObj][key] === 'function') {
            tagSelector[nestedObj][key] = tagSelector[nestedObj][key].bind(tagSelector[nestedObj]);
        }
    });
});

// Bind top-level methods
['openTagSelector', 'updateTagCloud', 'closeTagSelector'].forEach(method => {
    tagSelector[method] = tagSelector[method].bind(tagSelector);
});

const publicAPI = {
    initialize: tagSelector.initialization.initialize,
    openTagSelector: tagSelector.openTagSelector,
    closeTagSelector: tagSelector.closeTagSelector,
    //setSelectedTags: tagSelector.tagSelection.setSelectedTags,
    //updateFilteredPairs: tagSelector.dataManager.updateFilteredPairs,
    clearTagsInCloud: tagSelector.dataManager.clearTagsInCloud,
};

export default publicAPI;
