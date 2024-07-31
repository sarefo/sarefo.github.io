import api from './api.js';
import dialogManager from './dialogManager.js';
import { gameState, updateGameState } from './state.js';
import preloader from './preloader.js';
import ui from './ui.js';
import logger from './logger.js';

const tagCloud = {
    selectedTags: new Set(),
    eventListeners: {},

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
        const selectTagsButton = document.getElementById('select-tags-button');
        const tagCloudDialog = document.getElementById('tag-cloud-dialog');
        const doneButton = document.getElementById('tag-cloud-done-button');

        selectTagsButton.addEventListener('click', () => this.openTagCloud());
        doneButton.addEventListener('click', () => this.closeTagCloud());

        // Close button functionality
        const closeButton = tagCloudDialog.querySelector('.dialog-close-button');
        closeButton.addEventListener('click', () => this.closeTagCloud());
    
        const clearAllTagsButton = document.getElementById('clear-all-tags');
        clearAllTagsButton.addEventListener('click', () => this.clearAllTags());
        
        // Update active tags when the tag cloud is opened or closed
        this.on('tagCloudOpened', () => this.updateActiveTags());
        this.on('tagCloudClosed', () => this.updateActiveTags());
    },

    async openTagCloud() {
        const tagCounts = await this.getTagCounts();
        this.renderTagCloud(tagCounts);
        dialogManager.openDialog('tag-cloud-dialog');
        this.emit('tagCloudOpened');
    },

    closeTagCloud() {
        dialogManager.closeDialog('tag-cloud-dialog');
        this.updateTaxonList();
        preloader.preloadNewPairWithTags(gameState.selectedTags);
        this.emit('tagCloudClosed');
    },

    updateTaxonList() {
        const selectedTags = this.getSelectedTags();
        
        api.fetchTaxonPairs().then(taxonPairs => {
            let filteredPairs;
            
            if (selectedTags.length > 0) {
                filteredPairs = taxonPairs.filter(pair => 
                    pair.tags.some(tag => selectedTags.includes(tag))
                );
            } else {
                filteredPairs = taxonPairs; // If no tags selected, show all pairs
            }
            
            logger.debug(`Filtered pairs: ${filteredPairs.length} out of ${taxonPairs.length}`);
            logger.debug(`Selected tags: ${selectedTags.join(', ')}`);
            
            // Update the UI with the filtered pairs
            ui.renderTaxonPairList(filteredPairs);
        });
    },

    async getTagCounts() {
        const taxonPairs = await api.fetchTaxonPairs();
        const tagCounts = {};
        taxonPairs.forEach(pair => {
            pair.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        return tagCounts;
    },

    async updateMatchingPairsCount() {
        const taxonPairs = await api.fetchTaxonPairs();
        const selectedTags = Array.from(this.selectedTags);
        const matchingPairs = taxonPairs.filter(pair => 
            pair.tags.some(tag => selectedTags.includes(tag))
        );
        
        const countElement = document.getElementById('matching-pairs-count');
        if (countElement) {
            countElement.textContent = `Matching pairs: ${matchingPairs.length}`;
        }
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
            if (this.selectedTags.has(tag)) {
                tagElement.classList.add('active');
            }
            tagElement.addEventListener('click', () => this.toggleTag(tagElement, tag));
            container.appendChild(tagElement);
        });
    },

    toggleTag(element, tag) {
        element.classList.toggle('active');
        let newSelectedTags;
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
            newSelectedTags = Array.from(this.selectedTags);
        } else {
            this.selectedTags.add(tag);
            newSelectedTags = Array.from(this.selectedTags);
        }
        updateGameState({ selectedTags: newSelectedTags });
        this.updateMatchingPairsCount();
        this.updateActiveTags();
    },

    getSelectedTags() {
        return Array.from(this.selectedTags);
    },

    setSelectedTags(tags) {
        this.selectedTags = new Set(tags);
        updateGameState({ selectedTags: this.getSelectedTags() });
        this.updateActiveTags();
    },

    clearTags() {
        this.selectedTags.clear();
        updateGameState({ selectedTags: [] });
        this.renderTagCloud(this.getTagCounts());
        this.updateMatchingPairsCount();
    },

    clearAllTags() {
        this.selectedTags.clear();
        updateGameState({ selectedTags: [] });
        this.renderTagCloud(this.getTagCounts());
        this.updateTaxonList();
        this.updateMatchingPairsCount();
        this.updateActiveTags();
        
        // Trigger preloading of a random pair from all available pairs
        preloader.preloadNewPairWithTags([]);  // Pass an empty array to indicate no tag filtering
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
