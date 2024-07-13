// this snapshot is rather stable, but will take quite long at startup because it loads the whole image set.
// Game functions

import api from './api.js';
import config from './config.js';
import {elements, gameState} from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const game = {
    nextSelectedPair: null,
    currentRound: {
        pair: null,
        imageOneURLs: [],
        imageTwoURLs: [],
        imageOneVernacular: null,
        imageTwoVernacular: null,
        randomized: false
    },
    preloadedPair: null,
    isPreloadingPair: false,
    isInitialLoad: true,
    hasLoadedFullSet: false,

    setupGame: async function (newPair = false) {
        if (!await this.checkINaturalistReachability()) {
            return;
        }

        this.prepareUIForLoading();

        try {
            if (this.nextSelectedPair) {
                await this.loadSelectedPair();
                this.hasLoadedFullSet = false;
            } else if (newPair && this.preloadedPair) {
                this.currentRound = this.preloadedPair;
                this.preloadedPair = null;
                this.hasLoadedFullSet = true;
            } else if (newPair || !this.currentRound.pair) {
                await this.fetchNewPair();
                this.hasLoadedFullSet = false;
            } else {
                this.currentRound.randomized = Math.random() < 0.5;
            }
            
            if (this.isInitialLoad || !this.hasLoadedFullSet) {
                await this.fetchInitialImages();
                this.isInitialLoad = false;
            }

            await this.renderCurrentRound();
            this.finishSetup();

            if (!this.hasLoadedFullSet) {
                this.loadFullImageSet();
            }

            if (!this.preloadedPair && !this.isPreloadingPair) {
                this.preloadNextPair();
            }
        } catch (error) {
            console.error("Error setting up game:", error);
            ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
        }
    },

    loadFullImageSet: async function() {
        console.log("Loading full image set for current pair");
        const { taxon1, taxon2 } = this.currentRound.pair;
        const [imageOneURLs, imageTwoURLs] = await Promise.all([
            api.fetchMultipleImages(taxon1),
            api.fetchMultipleImages(taxon2)
        ]);

        this.currentRound.imageOneURLs = imageOneURLs;
        this.currentRound.imageTwoURLs = imageTwoURLs;

        await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
        this.hasLoadedFullSet = true;
        console.log("Finished loading full image set");
    },

    fetchInitialImages: async function() {
        const { taxon1, taxon2 } = this.currentRound.pair;
        const [imageOne, imageTwo, imageOneVernacular, imageTwoVernacular] = await Promise.all([
            api.fetchRandomImage(taxon1),
            api.fetchRandomImage(taxon2),
            api.fetchVernacular(taxon1),
            api.fetchVernacular(taxon2)
        ]);

        this.currentRound.imageOneURLs = [imageOne];
        this.currentRound.imageTwoURLs = [imageTwo];
        this.currentRound.imageOneVernacular = imageOneVernacular;
        this.currentRound.imageTwoVernacular = imageTwoVernacular;

        await this.preloadImages([imageOne, imageTwo]);
    },

    loadSelectedPair: async function() {
        this.currentRound = {
            pair: this.nextSelectedPair,
            imageOneURLs: [],
            imageTwoURLs: [],
            imageOneVernacular: null,
            imageTwoVernacular: null,
            randomized: Math.random() < 0.5
        };
        this.nextSelectedPair = null; // Clear the selected pair
        await this.fetchRoundData();
        [this.currentRound.imageOneVernacular, this.currentRound.imageTwoVernacular] = await Promise.all([
            api.fetchVernacular(this.currentRound.pair.taxon1),
            api.fetchVernacular(this.currentRound.pair.taxon2)
        ]);
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

    preloadNextPair: async function() {
        if (this.isPreloadingPair) return;
        
        this.isPreloadingPair = true;
        console.log("Starting to preload next pair in the background");
        try {
            this.preloadedPair = await this.preloadPair();
            console.log("Finished preloading next pair");
        } catch (error) {
            console.error("Error preloading next pair:", error);
        } finally {
            this.isPreloadingPair = false;
        }
    },

    preloadPair: async function () {
        console.log("Preloading next pair...");
        const pair = await this.selectTaxonPair();
        console.log("Selected pair for preloading:", pair);
        const [imageOneURLs, imageTwoURLs, imageOneVernacular, imageTwoVernacular] = await Promise.all([
            api.fetchMultipleImages(pair.taxon1),
            api.fetchMultipleImages(pair.taxon2),
            api.fetchVernacular(pair.taxon1),
            api.fetchVernacular(pair.taxon2)
        ]);
        console.log(`Fetched ${imageOneURLs.length} images for ${pair.taxon1} and ${imageTwoURLs.length} images for ${pair.taxon2}`);

        // Preload all fetched images
        await this.preloadImages(imageOneURLs.concat(imageTwoURLs));
        console.log("Finished preloading images for next pair");

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

    loadImageAndRemoveLoadingClass: function(imgElement, src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                imgElement.src = src;
                imgElement.classList.remove('loading');
                resolve();
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

    loadNewTaxonPair: async function(newPair) {
        if (newPair || !gameState.currentPair) {
            if (gameState.isFirstLoad) {
                const urlParams = utils.getURLParameters();
                gameState.currentPair = urlParams || await this.selectTaxonPair();
            } else if (gameState.preloadedPair) {
                gameState.currentPair = gameState.preloadedPair.pair;
            } else {
                gameState.currentPair = await this.selectTaxonPair();
            }
            gameState.preloadedPair = await this.preloadPair();
        }
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

    checkAnswer: function(droppedZoneId) {
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
                elements.imageOne.classList.add('loading');
                elements.imageTwo.classList.add('loading');
                ui.showOverlay('Correct!', colorCorrect);
                setTimeout(() => {
                    ui.hideOverlay();
                    game.setupGame(false);
                }, 2400);
            } else {
                utils.resetDraggables();
                ui.showOverlay('Try again!', colorWrong);
                setTimeout(() => {
                    ui.hideOverlay();
                }, 800);
            }
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

        elements.leftName.innerHTML = `<i>${nameOne}</i><br>(${vernacularOne})`;
        elements.rightName.innerHTML = `<i>${nameTwo}</i><br>(${vernacularTwo})`;

        // Update gameState to reflect the new positions
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
        return !index ? taxonPairs[Math.floor(Math.random() * taxonPairs.length)] : taxonPairs[index];
    }

};

export default game;
