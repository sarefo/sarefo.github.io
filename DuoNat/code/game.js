import api from './api.js';
import dialogManager from './dialogManager.js';
import { elements } from './state.js';
import gameSetup from './gameSetup.js';
import gameLogic from './gameLogic.js';
import gameUI from './gameUI.js';
import { GameState, gameState } from './state.js';
import logger from './logger.js';
import ui from './ui.js';
import utils from './utils.js';

const game = {
    loadingMessage: "",
    //loadingMessage: "Loading...",
    nextSelectedPair: null,
    currentState: GameState.IDLE,
    currentGraphTaxa: null,
    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },
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

    setState(newState) {
        this.currentState = newState;
    },

    resetShownHints() {
        this.shownHints = {
            taxon1: [],
            taxon2: []
        };
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
                    const collection = await this.initializeNewTaxonPair(game.nextSelectedPair);
                    game.nextSelectedPair = null;
                    return collection;
                } else if (game.preloadedPair) {
                    const collection = game.preloadedPair;
                    game.preloadedPair = null;
                    return collection;
                } else {
                    return await this.initializeNewTaxonPair();
                }
            }
            return gameState.currentTaxonImageCollection;
        },

        shouldRetryFetch: function (error, attempts, maxAttempts) {
            return attempts < maxAttempts && error.message.includes("No images found");
        },

        handleFetchError: async function (error) {
            if (error.message.includes("No images found")) {
                const taxonName = error.message.split("No images found for ")[1];
                ui.overlay.showOverlay(`Warning: No images found for ${taxonName}. Trying another pair...`, config.overlayColors.red);
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

            document.getElementById('info-dialog').addEventListener('close', () => {
                document.querySelectorAll('.image-container').forEach(container => {
                    container.classList.remove('image-container--framed');
                });
            });
        },

        setupButtonHandlers: function (url, currentTaxon) {
            const photoButton = document.getElementById('photo-button');
            const observationButton = document.getElementById('observation-button');
            const taxonButton = document.getElementById('taxon-button');
            const wikiButton = document.getElementById('wiki-button');
            const reportButton = document.getElementById('report-button');

            photoButton.onclick = () => {
                window.open(url, '_blank');
                dialogManager.closeDialog('info-dialog');
            };

            observationButton.onclick = () => {
                logger.debug("Observation button clicked");
                // Implement observation functionality here
            };

            taxonButton.onclick = async () => {
                try {
                    const taxonId = await api.taxonomy.fetchTaxonId(currentTaxon);
                    window.open(`https://www.inaturalist.org/taxa/${taxonId}`, '_blank');
                    dialogManager.closeDialog('info-dialog');
                } catch (error) {
                    alert("Unable to open taxon page. Please try again.");
                }
            };

            wikiButton.onclick = () => {
                try {
                    window.open(`https://en.wikipedia.org/wiki/${currentTaxon}`, '_blank');
                    dialogManager.closeDialog('info-dialog');
                } catch (error) {
                    alert("Unable to open Wikipedia page. Please try again.");
                }
            };

            reportButton.onclick = () => {
                logger.debug("Report button clicked");
                // Implement report functionality here
            };
        },

        showInfoDialog: async function (url, imageIndex) {
            const currentTaxon = gameLogic.getCurrentTaxon(url);
            if (!currentTaxon) return;

            const dialog = document.getElementById('info-dialog');

            // Get the image containers
            const topImageContainer = document.getElementById('image-container-1');
            const bottomImageContainer = document.getElementById('image-container-2');
            const namePairContainer = document.querySelector('.name-pair');

            // Position the dialog
            const positionDialog = () => {
                const dialogRect = dialog.getBoundingClientRect();
                const topContainerRect = topImageContainer.getBoundingClientRect();
                const bottomContainerRect = bottomImageContainer.getBoundingClientRect();
                const namePairRect = namePairContainer.getBoundingClientRect();

                if (imageIndex === 1) {
                    // For the top image
                    dialog.style.top = `${namePairRect.top}px`;
                    dialog.style.bottom = `${window.innerHeight - bottomContainerRect.bottom}px`;
                    dialog.style.height = 'auto'; // Let the height adjust automatically
                } else {
                    // For the bottom image
                    dialog.style.top = `${topContainerRect.top}px`;
                    dialog.style.bottom = `${window.innerHeight - namePairRect.bottom}px`;
                    dialog.style.height = 'auto'; // Let the height adjust automatically
                }

                // Center horizontally
                dialog.style.left = `${(window.innerWidth - dialogRect.width) / 2}px`;
            };

            this.frameImage(imageIndex);

            const taxonElement = document.getElementById('info-dialog-taxon');
            const vernacularElement = document.getElementById('info-dialog-vernacular');
            const factsElement = document.getElementById('info-dialog-facts');
            taxonElement.textContent = currentTaxon;

            try {
                const vernacularName = await api.vernacular.fetchVernacular(currentTaxon);
                vernacularElement.textContent = vernacularName;

                const taxonInfo = await api.taxonomy.loadTaxonInfo();
                const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === currentTaxon.toLowerCase());
                if (taxonData && taxonData.taxonFacts && taxonData.taxonFacts.length > 0) {
                    factsElement.innerHTML = '<h3>Facts:</h3><ul>' +
                        taxonData.taxonFacts.map(fact => `<li>${fact}</li>`).join('') +
                        '</ul>';
                    factsElement.style.display = 'block';
                } else {
                    factsElement.style.display = 'none';
                }

                const hasWikipediaPage = await api.externalAPIs.checkWikipediaPage(currentTaxon);

                const wikiButton = document.getElementById('wiki-button');
                if (hasWikipediaPage) {
                    wikiButton.classList.remove('info-dialog__button--inactive');
                    wikiButton.disabled = false;
                } else {
                    wikiButton.classList.add('info-dialog__button--inactive');
                    wikiButton.disabled = true;
                }

                // TODO enable when functionality added
                //const hintButton = document.getElementById('hints-button');
                //hintButton.classList.add('info-dialog__button--inactive');
                //hintButton.disabled = true;
                const observationButton = document.getElementById('observation-button');
                observationButton.classList.add('info-dialog__button--inactive');
                observationButton.disabled = true;

                this.setupButtonHandlers(url, currentTaxon);

                // TODO: let dialogManager take over
                const closeButton = document.getElementById('info-close-button');
                closeButton.onclick = () => {
                    dialog.close();
                    document.querySelectorAll('.image-container').forEach(container => {
                        container.classList.remove('image-container--framed');
                    });
                };

                dialog.addEventListener('close', () => {
                    // Remove framing from all containers when dialog is closed
                    document.querySelectorAll('.image-container').forEach(container => {
                        container.classList.remove('image-container--framed');
                    });
                });

                // Check if the dialog is already open
                if (!dialog.open) {
                    dialog.showModal();
                }

                // Position the dialog after content is loaded
                positionDialog();

                // Reposition on window resize
                window.addEventListener('resize', positionDialog);

            } catch (error) {
                logger.error('Error in showInfoDialog:', error);
            }
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
                dialog.style.height = 'auto';
            } else {
                dialog.style.top = `${topContainerRect.top}px`;
                dialog.style.bottom = `${window.innerHeight - namePairRect.bottom}px`;
                dialog.style.height = 'auto';
            }

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
