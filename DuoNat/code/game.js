import api from './api.js';
import dialogManager from './dialogManager.js';
import { elements } from './state.js'; 
import gameSetup from './gameSetup.js';
import gameLogic from './gameLogic.js';
import gameUI from './gameUI.js';
import { GameState, gameState } from './state.js';
import logger from './logger.js';
import taxaRelationshipViewer from './taxaRelationshipViewer.js'; 

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
    setState(newState) {
        this.currentState = newState;
    },

    // Expose necessary methods from other modules
    setupGame: gameSetup.setupGame,
    loadNewRandomPair: gameLogic.loadNewRandomPair,
    updateSkillLevelIndicator: gameUI.updateSkillLevelIndicator,

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

    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },

    setState(newState) {
        this.currentState = newState;
    },

    showLoadingScreen: function () {
        document.getElementById('loading-screen').style.display = 'flex';
    },

    hideLoadingScreen: function () {
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
        }, 500); // 500ms delay, adjust as needed
    },

    async fetchTaxonImageCollection(newPair) {
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

    async attemptFetchTaxonImageCollection(newPair) {
        if (newPair || !gameState.currentTaxonImageCollection) {
            if (this.nextSelectedPair) {
                const collection = await this.initializeNewTaxonPair(this.nextSelectedPair);
                this.nextSelectedPair = null;
                return collection;
            } else if (this.preloadedPair) {
                const collection = this.preloadedPair;
                this.preloadedPair = null;
                return collection;
            } else {
                return await this.initializeNewTaxonPair();
            }
        }
        return gameState.currentTaxonImageCollection;
    },

    shouldRetryFetch(error, attempts, maxAttempts) {
        return attempts < maxAttempts && error.message.includes("No images found");
    },

    async handleFetchError(error) {
        if (error.message.includes("No images found")) {
            const taxonName = error.message.split("No images found for ")[1];
            ui.showOverlay(`Warning: No images found for ${taxonName}. Trying another pair...`, config.overlayColors.red);
            await utils.sleep(2000);
            this.nextSelectedPair = null;
        }
    },

    async initializeNewTaxonPair(pair = null) {

        const newPair = pair || await utils.selectTaxonPair();
        const [imageOneURL, imageTwoURL] = await Promise.all([
            api.fetchRandomImage(newPair.taxon1),
            api.fetchRandomImage(newPair.taxon2)
        ]);

        return {
            pair: newPair,
            imageOneURL,
            imageTwoURL,
            imageOneVernacular: null,
            imageTwoVernacular: null
        };
    },

    async loadCurrentTaxonImageCollection() {
        if (!gameState.currentTaxonImageCollection || !gameState.currentTaxonImageCollection.pair) {
            logger.error("currentTaxonImageCollection or its pair is null");
            throw new Error("Invalid currentTaxonImageCollection");
        }

        const { taxon1, taxon2 } = gameState.currentTaxonImageCollection.pair;
        // TODO not sure if for one or both pairs? one taxon should not have more than 12 images
        const MAX_IMAGES = 24; // Adjust this number as needed

        const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
            api.fetchMultipleImages(taxon1),
            api.fetchMultipleImages(taxon2),
            api.fetchVernacular(taxon1),
            api.fetchVernacular(taxon2)
        ]);

        updateGameState({
            currentTaxonImageCollection: {
                ...gameState.currentTaxonImageCollection,
                imageOneURLs: imageOneURLs.slice(0, MAX_IMAGES),
                imageTwoURLs: imageTwoURLs.slice(0, MAX_IMAGES),
                imageOneVernacular,
                imageTwoVernacular
            }
        });

        await preloader.preloadImages(imageOneURLs.slice(0, MAX_IMAGES).concat(imageTwoURLs.slice(0, MAX_IMAGES)));
    },

    async preloadImagesForCurrentPair() {
        const { pair } = gameState.currentTaxonImageCollection;

        try {
            const [newImageOneURL, newImageTwoURL] = await Promise.all([
                api.fetchRandomImageMetadata(pair.taxon1),
                api.fetchRandomImageMetadata(pair.taxon2)
            ]);

            await Promise.all([
                this.preloadImage(newImageOneURL),
                this.preloadImage(newImageTwoURL)
            ]);

            this.preloadedImages.current.taxon1.push(newImageOneURL);
            this.preloadedImages.current.taxon2.push(newImageTwoURL);

        } catch (error) {
            logger.error("Error preloading images for current pair:", error);
        }
    },

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve(url);
            };
            img.onerror = () => {
                logger.error(`Failed to load image: ${url}`);
                reject(url);
            };
            img.src = url;
        });
    },

    loadImages: async function (leftImageSrc, rightImageSrc) {
        await Promise.all([
            this.loadImageAndRemoveLoadingClass(elements.imageOne, leftImageSrc),
            this.loadImageAndRemoveLoadingClass(elements.imageTwo, rightImageSrc)
        ]);
    },

    async loadImageAndRemoveLoadingClass(imgElement, src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                imgElement.src = src;
                imgElement.classList.remove('image-container__image--loading');
                // Add a slight delay before adding the 'loaded' class
                setTimeout(() => {
                    imgElement.classList.add('image-container__image--loaded');
                    resolve();
                }, 50); // 50ms delay to ensure the browser has time to apply the new src
            };
            img.src = src;
        });
    },

    async showTaxaRelationship() {
        const { taxonImageOne, taxonImageTwo } = gameState;
        const container = document.getElementById('phylogeny-dialog__graph');
        const dialog = document.getElementById('phylogeny-dialog');

        if (!taxonImageOne || !taxonImageTwo) {
            logger.error('Taxon names not available');
            alert('Unable to show relationship. Please try again after starting a new game.');
            return;
        }

        // Show the dialog
    //    dialog.style.display = 'flex'; // Change to flex to match the CSS layout
        dialogManager.openDialog('phylogeny-dialog');

        try {
            await taxaRelationshipViewer.initialize(container);

            if (this.currentGraphTaxa &&
                this.currentGraphTaxa[0] === taxonImageOne &&
                this.currentGraphTaxa[1] === taxonImageTwo) {
                logger.debug("Showing existing graph for the same taxa pair");
                taxaRelationshipViewer.showExistingGraph();
            } else {
                logger.debug("Creating new graph for a different taxa pair");
                taxaRelationshipViewer.clearGraph();
                await taxaRelationshipViewer.findRelationship(taxonImageOne, taxonImageTwo);
                this.currentGraphTaxa = [taxonImageOne, taxonImageTwo];
            }
        } catch (error) {
            logger.error('Error showing taxa relationship:', error);
            alert('Failed to load the relationship graph. Please try again later.');
     //       dialog.style.display = 'none'; // Hide the dialog on error
            dialogManager.closeDialog();
        }
    },

    initializeInfoButtons() {
        const infoButton1 = document.getElementById('info-button-1');
        const infoButton2 = document.getElementById('info-button-2');

        infoButton1.addEventListener('click', () => this.showInfoDialog(this.currentObservationURLs.imageOne, 1));
        infoButton2.addEventListener('click', () => this.showInfoDialog(this.currentObservationURLs.imageTwo, 2));

        document.getElementById('info-dialog').addEventListener('close', () => {
            document.querySelectorAll('.image-container').forEach(container => {
                container.classList.remove('image-container--framed');
            });
        });
    },

    openObservationURL(url) {
        if (url) {
            this.showInfoDialog(url);
        } else {
            logger.error('Observation URL not available');
        }
    },

    frameImage(imageIndex) {
        if (imageIndex) {
            const imageContainer = document.getElementById(`image-container-${imageIndex}`);
            if (imageContainer) {
                imageContainer.classList.add('image-container--framed');
            }
        }
    },

    async showInfoDialog(url, imageIndex) {
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
            const vernacularName = await api.fetchVernacular(currentTaxon);
            vernacularElement.textContent = vernacularName;

            const taxonInfo = await api.loadTaxonInfo();
            const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === currentTaxon.toLowerCase());
            if (taxonData && taxonData.taxonFacts && taxonData.taxonFacts.length > 0) {
                factsElement.innerHTML = '<h3>Facts:</h3><ul>' +
                    taxonData.taxonFacts.map(fact => `<li>${fact}</li>`).join('') +
                    '</ul>';
                factsElement.style.display = 'block';
            } else {
                factsElement.style.display = 'none';
            }

            const hasWikipediaPage = await api.checkWikipediaPage(currentTaxon);

            const wikiButton = document.getElementById('wiki-button');
            if (hasWikipediaPage) {
                wikiButton.classList.remove('info-dialog__button--inactive');
                wikiButton.disabled = false;
            } else {
                wikiButton.classList.add('info-dialog__button--inactive');
                wikiButton.disabled = true;
            }

            // TODO enable when functionality added
//            const hintButton = document.getElementById('hints-button');
//            hintButton.classList.add('info-dialog__button--inactive');
//            hintButton.disabled = true;
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

    positionDialog(dialog, imageIndex) {
        const topImageContainer = document.getElementById('image-container-1');
        const bottomImageContainer = document.getElementById('image-container-2');
        const namePairContainer = document.querySelector('.name-pair');

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
    },

    setupButtonHandlers(url, currentTaxon) {
        const photoButton = document.getElementById('photo-button');
        const observationButton = document.getElementById('observation-button');
        const taxonButton = document.getElementById('taxon-button');
//        const hintsButton = document.getElementById('hints-button');
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
                const taxonId = await api.fetchTaxonId(currentTaxon);
                window.open(`https://www.inaturalist.org/taxa/${taxonId}`, '_blank');
                dialogManager.closeDialog('info-dialog');
            } catch (error) {
                alert("Unable to open taxon page. Please try again.");
            }
        };

 //       hintsButton.onclick = () => {
 //           logger.debug("Taxon hints button clicked");
            // Implement taxon hints functionality here
 //       };

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

};

// Bind all methods to ensure correct 'this' context
Object.keys(game).forEach(key => {
    if (typeof game[key] === 'function') {
        game[key] = game[key].bind(game);
    }
});

// TODO Why here
game.initializeInfoButtons();

export default game;
