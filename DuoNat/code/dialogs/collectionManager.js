import config from '../config.js';
import logger from '../logger.js';
import state from '../state.js';
import utils from '../utils.js';

import api from '../api.js';
import ui from '../ui.js';

import eventMain from '../events/eventMain.js';

import filtering from '../filtering.js';
import gameLogic from '../gameLogic.js';
import pairManager from '../pairManager.js';
import preloader from '../preloader.js';
import worldMap from '../worldMap.js';

import dialogManager from './dialogManager.js';
import phylogenySelector from './phylogenySelector.js';
import rangeSelector from './rangeSelector.js';
import tagSelector from './tagSelector.js';

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
        isInitialized: false,
        initialize() {
            if (this.isInitialized) {
                logger.warn("Collection manager already initialized, skipping");
                return;
            }
            this.isInitialized = true;

            this.initializeFilterTagsButton();
            this.initializeFilterSummaryMap();
            this.initializeFilterSummaryTags();
            this.initializeClearFiltersButton();
            this.initializeLevelDropdown();
            this.initializePhylogenySelector();

            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.addEventListener('change', collectionManager.ui.handleLevelChange.bind(this));
            }
            collectionManager.taxonList.initializeTaxonInfoVisibility();
        },

        initializePhylogenySelector() {
            const phylogenyButton = document.getElementById('select-phylogeny-button');
            phylogenyButton.addEventListener('click', () => {
                dialogManager.openDialog('phylogeny-dialog');
                phylogenySelector.clearSearchResults();
                phylogenySelector.updateToggleState();
                phylogenySelector.updateGraph();
            });

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

        setupCollectionManagerDialog() {
            const playButton = document.getElementById('collection-done-button');
            if (playButton) {
                // Remove any existing event listeners
                if (this.handlePlayButtonClick) {
                    playButton.removeEventListener('click', this.handlePlayButtonClick);
                }
                
                // Add the event listener
                this.handlePlayButtonClick = (event) => {
                    event.preventDefault();
                    collectionManager.eventHandlers.handleCollectionManagerDone();
                };
                playButton.addEventListener('click', this.handlePlayButtonClick);
                
                //logger.debug("Collection manager dialog setup complete");
            } else {
                logger.error('Play button not found in collection-dialog');
            }
        },

        initializeLevelDropdown() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.innerHTML = `
                    <option value="">All Levels</option>
                    <option value="1">Easy</option>
                    <option value="2">Medium</option>
                    <option value="3">Hard</option>
                    <option value="1,2">Easy + Medium</option>
                    <option value="2,3">Medium + Hard</option>
                `;
                levelDropdown.addEventListener('change', (event) => {
                    const selectedLevels = event.target.value.split(',').map(Number);
                    state.setSelectedLevels(selectedLevels);
                    collectionManager.taxonList.onFiltersChanged();
                });
            }
            //collectionManager.ui.updateLevelDropdown();
            collectionManager.ui.updateLevelCounts();
        },
    },

    taxonList: {
        filterTaxonPairsBySearch(pairs, searchTerm) {
            if (!searchTerm) return pairs;
            
            const searchTermLower = searchTerm.toLowerCase();
            return pairs.filter(pair => 
                pair.taxonNames.some(name => name.toLowerCase().includes(searchTermLower)) ||
                pair.pairName.toLowerCase().includes(searchTermLower) ||
                pair.tags.some(tag => tag.toLowerCase().includes(searchTermLower)) ||
                pair.pairID.toString() === searchTerm
            );
        },

    async updateTaxonList(isInitialLoad = false, isPairIDSearch = false) {
        const filters = filtering.getActiveFilters();
        const searchTerm = state.getSearchTerm();
        const page = isInitialLoad ? 1 : (state.getCurrentPage() || 1);
        const pageSize = 20;

        try {
            let result;
            if (config.useMongoDB) {
                if (isPairIDSearch) {
                    const pair = await api.taxonomy.fetchPairByID(searchTerm);
                    result = {
                        results: pair ? [pair] : [],
                        totalCount: pair ? 1 : 0,
                        hasMore: false
                    };
                } else {
                    result = await api.taxonomy.fetchPaginatedTaxonPairs(filters, searchTerm, page, pageSize);
                }
            } else {
                // Existing code for JSON file
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                let filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
                if (isPairIDSearch) {
                    filteredPairs = filteredPairs.filter(pair => pair.pairID.toString() === searchTerm);
                } else {
                    filteredPairs = this.filterTaxonPairsBySearch(filteredPairs, searchTerm);
                }
                const startIndex = (page - 1) * pageSize;
                result = {
                    results: filteredPairs.slice(startIndex, startIndex + pageSize),
                    totalCount: filteredPairs.length,
                    hasMore: filteredPairs.length > page * pageSize
                };
            }

            // Handle initial load case
            if (isInitialLoad) {
                const currentPair = this.getCurrentActivePair();
                if (currentPair && !result.results.some(pair => pair.pairID === currentPair.pairID)) {
                    result.results.unshift(currentPair);
                    result.totalCount += 1;
                }
            }

            // Use the stored total count instead of the paginated result
            const totalCount = state.getTotalTaxonPairCount();

            // Update UI
            await this.renderTaxonList(result.results, isInitialLoad, page === 1, result.hasMore);
            collectionManager.ui.updateActiveCollectionCount(totalCount);
            collectionManager.ui.updateFilterSummary();

            state.setPreviousFilters(filtering.getActiveFilters());

            return result;
        } catch (error) {
            logger.error("Error in updateTaxonList:", error);
            return { results: [], totalCount: 0, hasMore: false };
        }
    },

    async renderTaxonList(pairs, isInitialLoad, clearExisting = true, hasMore = false) {
        const list = document.getElementById('taxon-pair-list');
        if (!list) return;

        if (clearExisting) {
            list.innerHTML = '';
        }

        const fragment = document.createDocumentFragment();
        const buttons = await this.createTaxonPairButtons(pairs);
        buttons.forEach(button => fragment.appendChild(button));
        list.appendChild(fragment);

        const loadMoreButton = list.querySelector('.load-more-button');
        if (loadMoreButton) {
            loadMoreButton.remove();
        }

        if (pairs.length === 0 && clearExisting) {
            this.displayNoResultsMessage(list);
        } else if (hasMore) {
            this.addLoadMoreButton(list);
        } else {
            logger.debug('No more pairs to load');
        }
    },

    addLoadMoreButton(list) {
        const existingButton = list.querySelector('.load-more-button');
        if (existingButton) {
            existingButton.remove();
        }

        const loadMoreButton = document.createElement('button');
        loadMoreButton.textContent = 'Load More';
        loadMoreButton.className = 'load-more-button';
        loadMoreButton.addEventListener('click', () => {
            this.loadMorePairs();
        });
        list.appendChild(loadMoreButton);
    },

async loadMorePairs() {
    const currentPage = state.getCurrentPage() || 1;
    const nextPage = currentPage + 1;
    state.setCurrentPage(nextPage);
    
    try {
        const result = await this.updateTaxonList(false, false);
        
        if (result && result.results) {
            await this.renderTaxonList(result.results, false, false, result.hasMore);
        } else {
            logger.warn('No results or unexpected result structure from updateTaxonList');
        }

        if (result && !result.hasMore) {
            const loadMoreButton = document.querySelector('.load-more-button');
            if (loadMoreButton) {
                loadMoreButton.remove();
            }
        }
    } catch (error) {
        logger.error('Error in loadMorePairs:', error);
    }
},

        initializeTaxonInfoVisibility() {
            const taxonInfoToggle = document.getElementById('taxon-info-toggle');
            
            if (taxonInfoToggle) {
                const updateVisibility = () => {
                    const hideCollManTaxa = !taxonInfoToggle.checked;
                    //logger.debug(`Updating taxon info visibility. Hide taxa: ${hideCollManTaxa}`);
                    state.setHideCollManTaxa(hideCollManTaxa);
                    this.syncTaxonInfoVisibility();
                };

                // Set initial state based on the current state
                taxonInfoToggle.checked = !state.getHideCollManTaxa();
                updateVisibility();

                // Add event listener for future changes
                taxonInfoToggle.addEventListener('change', updateVisibility);
            } else {
                logger.warn("Taxon info toggle element not found");
            }
        },

        async renderVisibleTaxonPairs(pairs) {
            const list = document.getElementById('taxon-pair-list');
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

        async createTaxonPairButton(pair) {
          const button = document.createElement('button');
          button.className = 'taxon-pair-button';

          const [vernacular1, vernacular2] = await Promise.all([
            getCachedVernacularName(pair.taxonNames[0]),
            getCachedVernacularName(pair.taxonNames[1])
          ]);

          button.innerHTML = this.createButtonHTML(pair, vernacular1, vernacular2);
          button.addEventListener('click', () => collectionManager.eventHandlers.handleTaxonPairSelection(pair));

          return button;
        },

        async createTaxonPairButtons(pairs) {
            const allTaxonNames = pairs.flatMap(pair => pair.taxonNames);
            const uniqueTaxonNames = [...new Set(allTaxonNames)];
            
            let vernacularNames;
            if (config.useMongoDB) {
                vernacularNames = await api.taxonomy.fetchBulkTaxonInfo(uniqueTaxonNames);
            } else {
                vernacularNames = Object.fromEntries(await Promise.all(
                    uniqueTaxonNames.map(async name => [name, await getCachedVernacularName(name)])
                ));
            }

            return pairs.map(pair => {
                const button = document.createElement('button');
                button.className = 'taxon-pair-button';

                const vernacular1 = vernacularNames[pair.taxonNames[0]] || '-';
                const vernacular2 = vernacularNames[pair.taxonNames[1]] || '-';

                button.innerHTML = this.createButtonHTML(pair, vernacular1, vernacular2);
                button.addEventListener('click', () => collectionManager.eventHandlers.handleTaxonPairSelection(pair));

                return button;
            });
        },

        createButtonHTML(pair, vernacular1, vernacular2) {
            const hideCollManTaxa = state.getHideCollManTaxa();
            const taxonItemsClass = hideCollManTaxa ? 'taxon-items hidden' : 'taxon-items';
            const taxonPairContainerClass = hideCollManTaxa ? 'taxon-pair-container compact' : 'taxon-pair-container';
            const pairNameContainerClass = hideCollManTaxa ? 'pair-name-container compact' : 'pair-name-container';
            const pairNameClass = hideCollManTaxa ? 'taxon-pair__pair-name compact' : 'taxon-pair__pair-name';

            return `
                <div class="${taxonPairContainerClass}">
                    <div class="${pairNameContainerClass}">
                        <div class="${pairNameClass}">${pair.pairName || 'Unnamed Pair'}</div>
                        <div class="taxon-pair__level-chilis" aria-label="Skill level">${this.getChiliHtml(pair.level)}</div>
                        <div class="taxon-pair__tags">${pair.tags.join(', ')}</div>
                    </div>
                    <div class="${taxonItemsClass}">
                        ${this.createTaxonItemHTML(pair.taxonNames[0], vernacular1)}
                        ${this.createTaxonItemHTML(pair.taxonNames[1], vernacular2)}
                    </div>
                </div>
            `;
        },

        syncTaxonInfoVisibility() {
            //logger.warn("syncing taxoninfo viz");
            const taxonInfoToggle = document.getElementById('taxon-info-toggle');
            const hideCollManTaxa = state.getHideCollManTaxa();
            
            if (taxonInfoToggle) {
                taxonInfoToggle.checked = !hideCollManTaxa;
            }
            
            const taxonPairContainers = document.querySelectorAll('.taxon-pair-container');
            taxonPairContainers.forEach(item => {
                item.classList.toggle('compact', hideCollManTaxa);
            });            
            
            const pairNameContainers = document.querySelectorAll('.pair-name-container');
            pairNameContainers.forEach(item => {
                item.classList.toggle('compact', hideCollManTaxa);
            });
            
            const pairNames = document.querySelectorAll('.taxon-pair__pair-name');
            pairNames.forEach(item => {
                item.classList.toggle('compact', hideCollManTaxa);
            });

            const taxonItems = document.querySelectorAll('.taxon-items');
            taxonItems.forEach(item => {
                item.classList.toggle('hidden', hideCollManTaxa);
            });
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
            return Array(chiliCount).fill('<svg class="icon taxon-pair__icon-chili"><use href="./images/icons.svg#icon-spicy"/></svg>').join('');
        },

        updateLoadMoreButton(list, pairs, startIndex) {
            if (startIndex + 20 >= pairs.length) {
                list.removeChild(list.lastChild);
            } else {
                const loadMoreButton = list.lastChild;
                loadMoreButton.addEventListener('click', () => this.loadMorePairs(pairs, startIndex + 20));
            }
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

        hasActiveFilters(filters) {
            return filters.level !== '' || 
                   filters.ranges.length > 0 || 
                   filters.tags.length > 0 || 
                   filters.searchTerm !== '';
        },

        getNoResultsMessageContent(hasActiveFilters) {
            return hasActiveFilters
                ? 'No matching pairs found.<br><span class="filter-warning">You have active filters. Try clearing some filters at the top of this dialog to see more results.</span>'
                : 'No matching pairs found.';
        },

        async populateListWithPairs(list, pairs) {
            for (const pair of pairs) {
                const button = await this.createTaxonPairButton(pair);
                list.appendChild(button);
            }
        },

        async updateVernacularNames(button, pair) {
            const vernacular1 = await getCachedVernacularName(pair.taxonA);
            const vernacular2 = await getCachedVernacularName(pair.taxonB);

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
                taxonNames: [currentPair.taxonA, currentPair.taxonB],
                pairName: currentPair.pairName,
                tags: currentPair.tags,
                pairID: currentPair.pairID,
                level: currentPair.level
            } : null;
        },

    },

    ui: {
        updateFilterSummary() {
            this.updateMapInFilterSummary();
            this.updatePhylogenyDisplay();
            this.updateTagsInFilterSummary();
            //this.updateLevelDropdown();
            this.updateLevelCounts();
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
                        ${vernacularName && vernacularName !== '-' ? `<span class="phylogeny-vernacular">(${utils.string.truncate(vernacularName,24)})</span>` : ''}
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

        /*async updateLevelDropdown() {
            console.log('updateLevelDropdown called');
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                const activeFilters = filtering.getActiveFilters();
                console.log('Active filters:', activeFilters);

                let counts = { total: 0, '1': 0, '2': 0, '3': 0 };
                
                if (config.useMongoDB) {
                    const fetchedCounts = await api.taxonomy.fetchLevelCounts(activeFilters);
                    console.log('Fetched counts:', fetchedCounts);
                    if (fetchedCounts) {
                        counts = {
                            total: fetchedCounts.total,
                            '1': fetchedCounts.levels['1'] || 0,
                            '2': fetchedCounts.levels['2'] || 0,
                            '3': fetchedCounts.levels['3'] || 0
                        };
                        state.setTotalTaxonPairCount(counts.total);
                    }
                } else {
                    counts = await filtering.countPairsPerLevel(activeFilters);
                }

                const totalCount = counts.total;
                const selectedLevels = state.getSelectedLevels();
                
                console.log('Total count:', totalCount);
                console.log('Counts per level:', counts);
                
                levelDropdown.innerHTML = `
                    <option value="">All Levels (${totalCount})</option>
                    <option value="1">Easy (${counts['1']})</option>
                    <option value="2">Medium (${counts['2']})</option>
                    <option value="3">Hard (${counts['3']})</option>
                    <option value="1,2">Easy + Medium (${counts['1'] + counts['2']})</option>
                    <option value="2,3">Medium + Hard (${counts['2'] + counts['3']})</option>
                `;
                
                levelDropdown.value = selectedLevels.join(',');

                // Update the selected option text to show filtered count
                if (selectedLevels.length > 0) {
                    const filteredCount = selectedLevels.reduce((sum, level) => sum + (counts[level] || 0), 0);
                    const selectedOption = levelDropdown.querySelector(`option[value="${selectedLevels.join(',')}"]`);
                    if (selectedOption) {
                        const levelText = selectedOption.textContent.split(' (')[0];
                        selectedOption.textContent = `${levelText} (${filteredCount})`;
                    }
                }
                console.log('updateLevelDropdown finished');
            }
        },*/

        // Update the getFilteredCountForLevel function to handle multiple levels
        async getFilteredCountForLevels(levels) {
            const activeFilters = filtering.getActiveFilters();
            const filteredPairs = await filtering.getFilteredTaxonPairs(activeFilters);
            return filteredPairs.filter(pair => levels.includes(Number(pair.level))).length;
        },

        async updateLevelCounts() {
            console.log('updateLevelCounts called');
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                const activeFilters = filtering.getActiveFilters();
                console.log('Active filters:', activeFilters);

                let counts = { total: 0, '1': 0, '2': 0, '3': 0 };
                
                if (config.useMongoDB) {
                    const fetchedCounts = await api.taxonomy.fetchLevelCounts(activeFilters);
                    console.log('Fetched counts:', fetchedCounts);
                    if (fetchedCounts) {
                        counts = {
                            total: fetchedCounts.total,
                            '1': fetchedCounts.levels['1'] || 0,
                            '2': fetchedCounts.levels['2'] || 0,
                            '3': fetchedCounts.levels['3'] || 0
                        };
                    }
                } else {
                    counts = await filtering.countPairsPerLevel(activeFilters);
                }

                const selectedLevels = state.getSelectedLevels();
                let totalCount = counts.total;

                // If levels are selected, recalculate the total
                if (selectedLevels.length > 0) {
                    totalCount = selectedLevels.reduce((sum, level) => sum + (counts[level] || 0), 0);
                }
                
                state.setTotalTaxonPairCount(totalCount);
                
                console.log('Total count:', totalCount);
                console.log('Counts per level:', counts);
                
                levelDropdown.innerHTML = `
                    <option value="">All Levels (${counts.total})</option>
                    <option value="1">Easy (${counts['1']})</option>
                    <option value="2">Medium (${counts['2']})</option>
                    <option value="3">Hard (${counts['3']})</option>
                    <option value="1,2">Easy + Medium</option>
                    <option value="2,3">Medium + Hard</option>
                `;
                
                levelDropdown.value = selectedLevels.join(',');

                // Update the selected option text to show filtered count
                if (selectedLevels.length > 0) {
                    const selectedOption = levelDropdown.querySelector(`option[value="${selectedLevels.join(',')}"]`);
                    if (selectedOption) {
                        const levelText = selectedOption.textContent.split(' (')[0];
                        selectedOption.textContent = `${levelText} (${totalCount})`;
                    }
                }

                // Update the active collection count
                this.updateActiveCollectionCount(totalCount);

                console.log('updateLevelCounts finished');
            }
        },

        async handleLevelChange(event) {
            const selectedLevels = event.target.value.split(',').map(Number);
            state.setSelectedLevels(selectedLevels);
            await collectionManager.ui.updateLevelCounts();
            await collectionManager.taxonList.onFiltersChanged();
        },


        async openCollectionManagerDialog() {
            dialogManager.openDialog('collection-dialog');
            await collectionManager.taxonList.updateTaxonList(true);  // Pass true for initial load
            await collectionManager.ui.updateLevelCounts();
            eventMain.resetScrollPosition();
            if (state.getHasKeyboard()) this.focusSearchInput();
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
        isSelectionInProgress: false,

        async handleCollectionManagerDone() {
            this.isLoadingNewPair = true;

            try {
                await collectionManager.taxonList.updateTaxonList();
                await pairManager.refreshCollectionSubset();
                dialogManager.closeDialog('collection-dialog');

                // Get current filtered pairs
                const filteredPairs = await filtering.getFilteredTaxonPairs(filtering.getActiveFilters());
                
                // Get the current pair
                const currentPair = state.getCurrentTaxonImageCollection()?.pair;
                logger.debug("currentPair", currentPair);

                // Check if the current pair is in the filtered collection
                const currentPairInCollection = currentPair && filteredPairs.some(pair => pair.pairID === currentPair.pairID);

                if (!currentPairInCollection && filteredPairs.length > 0) {
                    // Only load a new pair if the current pair is not in the filtered collection

                    preloader.clearPreloadedPair();

                    const randomPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                    await pairManager.loadNewPair(randomPair.pairID);
                    if (this.loadNewPairTimeout) {
                        clearTimeout(this.loadNewPairTimeout);
                    }
                } else if (filteredPairs.length === 0) {
                    logger.warn("No pairs available in the current filtered collection");
                    ui.showOverlay("No pairs available for the current filters. Please adjust your selection.", config.overlayColors.red);
                }
                // If the current pair is in the collection, do nothing and keep the current pair
            } catch (error) {
                logger.error("Error in handleCollectionManagerDone:", error);
            } finally {
                this.isLoadingNewPair = false;
            }
        },

        handleTaxonPairSelection(pair) {
            if (this.isSelectionInProgress) return;
            this.isSelectionInProgress = true;

            const selectedPair = {
                taxonA: pair.taxonNames[0],
                taxonB: pair.taxonNames[1],
                pairName: pair.pairName,
                tags: [...pair.tags],
                pairID: pair.pairID,
                level: pair.level
            };
            //logger.debug('Selected pair:', selectedPair);
            dialogManager.closeDialog('collection-dialog');
            
            // Clear the preloaded pair before setting up the new game
            preloader.clearPreloadedPair();
            
            // Pass the pairID to loadNewPair
            pairManager.loadNewPair(selectedPair.pairID).finally(() => {
                this.isSelectionInProgress = false;
            });
        },
    },
};

// Bind all methods in phylogenySelector and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(collectionManager);

const publicAPI = {
    initialize: collectionManager.initialization.initialize,
    openCollectionManagerDialog: collectionManager.ui.openCollectionManagerDialog,
    setupCollectionManagerDialog: collectionManager.initialization.setupCollectionManagerDialog,

    updateTaxonList: collectionManager.taxonList.updateTaxonList,
    renderTaxonList: collectionManager.taxonList.renderTaxonList,
    onFiltersChanged: collectionManager.taxonList.onFiltersChanged,
    syncTaxonInfoVisibility: collectionManager.taxonList.syncTaxonInfoVisibility,

    updateFilterSummary: collectionManager.ui.updateFilterSummary,
    updateActiveCollectionCount: collectionManager.ui.updateActiveCollectionCount,

    updateLevelCounts: collectionManager.ui.updateLevelCounts,
    getFilteredCountForLevel: collectionManager.ui.getFilteredCountForLevel,
    handleLevelChange: collectionManager.ui.handleLevelChange,
};

export default publicAPI;
