import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import { elements, gameState, updateGameState, GameState } from './state.js';
import logger from './logger.js';
import preloader from './preloader.js';
import taxaRelationshipViewer from './taxaRelationshipViewer.js';
import ui from './ui.js';
import utils from './utils.js';
import { createWorldMap } from './worldMap.js';

const game = {
    loadingMessage: "",
    //loadingMessage: "Loading...",
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

    async setupGame(newPair = false) {
        this.setState(GameState.LOADING);

        if (!await this.checkINaturalistReachability()) { return; }

        this.prepareUIForLoading();

        try {
            if (newPair || !gameState.currentTaxonImageCollection) {
                await this.initializeNewPair();
            } else {
                await this.setupRound();
            }

            // Update skill level indicator
            const skillLevel = gameState.currentTaxonImageCollection.pair.skillLevel;
            this.updateSkillLevelIndicator(skillLevel);

            this.finishSetup();
            this.setNamePairHeight();

            this.setState(GameState.PLAYING);
            this.hideLoadingScreen();

            if (gameState.isInitialLoad) {
                updateGameState({ isInitialLoad: false });
            }

            ui.hideOverlay();
            ui.resetUIState();

            // Start preloading asynchronously
            this.startPreloading(newPair);
        } catch (error) {
            this.handleSetupError(error);
        }
    },

    async startPreloading(isNewPair) {
        try {
            await preloader.preloadForNextRound();
            if (isNewPair || !preloader.hasPreloadedPair()) {
                await preloader.preloadForNextPair();
            }
            logger.debug("Preloading completed for next round" + (isNewPair ? " and next pair" : ""));
        } catch (error) {
            logger.error("Error during preloading:", error);
        }
    },

    async initializeNewPair() {
        let newPair, imageOneURL, imageTwoURL;

        logger.debug("Initializing new pair");
        logger.debug("Current nextSelectedPair:", this.nextSelectedPair);

        if (this.nextSelectedPair) {
            newPair = this.nextSelectedPair;
            logger.debug("Using nextSelectedPair:", newPair);
            this.nextSelectedPair = null;
        } else {
            const preloadedPair = preloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair) {
                logger.debug("Using preloaded pair:", preloadedPair.pair);
                newPair = preloadedPair.pair;
                imageOneURL = preloadedPair.taxon1;
                imageTwoURL = preloadedPair.taxon2;
            } else {
                logger.debug("No preloaded pair available, selecting random pair");
                newPair = await utils.selectTaxonPair(gameState.selectedLevel, gameState.currentSetID);
                if (!newPair) {
                    throw new Error("Failed to select a valid taxon pair");
                }
            }
        }

        if (!imageOneURL || !imageTwoURL) {
            [imageOneURL, imageTwoURL] = await Promise.all([
                api.fetchRandomImageMetadata(newPair.taxon1),
                api.fetchRandomImageMetadata(newPair.taxon2)
            ]);
        }

        updateGameState({
            currentTaxonImageCollection: {
                pair: newPair,
                imageOneURL,
                imageTwoURL,
                skillLevel: newPair.skillLevel
            },
            usedImages: {
                taxon1: new Set([imageOneURL]),
                taxon2: new Set([imageTwoURL])
            },
            currentSetID: newPair.setID || gameState.currentSetID
        });

        // Update the skill level indicator
        this.updateSkillLevelIndicator(newPair.skillLevel);

        await this.setupRound(true);
    },

    async setupRound(isNewPair = false) {
        const { pair } = gameState.currentTaxonImageCollection;
        const randomized = Math.random() < 0.5;

        let imageOneURL, imageTwoURL;

        if (isNewPair) {
            imageOneURL = gameState.currentTaxonImageCollection.imageOneURL;
            imageTwoURL = gameState.currentTaxonImageCollection.imageTwoURL;
        } else {
            const preloadedImages = preloader.getPreloadedImagesForNextRound();
            if (preloadedImages && preloadedImages.taxon1 && preloadedImages.taxon2) {
                imageOneURL = preloadedImages.taxon1;
                imageTwoURL = preloadedImages.taxon2;
            } else {
                [imageOneURL, imageTwoURL] = await Promise.all([
                    preloader.fetchDifferentImage(pair.taxon1, gameState.currentRound.imageOneURL),
                    preloader.fetchDifferentImage(pair.taxon2, gameState.currentRound.imageTwoURL)
                ]);
            }
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

        // Add world maps
        const leftContinents = await this.getContinentForTaxon(randomized ? pair.taxon1 : pair.taxon2);
        const rightContinents = await this.getContinentForTaxon(randomized ? pair.taxon2 : pair.taxon1);
        createWorldMap(elements.imageOneContainer, leftContinents);
        createWorldMap(elements.imageTwoContainer, rightContinents);

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

        setTimeout(() => this.setNamePairHeight(), 100);
    },

    async getContinentForTaxon(taxon) {
        const taxonInfo = await api.loadTaxonInfo();
        const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxon.toLowerCase());

        if (taxonData && taxonData.distribution && taxonData.distribution.length > 0) {
            // Convert the continent codes to full names
            const continentMap = {
                'NA': 'North America',
                'SA': 'South America',
                'EU': 'Europe',
                'AS': 'Asia',
                'AF': 'Africa',
                'OC': 'Oceania'
            };

            // Convert all continent codes to full names
            const fullContinents = taxonData.distribution.map(code => continentMap[code]);

            return fullContinents;
        } else {
            logger.debug(`No distribution data found for ${taxon}. Using placeholder.`);
            return ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania'];
        }
    },

    async checkINaturalistReachability() {
        if (!await api.isINaturalistReachable()) {
            ui.showINatDownDialog();
            this.setState(GameState.IDLE);
            return false;
        }
        ui.hideINatDownDialog();
        return true;
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

    handleSetupError(error) {
        logger.error("Error setting up game:", error);
        if (error.message === "Failed to select a valid taxon pair") {
            ui.showOverlay("No valid taxon pairs found. Please check your filters and try again.", config.overlayColors.red);
        } else {
            ui.showOverlay("Error loading game. Please try again.", config.overlayColors.red);
        }
        this.setState(GameState.IDLE);
        if (gameState.isInitialLoad) {
            this.hideLoadingScreen();
            updateGameState({ isInitialLoad: false });
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

    prepareUIForLoading: function () {
        utils.resetDraggables();
        elements.imageOne.classList.add('image-container__image--loading');
        elements.imageTwo.classList.add('image-container__image--loading');
        var startMessage = gameState.isFirstLoad ? "Drag the names!" : `${this.loadingMessage}`;
        ui.showOverlay(startMessage, config.overlayColors.green);
        // what does this do?
        gameState.isFirstLoad = false;
    },

    async loadNewRandomPair() {
        if (this.currentState === GameState.LOADING) {
            logger.debug("Already loading a new pair, ignoring request");
            return;
        }

        logger.debug("Loading new pair");
        this.setState(GameState.LOADING);
        ui.showOverlay(`${this.loadingMessage}`, config.overlayColors.green);
        elements.imageOne.classList.add('image-container__image--loading');
        elements.imageTwo.classList.add('image-container__image--loading');

        try {
            const preloadedPair = preloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair) {
                logger.debug("Using preloaded pair:", preloadedPair.pair);
                await this.setupGameWithPreloadedPair(preloadedPair);
            } else {
                logger.debug("No preloaded pair available, selecting random pair");
                await this.setupGame(true);
            }
            ui.hideOverlay();
            this.setNamePairHeight(); 
            this.updateSkillLevelIndicator(gameState.currentTaxonImageCollection.pair.skillLevel);
        } catch (error) {
            logger.error("Error loading new pair:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            this.setState(GameState.PLAYING);
            // Clear preloaded images for the next round
            preloader.clearPreloadedImagesForNextRound();
            // Start preloading for the next round and the next pair
            this.startPreloading(true);
        }
    },

    async setupGameWithPreloadedPair(preloadedPair) {
        updateGameState({
            currentTaxonImageCollection: {
                pair: preloadedPair.pair,
                imageOneURL: preloadedPair.taxon1,
                imageTwoURL: preloadedPair.taxon2
            },
            usedImages: {
                taxon1: new Set([preloadedPair.taxon1]),
                taxon2: new Set([preloadedPair.taxon2])
            }
        });

        await this.setupRound(true);
    },

    // Update this method to set the nextSelectedPair
    async loadNewTaxonPair(newPair) {
        this.nextSelectedPair = newPair;
        await this.setupGame(true);
    },

    checkAnswer(droppedZoneId) {
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

        if (leftAnswer || rightAnswer) {
            let isCorrect = false;
            if (droppedZoneId === 'drop-1') {
                isCorrect = leftAnswer === gameState.taxonImageOne;
            } else {
                isCorrect = rightAnswer === gameState.taxonImageTwo;
            }

            if (isCorrect) {
                this.handleCorrectAnswer();
            } else {
                this.handleIncorrectAnswer();
            }
        } else {
            logger.debug("Incomplete answer. Returning to PLAYING state.");
            this.setState(GameState.PLAYING);
        }
    },

    async handleCorrectAnswer() {
        await ui.showOverlay('Correct!', config.overlayColors.green);
        elements.imageOne.classList.add('image-container__image--loading');
        elements.imageTwo.classList.add('image-container__image--loading');
        await utils.sleep(2000); // Show "Correct!" for a while
        ui.updateOverlayMessage(`${this.loadingMessage}`); // Update message without changing color
        await this.setupGame(false);  // Start a new round with the same taxon pair
    },

    async handleIncorrectAnswer() {
        utils.resetDraggables();
        await ui.showOverlay('Try again!', config.overlayColors.red);
        await utils.sleep(1200);
        ui.hideOverlay();
        this.setState(GameState.PLAYING);
    },

    // determine height of tallest name tile, to keep layout stable over multiple rounds
    setNamePairHeight: function () {
        const leftName = document.getElementById('left-name');
        const rightName = document.getElementById('right-name');
        const namePair = document.querySelector('.name-pair');

        // Reset the height to auto to get the natural height
        leftName.style.height = 'auto';
        rightName.style.height = 'auto';
        namePair.style.height = 'auto';

        // Use requestAnimationFrame to ensure the browser has rendered the auto heights
        requestAnimationFrame(() => {
            const maxHeight = Math.max(leftName.offsetHeight, rightName.offsetHeight);

            // Set the height of the name-pair container
            namePair.style.height = `${maxHeight}px`;

            // Set both name tiles to this height
            leftName.style.height = `${maxHeight}px`;
            rightName.style.height = `${maxHeight}px`;
        });
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
            <span class="name-pair__taxon-name">${nameOne}</span>
            ${vernacularOne ? `<span class="name-pair__vernacular-name">${vernacularOne}</span>` : ''}
        `;
        elements.rightName.innerHTML = `
            <span class="name-pair__taxon-name">${nameTwo}</span>
            ${vernacularTwo ? `<span class="name-pair__vernacular-name">${vernacularTwo}</span>` : ''}
        `;

        gameState.taxonLeftName = nameOne;
        gameState.taxonRightName = nameTwo;

        // Call setNamePairHeight after setting the content
        this.setNamePairHeight();
    },

    finishSetup: function () {
        ui.hideOverlay();
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

    showInfoDialog(url, imageIndex) {
    const currentTaxon = this.getCurrentTaxon(url);
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
        // TODO check why api.fetchVernacular() won't work here
        api.fetchVernacular(currentTaxon).then(vernacularName => {
            vernacularElement.textContent = vernacularName;

            // Add taxon facts (assuming they're still in taxonInfo.json)
            api.loadTaxonInfo().then(taxonInfo => {
                const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === currentTaxon.toLowerCase());
                if (taxonData && taxonData.taxonFacts && taxonData.taxonFacts.length > 0) {
                    factsElement.innerHTML = '<h3>Facts:</h3><ul>' +
                        taxonData.taxonFacts.map(fact => `<li>${fact}</li>`).join('') +
                        '</ul>';
                    factsElement.style.display = 'block';
                } else {
                    factsElement.style.display = 'none';
                }

                // Position the dialog after content is loaded
                dialog.setAttribute('open', ''); // Explicitly set the 'open' attribute
                positionDialog();
            });
        });

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

        dialog.showModal();
        // Reposition on window resize
        window.addEventListener('resize', positionDialog);

    },

    getCurrentTaxon(url) {
        if (url === this.currentObservationURLs.imageOne) {
            return gameState.taxonImageOne;
        } else if (url === this.currentObservationURLs.imageTwo) {
            return gameState.taxonImageTwo;
        } else {
            logger.error("Unable to determine current taxon name");
            return null;
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

    setupButtonHandlers(url, currentTaxon) {
        const photoButton = document.getElementById('photo-button');
        const observationButton = document.getElementById('observation-button');
        const taxonButton = document.getElementById('taxon-button');
        const hintsButton = document.getElementById('hints-button');
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

        hintsButton.onclick = () => {
            logger.debug("Taxon hints button clicked");
            // Implement taxon hints functionality here
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

    // TODO should probably be somewhere with other select-set-dialog functionality
    loadRandomPairFromCurrentCollection: async function() {
        if (this.isCurrentPairInCollection()) {
            logger.debug("Current pair is already in the collection. No new pair loaded.");
            return;
        }

        logger.debug("Loading random pair from current collection");
        this.setState(GameState.LOADING);
        ui.showOverlay(`${this.loadingMessage}`, config.overlayColors.green);

        try {
            // Check if there's a preloaded pair that matches the current collection
            const preloadedPair = preloader.getPreloadedImagesForNextPair();
            if (preloadedPair && preloadedPair.pair && this.isPairInCurrentCollection(preloadedPair.pair)) {
                logger.debug("Using preloaded pair:", preloadedPair.pair);
                await this.setupGameWithPreloadedPair(preloadedPair);
            } else {
                logger.debug("No suitable preloaded pair, selecting new random pair");
                const newPair = await this.selectRandomPairFromCurrentCollection();
                if (newPair) {
                    this.nextSelectedPair = newPair;
                    await this.setupGame(true);
                } else {
                    throw new Error("No pairs available in the current collection");
                }
            }

            this.updateSkillLevelIndicator(gameState.currentTaxonImageCollection.pair.skillLevel);

            ui.hideOverlay();
        } catch (error) {
            logger.error("Error loading random pair from collection:", error);
            ui.showOverlay("Error loading new pair. Please try again.", config.overlayColors.red);
        } finally {
            this.setState(GameState.PLAYING);
            preloader.clearPreloadedImagesForNextRound();
            preloader.preloadForNextRound();
            preloader.preloadForNextPair();
        }
    },

    isPairInCurrentCollection: function(pair) {
        const selectedTags = gameState.selectedTags;
        const selectedLevel = gameState.selectedLevel;
        return (selectedTags.length === 0 || pair.tags.some(tag => selectedTags.includes(tag))) &&
               (selectedLevel === '' || pair.skillLevel === selectedLevel);
    },

    isCurrentPairInCollection: function() {
        if (!gameState.currentTaxonImageCollection || !gameState.currentTaxonImageCollection.pair) {
            return false;
        }

        const currentPair = gameState.currentTaxonImageCollection.pair;
        return this.isPairInCurrentCollection(currentPair);
    },

    selectRandomPairFromCurrentCollection: async function() {
        const taxonPairs = await api.fetchTaxonPairs();
        const filteredPairs = taxonPairs.filter(pair => this.isPairInCurrentCollection(pair));
        
        if (filteredPairs.length === 0) {
            logger.warn("No pairs match the current collection criteria");
            return null;
        }

        return filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
    },

    updateSkillLevelIndicator: function(skillLevel) {
        const indicator = document.getElementById('skill-level-indicator');
        if (!indicator) return;

        const chiliCount = parseInt(skillLevel) || 0;
        indicator.innerHTML = ''; // Clear existing content

        // Create an SVG element to hold the filter definition
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute'; // Position it off-screen

        // Define the filter
        const filter = `
            <filter id="chiliShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#FFFFFF" flood-opacity="0.5"/>
            </filter>
        `;
        svg.innerHTML = filter;
        indicator.appendChild(svg);

        for (let i = 0; i < chiliCount; i++) {
            const chiliSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            chiliSvg.classList.add('icon', 'icon-chili');
            chiliSvg.setAttribute('viewBox', '0 0 24 24');
            
            const useElement = document.createElementNS("http://www.w3.org/2000/svg", "use");
            useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', './images/icons.svg#icon-spicy');
            
            useElement.setAttribute('transform', 'scale(1.5) translate(-4, -4)');
            useElement.setAttribute('filter', 'url(#chiliShadow)'); // Apply the glow filter
            
            chiliSvg.appendChild(useElement);
            indicator.appendChild(chiliSvg);
        }

        // Adjust container height based on number of chilis
        indicator.style.height = `${chiliCount * 12 + 8}px`;
    },

};

// Initialize info buttons
game.initializeInfoButtons();

export default game;
