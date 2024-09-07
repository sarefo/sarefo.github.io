import collectionManager from './collectionManager.js';
import config from './config.js';
import filtering from './filtering.js';
import hintSystem from './hintSystem.js';
import logger from './logger.js';
import pairManager from './pairManager.js';
import state from './state.js';
import tutorial from './tutorial.js';

const ui = {

    // Modules:
    // - state
    // - core
    // - overlay
    // - menu
    // - levelIndicator
    // - notifications
    // - layoutManagement
    // - nameTiles
    // - imageHandling
    // - orientation

    state: {
        isMenuOpen: false,
    },

    core: {
        initialize() {
            this.initializeMenu();
            this.setupOutsideClickHandler();
            hintSystem.initialize();
            // TODO determine screen orientation
            ui.orientation.setInitialOrientation();
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
        showOverlay(message = "", color = config.overlayColors.green) {
            this.setOverlayContent(message, color);
            this.adjustFontSize(message);
            const overlay = state.getElement('overlay');
            const overlayMessage = state.getElement('overlayMessage');
            
            // Reset any transition and set opacity to 1
            overlayMessage.style.transition = 'none';
            overlayMessage.style.opacity = '1';
            
            overlay.classList.add('show');
            
            // Force a redraw
            overlay.offsetHeight;
            
            // Restore the transition for future animations
            overlayMessage.style.transition = 'opacity 0.3s ease-out';
        },

        updateOverlayMessage(message) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.innerHTML = message;
            this.adjustFontSize(message);
        },

        hideOverlay() {
            const overlay = state.getElement('overlay');
            overlay.classList.remove('show');
        },

        setOverlayContent(message, color) {
            state.getElement('overlayMessage').innerHTML = message;
            state.getElement('overlay').style.backgroundColor = color;
        },

        adjustFontSize(message) {
            const fontSize = message.length > 20 ? '1.4em' : '2.4em';
            state.getElement('overlayMessage').style.fontSize = fontSize;
        },
    
        createCollectionManagerOverlay(dialogElement) {
            const taxonPairList = dialogElement.querySelector('#taxon-pair-list');
            if (!taxonPairList) {
                logger.error('Taxon pair list not found in the dialog');
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'dialog-tutorial-overlay';
            overlay.className = 'dialog-tutorial-overlay';
            overlay.innerHTML = '<div class="dialog-tutorial-overlay__message"></div>';
            
            // Insert the overlay as a sibling of the taxon pair list
            taxonPairList.parentNode.insertBefore(overlay, taxonPairList.nextSibling);

            // Position the overlay
            this.positionOverlay(overlay, dialogElement);

            // Add a mutation observer to reposition the overlay when the taxon pair list changes
            const observer = new MutationObserver(() => this.positionOverlay(overlay, dialogElement));
            observer.observe(taxonPairList, { childList: true, subtree: true });

            // Store the observer in the overlay element for later cleanup
            overlay.mutationObserver = observer;
        },

        positionOverlay(overlay, dialogElement) {
            const firstTaxonButton = dialogElement.querySelector('.taxon-pair-button');
            if (!firstTaxonButton) {
                logger.error('No taxon pair button found');
                return;
            }

            const buttonRect = firstTaxonButton.getBoundingClientRect();
            const dialogRect = dialogElement.getBoundingClientRect();

            overlay.style.position = 'absolute';
            overlay.style.top = `${buttonRect.top - dialogRect.top}px`;
            overlay.style.left = `${buttonRect.left - dialogRect.left}px`;
            overlay.style.width = `${buttonRect.width}px`;
            overlay.style.height = `${buttonRect.height}px`;
            overlay.style.pointerEvents = 'none'; // Allow clicks to pass through
        },

        createInfoDialogOverlay(dialogElement) {
            const overlay = document.createElement('div');
            overlay.id = 'info-dialog-tutorial-overlay';
            overlay.className = 'dialog-tutorial-overlay';
            overlay.innerHTML = '<div class="dialog-tutorial-overlay__message"></div>';
            
            const factContainer = document.getElementById(`info-dialog-facts`);
            factContainer.appendChild(overlay); 

            const factsRect = factContainer.getBoundingClientRect();
            const dialogRect = dialogElement.getBoundingClientRect();
            
            overlay.style.bottom = `${dialogRect.bottom - factsRect.bottom}px`;
            overlay.style.left = `${factsRect.left - dialogRect.left}px`;
            overlay.style.width = `${factsRect.width}px`;
        },

        updateDialogOverlayMessage(message) {
            const overlayMessage = document.querySelector('.dialog-tutorial-overlay__message');
            if (overlayMessage) {
                overlayMessage.innerHTML = message;
            }
        },

        removeDialogOverlay() {
            const overlay = document.querySelector('[id$="dialog-tutorial-overlay"]');

            if (overlay) {
                // Disconnect the mutation observer if it exists
                if (overlay.mutationObserver) {
                    overlay.mutationObserver.disconnect();
                }
                overlay.remove();
            }
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
                this.close();
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
                bottomGroup.style.right = '0px';
            }
        },

        close() {
            if (tutorial.isActive() && tutorial.isMenuForcedOpen) {
                return; // Don't close the menu if it's forced open during the tutorial
            }
            if (ui.state.isMenuOpen) {
                this.closeDropdownGroups();
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

    levelIndicator: {

        // called only from pairmanager.loadNewPair()
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

        hideLoadingScreen() {
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('loading-screen--fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                loadingScreen.remove();
            }, 500); // This matches the transition duration in CSS
        },

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

    layoutManagement: {

        // only called at end of loadNewRound()
        // determines height of tallest name tile, to keep layout stable over multiple rounds
        setNamePairHeight() {
            const nameX = document.getElementById('name-x');
            const nameY = document.getElementById('name-y');
            const namePair = document.querySelector('.name-pair');

            this._resetHeights(nameX, nameY, namePair);
            this._setMaxHeight(nameX, nameY, namePair);
        },

        _resetHeights(nameX, nameY, namePair) {
            nameX.style.height = 'auto';
            nameY.style.height = 'auto';
            namePair.style.height = 'auto';
        },

        _setMaxHeight(nameX, nameY, namePair) {
            requestAnimationFrame(() => {
                const maxHeight = Math.max(nameX.offsetHeight, nameY.offsetHeight);
                this._applyHeights(nameX, nameY, namePair, maxHeight);
            });
        },

        _applyHeights(nameX, nameY, namePair, maxHeight) {
            namePair.style.height = `${maxHeight}px`;
            nameX.style.height = `${maxHeight}px`;
            nameY.style.height = `${maxHeight}px`;
        },

        // called from:
        // - pairManager.loadNewPair()
        // - roundManager.loadNewRound()
        async updateUIAfterSetup() {
            if (filtering.areAllFiltersDefault()) collectionManager.updateFilterSummary();

            state.setState(state.GameState.PLAYING);

            if (state.getIsInitialLoad()) {
                ui.notifications.hideLoadingScreen();
                state.setIsInitialLoad(false);
            }
            ui.core.resetUIState();
            ui.overlay.hideOverlay();
            state.setState(state.GameState.PLAYING);

            // Initialize the collection subset after the game has loaded
            pairManager.initializeCollectionSubset().catch(error => {
                logger.error("Error initializing collection subset:", error);
            });
        },
    },

    nameTiles: {
        setupNameTilesUI(nameX, nameY, nameXVernacular, nameYVernacular) {
            const { nameOne, nameTwo, vernacularOne, vernacularTwo } = this._randomizeNames(nameX, nameY, nameXVernacular, nameYVernacular);

            this._setNameAttributes(nameOne, nameTwo);
            this._setNameContent(nameOne, nameTwo, vernacularOne, vernacularTwo);
            this._updateGameState(nameOne, nameTwo);
        },

        _randomizeNames(nameX, nameY, nameXVernacular, nameYVernacular) {
            const shouldSwap = Math.random() < 0.5;
            return {
                nameOne: shouldSwap ? nameY : nameX,
                nameTwo: shouldSwap ? nameX : nameY,
                vernacularOne: shouldSwap ? nameYVernacular : nameXVernacular,
                vernacularTwo: shouldSwap ? nameXVernacular : nameYVernacular
            };
        },

        _setNameAttributes(nameOne, nameTwo) {
            state.getElement('nameX').setAttribute('data-taxon', nameOne);
            state.getElement('nameY').setAttribute('data-taxon', nameTwo);
            state.getElement('nameX').style.zIndex = '10';
            state.getElement('nameY').style.zIndex = '10';
        },

        _setNameContent(nameOne, nameTwo, vernacularOne, vernacularTwo) {
            state.getElement('nameX').innerHTML = this._createNameHTML(nameOne, vernacularOne);
            state.getElement('nameY').innerHTML = this._createNameHTML(nameTwo, vernacularTwo);
        },

        _createNameHTML(name, vernacular) {
            return `
                <span class="name-pair__taxon-name">${name}</span>
                ${vernacular && vernacular !== "-" ? `<span class="name-pair__vernacular-name">${vernacular}</span>` : ''}
            `;
        },

        _updateGameState(name1, name2) {
            state.setTaxonNameX = name1;
            state.setTaxonNameY = name2;
        },

        resetDraggables() {
            const nameXContainer = document.getElementsByClassName('name-pair__container--x')[0];
            const nameYContainer = document.getElementsByClassName('name-pair__container--y')[0];
            const drop1 = document.getElementById('drop-1');
            const drop2 = document.getElementById('drop-2');

            nameXContainer.appendChild(document.getElementById('name-x'));
            nameYContainer.appendChild(document.getElementById('name-y'));

            drop1.innerHTML = '';
            drop2.innerHTML = '';
        },
    },

    imageHandling: {

        // called from:
        // - roundManager.loadNewRound()
        // - gameLogic.handleCorrectAnswer()
        prepareImagesForLoading() {
            const image1 = state.getElement('image1');
            const image2 = state.getElement('image2');
            
            image1.classList.remove('image-container__image--fade-in');
            image2.classList.remove('image-container__image--fade-in');
            
            image1.classList.add('image-container__image--loading');
            image2.classList.add('image-container__image--loading');
        },
    },

    orientation: {
        setInitialOrientation() {
            const isLandscape = window.innerWidth > window.innerHeight;
            const minWidth = 1200; // Adjust this value as needed
            state.setUseLandscape(isLandscape && window.innerWidth >= minWidth);
            this.applyOrientationLayout();
        },

        applyOrientationLayout() {
            // TODO enable once ready
            let useLandscape;
            // false = disable landscape mode
            if (false) { useLandscape = state.getUseLandscape() } else { useLandscape = false;}
            document.body.classList.toggle('landscape-layout', useLandscape);
            document.body.classList.toggle('portrait-layout', !useLandscape);

            this.updateMainViewLayout(useLandscape);
            this.updateInfoDialogLayout(useLandscape);
            //this.updateNameTilesLayout(useLandscape);
            //this.updateUIContainerPosition(useLandscape); // Add this line

            logger.warn("Orientation changed to", useLandscape ? "landscape" : "portrait");
        },

        updateMainViewLayout(useLandscape) {
            const gameContainer = document.querySelector('.game-container');
            if (useLandscape) {
                //gameContainer.classList.add('landscape');
                // Disable swiping in landscape mode
                // You'll need to implement this in your swipe handling code
            } else {
                //gameContainer.classList.remove('landscape');
                // Enable swiping in portrait mode
            }
        },

        updateInfoDialogLayout(useLandscape) {
            // This function will be called when the info dialog is opened
            // You'll need to modify your info dialog code to use this
            const infoDialog = document.querySelector('.info-dialog');
            if (infoDialog) {
                infoDialog.classList.toggle('landscape', useLandscape);
            }
        },

        /*updateNameTilesLayout(useLandscape) {
            const namePair = document.querySelector('.name-pair');
            if (useLandscape) {
                namePair.classList.add('landscape');
            } else {
                namePair.classList.remove('landscape');
            }
        },*/

        updateUIContainerPosition(useLandscape) {
            const uiContainer = document.querySelector('.ui-container');
            if (!uiContainer) return;

            if (useLandscape) {
                uiContainer.style.left = '50%';
                uiContainer.style.right = 'auto';
                uiContainer.style.top = '20px';
                uiContainer.style.transform = 'translateX(-50%)';
                uiContainer.style.width = 'auto';
            } else {
                uiContainer.style.left = '50%';
                uiContainer.style.right = 'auto';
                uiContainer.style.top = '10px';
                uiContainer.style.transform = 'translateX(-50%)';
                uiContainer.style.width = '98vw';
                uiContainer.style.maxWidth = 'var(--max-image-width)';
            }
        },

        handleOrientationChange() {
            const isLandscape = window.innerWidth > window.innerHeight;
            const minWidth = 1200; // Adjust this value as needed
            const newUseLandscape = isLandscape && window.innerWidth >= minWidth;
            
            if (newUseLandscape !== state.getUseLandscape()) {
                state.setUseLandscape(newUseLandscape);
                this.applyOrientationLayout();
            }
        }
    },
};

const bindAllMethods = (obj) => {
    for (let prop in obj) {
        if (typeof obj[prop] === 'function') {
            obj[prop] = obj[prop].bind(obj);
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            bindAllMethods(obj[prop]);
        }
    }
};

bindAllMethods(ui);

const publicAPI = {

    // Core
    resetUIState: ui.core.resetUIState,
    initialize: ui.core.initialize,

    // Main view
    setNamePairHeight: ui.layoutManagement.setNamePairHeight,
    setupNameTilesUI: ui.nameTiles.setupNameTilesUI,
    resetDraggables: ui.nameTiles.resetDraggables,
    updateUIAfterSetup: ui.layoutManagement.updateUIAfterSetup,
    prepareImagesForLoading: ui.imageHandling.prepareImagesForLoading,

    // Overlay
    showOverlay: ui.overlay.showOverlay,
    updateOverlayMessage: ui.overlay.updateOverlayMessage,
    hideOverlay: ui.overlay.hideOverlay,
    createCollectionManagerOverlay: ui.overlay.createCollectionManagerOverlay,
    createInfoDialogOverlay: ui.overlay.createInfoDialogOverlay,
    updateDialogOverlayMessage: ui.overlay.updateDialogOverlayMessage,
    removeDialogOverlay: ui.overlay.removeDialogOverlay,

    // Menu
    toggleMainMenu: ui.menu.toggleMainMenu,
    openMenu: ui.menu.open,
    closeMenu: ui.menu.close,

    // Level
    updateLevelIndicator: ui.levelIndicator.updateLevelIndicator,

    // Misc
    showPopupNotification: ui.notifications.showPopupNotification,
    hideLoadingScreen: ui.notifications.hideLoadingScreen,
    handleOrientationChange: ui.orientation.handleOrientationChange,
};

export default publicAPI;
