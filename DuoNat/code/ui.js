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

};

bindAllMethods(ui);

const publicAPI = {
    // Overlay
    showOverlay: ui.overlay.showOverlay,
    updateOverlayMessage: ui.overlay.updateOverlayMessage,
    hideOverlay: ui.overlay.hideOverlay,
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
};

export default publicAPI;
//export default ui;

