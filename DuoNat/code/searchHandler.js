import logger from './logger.js';
import state from './state.js';

import api from './api.js';
import ui from './ui.js';

import filtering from './filtering.js';
import gameLogic from './gameLogic.js';

import collectionManager from './dialogs/collectionManager.js';
import dialogManager from './dialogs/dialogManager.js';

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.vernacular.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName);
}

const searchHandler = {
    hasLostFocus: true,

    initialize() {
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch.bind(this));
            searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
        }

        const clearSearchButton = document.getElementById('clear-search');
        if (clearSearchButton) {
            clearSearchButton.addEventListener('click', this.handleClearSearch.bind(this));
        }
    },

    async handleSearch(event) {
        const searchInput = event.target;
        const searchTerm = searchInput.value.trim();

        this.updateClearButtonVisibility(searchTerm);

        state.setSearchTerm(searchTerm);

        const isNumericSearch = /^\d+$/.test(searchTerm);

        let filteredPairs;
        // interpret numeric input as pairId:
        if (isNumericSearch) {
            filteredPairs = await collectionManager.updateTaxonList(false, true);
        } else {
            filteredPairs = await collectionManager.updateTaxonList(false);
        }

        // Ensure filteredPairs is always an array
        filteredPairs = filteredPairs || [];

        this.updateUI(filteredPairs);
    },

    updateClearButtonVisibility(searchTerm) {
        const clearButton = document.getElementById('clear-search');
        clearButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
    },

    resetScrollPosition() {
        const taxonPairList = document.getElementById('taxon-pair-list');
        if (taxonPairList) {
            taxonPairList.scrollTop = 0;
        }
    },

    matchesTags(pair, activeTags) {
        return activeTags.length === 0 || pair.tags.some(tag => activeTags.includes(tag));
    },

    matchesLevel(pair, selectedLevel) {
        return selectedLevel === '' || pair.level === selectedLevel;
    },

    matchesRanges(pair, selectedRanges) {
        return selectedRanges.length === 0 || (pair.range && pair.range.some(range => selectedRanges.includes(range)));
    },

    matchesSearch(pair, searchTerm, vernacular1, vernacular2) {
        if (searchTerm === '') return true;

        const searchTermLower = searchTerm.toLowerCase();
        const matchesTaxon = pair.taxonNames[0].toLowerCase().includes(searchTermLower) ||
            pair.taxonNames[1].toLowerCase().includes(searchTermLower);
        const matchesVernacular = (vernacular1 && vernacular1.toLowerCase().includes(searchTermLower)) ||
            (vernacular2 && vernacular2.toLowerCase().includes(searchTermLower));
        const matchesPairName = pair.pairName.toLowerCase().includes(searchTermLower);
        const matchesTags = pair.tags.some(tag => tag.toLowerCase().includes(searchTermLower));

        return matchesTaxon || matchesVernacular || matchesPairName || matchesTags;
    },

    updateUI(filteredPairs) {
        // Ensure filteredPairs is an array before accessing its length
        const count = Array.isArray(filteredPairs) ? filteredPairs.length : 0;
        collectionManager.updateActiveCollectionCount(count);
    },

    handleSearchInputFocus(searchInput) {
        if (this.hasLostFocus && searchInput.value.length > 1) {
            searchInput.select();
        }
        this.hasLostFocus = false;

        searchInput.addEventListener('blur', () => {
            this.hasLostFocus = true;
        }, { once: true });
    },

    handleSearchKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const firstTaxonPairButton = document.querySelector('.taxon-pair-button');
            if (firstTaxonPairButton) {
                firstTaxonPairButton.click();
                dialogManager.closeDialog('collection-dialog');
            }
        }
    },

    async handleClearSearch() {
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            this.resetSearch();
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.hasLostFocus = true;
            searchInput.focus();
        }
    },

    resetSearch() {
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            searchInput.value = '';
            document.getElementById('clear-search').style.display = 'none';
            state.setSearchTerm('');
        }
    },

    openFirstTaxonPair() {
        const firstTaxonPairButton = document.querySelector('.taxon-pair-button');
        if (firstTaxonPairButton) {
            firstTaxonPairButton.click();
        }
    },

    setFocusLost(value) {
        this.hasLostFocus = value;
    }
};

// Bind all methods to ensure correct 'this' context
Object.keys(searchHandler).forEach(key => {
    if (typeof searchHandler[key] === 'function') {
        searchHandler[key] = searchHandler[key].bind(searchHandler);
    }
});

export default searchHandler;
// don't call directly; API is in eventMain
