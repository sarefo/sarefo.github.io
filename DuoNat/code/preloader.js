// preloader.js
import api from './api.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';
import utils from './utils.js';

const preloader = {
  async preloadForCurrentRound() {
    const { pair } = gameState.currentTaxonImageCollection;
    const [imageOneURL, imageTwoURL] = await Promise.all([
      api.fetchRandomImageMetadata(pair.taxon1),
      api.fetchRandomImageMetadata(pair.taxon2)
    ]);
    
    updateGameState({
      preloadState: {
        ...gameState.preloadState,
        currentRound: {
          taxon1: imageOneURL,
          taxon2: imageTwoURL
        }
      }
    });
    
    logger.debug("Preloaded images for current round");
  },

  async preloadForNextRound() {
    const { pair } = gameState.currentTaxonImageCollection;
    const [imageOneURL, imageTwoURL] = await Promise.all([
      api.fetchRandomImageMetadata(pair.taxon1),
      api.fetchRandomImageMetadata(pair.taxon2)
    ]);
    
    updateGameState({
      preloadState: {
        ...gameState.preloadState,
        nextRound: {
          taxon1: imageOneURL,
          taxon2: imageTwoURL
        }
      }
    });
    
    logger.debug("Preloaded images for next round");
  },

  async preloadForNextPair() {
    const newPair = await utils.selectTaxonPair();
    const [imageOneURL, imageTwoURL] = await Promise.all([
      api.fetchRandomImageMetadata(newPair.taxon1),
      api.fetchRandomImageMetadata(newPair.taxon2)
    ]);
    
    updateGameState({
      preloadState: {
        ...gameState.preloadState,
        nextPair: {
          taxon1: imageOneURL,
          taxon2: imageTwoURL
        }
      }
    });
    
    logger.debug("Preloaded images for next pair");
  }
};

export default preloader;
