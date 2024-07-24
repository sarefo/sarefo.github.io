// Game functions

import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState, updateGameState, GameState } from './state.js';
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

    /**
     * Sets the current game state.
     * @param {GameState} newState - The new state to set.
     */
    setState(newState) {
        logger.debug(`Game state changing from ${this.currentState} to ${newState}`);
        this.currentState = newState;
    },

    /**
     * Shows the loading screen.
     */
    showLoadingScreen: function () {
        document.getElementById('loading-screen').style.display = 'flex';
    },

    /**
     * Hides the loading screen.
     */
    hideLoadingScreen: function () {
        document.getElementById('loading-screen').style.display = 'none';
    },

    /**
     * Sets up the game, either for a new session or continuing the current one.
     * @param {boolean} newSession - Whether to start a new session.
     */
    async setupGame(newSession = false) {

        // load new taxon set?
        if (newSession) { this.initializeNewSession(); }

        // does GameState allow for new session?
        if (!this.canStartNewSession()) { return; }

        // enter LOADING state
        this.setState(GameState.LOADING);

        // Exit setupGame if iNaturalist is not reachable
        if (!await this.checkINaturalistReachability()) { return; }

        // Loading …
        this.prepareUIForLoading();

        try {

            let newTaxonImageCollection;

            // no idea what this does
            if (newSession || !gameState.currentTaxonImageCollection) {

                if (this.nextSelectedPair) {
                    logger.debug("Using selected pair:", this.nextSelectedPair);

                    newTaxonImageCollection = await this.initializeNewTaxonPair(this.nextSelectedPair);
                    this.nextSelectedPair = null;

                } else if (this.preloadedPair) {
                    logger.debug("Using preloaded pair");

                    newTaxonImageCollection = this.preloadedPair;
                    this.preloadedPair = null;

                // Use the preloaded images
                newTaxonImageCollection.imageOneURL = this.preloadedImages.next.taxon1[0];
                newTaxonImageCollection.imageTwoURL = this.preloadedImages.next.taxon2[0];
                
                // Move preloaded images to current
                this.preloadedImages.current = this.preloadedImages.next;
                this.preloadedImages.next = { taxon1: [], taxon2: [] };

                } else {
                    logger.debug("First round of first session");
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
            ui.resetUIState();

            // Only preload for the next session if we're starting a new one
            if (newSession) {
                this.preloadNextPair();
            }
        } catch (error) {
            this.handleSetupError(error);
        }
    },

    initializeNewSession() {
        this.preloadedImages = {
            current: { taxon1: [], taxon2: [] },
            next: { taxon1: [], taxon2: [] }
        };
        logger.debug("Starting new session, resetting state");
        this.setState(GameState.IDLE);
        this.currentGraphTaxa = null; // Clear the current graph taxa
        taxaRelationshipViewer.clearGraph(); // Clear the existing graph

    },

    canStartNewSession() {
        if (this.currentState !== GameState.IDLE &&
            this.currentState !== GameState.READY &&
            this.currentState !== GameState.CHECKING) {
            logger.debug("Game is not in a state to start a new session");
            return false;
        }
        return true;
    },

    /**
     * Checks if iNaturalist API is reachable.
     * @returns {Promise<boolean>} True if iNaturalist is reachable, false otherwise.
     */
    async checkINaturalistReachability() {
        if (!await api.isINaturalistReachable()) {
            ui.showINatDownDialog();
            this.setState(GameState.IDLE);
            return false;
        }
        ui.hideINatDownDialog();
        return true;
    },

    /**
     * Fetches a taxon image collection, with retry logic.
     * @param {boolean} newSession - Whether this is for a new session.
     * @returns {Promise<Object>} The fetched taxon image collection.
     */
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

    /**
     * Attempts to fetch a taxon image collection.
     * @param {boolean} newSession - Whether this is for a new session.
     * @returns {Promise<Object>} The fetched taxon image collection.
     */
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

    /**
     * Determines if a fetch should be retried based on the error and attempt count.
     * @param {Error} error - The error that occurred during the fetch.
     * @param {number} attempts - The number of attempts made so far.
     * @param {number} maxAttempts - The maximum number of attempts allowed.
     * @returns {boolean} True if the fetch should be retried, false otherwise.
     */
    shouldRetryFetch(error, attempts, maxAttempts) {
        return attempts < maxAttempts && error.message.includes("No images found");
    },

    /**
     * Handles errors that occur during fetching.
     * @param {Error} error - The error that occurred.
     */
    async handleFetchError(error) {
        if (error.message.includes("No images found")) {
            const taxonName = error.message.split("No images found for ")[1];
            ui.showOverlay(`Warning: No images found for ${taxonName}. Trying another pair...`, config.overlayColors.red);
            await utils.sleep(2000);
            this.nextSelectedPair = null;
        }
    },

    /**
     * Handles the initial load of the game.
     */
    handleInitialLoad() {
        if (gameState.isInitialLoad) {
            this.hideLoadingScreen();
            updateGameState({ isInitialLoad: false });
        }
    },

    /**
     * Handles errors that occur during game setup.
     * @param {Error} error - The error that occurred.
     */
    handleSetupError(error) {
        logger.error("Error setting up game:", error);
        ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
        this.setState(GameState.IDLE);
        if (gameState.isInitialLoad) {
            this.hideLoadingScreen();
            updateGameState({ isInitialLoad: false });
        }
    },

    /**
     * Preloads the next pair of taxa.
     */
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

    /**
     * Initializes a new taxon pair.
     * @param {Object} [pair=null] - The taxon pair to initialize. If null, a random pair is selected.
     * @returns {Promise<Object>} The initialized taxon pair with image URLs.
     */
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

    /**
     * Gets new random images for the current taxon pair.
     * @returns {Promise<Object>} Object containing new image URLs for the current pair.
     */
    async getNewRandomImagesForCurrentPair() {
        const { pair } = gameState.currentTaxonImageCollection;
        const [newImageOneURL, newImageTwoURL] = await Promise.all([
            api.fetchRandomImage(pair.taxon1),
            api.fetchRandomImage(pair.taxon2)
        ]);

        return { newImageOneURL, newImageTwoURL };
    },

    /**
     * Loads the current taxon image collection, including multiple images and vernacular names.
     */
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

    /**
     * Sets up a new round of the game.
     */
    async setupRound(isNewSession = false) {
        const { pair } = gameState.currentTaxonImageCollection;
        const randomized = Math.random() < 0.5;

        let imageOneURL, imageTwoURL;

    if (isNewSession && gameState.currentTaxonImageCollection.imageOneURL && gameState.currentTaxonImageCollection.imageTwoURL) {
        // Use the preloaded images for the new session
        imageOneURL = gameState.currentTaxonImageCollection.imageOneURL;
        imageTwoURL = gameState.currentTaxonImageCollection.imageTwoURL;
        logger.debug("Using preloaded images for new session");
    } else if (this.preloadedImages.current.taxon1.length > 0 && this.preloadedImages.current.taxon2.length > 0) {
        // Use preloaded images for subsequent rounds
        imageOneURL = this.preloadedImages.current.taxon1.pop();
        imageTwoURL = this.preloadedImages.current.taxon2.pop();
        logger.debug("Using preloaded image metadata for current round");
    } else {
        // Fetch new images if no preloaded images are available
        [imageOneURL, imageTwoURL] = await Promise.all([
            api.fetchRandomImageMetadata(pair.taxon1),
            api.fetchRandomImageMetadata(pair.taxon2)
        ]);
        logger.debug("Fetching new random image metadata for current round");
    }

/*
        // Use preloaded images for the current session if available
        if (this.preloadedImages.current.taxon1.length > 0 && this.preloadedImages.current.taxon2.length > 0) {
//            logger.debug("Using preloaded image metadata for current round");
            imageOneURL = this.preloadedImages.current.taxon1.pop();
            imageTwoURL = this.preloadedImages.current.taxon2.pop();
        } else {
//            logger.debug("Fetching new random image metadata for current round");
            [imageOneURL, imageTwoURL] = await Promise.all([
                api.fetchRandomImageMetadata(pair.taxon1),
                api.fetchRandomImageMetadata(pair.taxon2)
            ]);
        }
*/
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

    /**
     * Preloads images for the current taxon pair.
     */
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
//                logger.debug(`Image fully loaded: ${url}`);
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
        const dialog = document.getElementById('phylogeny-dialog');

        if (!taxonImageOne || !taxonImageTwo) {
            logger.error('Taxon names not available');
            alert('Unable to show relationship. Please try again after starting a new game.');
            return;
        }

        // Show the dialog
        dialog.style.display = 'flex'; // Change to flex to match the CSS layout
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
            dialog.style.display = 'none'; // Hide the dialog on error
            dialogManager.closeDialog();
        }
    },

    prepareUIForLoading: function () {
        utils.resetDraggables();
        ui.scrollToTop();
        elements.imageOne.classList.add('loading');
        elements.imageTwo.classList.add('loading');
        var startMessage = gameState.isFirstLoad ? "Drag the names!" : "Loading...";
        ui.showOverlay(startMessage, config.overlayColors.green);
        // what does this do?
        gameState.isFirstLoad = false;
    },

    async loadNewRandomPair() {
        if (this.currentState === GameState.LOADING) {
            logger.debug("Already loading a new pair, ignoring request");
            return;
        }

        logger.debug("Loading new random pair");
        this.setState(GameState.LOADING);
        ui.showOverlay('Loading...', config.overlayColors.green);
        elements.imageOne.classList.add('loading');
        elements.imageTwo.classList.add('loading');
        
        try {
            await this.setupGame(true);
            ui.hideOverlay();
        } catch (error) {
            logger.error("Error loading new random pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            this.setState(GameState.PLAYING);
        }
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

    setupNameTilesUI: function (leftName, rightName, leftNameVernacular, rightNameVernacular) {
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

    finishSetup: function () {
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

    openObservationURL(url) {
        if (url) {
            this.showInfoDialog(url);
        } else {
            logger.error('Observation URL not available');
        }
    },

    showInfoDialog(url) {
        const dialog = document.getElementById('info-dialog');
        const taxonElement = document.getElementById('info-dialog-taxon');
        const vernacularElement = document.getElementById('info-dialog-vernacular');
        const photoButton = document.getElementById('photo-button');
        const observationButton = document.getElementById('observation-button');
        const taxonButton = document.getElementById('taxon-button');
        const hintsButton = document.getElementById('hints-button');
        const closeButton = document.getElementById('info-close-button');

    // Set taxon and vernacular name
    const currentTaxon = this.getCurrentTaxonName(url);
    taxonElement.textContent = currentTaxon;
    
    // Fetch and set vernacular name
    api.fetchVernacular(currentTaxon).then(vernacularName => {
        vernacularElement.textContent = utils.capitalizeFirstLetter(vernacularName) || '';
    });

        photoButton.onclick = () => {
            window.open(url, '_blank');
            dialog.close();
        };

        observationButton.onclick = () => {
            logger.debug("Observation button clicked");
//            utils.fart(); // placeholder
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
//            utils.fart(); // placeholder
            // Implement taxon hints functionality here
        };

        // TODO shouldn't this be handled in a standardized dialog way?
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
