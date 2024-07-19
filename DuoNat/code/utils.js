// Utility functions

import api from './api.js';
import game from './game.js';
import logger from './logger.js';

const utils = {

    // optionally get pair of taxa from URL
    getURLParameters: function () {
        const params = new URLSearchParams(window.location.search);
        const taxon1 = params.get('taxon1');
        const taxon2 = params.get('taxon2');
        if (taxon1 && taxon2) {
            return { taxon1, taxon2 };
        }
        return null;
    },

    // trying out things button
    surprise: function () {
        logger.debug("Surprise!");
//        game.showTaxaRelationship();
        this.fart();
    },

    fart: function () {
        // placeholder
        const soundUrl = './sound/fart.mp3';
        // Create a new Audio object

    const audio = new Audio(soundUrl);
        audio.play({ playbackMode: 'background' })
          .then(() => { logger.info("Everybody plays their fart."); /* Audio started playing successfully*/ }).catch(error => { logger.error('Could not play my fart:', error); });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    resetDraggables: function () {
        const leftNameContainer = document.getElementById('left-name-container');
        const rightNameContainer = document.getElementById('right-name-container');
        const dropOne = document.getElementById('drop-1');
        const dropTwo = document.getElementById('drop-2');
        
        // Move draggables back to the names container
        leftNameContainer.appendChild(document.getElementById('left-name'));
        rightNameContainer.appendChild(document.getElementById('right-name'));
        
        // Clear drop zones
        dropOne.innerHTML = ''; dropTwo.innerHTML = '';
    },

    capitalizeFirstLetter: function(string) {
        if (!string) { return '';
        } else { return string.charAt(0).toUpperCase() + string.slice(1); }
    },

    shortenSpeciesName: function(string) {
        if (!string) { return ''; }
        
        let parts = string.split(' ');
        if (parts.length < 2) {
            return string; // Return the original string if it doesn't contain at least two parts
        }
        
        let genusInitial = parts[0].charAt(0).toUpperCase() + '.';
        let species = parts.slice(1).join(' '); // Join the remaining parts in case the species name has multiple words

        return genusInitial + ' ' + species;
    },

    selectTaxonPair: async function (index = null) {
        const taxonPairs = await api.fetchTaxonPairs();
        if (taxonPairs.length === 0) {
            logger.error("No taxon pairs available");
            return null;
        }
        return index !== null ? taxonPairs[index] : taxonPairs[Math.floor(Math.random() * taxonPairs.length)];
    },

}; // const utils

export default utils;
