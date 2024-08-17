import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import mainEventHandler from './mainEventHandler.js';
import rangeSelector from './rangeSelector.js';
import setManager from './setManager.js';
import state from './state.js';
import tagCloud from './tagCloud.js';
import ui from './ui.js';
import worldMap from './worldMap.js';

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.vernacular.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName) || 'n/a';
}

const collectionManager = {
    initialization: {
        initialize() {
            this.initializeSelectSetDialog();
            this.initializeFilterSummaryMap();
            this.initializeClearFiltersButton();
            this.initializeSelectSetDoneButton();
            this.initializeLevelDropdown();
        },

        initializeSelectSetDialog() {
            const selectSetButton = document.getElementById('select-set-button');
            selectSetButton.addEventListener('click', () => collectionManager.ui.openCollectionManagerDialog());
        },

        initializeFilterSummaryMap() {
            const filterSummaryMap = document.querySelector('.filter-summary__map');
            if (filterSummaryMap) {
                filterSummaryMap.addEventListener('click', () => {
                    rangeSelector.openRangeDialog();
                });
            }
        },

        initializeClearFiltersButton() {
            const clearFiltersButton = document.getElementById('clear-all-filters');
            if (clearFiltersButton) {
                clearFiltersButton.addEventListener('click', filtering.clearAllFilters);
            }
        },

        initializeSelectSetDoneButton() {
            const selectSetDoneButton = document.getElementById('select-set-done-button');
            if (selectSetDoneButton) {
                selectSetDoneButton.addEventListener('click', collectionManager.eventHandlers.handleSelectSetDone);
            }
        },

        setupSelectSetDialog() {
            const playButton = document.getElementById('select-set-done-button');
            if (playButton) {
                playButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    collectionManager.eventHandlers.handleSelectSetDone();
                });
            } else {
                logger.error('Play button not found in select-set-dialog');
            }
        },

        initializeLevelDropdown() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.addEventListener('change', (event) => {
                    state.setSelectedLevel(event.target.value);
                    collectionManager.taxonList.onFiltersChanged();
                });
            }
        },
    },

    taxonList: {

        async updateTaxonList() {
            const filters = filtering.getActiveFilters();

            try {
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
                
                // Update UI
                await collectionManager.taxonList.renderTaxonPairList(filteredPairs);
                collectionManager.ui.updateActiveCollectionCount(filteredPairs.length);
                collectionManager.ui.updateFilterSummary();
                
                return filteredPairs;
            } catch (error) {
                logger.error("Error in updateTaxonList:", error);
                return [];
            }
        },

        async renderTaxonPairList(pairs) {
            const list = document.getElementById('taxon-set-list');
            if (list) {
                list.innerHTML = '';
            }
            await this.renderVisibleTaxonPairs(pairs);
            collectionManager.ui.updateActiveCollectionCount(pairs.length);
        },

        async renderVisibleTaxonPairs(pairs) {
            const list = document.getElementById('taxon-set-list');
            if (!list) return;

            list.innerHTML = '';
            const visiblePairs = pairs.slice(0, 20);

            for (const pair of visiblePairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }

            if (pairs.length > 20) {
                this.addLoadMoreButton(list, pairs);
            }
        },

        addLoadMoreButton(list, pairs) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Load More';
            loadMoreButton.className = 'load-more-button';
            loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, 20));
            list.appendChild(loadMoreButton);
        },

        async createTaxonPairButton(pair) {
            const button = document.createElement('button');
            button.className = 'taxon-set-button';

            const vernacular1 = await getCachedVernacularName(pair.taxonNames[0]);
            const vernacular2 = await getCachedVernacularName(pair.taxonNames[1]);

            button.innerHTML = this.createButtonHTML(pair, vernacular1, vernacular2);
            button.onclick = () => collectionManager.eventHandlers.handleTaxonPairSelection(pair);

            return button;
        },

        createButtonHTML(pair, vernacular1, vernacular2) {
            return `
                <div class="taxon-set-container">
                    <div class="set-name-container">
                        <div class="taxon-set__set-name">${pair.setName || 'Unnamed Set'}</div>
                        <div class="taxon-set__level-chilis" aria-label="Skill level">${this.getChiliHtml(pair.level)}</div>
                        <div class="taxon-set__tags">${pair.tags.join(', ')}</div>
                    </div>
                    <div class="taxon-items">
                        ${this.createTaxonItemHTML(pair.taxonNames[0], vernacular1)}
                        ${this.createTaxonItemHTML(pair.taxonNames[1], vernacular2)}
                    </div>
                </div>
            `;
        },

        createTaxonItemHTML(taxonName, vernacularName) {
            return `
                <div class="taxon-item">
                    <div class="taxon-name">${taxonName}</div>
                    <div class="vernacular-name">${vernacularName}</div>
                </div>
            `;
        },

        getChiliHtml(level) {
            const chiliCount = parseInt(level) || 0;
            return Array(chiliCount).fill('<svg class="icon taxon-set__icon-chili"><use href="./images/icons.svg#icon-spicy"/></svg>').join('');
        },

        loadMorePairs: async function (pairs, startIndex) {
            const list = document.getElementById('taxon-set-list');
            const nextPairs = pairs.slice(startIndex, startIndex + 20);

            for (const pair of nextPairs) {
                const button = await this.createTaxonPairButton(pair);
                list.insertBefore(button, list.lastChild);
            }

            this.updateLoadMoreButton(list, pairs, startIndex);
        },

        updateLoadMoreButton(list, pairs, startIndex) {
            if (startIndex + 20 >= pairs.length) {
                list.removeChild(list.lastChild);
            } else {
                const loadMoreButton = list.lastChild;
                loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, startIndex + 20));
            }
        },

        async updateTaxonPairList(filteredPairs) {
            const list = document.getElementById('taxon-set-list');
            list.innerHTML = '';

            if (!filteredPairs || filteredPairs.length === 0) {
                this.displayNoResultsMessage(list);
            } else {
                await this.populateListWithPairs(list, filteredPairs);
            }

            collectionManager.ui.updateActiveCollectionCount(filteredPairs ? filteredPairs.length : 0);
            collectionManager.ui.updateFilterSummary();
        },

        displayNoResultsMessage(list) {
            const noResultsMessage = document.createElement('p');
            noResultsMessage.className = 'no-results-message';
            
            const hasActiveFilters = this.checkForActiveFilters();
            noResultsMessage.innerHTML = this.getNoResultsMessageContent(hasActiveFilters);
            
            list.appendChild(noResultsMessage);
        },

        checkForActiveFilters() {
            return state.getSelectedLevel() !== '' || 
                   state.getSelectedRanges().length > 0 || 
                   state.getSelectedTags().length > 0;
        },

        getNoResultsMessageContent(hasActiveFilters) {
            return hasActiveFilters
                ? 'No matching sets found.<br><span class="filter-warning">You have active filters. Try clearing some filters at the top of this dialog to see more results.</span>'
                : 'No matching sets found.';
        },

        async populateListWithPairs(list, pairs) {
            for (const pair of pairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }
        },

        async updateVernacularNames(button, pair) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            const vernacularElements = button.querySelectorAll('.vernacular-name');
            vernacularElements[0].textContent = vernacular1 || '';
            vernacularElements[1].textContent = vernacular2 || '';
        },

        async onFiltersChanged() {
            try {
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                const filters = {
                    level: state.getSelectedLevel(),
                    ranges: state.getSelectedRanges(),
                    tags: state.getSelectedTags(),
                    searchTerm: state.getSearchTerm()
                };
                const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
                collectionManager.taxonList.updateTaxonPairList(filteredPairs);
            } catch (error) {
                logger.error("Error in onFiltersChanged:", error);
            }
        },
    },

    ui: {
        updateFilterSummary() {
            this.updateMapInFilterSummary();
            this.updateTagsInFilterSummary();
        },

        updateMapInFilterSummary() {
            const mapContainer = document.querySelector('.filter-summary__map');
            if (mapContainer) {
                let selectedRanges = state.getSelectedRanges();
                const currentRanges = JSON.stringify(selectedRanges);
                if (this.lastDrawnRanges !== currentRanges) {
                    mapContainer.innerHTML = '';
                    const selectedContinents = new Set(selectedRanges.map(abbr => worldMap.getFullContinentName(abbr)));
                    worldMap.createNonClickableWorldMap(mapContainer, selectedContinents);
                    this.lastDrawnRanges = currentRanges;
                }
            }
        },

        updateTagsInFilterSummary() {
            const tagsContainer = document.querySelector('.filter-summary__tags');
            if (tagsContainer) {
                tagsContainer.innerHTML = this.getTagsHTML();
            }
        },

        getTagsHTML() {
            let selectedTags = state.getSelectedTags();
            return selectedTags.length > 0
                ? selectedTags
                    .map(tag => `<span class="filter-summary__tag">${tag}</span>`)
                    .join('')
                : '<span class="filter-summary__no-tags">No active tags</span>';
        },

        updateActiveCollectionCount(count) {
            const countElement = document.getElementById('active-collection-count');
            if (countElement) {
                countElement.textContent = `Active collection: ${count} set${count !== 1 ? 's' : ''}`;
            }
        },

        updateLevelDropdown() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.value = state.getSelectedLevel();
            }
        },

        updateUIForClearedFilters() {
            collectionManager.ui.updateFilterSummary();
            collectionManager.ui.updateLevelDropdown();
        },

        openCollectionManagerDialog() {
            dialogManager.openDialog('select-set-dialog');
            collectionManager.taxonList.updateTaxonList();
//            mainEventHandler.resetSearch();
            mainEventHandler.resetScrollPosition();
        },

        focusSearchInput() {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    if (searchInput.value.length > 0) {
                        searchInput.select();
                    }
                    mainEventHandler.setFocusLost(false);
                }, 100);
            }
        },
    },

    eventHandlers: {
        handleSelectSetDone() {
            collectionManager.taxonList.updateTaxonList();
            setManager.refreshSubset();
            dialogManager.closeDialog('select-set-dialog');

            setTimeout(() => {
                gameSetup.setupGame(true);
            }, 100);
        },

        handleTaxonPairSelection(pair) {
            const selectedPair = {
                taxon1: pair.taxonNames[0],
                taxon2: pair.taxonNames[1],
                setName: pair.setName,
                tags: [...pair.tags],
                setID: pair.setID,
                level: pair.level
            };
            state.setNextSelectedPair(selectedPair);
            logger.debug('Selected pair:', selectedPair);
            dialogManager.closeDialog('select-set-dialog');
            setTimeout(() => gameSetup.setupGame(true), 300);
        },

    },
};

const publicAPI = {
    initialize: collectionManager.initialization.initialize.bind(collectionManager.initialization),

    setupSelectSetDialog: collectionManager.initialization.setupSelectSetDialog.bind(collectionManager.initialization),

    updateTaxonList: collectionManager.taxonList.updateTaxonList.bind(collectionManager.taxonList),
    onFiltersChanged: collectionManager.taxonList.updateTaxonList.bind(collectionManager.taxonList),
    openCollectionManagerDialog: collectionManager.ui.openCollectionManagerDialog.bind(collectionManager.ui),

    renderTaxonPairList: collectionManager.taxonList.renderTaxonPairList.bind(collectionManager.taxonList),
    updateTaxonPairList: collectionManager.taxonList.updateTaxonPairList.bind(collectionManager.taxonList),

    updateFilterSummary: collectionManager.ui.updateFilterSummary.bind(collectionManager.ui),
    updateUIForClearedFilters: collectionManager.ui.updateUIForClearedFilters.bind(collectionManager.ui),

    updateActiveCollectionCount: collectionManager.ui.updateActiveCollectionCount.bind(collectionManager.ui),

    updateLevelDropdown: collectionManager.ui.updateLevelDropdown.bind(collectionManager.ui),
};

export default publicAPI;
