import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import eventMain from './eventMain.js';
import gameLogic from './gameLogic.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import state from './state.js';
import tutorial from './tutorial.js';
import worldMap from './worldMap.js';

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
        showOverlay(message = "", color = config.overlayColors.green) {
            logger.debug(`Showing overlay: message="${message}", color=${color}`);
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

            logger.debug(`Overlay element classes: ${overlay.className}`);
            logger.debug(`Overlay message content: ${overlayMessage.innerHTML}`);
            logger.debug(`Overlay message opacity: ${overlayMessage.style.opacity}`);
        },

        updateOverlayMessage(message) {
            const overlayMessage = document.getElementById('overlay-message');
            overlayMessage.innerHTML = message;
            this.adjustFontSize(message);
        },

        hideOverlay() {
            logger.debug('Hiding overlay');
            const overlay = state.getElement('overlay');
            overlay.classList.remove('show');
            logger.debug(`Overlay element classes after hiding: ${overlay.className}`);
        },

        setOverlayContent(message, color) {
            state.getElement('overlayMessage').innerHTML = message;
            state.getElement('overlay').style.backgroundColor = color;
        },

        adjustFontSize(message) {
            const fontSize = message.length > 20 ? '1.4em' : '2.4em';
            state.getElement('overlayMessage').style.fontSize = fontSize;
        },
    
        createDialogOverlay(dialogElement) {
            const taxonSetList = dialogElement.querySelector('#taxon-set-list');
            if (!taxonSetList) {
                console.error('Taxon set list not found in the dialog');
                return;
            }

            const overlay = document.createElement('div');
            overlay.id = 'dialog-tutorial-overlay';
            overlay.className = 'dialog-tutorial-overlay';
            overlay.innerHTML = '<div class="dialog-tutorial-overlay__message"></div>';
            
            // Insert the overlay as a sibling of the taxon set list
            taxonSetList.parentNode.insertBefore(overlay, taxonSetList.nextSibling);

            // Position the overlay
            this.positionOverlay(overlay, dialogElement);

            // Add a mutation observer to reposition the overlay when the taxon set list changes
            const observer = new MutationObserver(() => this.positionOverlay(overlay, dialogElement));
            observer.observe(taxonSetList, { childList: true, subtree: true });

            // Store the observer in the overlay element for later cleanup
            overlay.mutationObserver = observer;
        },

        positionOverlay(overlay, dialogElement) {
            const firstTaxonButton = dialogElement.querySelector('.taxon-set-button');
            if (!firstTaxonButton) {
                console.error('No taxon set button found');
                return;
            }

            const buttonRect = firstTaxonButton.getBoundingClientRect();
            const dialogRect = dialogElement.getBoundingClientRect();

            overlay.style.position = 'absolute';
            overlay.style.top = `${buttonRect.top - dialogRect.top}px`;
            overlay.style.left = `${buttonRect.left - dialogRect.left}px`;
            overlay.style.width = `${buttonRect.width}px`;
            overlay.style.height = `${buttonRect.height}px`;
        },

        updateDialogOverlayMessage(message) {
            const overlayMessage = document.querySelector('.dialog-tutorial-overlay__message');
            if (overlayMessage) {
                overlayMessage.innerHTML = message;
            }
        },

        removeDialogOverlay() {
            const overlay = document.getElementById('dialog-tutorial-overlay');
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
                bottomGroup.style.right = '0px'; // Adjust if needed
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

    imageHandling: {
        prepareImagesForLoading() {
            const imageOne = state.getElement('imageOne');
            const imageTwo = state.getElement('imageTwo');
            
            imageOne.classList.remove('image-container__image--fade-in');
            imageTwo.classList.remove('image-container__image--fade-in');
            
            imageOne.classList.add('image-container__image--loading');
            imageTwo.classList.add('image-container__image--loading');
        },
    },

    layoutManagement: {
        // determine height of tallest name tile, to keep layout stable over multiple rounds
        setNamePairHeight() {
            const leftName = document.getElementById('left-name');
            const rightName = document.getElementById('right-name');
            const namePair = document.querySelector('.name-pair');

            this._resetHeights(leftName, rightName, namePair);
            this._setMaxHeight(leftName, rightName, namePair);
        },

        _resetHeights(leftName, rightName, namePair) {
            leftName.style.height = 'auto';
            rightName.style.height = 'auto';
            namePair.style.height = 'auto';
        },

        _setMaxHeight(leftName, rightName, namePair) {
            requestAnimationFrame(() => {
                const maxHeight = Math.max(leftName.offsetHeight, rightName.offsetHeight);
                this._applyHeights(leftName, rightName, namePair, maxHeight);
            });
        },

        _applyHeights(leftName, rightName, namePair, maxHeight) {
            namePair.style.height = `${maxHeight}px`;
            leftName.style.height = `${maxHeight}px`;
            rightName.style.height = `${maxHeight}px`;
        }
    },

    nameTiles: {
        setupNameTilesUI(leftName, rightName, leftNameVernacular, rightNameVernacular) {
            const { nameOne, nameTwo, vernacularOne, vernacularTwo } = this._randomizeNames(leftName, rightName, leftNameVernacular, rightNameVernacular);

            this._setNameAttributes(nameOne, nameTwo);
            this._setNameContent(nameOne, nameTwo, vernacularOne, vernacularTwo);
            this._updateGameState(nameOne, nameTwo);

            ui.layoutManagement.setNamePairHeight();
        },

        _randomizeNames(leftName, rightName, leftNameVernacular, rightNameVernacular) {
            const shouldSwap = Math.random() < 0.5;
            return {
                nameOne: shouldSwap ? rightName : leftName,
                nameTwo: shouldSwap ? leftName : rightName,
                vernacularOne: shouldSwap ? rightNameVernacular : leftNameVernacular,
                vernacularTwo: shouldSwap ? leftNameVernacular : rightNameVernacular
            };
        },

        _setNameAttributes(nameOne, nameTwo) {
            state.getElement('leftName').setAttribute('data-taxon', nameOne);
            state.getElement('rightName').setAttribute('data-taxon', nameTwo);
            state.getElement('leftName').style.zIndex = '10';
            state.getElement('rightName').style.zIndex = '10';
        },

        _setNameContent(nameOne, nameTwo, vernacularOne, vernacularTwo) {
            state.getElement('leftName').innerHTML = this._createNameHTML(nameOne, vernacularOne);
            state.getElement('rightName').innerHTML = this._createNameHTML(nameTwo, vernacularTwo);
        },

        _createNameHTML(name, vernacular) {
            return `
                <span class="name-pair__taxon-name">${name}</span>
                ${vernacular && vernacular !== "-" ? `<span class="name-pair__vernacular-name">${vernacular}</span>` : ''}
            `;
        },

        _updateGameState(nameOne, nameTwo) {
            state.setTaxonLeftName = nameOne;
            state.setTaxonRightName = nameTwo;
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
    // Overlay
    showOverlay: ui.overlay.showOverlay,
    updateOverlayMessage: ui.overlay.updateOverlayMessage,
    hideOverlay: ui.overlay.hideOverlay,
    createDialogOverlay: ui.overlay.createDialogOverlay,
    updateDialogOverlayMessage: ui.overlay.updateDialogOverlayMessage,
    removeDialogOverlay: ui.overlay.removeDialogOverlay,
    // Menu
    toggleMainMenu: ui.menu.toggleMainMenu,
    openMenu: ui.menu.open,
    closeMenu: ui.menu.close,
    // Core
    resetUIState: ui.core.resetUIState,
    initialize: ui.core.initialize,
    // Level
    updateLevelIndicator: ui.levelIndicator.updateLevelIndicator,
    // Misc
    showPopupNotification: ui.notifications.showPopupNotification,
    // from gameUI
    setNamePairHeight: ui.layoutManagement.setNamePairHeight,
    setupNameTilesUI: ui.nameTiles.setupNameTilesUI,
    prepareImagesForLoading: ui.imageHandling.prepareImagesForLoading,
};

export default publicAPI;
