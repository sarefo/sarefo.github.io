import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import gameLogic from './gameLogic.js';
import logger from './logger.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const game = {

    imageManagement: {
        loadImages: async function (leftImageSrc, rightImageSrc) {
            await Promise.all([
                this.loadImageAndRemoveLoadingClass(state.getElement('imageOne'), leftImageSrc),
                this.loadImageAndRemoveLoadingClass(state.getElement('imageTwo'), rightImageSrc)
            ]);
        },

        loadImageAndRemoveLoadingClass: async function (imgElement, src) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    imgElement.src = src;
                    imgElement.classList.remove('image-container__image--loading');
                    setTimeout(() => {
                        imgElement.classList.add('image-container__image--loaded');
                        resolve();
                    }, 50); // 50ms delay to ensure the browser has time to apply the new src
                };
                img.src = src;
            });
        },
    },

    // Misc
    // TODO move to config.js
    getLoadingMessage() {
        return config.loadingMessage;
    },

};

// Bind all methods to ensure correct 'this' context
Object.keys(game).forEach(key => {
    if (game[key] && typeof game[key] === 'object') {
        Object.keys(game[key]).forEach(subKey => {
            if (typeof game[key][subKey] === 'function') {
                game[key][subKey] = game[key][subKey].bind(game[key]);
            }
        });
    } else if (typeof game[key] === 'function') {
        game[key] = game[key].bind(game);
    }
});

const publicAPI = {
    loadImages: game.imageManagement.loadImages,
    getLoadingMessage: game.getLoadingMessage
};

// Initialize info buttons
//game.dialogHandling.initializeInfoButtons();

export default publicAPI;
