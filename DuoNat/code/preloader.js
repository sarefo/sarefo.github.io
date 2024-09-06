import api from './api.js';
import logger from './logger.js';
import pairManager from './pairManager.js';
import state from './state.js';

const preloader = {
    preloadedImages: {
        nextRound: { taxonA: null, taxonB: null },
        nextPair: { taxonA: null, taxonB: null, pair: null }
    },
    isPreloading: false,

    imageLoader: {
        preloadImage(url) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(url);
                img.onerror = () => {
                    logger.error(`Failed to load image: ${url}`);
                    reject(url);
                };
                img.src = url;
            });
        },

        async fetchDifferentImage(taxonName, currentImageURL) {
            const images = await api.images.fetchMultipleImages(taxonName, 12);
            let usedImages = this.getUsedImagesForTaxon(taxonName);
            
            let availableImages = this.filterAvailableImages(images, usedImages, currentImageURL);

            if (availableImages.length === 0) {
                logger.warn(`All images have been used for ${taxonName}. Resetting used images.`);
                usedImages = new Set();
                this.updateUsedImagesState(usedImages, null, taxonName);
                availableImages = this.filterAvailableImages(images, usedImages, currentImageURL);
            }

            if (availableImages.length === 0) {
                logger.warn(`No available images for ${taxonName}. Using the current image.`);
                return currentImageURL || images[0];
            }

            const selectedImage = this.selectAndUpdateUsedImage(availableImages, usedImages, taxonName);

            return selectedImage;
        },

        filterAvailableImages(images, usedImages, currentImageURL) {
            return images.filter(img => !usedImages.has(img) && img !== currentImageURL);
        },

        getUsedImagesForTaxon(taxonName) {
            const usedImages = state.getUsedImages();
            return usedImages[taxonName] || new Set();
        },

        getTaxonKey(taxonName) {
            const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            if (currentTaxonImageCollection) {
                return taxonName === currentTaxonImageCollection.pair.taxonA ? 'taxonA' : 'taxonB';
            }
            return taxonName; // Fallback to using the taxon name as the key
        },

        filterAvailableImages(images, usedImages, currentImageURL) {
            return images.filter(img => !usedImages.has(img) && img !== currentImageURL);
        },

        resetUsedImages(images, currentImageURL) {
            logger.warn(`All images have been used. Resetting used images.`);
            return images.filter(img => img !== currentImageURL);
        },

        selectAndUpdateUsedImage(availableImages, usedImages, taxonName) {
            if (availableImages.length > 0) {
                const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
                this.updateUsedImagesState(usedImages, selectedImage, taxonName);
                return selectedImage;
            } else {
                logger.warn(`No available images found for ${taxonName}. Using the first image.`);
                return availableImages[0];
            }
        },

        updateUsedImagesState(usedImages, selectedImage, taxonName) {
            if (selectedImage) {
                usedImages.add(selectedImage);
            }
            const currentUsedImages = state.getUsedImages();
            state.updateGameStateMultiple({
                usedImages: {
                    ...currentUsedImages,
                    [taxonName]: usedImages
                }
            });
        },
    },

    roundPreloader: {
        async preloadForNextRound() {
            try {
                const { pair, image1URL, image2URL } = state.getCurrentTaxonImageCollection();
                const [newImage1URL, newImage2URL] = await Promise.all([
                    preloader.imageLoader.fetchDifferentImage(pair.taxonA, image1URL),
                    preloader.imageLoader.fetchDifferentImage(pair.taxonB, image2URL)
                ]);

                await Promise.all([
                    preloader.imageLoader.preloadImage(newImage1URL),
                    preloader.imageLoader.preloadImage(newImage2URL)
                ]);

                preloader.preloadedImages.nextRound = { taxonA: newImage1URL, taxonB: newImage2URL };
                logger.debug("Preloading completed for next round");
            } catch (error) {
                logger.error("Error during round preloading:", error);
            }
        },

        getPreloadedImagesForNextRound() {
            const images = preloader.preloadedImages.nextRound;
            preloader.preloadedImages.nextRound = { taxonA: null, taxonB: null };
            return images;
        },

        getPreloadedImagesForRoundDemo() {
            const images = preloader.preloadedImages.nextRound;
            return images;
        },

        // called only from roundManager.getImages()
        clearPreloadedRound() {
            preloader.preloadedImages.nextRound = { taxonA: null, taxonB: null };
        },
    },

    pairPreloader: {
        isCollectionSubsetInitialized: false,

        clearPreloadedPair() {
            preloader.preloadedImages.nextPair = null;
            //logger.debug("Cleared preloaded pair");

        },

        // only called from pairManager.loadNewPair() helper function
        async preloadForNextPair() {
            if (preloader.isPreloading) return;

            preloader.isPreloading = true;
            try {
                if (!this.isCollectionSubsetInitialized) {
                    await pairManager.initializeCollectionSubset();
                    this.isCollectionSubsetInitialized = true;
                }

                let newPair;
                if (state.getPreloadNextPairID()) {
                    const currentPairID = state.getCurrentPairID();
                    const highestPairID = state.getHighestPairID();
                    
                    let nextPairID;
                    let attempts = 0;
                    const maxAttempts = 10; // Limit the number of attempts to find a valid pair

                    do {
                        if (currentPairID === highestPairID || attempts >= maxAttempts) {
                            nextPairID = "1";
                        } else {
                            nextPairID = String(Number(currentPairID) + 1);
                        }
                        newPair = await pairManager.getPairByID(nextPairID);
                        attempts++;
                    } while (!newPair && attempts < maxAttempts);

                    if (!newPair) {
                        logger.warn(`Could not find a valid pair after ${maxAttempts} attempts. Falling back to random selection.`);
                        newPair = await pairManager.selectRandomPair();
                    } else {
                        logger.debug("Preloading next ID", nextPairID);
                    }
                    state.setPreloadNextPairID(false); // Reset the flag
                } else {
                    newPair = await pairManager.selectRandomPair();
                }
                
                if (newPair) {
                    await this.preloadPairImages(newPair);
                    logger.debug("Preloaded pair:", newPair.pairID, newPair);
                } else {
                    logger.warn("No valid pairs found for preloading");
                    preloader.preloadedImages.nextPair = null;
                }
            } catch (error) {
                logger.error("Error preloading next pair:", error);
                preloader.preloadedImages.nextPair = null;
            } finally {
                preloader.isPreloading = false;
                logger.debug("Preloading completed for next pair");
            }
        },

        async preloadPairImages(pair) {
            if (!pair || !pair.taxonA || !pair.taxonB) {
                logger.error("Invalid pair data for preloading images:", pair);
                return;
            }

            try {
                const [image1URL, image2URL] = await Promise.all([
                    preloader.imageLoader.fetchDifferentImage(pair.taxonA, null),
                    preloader.imageLoader.fetchDifferentImage(pair.taxonB, null)
                ]);

                if (image1URL && image2URL) {
                    await Promise.all([
                        preloader.imageLoader.preloadImage(image1URL),
                        preloader.imageLoader.preloadImage(image2URL)
                    ]);

                    preloader.preloadedImages.nextPair = {
                        pair: pair,
                        taxonA: image1URL,
                        taxonB: image2URL
                    };
                } else {
                    logger.warn("Failed to fetch images for preloading:", pair);
                    preloader.preloadedImages.nextPair = null;
                }
            } catch (error) {
                logger.error("Error preloading images for pair:", error);
                preloader.preloadedImages.nextPair = null;
            }
        },

        isPairValid(pair) {
            const selectedLevel = state.getSelectedLevel();
            const matchesLevel = selectedLevel === '' || pair.level === selectedLevel;

            if (!matchesLevel) {
                logger.debug(`Pair invalid - Skill level mismatch: Pair ${pair.level}, Selected ${selectedLevel}`);
            }

            return matchesLevel;
        },

        // called from 
        // - pairManager.selectPairForLoading()
        // - pairManager.loadImagesForNewPair()
        getPreloadedImagesForNextPair() {
            if (this.hasPreloadedPair()) { // Don't clear the preloaded images here
                const imageData = preloader.preloadedImages.nextPair;
                return imageData;
            } else {
                logger.debug("No preloaded pair available");
                return null;
            }
        },

        hasPreloadedPair() {
            return preloader.preloadedImages.nextPair != null && preloader.preloadedImages.nextPair.pair != null;
        },

        async preloadNewPairWithTags(selectedTags, selectedLevel, selectedRanges) {
            if (preloader.isPreloading) {
                logger.warn("Preloading already in progress, skipping tag-based preload");
                return;
            }

            preloader.isPreloading = true;
            try {
                const allPairs = await api.taxonomy.fetchTaxonPairs();
                const filteredPairs = this.filterPairsByTags(allPairs, selectedTags, selectedLevel, selectedRanges);
                const newPair = this.selectNewPair(filteredPairs, allPairs);
                await this.preloadPairImages(newPair);
            } catch (error) {
                logger.error("Error preloading new pair with tags, level, and ranges:", error);
            } finally {
                preloader.isPreloading = false;
            }
        },

        filterPairsByTags(allPairs, selectedTags, selectedLevel, selectedRanges) {
            const tags = Array.isArray(selectedTags) ? selectedTags : [];
            const ranges = Array.isArray(selectedRanges) ? selectedRanges : [];
            const level = typeof selectedLevel === 'string' ? selectedLevel : '';

            return allPairs.filter(pair => {
                const matchesLevel = level === '' || pair.level === level;
                const matchesRanges = ranges.length === 0 ||
                    (pair.range && pair.range.some(range => ranges.includes(range)));
                const matchesTags = tags.length === 0 ||
                    (pair.tags && pair.tags.some(tag => tags.includes(tag)));
                const isDifferentFromCurrent = this.isDifferentFromCurrentPair(pair);

                return matchesLevel && matchesRanges && matchesTags && isDifferentFromCurrent;
            });
        },

        isDifferentFromCurrentPair(pair) {
            const currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            return !currentTaxonImageCollection ||
                !currentTaxonImageCollection.pair ||
                pair.taxonA !== currentTaxonImageCollection.pair.taxonA ||
                pair.taxonB !== currentTaxonImageCollection.pair.taxonB;
        },

        selectNewPair(filteredPairs, allPairs) {
            if (filteredPairs.length > 0) {
                const newPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                return newPair;
            } else {
                const newPair = allPairs[Math.floor(Math.random() * allPairs.length)];
                logger.warn("No pairs match the criteria. Selected a random pair from all pairs.");
                return newPair;
            }
        },

        // used by "+" shortcut for ID walking
        /*async preloadPairByID(pairID) {
            try {
                const nextPair = await pairManager.getPairByID(pairID);
                if (nextPair) {
                    await this.preloadPairImages(nextPair);
                } else {
                    logger.warn(`Pair with ID ${pairID} not found for preloading`);
                }
            } catch (error) {
                logger.error(`Error preloading pair with ID ${pairID}:`, error);
            }
        },*/
    },
};

const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};
bindMethodsRecursively(preloader);

const publicAPI = {
    // Pairs
    hasPreloadedPair: preloader.pairPreloader.hasPreloadedPair,
    isPairValid: preloader.pairPreloader.isPairValid,
    getPreloadedImagesForNextPair: preloader.pairPreloader.getPreloadedImagesForNextPair,
    clearPreloadedPair: preloader.pairPreloader.clearPreloadedPair,

    preloadNewPairWithTags: preloader.pairPreloader.preloadNewPairWithTags,
    //preloadPairByID: preloader.pairPreloader.preloadPairByID,
    preloadForNextPair: preloader.pairPreloader.preloadForNextPair,

    // Rounds
    preloadForNextRound: preloader.roundPreloader.preloadForNextRound,
    clearPreloadedRound: preloader.roundPreloader.clearPreloadedRound,

    getPreloadedImagesForNextRound: preloader.roundPreloader.getPreloadedImagesForNextRound,
    getPreloadedImagesForRoundDemo: preloader.roundPreloader.getPreloadedImagesForRoundDemo,

    // Misc
    fetchDifferentImage: preloader.imageLoader.fetchDifferentImage,
};

export default publicAPI;
