// preloader.js
import api from './api.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';
import utils from './utils.js';

const preloader = {
  preloadedImages: {
    nextRound: { taxon1: null, taxon2: null },
    nextPair: { taxon1: null, taxon2: null, pair: null }
  },

  async preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  },

    async preloadForNextRound() {
        const { pair, imageOneURL, imageTwoURL } = gameState.currentTaxonImageCollection;
        const [newImageOneURL, newImageTwoURL] = await Promise.all([
            this.fetchDifferentImage(pair.taxon1, imageOneURL),
            this.fetchDifferentImage(pair.taxon2, imageTwoURL)
        ]);
        
        await Promise.all([
            this.preloadImage(newImageOneURL),
            this.preloadImage(newImageTwoURL)
        ]);

        this.preloadedImages.nextRound = { taxon1: newImageOneURL, taxon2: newImageTwoURL };
        logger.debug("Preloaded images for next round");
    },

    async fetchDifferentImage(taxonName, currentImageURL) {
        const images = await api.fetchMultipleImages(taxonName, 12);
        const taxonKey = taxonName === gameState.currentTaxonImageCollection.pair.taxon1 ? 'taxon1' : 'taxon2';
        let usedImages = gameState.usedImages[taxonKey];
        
        // Filter out the current image and any previously used images
        let availableImages = images.filter(img => !usedImages.has(img) && img !== currentImageURL);
        
        // If we've used all images, reset the used images but still avoid the current image
        if (availableImages.length === 0) {
            logger.warn(`All images for ${taxonName} have been used. Resetting used images.`);
            usedImages = new Set([currentImageURL]);
            availableImages = images.filter(img => img !== currentImageURL);
        }
        
        if (availableImages.length > 0) {
            const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            usedImages.add(selectedImage);
            updateGameState({ 
                usedImages: { 
                    ...gameState.usedImages, 
                    [taxonKey]: usedImages 
                } 
            });
            return selectedImage;
        } else {
            // This should rarely happen, but just in case
            logger.error(`No available images found for ${taxonName}. Using current image.`);
            return currentImageURL;
        }
    },

    async preloadForNextPair() {
        if (this.preloadedImages.nextPair.pair) {
            logger.debug("Skipping preload for next pair as one is already available");
            return;
        }

        const newPair = await utils.selectTaxonPair();
        const [imageOneURL, imageTwoURL] = await Promise.all([
            this.fetchDifferentImage(newPair.taxon1, null),
            this.fetchDifferentImage(newPair.taxon2, null)
        ]);
        
        await Promise.all([
            this.preloadImage(imageOneURL),
            this.preloadImage(imageTwoURL)
        ]);

        this.preloadedImages.nextPair = { 
            pair: newPair,
            taxon1: imageOneURL, 
            taxon2: imageTwoURL 
        };
        logger.debug("Preloaded images for next pair");
    },

  getPreloadedImagesForNextRound() {
    const images = this.preloadedImages.nextRound;
    this.preloadedImages.nextRound = { taxon1: null, taxon2: null };
    return images;
  },

  getPreloadedImagesForNextPair() {
    const images = this.preloadedImages.nextPair;
    this.preloadedImages.nextPair = { taxon1: null, taxon2: null, pair: null };
    return images;
  },

  hasPreloadedPair() {
    return !!this.preloadedImages.nextPair.pair;
  }
};

export default preloader;
