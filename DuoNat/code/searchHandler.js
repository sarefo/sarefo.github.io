import api from './api.js';
import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import state from './state.js';
import ui from './ui.js';

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
            searchInput.addEventListener('input', searchHandler.handleSearch.bind(this));
            searchInput.addEventListener('keydown', searchHandler.handleSearchKeydown.bind(this));
        }

        const clearSearchButton = document.getElementById('clear-search');
        if (clearSearchButton) {
            clearSearchButton.addEventListener('click', searchHandler.handleClearSearch.bind(this));
        }
    },

    async handleSearch(event) {
        const searchInput = event.target;
        const searchTerm = searchInput.value.trim();

        searchHandler.updateClearButtonVisibility(searchTerm);

        state.setSearchTerm(searchTerm);

        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const isNumericSearch = /^\d+$/.test(searchTerm);

        let filteredPairs;
        if (isNumericSearch) {
            filteredPairs = taxonPairs.filter(pair => pair.setID.toString() === searchTerm);
        } else {
            filteredPairs = await filtering.filterTaxonPairs(taxonPairs, {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: state.getSelectedTags(),
                searchTerm: searchTerm
            });
        }

        searchHandler.updateUI(filteredPairs);
    },

    updateClearButtonVisibility(searchTerm) {
        const clearButton = document.getElementById('clear-search');
        clearButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
    },

    resetScrollPosition() {
        const taxonSetList = document.getElementById('taxon-set-list');
        if (taxonSetList) {
            taxonSetList.scrollTop = 0;
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
        const matchesSetName = pair.setName.toLowerCase().includes(searchTermLower);
        const matchesTags = pair.tags.some(tag => tag.toLowerCase().includes(searchTermLower));

        return matchesTaxon || matchesVernacular || matchesSetName || matchesTags;
    },

    updateUI(filteredPairs) {
        collectionManager.updateTaxonPairList(filteredPairs);
        collectionManager.updateActiveCollectionCount(filteredPairs.length);
    },

    handleSearchInputFocus(searchInput) {
        if (searchHandler.hasLostFocus && searchInput.value.length > 1) {
            searchInput.select();
        }
        searchHandler.hasLostFocus = false;

        searchInput.addEventListener('blur', () => {
            searchHandler.hasLostFocus = true;
        }, { once: true });
    },

    handleSearchKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const firstTaxonSetButton = document.querySelector('.taxon-set-button');
            if (firstTaxonSetButton) {
                firstTaxonSetButton.click();
                setTimeout(() => {
                    dialogManager.closeDialog('select-set-dialog');
                }, 100);
            }
        }
    },

    async handleClearSearch() {
        const searchInput = document.getElementById('taxon-search');
        if (searchInput) {
            searchHandler.resetSearch();
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchHandler.hasLostFocus = true;
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

    openFirstTaxonSet() {
        const firstTaxonSetButton = document.querySelector('.taxon-set-button');
        if (firstTaxonSetButton) {
            firstTaxonSetButton.click();
        }
    },

    setFocusLost(value) {
        searchHandler.hasLostFocus = value;
    }
};

export default searchHandler;
// API in mainEventHandler //
