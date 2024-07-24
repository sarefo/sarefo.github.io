// preloader.js
import api from './api.js';
import { gameState } from './state.js';
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
    const { pair } = gameState.currentTaxonImageCollection;
    const [imageOneURL, imageTwoURL] = await Promise.all([
      api.fetchRandomImageMetadata(pair.taxon1),
      api.fetchRandomImageMetadata(pair.taxon2)
    ]);
    
    await Promise.all([
      this.preloadImage(imageOneURL),
      this.preloadImage(imageTwoURL)
    ]);

    this.preloadedImages.nextRound = { taxon1: imageOneURL, taxon2: imageTwoURL };
    logger.debug("Preloaded images for next round");
  },

  async preloadForNextPair() {
    const newPair = await utils.selectTaxonPair();
    const [imageOneURL, imageTwoURL] = await Promise.all([
      api.fetchRandomImageMetadata(newPair.taxon1),
      api.fetchRandomImageMetadata(newPair.taxon2)
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
  }
};

export default preloader;
