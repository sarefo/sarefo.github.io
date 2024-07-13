// Game functions

import api from './api.js';
import config from './config.js';
import {elements, gameState, updateGameState, GameState} from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const game = {
    nextSelectedPair: null,
    currentState: GameState.IDLE,

    currentObservationURLs: {
        imageOne: null,
        imageTwo: null
    },

    setState(newState) {
        console.log(`Game state changing from ${this.currentState} to ${newState}`);
        this.currentState = newState;
    },

    async quickLoadInitialImages() {
        try {
            console.log("Starting quick load of initial images");
            const initialPair = await this.selectTaxonPair();
            const [imageOneURL, imageTwoURL] = await Promise.all([
                api.fetchRandomImage(initialPair.taxon1),
                api.fetchRandomImage(initialPair.taxon2)
            ]);
            console.log("Quick load completed successfully");
            return { initialPair, imageOneURL, imageTwoURL };
        } catch (error) {
            console.error("Error during quick load of initial images:", error);
            throw error;
        }
    },

    async setupGame(newSession = false) {
        if (newSession) {
            console.log("Starting new session, resetting state");
            this.setState(GameState.IDLE);
        }

        if (this.currentState !== GameState.IDLE && 
            this.currentState !== GameState.READY && 
            this.currentState !== GameState.CHECKING) {
            console.log("Game is not in a state to start a new session");
            return;
        }

        this.setState(GameState.LOADING);

        if (!await this.checkINaturalistReachability()) {
            this.setState(GameState.IDLE);
            return;
        }

        this.prepareUIForLoading();

        try {
            await this.initializeOrUpdateTaxonImageCollection(newSession);
            
            await this.setupRound();
            this.finishSetup();
  //          ui.initializeDraggables(); // for dragging name tiles
            this.setState(GameState.PLAYING);
            console.log("Game setup complete. Current state:", this.currentState);

            ui.hideOverlay();  // Hide overlay when setup is complete

            // Start preloading the next pair in the background only for new sessions
            if (newSession) {
                this.preloadNextTaxonPairInBackground();
            }
        } catch (error) {
            console.error("Error setting up game:", error);
            ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
            this.setState(GameState.IDLE);
        }
    },

    async initializeOrUpdateTaxonImageCollection(newSession) {
        if (newSession || !gameState.currentTaxonImageCollection) {
            if (this.nextSelectedPair) {
                console.log("Using selected pair:", this.nextSelectedPair);
                updateGameState({
                    currentTaxonImageCollection: {
                        pair: this.nextSelectedPair,
                        imageOneURLs: [],
                        imageTwoURLs: [],
                        imageOneVernacular: null,
                        imageTwoVernacular: null
                    }
                });
                this.nextSelectedPair = null; // Clear the selected pair
            } else if (gameState.isInitialLoad) {
                console.log("Performing quick load for initial session");
                const quickLoadData = await this.quickLoadInitialImages();
                updateGameState({
                    currentTaxonImageCollection: {
                        pair: quickLoadData.initialPair,
                        imageOneURLs: [quickLoadData.imageOneURL],
                        imageTwoURLs: [quickLoadData.imageTwoURL],
                        imageOneVernacular: null,
                        imageTwoVernacular: null
                    },
                    isInitialLoad: false
                });
            } else if (gameState.preloadedTaxonImageCollection) {
                updateGameState({
                    currentTaxonImageCollection: gameState.preloadedTaxonImageCollection,
                    preloadedTaxonImageCollection: null
                });
            } else {
                await this.loadNewTaxonPair();
            }

            if (!gameState.currentTaxonImageCollection) {
                console.error("Failed to initialize currentTaxonImageCollection");
                throw new Error("Failed to initialize currentTaxonImageCollection");
            }
            await this.loadCurrentTaxonImageCollection();
        }
    },

    async preloadNextTaxonPairInBackground() {
        if (this.currentState !== GameState.PLAYING) {
            console.log("Not in correct state to preload");
            return;
        }

        if (gameState.isPreloading) return;
        
        updateGameState({ isPreloading: true });
        console.log("Starting to preload next pair in the background");

        try {
            const newPair = await this.selectTaxonPair();
            console.log(`Preloading images for taxon pair: ${newPair.taxon1} and ${newPair.taxon2}`);
            const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
                api.fetchMultipleImages(newPair.taxon1),
                api.fetchMultipleImages(newPair.taxon2),
                api.fetchVernacular(newPair.taxon1),
                api.fetchVernacular(newPair.taxon2)
            ]);

            updateGameState({
                preloadedTaxonImageCollection: {
                    pair: newPair,
                    imageOneURLs,
                    imageTwoURLs,
                    imageOneVernacular,
                    imageTwoVernacular
                }
            });

            await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
            console.log("Finished preloading next pair");
        } catch (error) {
            console.error("Error preloading next pair:", error);
        } finally {
            updateGameState({ isPreloading: false });
        }
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

        await this.preloadImages(imageOneURLs.slice(0, MAX_IMAGES).concat(imageTwoURLs.slice(0, MAX_IMAGES)));
    },

    async setupRound() {
        const { pair, imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular } = gameState.currentTaxonImageCollection;
        const randomized = Math.random() < 0.5;

        const leftImageSrc = randomized ? 
            imageOneURLs[Math.floor(Math.random() * imageOneURLs.length)] :
            imageTwoURLs[Math.floor(Math.random() * imageTwoURLs.length)];
        const rightImageSrc = randomized ?
            imageTwoURLs[Math.floor(Math.random() * imageTwoURLs.length)] :
            imageOneURLs[Math.floor(Math.random() * imageOneURLs.length)];

        await this.loadImages(leftImageSrc, rightImageSrc);

        // Set the observation URLs
        this.currentObservationURLs.imageOne = this.getObservationURLFromImageURL(leftImageSrc);
        this.currentObservationURLs.imageTwo = this.getObservationURLFromImageURL(rightImageSrc);

        const leftName = randomized ? pair.taxon1 : pair.taxon2;
        const rightName = randomized ? pair.taxon2 : pair.taxon1;
        const leftVernacular = randomized ? imageOneVernacular : imageTwoVernacular;
        const rightVernacular = randomized ? imageTwoVernacular : imageOneVernacular;

        this.setupNameTilesUI(leftName, rightName, leftVernacular, rightVernacular);

        updateGameState({
            taxonImageOne: randomized ? pair.taxon1 : pair.taxon2,
            taxonImageTwo: randomized ? pair.taxon2 : pair.taxon1,
            currentRound: {
                pair,
                imageOneURLs,
                imageTwoURLs,
                imageOneVernacular,
                imageTwoVernacular,
                randomized
            }
        });
    },

    async preloadNextTaxonPair() {
        if (this.currentState !== GameState.PRELOADING_BACKGROUND) {
            console.log("Not in correct state to preload");
            return;
        }

        if (gameState.isPreloading) return;
        
        updateGameState({ isPreloading: true });
        console.log("Starting to preload next pair in the background");

        try {
            const newPair = await this.selectTaxonPair();
            console.log(`Preloading images for taxon pair: ${newPair.taxon1} and ${newPair.taxon2}`);
            const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
                api.fetchMultipleImages(newPair.taxon1),
                api.fetchMultipleImages(newPair.taxon2),
                api.fetchVernacular(newPair.taxon1),
                api.fetchVernacular(newPair.taxon2)
            ]);

            updateGameState({
                preloadedTaxonImageCollection: {
                    pair: newPair,
                    imageOneURLs,
                    imageTwoURLs,
                    imageOneVernacular,
                    imageTwoVernacular
                }
            });

            await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
            console.log("Finished preloading next pair");
        } catch (error) {
            console.error("Error preloading next pair:", error);
        } finally {
            updateGameState({ isPreloading: false });
        }
        if (this.currentState === GameState.PRELOADING_BACKGROUND) {
            this.setState(GameState.PLAYING);
        }
    },

    prepareRound: async function(newPair) {
        console.log("Preparing new round, newPair:", newPair);
        if (newPair || !this.currentRound.pair) {
            if (gameState.preloadedPair) {
                console.log("Using preloaded pair");
                this.currentRound = gameState.preloadedPair;
                this.currentRound.randomized = Math.random() < 0.5;
            } else {
                console.log("No preloaded pair available, fetching new pair");
                await this.fetchNewPair();
            }

            // Fetch vernacular names if they're not already preloaded
            if (!this.currentRound.imageOneVernacular || !this.currentRound.imageTwoVernacular) {
                console.log("Fetching vernacular names for current pair");
                [this.currentRound.imageOneVernacular, this.currentRound.imageTwoVernacular] = await Promise.all([
                    api.fetchVernacular(this.currentRound.pair.taxon1),
                    api.fetchVernacular(this.currentRound.pair.taxon2)
                ]);
            }
        } else {
            console.log("Reusing current pair with new randomization");
            this.currentRound.randomized = Math.random() < 0.5;
        }
        console.log("Round preparation complete", this.currentRound);
    },

    fetchNewPair: async function() {
        const newPair = await this.selectTaxonPair();
        this.currentRound = {
            pair: newPair,
            imageOneURLs: [],
            imageTwoURLs: [],
            imageOneVernacular: null,
            imageTwoVernacular: null,
            randomized: Math.random() < 0.5
        };
        
        console.log("Fetching images for new pair");
        await this.fetchRoundData();
    },

    fetchRoundData: async function () {
        if (this.currentRound.imageOneURLs.length === 0 || this.currentRound.imageTwoURLs.length === 0) {
            const { taxon1, taxon2 } = this.currentRound.pair;
            const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
                api.fetchMultipleImages(taxon1),
                api.fetchMultipleImages(taxon2),
                api.fetchVernacular(taxon1),
                api.fetchVernacular(taxon2)
            ]);

            this.currentRound.imageOneURLs = imageOneURLs;
            this.currentRound.imageTwoURLs = imageTwoURLs;
            this.currentRound.imageOneVernacular = imageOneVernacular;
            this.currentRound.imageTwoVernacular = imageTwoVernacular;

            await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
        }
    },

    preloadImages: async function(urls) {
        console.log(`Starting to preload ${urls.length} images`);
        const preloadPromises = urls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    console.log(`Preloaded image: ${url}`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to preload image: ${url}`);
                    reject();
                };
                img.src = url;
            });
        });
        await Promise.all(preloadPromises);
        console.log("Finished preloading all images");
    },

    renderCurrentRound: async function () {
        console.log("Rendering current round");
        const { pair, imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular, randomized } = this.currentRound;

        // Select random images from preloaded arrays
        let leftImageSrc = randomized ? 
            imageOneURLs[Math.floor(Math.random() * imageOneURLs.length)] :
            imageTwoURLs[Math.floor(Math.random() * imageTwoURLs.length)];
        let rightImageSrc = randomized ?
            imageTwoURLs[Math.floor(Math.random() * imageTwoURLs.length)] :
            imageOneURLs[Math.floor(Math.random() * imageOneURLs.length)];

        console.log("Selected images:", { leftImageSrc, rightImageSrc });

        // Set image sources without displaying them yet
        elements.imageOne.src = '';
        elements.imageTwo.src = '';

        const leftName = randomized ? pair.taxon1 : pair.taxon2;
        const rightName = randomized ? pair.taxon2 : pair.taxon1;
        const leftVernacular = randomized ? imageOneVernacular : imageTwoVernacular;
        const rightVernacular = randomized ? imageTwoVernacular : imageOneVernacular;

        this.setupNameTilesUI(leftName, rightName, leftVernacular, rightVernacular);

        gameState.taxonImageOne = randomized ? pair.taxon1 : pair.taxon2;
        gameState.taxonImageTwo = randomized ? pair.taxon2 : pair.taxon1;
        gameState.taxonLeftName = leftName;
        gameState.taxonRightName = rightName;

        // Load images without changing their positions
        await this.loadImages(leftImageSrc, rightImageSrc);
        console.log("Finished rendering current round");
    },

    preloadPair: async function () {
        const pair = await this.selectTaxonPair();
        console.log("in preloadPair: Selected next pair for preloading:", pair);
        const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
            api.fetchMultipleImages(pair.taxon1),
            api.fetchMultipleImages(pair.taxon2),
            api.fetchVernacular(pair.taxon1),
            api.fetchVernacular(pair.taxon2)
        ]);
        console.log(`Fetched ${imageOneURLs.length} images for ${pair.taxon1} and ${imageTwoURLs.length} images for ${pair.taxon2}`);

        // Preload all fetched images
        await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
        console.log("in preloadPair: Finished preloading images for next pair");

        return { pair, imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular, randomized: Math.random() < 0.5 };
    },

    loadNewRound: async function () {
        if (gameState.preloadedPair) {
            this.currentRound = {
                pair: gameState.preloadedPair.pair,
                imageOneURL: gameState.preloadedPair.imageOneURL,
                imageTwoURL: gameState.preloadedPair.imageTwoURL,
                imageOneVernacular: null,
                imageTwoVernacular: null,
                randomized: Math.random() < 0.5
            };
        } else {
            const newPair = await this.selectTaxonPair();
            this.currentRound = {
                pair: newPair,
                imageOneURL: null,
                imageTwoURL: null,
                imageOneVernacular: null,
                imageTwoVernacular: null,
                randomized: Math.random() < 0.5
            };
            await this.fetchRoundData();
        }

        // Fetch vernacular names
        [this.currentRound.imageOneVernacular, this.currentRound.imageTwoVernacular] = await Promise.all([
            api.fetchVernacular(this.currentRound.pair.taxon1),
            api.fetchVernacular(this.currentRound.pair.taxon2)
        ]);

        // Start preloading the next pair
        gameState.preloadedPair = await this.preloadPair();
    },

    refreshCurrentRound: async function () {
        this.currentRound.randomized = Math.random() < 0.5;
        await this.fetchRoundData();
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

    checkINaturalistReachability: async function() {
        if (!await api.isINaturalistReachable()) {
            ui.showINatDownDialog();
            return false;
        }
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

    // Core gameplay functions
    setupImages: async function() {
        let randomizeImages = Math.random() < 0.5;
        gameState.taxonImageOne = randomizeImages ? gameState.currentPair.taxon1 : gameState.currentPair.taxon2;
        gameState.taxonImageTwo = randomizeImages ? gameState.currentPair.taxon2 : gameState.currentPair.taxon1;

        const [imageOneVernacular, imageTwoVernacular] = await Promise.all([
            api.fetchVernacular(gameState.taxonImageOne),
            api.fetchVernacular(gameState.taxonImageTwo)
        ]);

        const [imageOneURL, imageTwoURL] = await Promise.all([
            api.fetchRandomImage(gameState.taxonImageOne),
            api.fetchRandomImage(gameState.taxonImageTwo)
        ]);

        await this.loadImages(imageOneURL, imageTwoURL);

        return {
            imageData: {
                imageOneVernacular,
                imageTwoVernacular,
                imageOneURL,
                imageTwoURL
            },
            randomizeImages
        };
    },

    setupNameTiles: function(imageData, randomizeImages) {
        const { taxon1, taxon2 } = gameState.currentPair;
        
        gameState.taxonImageOne = randomizeImages ? taxon1 : taxon2;
        gameState.taxonImageTwo = randomizeImages ? taxon2 : taxon1;
        
        gameState.taxonLeftName = randomizeImages ? taxon1 : taxon2;
        gameState.taxonRightName = randomizeImages ? taxon2 : taxon1;

        let leftNameVernacular = randomizeImages ? imageData.imageOneVernacular : imageData.imageTwoVernacular;
        let rightNameVernacular = randomizeImages ? imageData.imageTwoVernacular : imageData.imageOneVernacular;

        this.setupNameTilesUI(gameState.taxonLeftName, gameState.taxonRightName, leftNameVernacular, rightNameVernacular);
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

    async waitForPreloadingComplete() {
        while (this.currentState === GameState.PRELOADING_BACKGROUND) {
            await utils.sleep(100);
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

        infoButton1.addEventListener('click', () => this.openObservationURL(this.currentObservationURLs.imageOne));
        infoButton2.addEventListener('click', () => this.openObservationURL(this.currentObservationURLs.imageTwo));
    },

    openObservationURL(url) {
        if (url) {
            window.open(url, '_blank');
        } else {
            console.error('Observation URL not available');
        }
    },

};

// Initialize info buttons
game.initializeInfoButtons();

export default game;
