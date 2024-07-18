// Game functions

import api from './api.js';
import config from './config.js';
import {elements, gameState, updateGameState, GameState} from './state.js';
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
        taxon1: [],
        taxon2: []
    },

    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },

    setState(newState) {
        console.log(`Game state changing from ${this.currentState} to ${newState}`);
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
          this.preloadedImages = { taxon1: [], taxon2: [] };
          console.log("Starting new session, resetting state");
          this.setState(GameState.IDLE);
          this.currentGraphTaxa = null; // Clear the current graph taxa
          taxaRelationshipViewer.clearGraph(); // Clear the existing graph
        }

        if (this.currentState !== GameState.IDLE && 
            this.currentState !== GameState.READY && 
            this.currentState !== GameState.CHECKING) {
            console.log("Game is not in a state to start a new session");
            return;
        }

        this.setState(GameState.LOADING);

        if (!await this.checkINaturalistReachability()) {
            console.log("iNaturalist is not reachable. Showing dialog.");
            this.setState(GameState.IDLE);
            return; // Exit setupGame if iNaturalist is not reachable
        }

        this.prepareUIForLoading();

        try {
            let newTaxonImageCollection;
            if (newSession || !gameState.currentTaxonImageCollection) {
                if (this.nextSelectedPair) {
                    console.log("Using selected pair:", this.nextSelectedPair);
                    newTaxonImageCollection = await this.initializeNewTaxonPair(this.nextSelectedPair);
                    this.nextSelectedPair = null;
                } else if (this.preloadedPair) {
                    console.log("Using preloaded pair");
                    newTaxonImageCollection = this.preloadedPair;
                    this.preloadedPair = null;
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
            console.log("Game setup complete. Current state:", this.currentState);

            this.setState(GameState.PLAYING);
            console.log("Game setup complete. Current state:", this.currentState);

            ui.hideOverlay();

            // Start preloading for the next session
            this.preloadNextPair();
        } catch (error) {
            console.error("Error setting up game:", error);
            ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
            this.setState(GameState.IDLE);
            if (gameState.isInitialLoad) {
                this.hideLoadingScreen();
                updateGameState({ isInitialLoad: false });
            }
        }
    },

    async preloadNextPair() {
        if (this.preloadedPair) return; // Don't preload if we already have a preloaded pair

        console.log("Starting to preload next pair");
        this.preloadedPair = await this.initializeNewTaxonPair();
        console.log("Finished preloading next pair");
    },

    async initializeNewTaxonPair(pair = null) {
        const newPair = pair || await this.selectTaxonPair();
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
            console.error("currentTaxonImageCollection or its pair is null");
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

        // Use preloaded images if available, otherwise fetch new ones
        if (this.preloadedImages.taxon1.length > 0 && this.preloadedImages.taxon2.length > 0) {
            console.log("Using preloaded image metadata for current round");
            imageOneURL = this.preloadedImages.taxon1.pop();
            imageTwoURL = this.preloadedImages.taxon2.pop();
        } else {
            console.log("Fetching new random image metadata for current round");
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

        console.log(`Images for this round: ${imageOneURL}, ${imageTwoURL}`);

        // Preload images for the next round
        this.preloadImagesForCurrentPair();
    },

    async preloadImagesForCurrentPair() {
        const { pair } = gameState.currentTaxonImageCollection;
        console.log("Starting to preload images for next round");
        
        try {
            const [newImageOneURL, newImageTwoURL] = await Promise.all([
                api.fetchRandomImageMetadata(pair.taxon1),
                api.fetchRandomImageMetadata(pair.taxon2)
            ]);
            
            await Promise.all([
                this.preloadImage(newImageOneURL),
                this.preloadImage(newImageTwoURL)
            ]);
            
            this.preloadedImages.taxon1 = [newImageOneURL];
            this.preloadedImages.taxon2 = [newImageTwoURL];
            
            console.log("Finished preloading images for next round");
        } catch (error) {
            console.error("Error preloading images:", error);
        }
    },

    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                console.log(`Image fully loaded: ${url}`);
                resolve(url);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${url}`);
                reject(url);
            };
            img.src = url;
        });
    },

    loadImages: async function(leftImageSrc, rightImageSrc) {
        console.log("Loading images:", { leftImageSrc, rightImageSrc });
        await Promise.all([
            this.loadImageAndRemoveLoadingClass(elements.imageOne, leftImageSrc),
            this.loadImageAndRemoveLoadingClass(elements.imageTwo, rightImageSrc)
        ]);
        console.log("Finished loading images");
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
            console.error('Taxon names not available');
            alert('Unable to show relationship. Please try again after starting a new game.');
            return;
        }
        
        containerWrapper.classList.remove('hidden');

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.hideTaxaRelationship();
            }
        }; 
        document.addEventListener('keydown', handleKeyDown);

        try {
            await taxaRelationshipViewer.initialize(container);

            // Check if we're showing the same taxa pair
            if (this.currentGraphTaxa &&
                this.currentGraphTaxa[0] === taxonImageOne &&
                this.currentGraphTaxa[1] === taxonImageTwo) {
                console.log("Showing existing graph for the same taxa pair");
                taxaRelationshipViewer.showExistingGraph();
            } else {
                console.log("Creating new graph for a different taxa pair");
                taxaRelationshipViewer.clearGraph();
                await taxaRelationshipViewer.findRelationship(taxonImageOne, taxonImageTwo);
                this.currentGraphTaxa = [taxonImageOne, taxonImageTwo];
            }
        } catch (error) {
            console.error('Error showing taxa relationship:', error);
            alert('Failed to load the relationship graph. Please try again later.');
            this.hideTaxaRelationship();
        }
    },

  hideTaxaRelationship() {
    const containerWrapper = document.getElementById('taxa-relationship-container');
    containerWrapper.classList.add('hidden');
    // We don't clear the graph here, as we might want to show it again
  },

    checkINaturalistReachability: async function() {
        if (!await api.isINaturalistReachable()) {
          ui.showINatDownDialog();
          return false;
        }
        ui.hideINatDownDialog(); // Hide the dialog if it was previously shown
        return true;
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
        const newPair = await this.selectTaxonPair();
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
        console.log("Checking answer. Current state:", this.currentState);
        
        if (this.currentState !== GameState.PLAYING) {
            console.log("Cannot check answer when not in PLAYING state");
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
            console.log("Incomplete answer. Returning to PLAYING state.");
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
        console.log('Setup complete:', {
            taxonImageOne: gameState.taxonImageOne,
            taxonImageTwo: gameState.taxonImageTwo,
            taxonLeftName: gameState.taxonLeftName,
            taxonRightName: gameState.taxonRightName
        });
    },

    selectTaxonPair: async function (index = null) {
        const taxonPairs = await api.fetchTaxonPairs();
        if (taxonPairs.length === 0) {
            console.error("No taxon pairs available");
            return null;
        }
        return index !== null ? taxonPairs[index] : taxonPairs[Math.floor(Math.random() * taxonPairs.length)];
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
        console.error('Observation URL not available');
      }
    },

    showInfoDialog(url) {
      const dialog = document.getElementById('info-dialog');
      const photoButton = document.getElementById('photo-button');
      const observationButton = document.getElementById('observation-button');
      const taxonButton = document.getElementById('taxon-button');
      const relationshipButton = document.getElementById('relationship-button');
      const closeButton = document.getElementById('close-info-dialog');

      photoButton.onclick = () => {
        window.open(url, '_blank');
        dialog.close();
      };

      observationButton.onclick = () => {
        console.log("Observation button clicked");
        // Implement observation functionality here
      };

      taxonButton.onclick = () => {
        console.log("Taxon button clicked");
        // Implement taxon functionality here
      };

      relationshipButton.onclick = () => {
        console.log("Relationship button clicked");
        // Implement relationship functionality here
        dialog.close();
        this.showTaxaRelationship();
      };

      closeButton.onclick = () => {
        dialog.close();
      };

      dialog.showModal();
    },
};

// Initialize info buttons
game.initializeInfoButtons();

export default game;
