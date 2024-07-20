// Game functions

import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import {elements, gameState, updateGameState, GameState} from './state.js';
import logger from './logger.js';
import preloader from './preloader.js';
import taxaRelationshipViewer from './taxaRelationshipViewer.js';
import ui from './ui.js';
import utils from './utils.js';

const game = {
    nextSelectedPair: null,
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

    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },

    setState(newState) {
        logger.debug(`Game state changing from ${this.currentState} to ${newState}`);
        this.currentState = newState;
    },

    showLoadingScreen: function() {
        document.getElementById('loading-screen').style.display = 'flex';
    },

    hideLoadingScreen: function() {
        document.getElementById('loading-screen').style.display = 'none';
    },

    async setupGame(newSession = false) {
        if (newSession) {
            this.preloadedImages = { 
                current: { taxon1: [], taxon2: [] },
                next: { taxon1: [], taxon2: [] }
            };
            logger.debug("Starting new session, resetting state");
            this.setState(GameState.IDLE);
            this.currentGraphTaxa = null; // Clear the current graph taxa
            taxaRelationshipViewer.clearGraph(); // Clear the existing graph
        }

        if (this.currentState !== GameState.IDLE && 
            this.currentState !== GameState.READY && 
            this.currentState !== GameState.CHECKING) {
            logger.debug("Game is not in a state to start a new session");
            return;
        }

        this.setState(GameState.LOADING);

        if (!await this.checkINaturalistReachability()) {
            logger.error("iNaturalist is not reachable. Showing dialog.");
            this.setState(GameState.IDLE);
            return; // Exit setupGame if iNaturalist is not reachable
        }

        this.prepareUIForLoading();

        try {
            let newTaxonImageCollection;
            if (newSession || !gameState.currentTaxonImageCollection) {
                if (this.nextSelectedPair) {
                    logger.debug("Using selected pair:", this.nextSelectedPair);
                    newTaxonImageCollection = await this.initializeNewTaxonPair(this.nextSelectedPair);
                    this.nextSelectedPair = null;
                } else if (this.preloadedPair) {
                    logger.debug("Using preloaded pair");
                    newTaxonImageCollection = this.preloadedPair;
                    this.preloadedPair = null;
                    // Move preloaded images for the next session to the current session
                    this.preloadedImages.current = this.preloadedImages.next;
                    this.preloadedImages.next = { taxon1: [], taxon2: [] };
                } else {
                    newTaxonImageCollection = await this.initializeNewTaxonPair();
                }
                
                // Update the gameState with the new collection
                updateGameState({
                    currentTaxonImageCollection: newTaxonImageCollection
                });
            }
            
            await this.setupRound();
            this.finishSetup();

            if (gameState.isInitialLoad) {
                this.hideLoadingScreen();
                updateGameState({ isInitialLoad: false });
            }

            this.setState(GameState.PLAYING);
            logger.debug("Game setup complete. Current state:", this.currentState);

            ui.hideOverlay();

            // Only preload for the next session if we're starting a new one
            if (newSession) {
                this.preloadNextPair();
            }
        } catch (error) {
            logger.error("Error setting up game:", error);
            ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
            this.setState(GameState.IDLE);
            if (gameState.isInitialLoad) {
                this.hideLoadingScreen();
                updateGameState({ isInitialLoad: false });
            }
        }
    },

    async checkINaturalistReachability() {
        if (!await api.isINaturalistReachable()) {
            logger.error("iNaturalist is not reachable. Showing dialog.");
            ui.showINatDownDialog();
            this.setState(GameState.IDLE);
            return false;
        }
        ui.hideINatDownDialog();
        return true;
    },

    async fetchTaxonImageCollection(newSession) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                return await this.attemptFetchTaxonImageCollection(newSession);
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

    async attemptFetchTaxonImageCollection(newSession) {
        if (newSession || !gameState.currentTaxonImageCollection) {
            if (this.nextSelectedPair) {
                logger.debug("Using selected pair:", this.nextSelectedPair);
                const collection = await this.initializeNewTaxonPair(this.nextSelectedPair);
                this.nextSelectedPair = null;
                return collection;
            } else if (this.preloadedPair) {
                logger.debug("Using preloaded pair");
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

    handleInitialLoad() {
        if (gameState.isInitialLoad) {
            this.hideLoadingScreen();
            updateGameState({ isInitialLoad: false });
        }
    },

    handleSetupError(error) {
        logger.error("Error setting up game:", error);
        ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
        this.setState(GameState.IDLE);
        if (gameState.isInitialLoad) {
            this.hideLoadingScreen();
            updateGameState({ isInitialLoad: false });
        }
    },

    async preloadNextPair() {
        if (this.preloadedPair) return; // Don't preload if we already have a preloaded pair

        logger.debug("Starting to preload next pair for a new session");
        this.preloadedPair = await this.initializeNewTaxonPair();
        
        try {
            const [newImageOneURL, newImageTwoURL] = await Promise.all([
                api.fetchRandomImageMetadata(this.preloadedPair.pair.taxon1),
                api.fetchRandomImageMetadata(this.preloadedPair.pair.taxon2)
            ]);
            
            await Promise.all([
                this.preloadImage(newImageOneURL),
                this.preloadImage(newImageTwoURL)
            ]);
            
            this.preloadedImages.next.taxon1 = [newImageOneURL];
            this.preloadedImages.next.taxon2 = [newImageTwoURL];
            
            logger.debug("Finished preloading next pair for a new session");
        } catch (error) {
            logger.error("Error preloading images for next session:", error);
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

    async getNewRandomImagesForCurrentPair() {
        const { pair } = gameState.currentTaxonImageCollection;
        const [newImageOneURL, newImageTwoURL] = await Promise.all([
            api.fetchRandomImage(pair.taxon1),
            api.fetchRandomImage(pair.taxon2)
        ]);
        
        return { newImageOneURL, newImageTwoURL };
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

    async setupRound() {
        const { pair } = gameState.currentTaxonImageCollection;
        const randomized = Math.random() < 0.5;

        let imageOneURL, imageTwoURL;

        // Use preloaded images for the current session if available
        if (this.preloadedImages.current.taxon1.length > 0 && this.preloadedImages.current.taxon2.length > 0) {
            logger.debug("Using preloaded image metadata for current round");
            imageOneURL = this.preloadedImages.current.taxon1.pop();
            imageTwoURL = this.preloadedImages.current.taxon2.pop();
        } else {
            logger.debug("Fetching new random image metadata for current round");
            [imageOneURL, imageTwoURL] = await Promise.all([
                api.fetchRandomImageMetadata(pair.taxon1),
                api.fetchRandomImageMetadata(pair.taxon2)
            ]);
        }

        const leftImageSrc = randomized ? imageOneURL : imageTwoURL;
        const rightImageSrc = randomized ? imageTwoURL : imageOneURL;

        await this.loadImages(leftImageSrc, rightImageSrc);
        // Set the observation URLs
        this.currentObservationURLs.imageOne = this.getObservationURLFromImageURL(leftImageSrc);
        this.currentObservationURLs.imageTwo = this.getObservationURLFromImageURL(rightImageSrc);

        const [leftVernacular, rightVernacular] = await Promise.all([
            utils.capitalizeFirstLetter(await api.fetchVernacular(randomized ? pair.taxon1 : pair.taxon2)),
            utils.capitalizeFirstLetter(await api.fetchVernacular(randomized ? pair.taxon2 : pair.taxon1))
        ]);

        this.setupNameTilesUI(
            randomized ? pair.taxon1 : pair.taxon2,
            randomized ? pair.taxon2 : pair.taxon1,
            leftVernacular,
            rightVernacular
        );

        updateGameState({
            taxonImageOne: randomized ? pair.taxon1 : pair.taxon2,
            taxonImageTwo: randomized ? pair.taxon2 : pair.taxon1,
            currentRound: {
                pair,
                imageOneURL,
                imageTwoURL,
                imageOneVernacular: leftVernacular,
                imageTwoVernacular: rightVernacular,
                randomized
            }
        });

        logger.debug(`Images for this round: ${imageOneURL}, ${imageTwoURL}`);

        // Preload images for the next round of the current session
        this.preloadImagesForCurrentPair();
    },

    async preloadImagesForCurrentPair() {
        const { pair } = gameState.currentTaxonImageCollection;
        logger.debug("Starting to preload images for next round of current session");
        
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
            
            logger.debug("Finished preloading images for next round of current session");
        } catch (error) {
            logger.error("Error preloading images for current session:", error);
        }
    },

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                logger.debug(`Image fully loaded: ${url}`);
                resolve(url);
            };
            img.onerror = () => {
                logger.error(`Failed to load image: ${url}`);
                reject(url);
            };
            img.src = url;
        });
    },

    loadImages: async function(leftImageSrc, rightImageSrc) {
        logger.debug("Loading images:", { leftImageSrc, rightImageSrc });
        await Promise.all([
            this.loadImageAndRemoveLoadingClass(elements.imageOne, leftImageSrc),
            this.loadImageAndRemoveLoadingClass(elements.imageTwo, rightImageSrc)
        ]);
        logger.debug("Finished loading images");
    },

    async loadImageAndRemoveLoadingClass(imgElement, src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                imgElement.src = src;
                imgElement.classList.remove('loading');
                // Add a slight delay before adding the 'loaded' class
                setTimeout(() => {
                    imgElement.classList.add('loaded');
                    resolve();
                }, 50); // 50ms delay to ensure the browser has time to apply the new src
            };
            img.src = src;
        });
    },

    async showTaxaRelationship() {
        const { taxonImageOne, taxonImageTwo } = gameState;
        const container = document.getElementById('taxa-relationship-graph');
        const containerWrapper = document.getElementById('taxa-relationship-container');
        
        if (!taxonImageOne || !taxonImageTwo) {
            logger.error('Taxon names not available');
            alert('Unable to show relationship. Please try again after starting a new game.');
            return;
        }
        
        dialogManager.openDialog('taxa-relationship-container');
//        containerWrapper.classList.remove('hidden');

        try {
            await taxaRelationshipViewer.initialize(container);

            // Check if we're showing the same taxa pair
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
            this.hideTaxaRelationship();
        }
    },

    hideTaxaRelationship: function() {
        dialogManager.closeDialog();
//        const containerWrapper = document.getElementById('taxa-relationship-container');
//        containerWrapper.classList.add('hidden');
        // We don't clear the graph here, as we might want to show it again
     },

    prepareUIForLoading: function() {
        utils.resetDraggables();
        ui.scrollToTop();
        elements.imageOne.classList.add('loading');
        elements.imageTwo.classList.add('loading');
        var startMessage = gameState.isFirstLoad ? "Drag the names!" : "Loading...";
        ui.showOverlay(startMessage, config.overlayColors.green);
        gameState.isFirstLoad = false;
    },

    async loadNewTaxonPair() {
        const newPair = await utils.selectTaxonPair();
        updateGameState({
            currentTaxonImageCollection: {
                pair: newPair,
                imageOneURLs: [],
                imageTwoURLs: [],
                imageOneVernacular: null,
                imageTwoVernacular: null
            }
        });
    },

    async checkAnswer(droppedZoneId) {
        logger.debug("Checking answer. Current state:", this.currentState);
        
        if (this.currentState !== GameState.PLAYING) {
            logger.debug("Cannot check answer when not in PLAYING state");
            return;
        }

        this.setState(GameState.CHECKING);

        const dropOne = document.getElementById('drop-1');
        const dropTwo = document.getElementById('drop-2');
        const colorCorrect = config.overlayColors.green;
        const colorWrong = config.overlayColors.red;

        const leftAnswer = dropOne.children[0]?.getAttribute('data-taxon');
        const rightAnswer = dropTwo.children[0]?.getAttribute('data-taxon');

        ui.scrollToTop();

        if (leftAnswer && rightAnswer) {
            let isCorrect = false;
            if (droppedZoneId === 'drop-1') {
                isCorrect = leftAnswer === gameState.taxonImageOne;
            } else {
                isCorrect = rightAnswer === gameState.taxonImageTwo;
            }

            if (isCorrect) {
                await ui.showOverlay('Correct!', colorCorrect);
                elements.imageOne.classList.add('loading');
                elements.imageTwo.classList.add('loading');
                await utils.sleep(1000); // Show "Correct!" for 1 second
                ui.updateOverlayMessage('Loading...'); // Update message without changing color
                await this.setupGame(false);  // Start a new round with the same taxon pair
            } else {
                // Immediately reset draggables before showing the "Try again!" message
                utils.resetDraggables();
                await ui.showOverlay('Try again!', colorWrong);
                await utils.sleep(800);
                ui.hideOverlay();
                this.setState(GameState.PLAYING);
            }
        } else {
            logger.debug("Incomplete answer. Returning to PLAYING state.");
            this.setState(GameState.PLAYING);
        }
    },

    setupNameTilesUI: function(leftName, rightName, leftNameVernacular, rightNameVernacular) {
        // Randomize the position of the name tiles
        const shouldSwap = Math.random() < 0.5;
        
        const nameOne = shouldSwap ? rightName : leftName;
        const nameTwo = shouldSwap ? leftName : rightName;
        const vernacularOne = shouldSwap ? rightNameVernacular : leftNameVernacular;
        const vernacularTwo = shouldSwap ? leftNameVernacular : rightNameVernacular;

        elements.leftName.setAttribute('data-taxon', nameOne);
        elements.rightName.setAttribute('data-taxon', nameTwo);
        elements.leftName.style.zIndex = '10';
        elements.rightName.style.zIndex = '10';

        // Create a span for the taxon name and a span for the vernacular name
        elements.leftName.innerHTML = `
            <span class="taxon-name">${nameOne}</span>
            ${vernacularOne ? `<span class="vernacular-name">${vernacularOne}</span>` : ''}
        `;
        elements.rightName.innerHTML = `
            <span class="taxon-name">${nameTwo}</span>
            ${vernacularTwo ? `<span class="vernacular-name">${vernacularTwo}</span>` : ''}
        `;

        gameState.taxonLeftName = nameOne;
        gameState.taxonRightName = nameTwo;
    },

    finishSetup: function() {
        ui.hideOverlay();
        logger.debug('Setup complete:', {
            taxonImageOne: gameState.taxonImageOne,
            taxonImageTwo: gameState.taxonImageTwo,
            taxonLeftName: gameState.taxonLeftName,
            taxonRightName: gameState.taxonRightName
        });
    },

// TODO for now only gives photo page
    getObservationURLFromImageURL(imageURL) {
        const match = imageURL.match(/\/photos\/(\d+)\//);
        if (match && match[1]) {
            return `https://www.inaturalist.org/photos/${match[1]}`;
        }
        return null;
    },

    initializeInfoButtons() {
      const infoButton1 = document.getElementById('info-button-1');
      const infoButton2 = document.getElementById('info-button-2');

      infoButton1.addEventListener('click', () => this.showInfoDialog(this.currentObservationURLs.imageOne));
      infoButton2.addEventListener('click', () => this.showInfoDialog(this.currentObservationURLs.imageTwo));
    },
/*    initializeInfoButtons() {
        const infoButton1 = document.getElementById('info-button-1');
        const infoButton2 = document.getElementById('info-button-2');

        infoButton1.addEventListener('click', () => this.openObservationURL(this.currentObservationURLs.imageOne));
        infoButton2.addEventListener('click', () => this.openObservationURL(this.currentObservationURLs.imageTwo));
    },*/

    openObservationURL(url) {
      if (url) {
        this.showInfoDialog(url);
      } else {
        logger.error('Observation URL not available');
      }
    },

    showInfoDialog(url) {
      const dialog = document.getElementById('info-dialog');
      const photoButton = document.getElementById('photo-button');
      const observationButton = document.getElementById('observation-button');
      const taxonButton = document.getElementById('taxon-button');
      const hintsButton = document.getElementById('hints-button');
      const closeButton = document.getElementById('close-info-dialog');

      photoButton.onclick = () => {
        window.open(url, '_blank');
        dialog.close();
      };

      observationButton.onclick = () => {
        logger.debug("Observation button clicked");
        utils.fart(); // placeholder
        // Implement observation functionality here
      };

      taxonButton.onclick = async () => {
        logger.debug("Taxon button clicked");
        try {
          const taxonName = this.getCurrentTaxonName(url);
          const taxonId = await api.fetchTaxonId(taxonName);
          window.open(`https://www.inaturalist.org/taxa/${taxonId}`, '_blank');
          dialog.close();
        } catch (error) {
          logger.error("Error opening taxon page:", error);
          alert("Unable to open taxon page. Please try again.");
        }
      };

      hintsButton.onclick = () => {
        logger.debug("Taxon hints button clicked");
        utils.fart(); // placeholder
        // Implement taxon hints functionality here
      };

      closeButton.onclick = () => {
        dialog.close();
      };

      dialog.showModal();
    },

// Rest of the game.js code remains the same
    getCurrentTaxonName(url) {
      if (url === this.currentObservationURLs.imageOne) {
        return gameState.taxonImageOne;
      } else if (url === this.currentObservationURLs.imageTwo) {
        return gameState.taxonImageTwo;
      } else {
        logger.error("Unable to determine current taxon name");
        return null;
      }
    },

};

// Initialize info buttons
game.initializeInfoButtons();

export default game;
