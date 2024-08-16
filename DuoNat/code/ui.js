import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import mainEventHandler from './mainEventHandler.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import state from './state.js';
import tutorial from './tutorial.js';
import worldMap from './worldMap.js';

const bindAllMethods = (obj) => {
    for (let prop in obj) {
        if (typeof obj[prop] === 'function') {
            obj[prop] = obj[prop].bind(obj);
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            bindAllMethods(obj[prop]);
        }
    }
};

const vernacularNameCache = new Map();

async function getCachedVernacularName(taxonName) {
    if (!vernacularNameCache.has(taxonName)) {
        const vernacularName = await api.vernacular.fetchVernacular(taxonName);
        vernacularNameCache.set(taxonName, vernacularName);
    }
    return vernacularNameCache.get(taxonName) || 'n/a';
}

const ui = {

    state: {
        isMenuOpen: false,
    },

    core: {
        initialize() {
            this.initializeMenu();
            this.setupOutsideClickHandler(); // Close the dropdown when clicking outside of it
        },

        initializeMenu() {
            ui.menu.initialize();
            ui.menu.close();
        },

        setupOutsideClickHandler() {
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.main-menu')) {
                    ui.menu.close();
                }
            });
        },

        resetUIState() {
            ui.menu.close();
            // Add any other UI state resets here if needed
        },

        resetGameContainerStyle() {
            ['.game-container', '#image-container-1', '#image-container-2'].forEach(selector => 
                this.resetContainerTransform(selector)
            );
        },

        resetContainerTransform(selector) {
            const container = document.querySelector(selector);
            if (container) {
                container.style.transform = '';
                container.style.opacity = '';
            }
        },
    },

    overlay: {
        showOverlay(message = "", color) {
            this.setOverlayContent(message, color);
            this.adjustFontSize(message);
            state.getElement('overlay').classList.add('show');
        },

        setOverlayContent(message, color) {
            state.getElement('overlayMessage').innerHTML = message;
            state.getElement('overlay').style.backgroundColor = color;
        },

        adjustFontSize(message) {
            const fontSize = message.length > 20 ? '1.4em' : '2.4em';
            state.getElement('overlayMessage').style.fontSize = fontSize;
        },

        updateOverlayMessage(message) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.innerHTML = message;
            this.adjustFontSize(message);
        },

        hideOverlay() {
            state.getElement('overlay').classList.remove('show');
        },
    },

    menu: {
        initialize() {
            this.setupMenuToggle();
            this.setupResizeHandler();
            this.setupOutsideClickHandler();
        },

        open() {
            ui.state.isMenuOpen = true;
            this.toggleDropdownGroups();
        },

        setupMenuToggle() {
            const menuToggle = document.getElementById('menu-toggle');
            if (menuToggle) {
                menuToggle.addEventListener('click', this.handleMenuToggleClick);
            } else {
                logger.error('Menu toggle button not found');
            }
        },

        setupResizeHandler() {
            window.addEventListener('resize', this.positionBottomGroup);
            this.positionBottomGroup();
        },

        setupOutsideClickHandler() {
            document.addEventListener('click', this.handleOutsideClick);
        },

        handleOutsideClick(event) {
            if (!event.target.closest('.main-menu') && !tutorial.isActive()) {
                ui.menu.close();
            }
        },

        handleMenuToggleClick(event) {
            event.stopPropagation();
            this.toggleMainMenu();
        },

        toggleMainMenu() {
            if (!tutorial.isActive() || this.isMenuForcedOpen) {
                ui.state.isMenuOpen = !ui.state.isMenuOpen;
                this.toggleDropdownGroups();
            }
        },

        toggleDropdownGroups() {
            const topGroup = document.querySelector('.main-menu__dropdown--top');
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');

            if (topGroup && bottomGroup) {
                topGroup.classList.toggle('show');
                bottomGroup.classList.toggle('show');

                if (ui.state.isMenuOpen) {
                    this.positionBottomGroup();
                }
            } else {
                logger.error('Dropdown groups not found');
            }
        },

        positionBottomGroup() {
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
            const lowerImageContainer = document.querySelector('#image-container-2');

            if (bottomGroup && lowerImageContainer) {
                const rect = lowerImageContainer.getBoundingClientRect();
                bottomGroup.style.top = `${rect.top}px`;
                bottomGroup.style.right = '0px'; // Adjust if needed
            }
        },

        close() {
            if (tutorial.isActive() && tutorial.isMenuForcedOpen) {
                return; // Don't close the menu if it's forced open during the tutorial
            }
            if (ui.state.isMenuOpen) {
                ui.menu.closeDropdownGroups();
            }
        },

        closeDropdownGroups() {
            const topGroup = document.querySelector('.main-menu__dropdown--top');
            const bottomGroup = document.querySelector('.main-menu__dropdown--bottom');
            if (topGroup && bottomGroup) {
                ui.state.isMenuOpen = false;
                topGroup.classList.remove('show');
                bottomGroup.classList.remove('show');
            }
        },
    },

    taxonPairList: {
        async showTaxonPairList() {
            try {
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                if (taxonPairs.length === 0) {
                    logger.error("No taxon pairs available");
                    return;
                }

                const filters = {
                    level: state.getSelectedLevel(),
                    ranges: state.getSelectedRanges(),
                    tags: state.getSelectedTags(),
                    searchTerm: state.getSearchTerm()
                };

                let filteredPairs = gameLogic.filterTaxonPairs(taxonPairs, filters);
                
                await this.renderTaxonPairList(taxonPairs);
                this.setupDialogAndFilters();
            } catch (error) {
                logger.error("Error in showTaxonPairList:", error);
            }
        },

        getCurrentFilters() {
            return {
                level: state.getSelectedLevel(),
                ranges: state.getSelectedRanges(),
                tags: state.getSelectedTags(),
                searchTerm: state.getSearchTerm()
            };
        },

        prioritizeCurrentActiveSet(filteredPairs) {
            const currentActiveSet = state.getCurrentTaxonImageCollection()?.pair;
            if (currentActiveSet) {
                const activeSetIndex = filteredPairs.findIndex(pair => 
                    pair.taxonNames[0] === currentActiveSet.taxon1 && 
                    pair.taxonNames[1] === currentActiveSet.taxon2
                );
                if (activeSetIndex !== -1) {
                    const activeSet = filteredPairs.splice(activeSetIndex, 1)[0];
                    filteredPairs.unshift(activeSet);
                }
            }
            return filteredPairs;
        },

        async renderTaxonPairList(pairs) {
            const list = document.getElementById('taxon-set-list');
            if (list) {
                list.innerHTML = '';
            }
            await this.renderVisibleTaxonPairs(pairs);
            this.updateActiveCollectionCount(pairs.length);
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

        setupDialogAndFilters() {
            this.setLevelDropdownValue();
            dialogManager.openDialog('select-set-dialog');
            this.updateFilterSummary();
            this.focusSearchInput();
            this.handleExistingSearch();
        },

        setLevelDropdownValue() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.value = state.getSelectedLevel();
            }
        },

        handleExistingSearch() {
            const searchInput = document.getElementById('taxon-search');
            if (searchInput && searchInput.value.trim() !== '') {
                const event = new Event('input', { bubbles: true, cancelable: true });
                searchInput.dispatchEvent(event);
            }
            this.toggleClearButton(searchInput);
        },

        toggleClearButton(searchInput) {
            const clearButton = document.getElementById('clear-search');
            if (clearButton) {
                clearButton.style.display = searchInput.value.trim() !== '' ? 'block' : 'none';
            }
        },

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

        async createTaxonPairButton(pair) {
            const button = document.createElement('button');
            button.className = 'taxon-set-button';

            const vernacular1 = await this.getVernacularName(pair.taxonNames[0]);
            const vernacular2 = await this.getVernacularName(pair.taxonNames[1]);

            button.innerHTML = this.createButtonHTML(pair, vernacular1, vernacular2);
            button.onclick = () => this.handleTaxonPairSelection(pair);

            return button;
        },

        async getVernacularName(taxonName) {
            const result = await getCachedVernacularName(taxonName);
            return result === "n/a" ? "" : result;
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

        updateTaxonPairList: async function (filteredPairs) {
            const list = document.getElementById('taxon-set-list');
            list.innerHTML = '';

//            logger.debug(`Updating taxon set list with ${filteredPairs ? filteredPairs.length : 0} pairs`);

            if (!filteredPairs || filteredPairs.length === 0) {
                this.displayNoResultsMessage(list);
            } else {
                await this.populateListWithPairs(list, filteredPairs);
            }

            this.updateActiveCollectionCount(filteredPairs ? filteredPairs.length : 0);
            this.updateFilterSummary();
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

        getChiliHtml: function (level) {
            const chiliCount = parseInt(level) || 0;
            return Array(chiliCount).fill('<svg class="icon taxon-set__icon-chili"><use href="./images/icons.svg#icon-spicy"/></svg>').join('');
        },

        focusSearchInput: function () {
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

        updateActiveCollectionCount: function (count) {
            const countElement = document.getElementById('active-collection-count');
            if (countElement) {
                countElement.textContent = `Active collection: ${count} set${count !== 1 ? 's' : ''}`;
            }
        },

        updateVernacularNames: async function (button, pair) {
            const vernacular1 = await getCachedVernacularName(pair.taxon1);
            const vernacular2 = await getCachedVernacularName(pair.taxon2);

            const vernacularElements = button.querySelectorAll('.vernacular-name');
            vernacularElements[0].textContent = vernacular1 || '';
            vernacularElements[1].textContent = vernacular2 || '';
        },
    },

    levelIndicator: {
        updateLevelIndicator(level) {
            const indicator = document.getElementById('level-indicator');
            if (!indicator) return;

            indicator.innerHTML = this.generateChiliIcons(level);
            this.adjustIndicatorWidth(indicator, level);
        },

        generateChiliIcons(level) {
            const chiliCount = parseInt(level) || 0;
            return Array(chiliCount).fill().map(() => this.createChiliSVG()).join('');
        },

        createChiliSVG() {
            return `
                <svg class="icon icon-chili" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <use xlink:href="./images/icons.svg#icon-spicy" transform="scale(1.2) translate(-2, -2)"></use>
                </svg>
            `;
        },

        adjustIndicatorWidth(indicator, level) {
            const chiliCount = parseInt(level) || 0;
            indicator.style.width = `${chiliCount * 26 + 16}px`;
        }
    },

    notifications: {
        showPopupNotification(message, duration = 3000) {
            const popup = this.createPopup(message);
            this.showPopup(popup);
            this.schedulePopupRemoval(popup, duration);
        },

        createPopup(message) {
            const popup = document.createElement('div');
            popup.className = 'popup-notification';
            popup.textContent = message;
            document.body.appendChild(popup);
            return popup;
        },

        showPopup(popup) {
            // Trigger a reflow before adding the 'show' class
            popup.offsetHeight;
            popup.classList.add('show');
        },

        schedulePopupRemoval(popup, duration) {
            setTimeout(() => {
                this.removePopup(popup);
            }, duration);
        },

        removePopup(popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(popup);
            }, 300); // Wait for the fade out animation to complete
        },
    },

    filters: {
        updateLevelDropdown() {
            const levelDropdown = document.getElementById('level-filter-dropdown');
            if (levelDropdown) {
                levelDropdown.value = state.getSelectedLevel();
            }
        },

    },

};

bindAllMethods(ui);

const publicAPI = {
    // Overlay
    showOverlay: ui.overlay.showOverlay,
    updateOverlayMessage: ui.overlay.updateOverlayMessage,
    hideOverlay: ui.overlay.hideOverlay,
    // Taxon pairs
    showTaxonPairList: ui.taxonPairList.showTaxonPairList,
    updateTaxonPairList: ui.taxonPairList.updateTaxonPairList,
    renderTaxonPairList: ui.taxonPairList.renderTaxonPairList,
    // Menu
    toggleMainMenu: ui.menu.toggleMainMenu,
    openMenu: ui.menu.open,
    closeMenu: ui.menu.close,
    // Core
    resetUIState: ui.core.resetUIState,
    initialize: ui.core.initialize,
    // Level
    updateLevelIndicator: ui.levelIndicator.updateLevelIndicator,
    updateLevelDropdown: ui.filters.updateLevelDropdown,
    // Misc
    updateFilterSummary: ui.taxonPairList.updateFilterSummary,
    updateActiveCollectionCount: ui.taxonPairList.updateActiveCollectionCount,
    showPopupNotification: ui.notifications.showPopupNotification,
};

export default publicAPI;
//export default ui;

