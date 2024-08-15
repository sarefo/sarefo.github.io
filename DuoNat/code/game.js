import api from './api.js';
import dialogManager from './dialogManager.js';
import { elements } from './state.js';
import gameLogic from './gameLogic.js';
import { GameState, gameState } from './state.js';
import logger from './logger.js';
import ui from './ui.js';
import utils from './utils.js';
import config from './config.js';

const game = {
    loadingMessage: "", // "Loading..."
    nextSelectedPair: null,
    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },
    currentState: GameState.IDLE,

    currentGraphTaxa: null,
    preloadedPair: null,
    preloadedImages: {
        current: {
            taxon1: [],
            taxon2: []
        },
        next: {
            taxon1: [],
            taxon2: []
        }
    },
    shownHints: {
        taxon1: [],
        taxon2: []
    },

    imageManagement: {
        loadImages: async function (leftImageSrc, rightImageSrc) {
            await Promise.all([
                this.loadImageAndRemoveLoadingClass(elements.imageOne, leftImageSrc),
                this.loadImageAndRemoveLoadingClass(elements.imageTwo, rightImageSrc)
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

        fetchTaxonImageCollection: async function (newPair) {
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts) {
                try {
                    return await this.attemptFetchTaxonImageCollection(newPair);
                } catch (error) {
                    attempts++;
                    if (this.shouldRetryFetch(error, attempts, maxAttempts)) {
                        await this.handleFetchError(error);
                    } else {
                        throw error;
                    }
                }
            }

            throw new Error("Failed to load images after multiple attempts");
        },

        attemptFetchTaxonImageCollection: async function (newPair) {
            if (newPair || !gameState.currentTaxonImageCollection) {
                if (game.nextSelectedPair) {
                    return await this.initializeNewTaxonPair(game.nextSelectedPair);
                } else if (game.preloadedPair) {
                    return this.usePreloadedPair();
                } else {
                    return await this.initializeNewTaxonPair();
                }
            }
            return gameState.currentTaxonImageCollection;
        },

        usePreloadedPair: function () {
            const collection = game.preloadedPair;
            game.preloadedPair = null;
            return collection;
        },

        shouldRetryFetch: function (error, attempts, maxAttempts) {
            return attempts < maxAttempts && error.message.includes("No images found");
        },

        handleFetchError: async function (error) {
            if (error.message.includes("No images found")) {
                const taxonName = error.message.split("No images found for ")[1];
                ui.showOverlay(`Warning: No images found for ${taxonName}. Trying another pair...`, config.overlayColors.red);
                await utils.ui.sleep(2000);
                game.nextSelectedPair = null;
            }
        },

        initializeNewTaxonPair: async function (pair = null) {
            const newPair = pair || await utils.game.selectTaxonPair();
            const [imageOneURL, imageTwoURL] = await Promise.all([
                api.images.fetchRandomImage(newPair.taxon1),
                api.images.fetchRandomImage(newPair.taxon2)
            ]);

            return {
                pair: newPair,
                imageOneURL,
                imageTwoURL,
                imageOneVernacular: null,
                imageTwoVernacular: null
            };
        }
    },

    dialogHandling: {
        initializeInfoButtons: function () {
            const infoButton1 = document.getElementById('info-button-1');
            const infoButton2 = document.getElementById('info-button-2');

            infoButton1.addEventListener('click', () => this.showInfoDialog(game.currentObservationURLs.imageOne, 1));
            infoButton2.addEventListener('click', () => this.showInfoDialog(game.currentObservationURLs.imageTwo, 2));

            this.setupInfoDialogCloseHandler();
        },

        setupInfoDialogCloseHandler: function () {
            document.getElementById('info-dialog').addEventListener('close', () => {
                document.querySelectorAll('.image-container').forEach(container => {
                    container.classList.remove('image-container--framed');
                });
            });
        },

        setupButtonHandlers: function (url, currentTaxon) {
            this.setupPhotoButton(url);
            this.setupObservationButton();
            this.setupTaxonButton(currentTaxon);
            this.setupWikiButton(currentTaxon);
            this.setupReportButton();
        },

        setupPhotoButton: function (url) {
            const photoButton = document.getElementById('photo-button');
            photoButton.onclick = () => {
                window.open(url, '_blank');
                dialogManager.closeDialog('info-dialog');
            };
        },

        setupObservationButton: function () {
            const observationButton = document.getElementById('observation-button');
            observationButton.onclick = () => {
                logger.debug("Observation button clicked");
                // Implement observation functionality here
            };
        },

        setupTaxonButton: function (currentTaxon) {
            const taxonButton = document.getElementById('taxon-button');
            taxonButton.onclick = async () => {
                try {
                    const taxonId = await api.taxonomy.fetchTaxonId(currentTaxon);
                    window.open(`https://www.inaturalist.org/taxa/${taxonId}`, '_blank');
                    dialogManager.closeDialog('info-dialog');
                } catch (error) {
                    alert("Unable to open taxon page. Please try again.");
                }
            };
        },

        setupWikiButton: function (currentTaxon) {
            const wikiButton = document.getElementById('wiki-button');
            wikiButton.onclick = () => {
                try {
                    window.open(`https://en.wikipedia.org/wiki/${currentTaxon}`, '_blank');
                    dialogManager.closeDialog('info-dialog');
                } catch (error) {
                    alert("Unable to open Wikipedia page. Please try again.");
                }
            };
        },

        setupReportButton: function () {
            const reportButton = document.getElementById('report-button');
            reportButton.onclick = () => {
                logger.debug("Report button clicked");
                // Implement report functionality here
            };
        },

        showInfoDialog: async function (url, imageIndex) {
            const currentTaxon = gameLogic.getCurrentTaxon(url); // TODO FIX looks like unnecessary fetch from gameLogic?
            if (!currentTaxon) return;

            const dialog = document.getElementById('info-dialog');
            this.frameImage(imageIndex);
            
            await this.populateDialogContent(currentTaxon);
            this.setupDialogButtons(url, currentTaxon);
            this.positionDialog(dialog, imageIndex);
            this.setupDialogEventListeners(dialog, imageIndex);

            if (!dialog.open) {
                dialog.showModal();
            }
        },

        populateDialogContent: async function (currentTaxon) {
            const taxonElement = document.getElementById('info-dialog-taxon');
            const vernacularElement = document.getElementById('info-dialog-vernacular');
            const factsElement = document.getElementById('info-dialog-facts');
            
            taxonElement.textContent = currentTaxon;
            
            try {
                const vernacularName = await api.vernacular.fetchVernacular(currentTaxon);
                vernacularElement.textContent = vernacularName;

                await this.populateTaxonFacts(currentTaxon, factsElement);
            } catch (error) {
                logger.error('Error in populateDialogContent:', error);
            }
        },

        populateTaxonFacts: async function (currentTaxon, factsElement) {
            const taxonInfo = await api.taxonomy.loadTaxonInfo();
            const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === currentTaxon.toLowerCase());
            
            if (taxonData && taxonData.taxonFacts && taxonData.taxonFacts.length > 1) {
                factsElement.innerHTML = '<h4>Facts:</h3><ul>' +
                    taxonData.taxonFacts.map(fact => `<li>${fact}</li>`).join('') +
                    '</ul>';
                factsElement.style.display = 'block';
            } else {
                factsElement.style.display = 'none';
            }
        },

        setupDialogButtons: async function (url, currentTaxon) {
            const wikiButton = document.getElementById('wiki-button');
            const hasWikipediaPage = await api.externalAPIs.checkWikipediaPage(currentTaxon);
            
            this.toggleButtonState(wikiButton, hasWikipediaPage);
            this.toggleButtonState(document.getElementById('observation-button'), false);
            // TODO: Enable when functionality added
            // this.toggleButtonState(document.getElementById('hints-button'), false);

            this.setupButtonHandlers(url, currentTaxon);
        },

        toggleButtonState: function (button, isEnabled) {
            if (isEnabled) {
                button.classList.remove('info-dialog__button--inactive');
                button.disabled = false;
            } else {
                button.classList.add('info-dialog__button--inactive');
                button.disabled = true;
            }
        },

        setupDialogEventListeners: function (dialog, imageIndex) {
            const closeButton = document.getElementById('info-close-button');
            closeButton.onclick = () => this.closeInfoDialog(dialog);

            dialog.addEventListener('close', this.handleDialogClose);

            window.addEventListener('resize', () => this.positionDialog(dialog, imageIndex));
        },

        closeInfoDialog: function (dialog) {
            dialog.close();
            this.removeImageFraming();
        },

        handleDialogClose: function () {
            this.removeImageFraming();
        },

        removeImageFraming: function () {
            document.querySelectorAll('.image-container').forEach(container => {
                container.classList.remove('image-container--framed');
            });
        },

        positionDialog: function (dialog, imageIndex) {
            const topImageContainer = document.getElementById('image-container-1');
            const bottomImageContainer = document.getElementById('image-container-2');
            const namePairContainer = document.querySelector('.name-pair');

            const dialogRect = dialog.getBoundingClientRect();
            const topContainerRect = topImageContainer.getBoundingClientRect();
            const bottomContainerRect = bottomImageContainer.getBoundingClientRect();
            const namePairRect = namePairContainer.getBoundingClientRect();

            if (imageIndex === 1) {
                dialog.style.top = `${namePairRect.top}px`;
                dialog.style.bottom = `${window.innerHeight - bottomContainerRect.bottom}px`;
            } else {
                dialog.style.top = `${topContainerRect.top}px`;
                dialog.style.bottom = `${window.innerHeight - namePairRect.bottom}px`;
            }
            dialog.style.height = 'auto';
            dialog.style.left = `${(window.innerWidth - dialogRect.width) / 2}px`;
        },

        frameImage: function (imageIndex) {
            if (imageIndex) {
                const imageContainer = document.getElementById(`image-container-${imageIndex}`);
                if (imageContainer) {
                    imageContainer.classList.add('image-container--framed');
                }
            }
        }
    },


    // Public API //

    // State
    setState(newState) {
        this.currentState = newState;
    },

    getState() {
        return this.currentState;
    },

    // Pair
    setNextSelectedPair(pair) {
        this.nextSelectedPair = pair;
    },

    getNextSelectedPair() {
        return this.nextSelectedPair;
    },

    // Observation URLs
    // TODO FIX can't use properly in gameSetup.uiSetup.setupRound() for some reason
    setObservationURLs(urls) {
        this.currentObservationURLs = urls;
    },

    getObservationURLs() {
        return this.currentObservationURLs;
    },

    // Images
    loadImages(leftImageSrc, rightImageSrc) {
        this.imageManagement.loadImages(leftImageSrc, rightImageSrc);
    },

    // Info dialog
    showInfoDialog(url, imageIndex) {
        return this.dialogHandling.showInfoDialog(url, imageIndex);
    },

    // Hints
    getShownHints(taxonIndex) {
        return [...this.shownHints[`taxon${taxonIndex}`]];
    },

    addShownHint(taxonIndex, hint) {
        this.shownHints[`taxon${taxonIndex}`].push(hint);
    },

    areAllHintsShown(taxonIndex, totalHints) {
        return this.shownHints[`taxon${taxonIndex}`].length >= totalHints;
    },

    resetShownHints() {
        this.shownHints = {
            taxon1: [],
            taxon2: []
        };
    },

    // Misc
    getLoadingMessage() {
        return this.loadingMessage;
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

// Initialize info buttons
game.dialogHandling.initializeInfoButtons();

export default game;
