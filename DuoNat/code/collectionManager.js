import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import eventMain from './eventMain.js';
import phylogenySelector from './phylogenySelector.js';
import rangeSelector from './rangeSelector.js';
import setManager from './setManager.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import ui from './ui.js';
import worldMap from './worldMap.js';

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.vernacular.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName) || '-';
}

const collectionManager = {
    initialization: {
        initialize() {
            this.initializeSelectSetDialog();
            this.initializeFilterTagsButton();
            this.initializeFilterSummaryMap();
            this.initializeFilterSummaryTags();
            this.initializeClearFiltersButton();
            this.initializeSelectSetDoneButton();
            this.initializeLevelDropdown();
            this.initializePhylogenySelector();
        },

        initializePhylogenySelector() {
            const phylogenyButton = document.getElementById('select-phylogeny-button');
            phylogenyButton.addEventListener('click', () => {
                dialogManager.openDialog('phylogeny-dialog');
                phylogenySelector.clearSearchResults();
                phylogenySelector.updateGraph();
            });

        },

        initializeSelectSetDialog() {
            const selectSetButton = document.getElementById('collection-button');
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

        initializeFilterTagsButton() {
            const selectTagsButton = document.getElementById('select-tags-button');
            selectTagsButton.addEventListener('click', () => tagSelector.openTagSelector());
        },

        initializeFilterSummaryTags() {
            const filterSummaryTags = document.querySelector('.filter-summary');
            if (filterSummaryTags) {
                filterSummaryTags.addEventListener('click', () => {
                    tagSelector.openTagSelector();
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
            const selectSetDoneButton = document.getElementById('collection-done-button');
            if (selectSetDoneButton) {
                selectSetDoneButton.addEventListener('click', collectionManager.eventHandlers.handleSelectSetDone);
            }
        },

        setupSelectSetDialog() {
            const playButton = document.getElementById('collection-done-button');
            if (playButton) {
                playButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    collectionManager.eventHandlers.handleSelectSetDone();
                });
            } else {
                logger.error('Play button not found in collection-dialog');
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
            collectionManager.ui.updateLevelDropdown();
        },
    },

    taxonList: {

        async updateTaxonList(isInitialLoad = false) {
            const filters = filtering.getActiveFilters();

            try {
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                let filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);

                // Only consider the active pair if this is the initial load of the collection manager
                if (isInitialLoad) {
                    const currentPair = this.getCurrentActivePair();
                    if (currentPair) {
                        // Remove the current pair from the filtered list if it exists
                        filteredPairs = filteredPairs.filter(pair => pair.setID !== currentPair.setID);
                        // Add the current pair to the beginning of the list
                        filteredPairs.unshift(currentPair);
                    }
                }

                // Update UI
                await collectionManager.taxonList.renderTaxonList(filteredPairs);
                collectionManager.ui.updateActiveCollectionCount(filteredPairs.length);
                collectionManager.ui.updateFilterSummary();

                return filteredPairs;
            } catch (error) {
                logger.error("Error in updateTaxonList:", error);
                return [];
            }
        },

        async renderTaxonList(pairs) {
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

            button.innerHTML = collectionManager.taxonList.createButtonHTML(pair, vernacular1, vernacular2);
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
                    ${vernacularName && vernacularName.toLowerCase() !== '-' 
                        ? `<div class="vernacular-name">${vernacularName}</div>`
                        : ''}
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

/*        async updateTaxonPairList(filteredPairs) {
            const list = document.getElementById('taxon-set-list');
            list.innerHTML = '';

            if (!filteredPairs || filteredPairs.length === 0) {
                this.displayNoResultsMessage(list);
            } else {
                await this.populateListWithPairs(list, filteredPairs);
            }

            collectionManager.ui.updateActiveCollectionCount(filteredPairs ? filteredPairs.length : 0);
            collectionManager.ui.updateFilterSummary();
        },*/

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

        hasActiveFilters(filters) {
            return filters.level !== '' || 
                   filters.ranges.length > 0 || 
                   filters.tags.length > 0 || 
                   filters.searchTerm !== '';
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
            await collectionManager.taxonList.updateTaxonList(false);
            await collectionManager.ui.updateLevelCounts();
        },

        getCurrentActivePair() {
            const currentPair = state.getCurrentTaxonImageCollection()?.pair;
            return currentPair ? {
                taxonNames: [currentPair.taxon1, currentPair.taxon2],
                setName: currentPair.setName,
                tags: currentPair.tags,
                setID: currentPair.setID,
                level: currentPair.level
            } : null;
        },

    },

    ui: {
        updateFilterSummary() {
            this.updateMapInFilterSummary();
            this.updatePhylogenyDisplay();
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

        updatePhylogenyDisplay: async function() {
            const phylogenyElement = document.querySelector('.filter-summary__phylogeny');
            const activePhylogenyId = state.getPhylogenyId();

            if (activePhylogenyId) {
                const taxonomyHierarchy = api.taxonomy.getTaxonomyHierarchy();
                const taxon = taxonomyHierarchy.getTaxonById(activePhylogenyId);

                if (taxon && taxon.id != "48460") { // 48460 = root node
                    const taxonName = taxon.taxonName;
                    const vernacularName = taxon.vernacularName;
                    
                    phylogenyElement.innerHTML = `
                        <span class="phylogeny-taxon">${taxonName}</span>
                        ${vernacularName && vernacularName !== '-' ? `<span class="phylogeny-vernacular">(${vernacularName})</span>` : ''}
                    `;
                } else {
                    phylogenyElement.textContent = 'All taxa';
                }
            } else {
                phylogenyElement.textContent = 'All taxa';
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

        async updateLevelDropdown() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                const activeFilters = filtering.getActiveFilters();
                const counts = await filtering.countSetsPerLevel(activeFilters);
                
                levelDropdown.innerHTML = `
                    <option value="">All Levels (${counts['1'] + counts['2'] + counts['3']})</option>
                    <option value="1">Easy (${counts['1']})</option>
                    <option value="2">Medium (${counts['2']})</option>
                    <option value="3">Hard (${counts['3']})</option>
                `;
                
                levelDropdown.value = state.getSelectedLevel();
            }
        },

        async updateLevelCounts() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                const activeFilters = filtering.getActiveFilters();
                const counts = await filtering.countSetsPerLevel(activeFilters);
                
                Array.from(levelDropdown.options).forEach(option => {
                    if (option.value === '') {
                        option.textContent = `All Levels (${counts['1'] + counts['2'] + counts['3']})`;
                    } else {
                        const level = option.value;
                        option.textContent = `${option.textContent.split(' (')[0]} (${counts[level]})`;
                    }
                });
            }
        },

        updateUIForClearedFilters() {
            collectionManager.ui.updateFilterSummary();
            collectionManager.ui.updateLevelDropdown();
        },

        async openCollectionManagerDialog() {
            dialogManager.openDialog('collection-dialog');
            await collectionManager.taxonList.updateTaxonList(true);  // Pass true for initial load
            await collectionManager.ui.updateLevelCounts();
            eventMain.resetScrollPosition();
            this.focusSearchInput();
        },

        focusSearchInput() {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    if (searchInput.value.length > 0) {
                        searchInput.select();
                    }
                    eventMain.setFocusLost(false);
                }, 100);
            }
        },
    },

    eventHandlers: {
        handleSelectSetDone() {
            collectionManager.taxonList.updateTaxonList();
            setManager.refreshSubset();
            dialogManager.closeDialog('collection-dialog');

            setTimeout(async () => {
                const filters = filtering.getActiveFilters();
                const filteredPairs = await filtering.getFilteredTaxonPairs(filters);
                if (filteredPairs.length > 0) {
                    const randomPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    state.setNextSelectedPair(randomPair);
                }
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
            dialogManager.closeDialog('collection-dialog');
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

    renderTaxonList: collectionManager.taxonList.renderTaxonList.bind(collectionManager.taxonList),
    //updateTaxonPairList: collectionManager.taxonList.updateTaxonPairList.bind(collectionManager.taxonList),

    updateFilterSummary: collectionManager.ui.updateFilterSummary.bind(collectionManager.ui),
    updateUIForClearedFilters: collectionManager.ui.updateUIForClearedFilters.bind(collectionManager.ui),

    updateActiveCollectionCount: collectionManager.ui.updateActiveCollectionCount.bind(collectionManager.ui),

    updateLevelDropdown: collectionManager.ui.updateLevelDropdown.bind(collectionManager.ui),
    updateLevelCounts: collectionManager.ui.updateLevelCounts.bind(collectionManager.ui),
};

export default publicAPI;
