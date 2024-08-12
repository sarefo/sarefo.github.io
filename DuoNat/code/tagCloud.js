import api from './api.js';
import dialogManager from './dialogManager.js';
import gameLogic from './gameLogic.js';
import { gameState, updateGameState } from './state.js';
import preloader from './preloader.js';
import ui from './ui.js';
import logger from './logger.js';

const tagCloud = {
    selectedTags: new Set(),
    eventListeners: {},
    filteredPairs: [],

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

    async initialize() {
        const tagCloudDialog = document.getElementById('tag-cloud-dialog');

        const selectTagsButton = document.getElementById('select-tags-button');
        selectTagsButton.addEventListener('click', () => this.openTagCloud());

        const doneButton = document.getElementById('tag-cloud-done-button');
        doneButton.addEventListener('click', () => this.closeTagCloud());

        // Close button functionality
        const closeButton = tagCloudDialog.querySelector('.dialog-close-button');
        closeButton.addEventListener('click', () => this.closeTagCloud());

        // TODO not sure this should be in tagCloud.js
        const clearAllFiltersButton = document.getElementById('clear-all-filters');
        clearAllFiltersButton.addEventListener('click', () => dialogManager.clearAllFilters());

        const levelDropdown = document.getElementById('level-filter-dropdown');
        levelDropdown.addEventListener('change', () => this.updateTaxonList());

        // Initialize filteredPairs
        await this.updateFilteredPairs();
    },

    async openTagCloud() {
        const tagCounts = await this.getTagCounts();
        this.renderTagCloud(tagCounts);
        this.updateMatchingPairsCount();
        dialogManager.openDialog('tag-cloud-dialog');
        // this.emit('tagCloudOpened');
    },

    closeTagCloud() {
        this.updateTaxonList();
        preloader.pairPreloader.preloadNewPairWithTags(gameState.selectedTags, gameState.selectedLevel);
        // this.emit('tagCloudClosed');
        dialogManager.closeDialog('tag-cloud-dialog', true);
        ui.taxonPairList.updateFilterSummary();
    },

    async updateTaxonList() {
        const selectedTags = this.getSelectedTags();
        const selectedLevel = document.getElementById('level-filter-dropdown').value;

        // Update gameState
        updateGameState({
            selectedTags: selectedTags,
            selectedLevel: selectedLevel
        });

        await this.updateFilteredPairs();
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

    async updateFilteredPairs() {
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const filters = {
            level: gameState.selectedLevel,
            ranges: gameState.selectedRanges,
            tags: Array.from(this.selectedTags)
        };

        this.filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);

        await ui.taxonPairList.renderTaxonPairList(this.filteredPairs);
        ui.taxonPairList.updateActiveCollectionCount(this.filteredPairs.length);
        this.updateMatchingPairsCount();
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

    async getTagCounts() {
        const tagCounts = {};
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const filters = {
            level: gameState.selectedLevel,
            ranges: gameState.selectedRanges,
            tags: Array.from(this.selectedTags) // Use the currently selected tags
        };

        const filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);

        filteredPairs.forEach(pair => {
            pair.tags.forEach(tag => {
                if (!this.selectedTags.has(tag)) { // Only count tags that are not already selected
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            });
        });
        return tagCounts;
    },

    updateMatchingPairsCount() {
        const countElement = document.getElementById('matching-pairs-count');
        if (countElement) {
            countElement.textContent = `Matching pairs: ${this.filteredPairs.length}`;
        }
    },

    async updateTagCloud() {
        const tagCounts = await this.getTagCounts();
        this.renderTagCloud(tagCounts);
        this.updateMatchingPairsCount();
    },

    async renderTagCloud(tagCounts) {
        const container = document.getElementById('tag-cloud-container');
        container.innerHTML = '';
        const maxCount = Math.max(...Object.values(tagCounts));

        // Add currently selected tags first
        this.selectedTags.forEach(tag => {
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

        tagElement.addEventListener('click', () => this.toggleTag(tagElement, tag));

        return tagElement;
    },

    async toggleTag(element, tag) {
        element.classList.toggle('active');
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
        } else {
            this.selectedTags.add(tag);
        }
        const newSelectedTags = Array.from(this.selectedTags);
        updateGameState({ selectedTags: newSelectedTags });
        await this.updateFilteredPairs();
        ui.taxonPairList.updateFilterSummary();
        this.updateMatchingPairsCount();
        
        this.updateTagCloud();
    },

    getSelectedTags() {
        return Array.from(this.selectedTags);
    },

    async setSelectedTags(tags) {
        this.selectedTags = new Set(tags);
        updateGameState({ selectedTags: this.getSelectedTags() });
        ui.taxonPairList.updateFilterSummary();
        await this.updateFilteredPairs();
        logger.debug("Setting selected tags");
        // Trigger preloading of a new pair based on the selected tags
        preloader.pairPreloader.preloadNewPairWithTags(this.getSelectedTags(), gameState.selectedLevel, gameState.selectedRanges || []);
    },

    async clearAllTags() {
        this.selectedTags.clear();
        updateGameState({ selectedTags: [] });
        ui.taxonPairList.updateFilterSummary();
        await this.updateFilteredPairs();

        // Trigger preloading of a random pair from all available pairs
        preloader.pairPreloader.preloadNewPairWithTags([], gameState.selectedLevel, gameState.selectedRanges);

    },

};

export default tagCloud;
