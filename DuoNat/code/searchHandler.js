import api from './api.js';
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
        
        const taxonPairs = await api.taxonomy.fetchTaxonPairs();
        const filteredPairs = await this.filterTaxonPairs(taxonPairs, searchTerm);
        
        this.updateUI(filteredPairs);
        this.handleSearchInputFocus(searchInput);
    },

    updateClearButtonVisibility(searchTerm) {
        const clearButton = document.getElementById('clear-search');
        clearButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
    },

    async filterTaxonPairs(taxonPairs, searchTerm) {
        const activeTags = state.getSelectedTags();
        const selectedLevel = state.getSelectedLevel();
        const isNumericSearch = /^\d+$/.test(searchTerm);
        const filteredPairs = [];

        for (const pair of taxonPairs) {
            const isMatching = await this.isPairMatching(pair, searchTerm, activeTags, selectedLevel, isNumericSearch);
            if (isMatching) {
                filteredPairs.push(pair);
            }
        }

        return filteredPairs;
    },

    async isPairMatching(pair, searchTerm, activeTags, selectedLevel, isNumericSearch) {
        const vernacular1 = await getCachedVernacularName(pair.taxonNames[0]);
        const vernacular2 = await getCachedVernacularName(pair.taxonNames[1]);

        const matchesTags = this.matchesTags(pair, activeTags);
        const matchesLevel = this.matchesLevel(pair, selectedLevel);
        const matchesSearch = this.matchesSearch(pair, searchTerm, vernacular1, vernacular2, isNumericSearch);

        return matchesTags && matchesLevel && matchesSearch;
    },

    matchesTags(pair, activeTags) {
        return activeTags.length === 0 || pair.tags.some(tag => activeTags.includes(tag));
    },

    matchesLevel(pair, selectedLevel) {
        return selectedLevel === '' || pair.level === selectedLevel;
    },

    matchesSearch(pair, searchTerm, vernacular1, vernacular2, isNumericSearch) {
        if (searchTerm === '') return true;
        
        if (isNumericSearch) {
            return pair.setID === searchTerm;
        }

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
        ui.updateTaxonPairList(filteredPairs);
        ui.updateActiveCollectionCount(filteredPairs.length);
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
            searchInput.value = '';
            document.getElementById('clear-search').style.display = 'none';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.hasLostFocus = true;
            searchInput.focus();
        }
    },

    openFirstTaxonSet() {
        const firstTaxonSetButton = document.querySelector('.taxon-set-button');
        if (firstTaxonSetButton) {
            firstTaxonSetButton.click();
        }
    },

    setFocusLost(value) {
        this.hasLostFocus = value;
    }
};

export default searchHandler;
