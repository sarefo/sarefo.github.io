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

        const clearAllTagsButton = document.getElementById('clear-all-tags');
        clearAllTagsButton.addEventListener('click', () => this.clearAllTags());

        // Update active tags when the tag cloud is opened or closed
        this.on('tagCloudOpened', () => this.updateActiveTags());
        this.on('tagCloudClosed', () => this.updateActiveTags());

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
        this.emit('tagCloudOpened');
    },

    closeTagCloud() {
        this.updateTaxonList();
        preloader.preloadNewPairWithTags(gameState.selectedTags, gameState.selectedLevel);
        this.emit('tagCloudClosed');
        dialogManager.closeDialog('tag-cloud-dialog', true);
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
        const taxonPairs = await api.fetchTaxonPairs();
        const filters = {
            level: gameState.selectedLevel,
            ranges: gameState.selectedRanges,
            tags: Array.from(this.selectedTags)
        };
        
        this.filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);
        
        ui.renderTaxonPairList(this.filteredPairs);
        ui.updateActiveCollectionCount(this.filteredPairs.length);
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
        const taxonPairs = await api.fetchTaxonPairs();
        const filters = {
            level: gameState.selectedLevel,
            ranges: gameState.selectedRanges,
            tags: [] // Empty array to ignore tag filtering
        };
        
        const filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);
        
        filteredPairs.forEach(pair => {
            pair.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
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

    updateTagCloud() {
        const tagCounts = this.getTagCounts();
        this.renderTagCloud(tagCounts);
        this.updateMatchingPairsCount();
    },

    renderTagCloud(tagCounts) {
        const container = document.getElementById('tag-cloud-container');
        container.innerHTML = '';
        const maxCount = Math.max(...Object.values(tagCounts));

        Object.entries(tagCounts).forEach(([tag, count]) => {
            const size = 14 + (count / maxCount) * 24; // Font size between 14px and 38px
            const tagElement = document.createElement('span');
            tagElement.textContent = tag;
            tagElement.className = 'tag-cloud-item';
            tagElement.style.fontSize = `${size}px`;
            
            // Apply CSS class for tags with only one occurrence
            if (count === 1) {
                tagElement.classList.add('tag-cloud-item--single');
            }
            
            if (this.selectedTags.has(tag)) {
                tagElement.classList.add('active');
            }
            tagElement.addEventListener('click', () => this.toggleTag(tagElement, tag));
            container.appendChild(tagElement);
        });
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
        this.updateActiveTags();
        this.updateMatchingPairsCount();
    },

    getSelectedTags() {
        return Array.from(this.selectedTags);
    },

    async setSelectedTags(tags) {
        this.selectedTags = new Set(tags);
        updateGameState({ selectedTags: this.getSelectedTags() });
        this.updateActiveTags();
        await this.updateFilteredPairs();
        logger.debug("Setting selected tags");
        // Trigger preloading of a new pair based on the selected tags
        preloader.preloadNewPairWithTags(this.getSelectedTags(), gameState.selectedLevel, gameState.selectedRanges || []);
    },

    async clearAllTags() {
        this.selectedTags.clear();
        updateGameState({ selectedTags: [] });
        this.updateActiveTags();
        await this.updateFilteredPairs();

        // Trigger preloading of a random pair from all available pairs
        preloader.preloadNewPairWithTags([], gameState.selectedLevel, gameState.selectedRanges);

    },

    updateActiveTags() {
        const activeTagsContainer = document.getElementById('active-tags');
        activeTagsContainer.innerHTML = '';

        this.selectedTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'active-tag';
            tagElement.textContent = tag;
            activeTagsContainer.appendChild(tagElement);
        });

        // Show or hide the container based on whether there are active tags
        const container = document.getElementById('active-tags-container');
        container.style.display = this.selectedTags.size > 0 ? 'flex' : 'none';
    },
};

export default tagCloud;
