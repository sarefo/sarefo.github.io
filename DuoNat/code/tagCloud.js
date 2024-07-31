import dialogManager from './dialogManager.js';
import api from './api.js';

const tagCloud = {
    selectedTags: new Set(),

    async initialize() {
        const selectTagsButton = document.getElementById('select-tags-button');
        const tagCloudDialog = document.getElementById('tag-cloud-dialog');
        const doneButton = document.getElementById('tag-cloud-done-button');

        selectTagsButton.addEventListener('click', () => this.openTagCloud());
        doneButton.addEventListener('click', () => this.closeTagCloud());

        // Close button functionality
        const closeButton = tagCloudDialog.querySelector('.dialog-close-button');
        closeButton.addEventListener('click', () => this.closeTagCloud());
    },                  

    async openTagCloud() {
        const tagCounts = await this.getTagCounts();
        this.renderTagCloud(tagCounts);
        dialogManager.openDialog('tag-cloud-dialog');
    },

    closeTagCloud() {
        dialogManager.closeDialog('tag-cloud-dialog');
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
        if (this.selectedTags.has(tag)) {
            this.selectedTags.delete(tag);
        } else {
            this.selectedTags.add(tag);
        }
        this.updateMatchingPairsCount();
    },

    getSelectedTags() {
        return Array.from(this.selectedTags);
    }
};

export default tagCloud;
