// Utility functions

import api from './api.js';
import game from './game.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';
import tagCloud from './tagCloud.js';

const utils = {

    // optionally get pair of taxa from URL
    getURLParameters: function () {
        const params = new URLSearchParams(window.location.search);
        const taxon1 = params.get('taxon1');
        const taxon2 = params.get('taxon2');
        const tags = params.get('tags');

        return { taxon1, taxon2, tags };
    },

    debounce: function (func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const context = this;
            const later = () => {
                clearTimeout(timeout);
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // trying out things button
    surprise: function () {
        logger.debug("Surprise!");
        //        game.showTaxaRelationship();
        //this.fart();
        this.randomAnimalSound();
    },

    randomAnimalSound: async function () {
        try {
            // Fetch random observations with sounds
            const url = "https://api.inaturalist.org/v1/observations?order_by=random&sounds=true";
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch observations');
            }
            const data = await response.json();

            // Filter observations with sounds
            const observationsWithSounds = data.results.filter(obs => obs.sounds && obs.sounds.length > 0);

            if (observationsWithSounds.length > 0) {
                // Choose a random observation
                const randomObservation = observationsWithSounds[Math.floor(Math.random() * observationsWithSounds.length)];

                // Extract the sound URL
                const soundUrl = randomObservation.sounds[0].file_url;

                if (soundUrl) {
                    // Create and play the audio
                    const audio = new Audio(soundUrl);
                    await audio.play();
                    logger.info(`Playing sound from observation: ${randomObservation.species_guess || 'Unknown species'}`);
                } else {
                    logger.warn("Sound URL not found in the selected observation.");
                }
            } else {
                logger.warn("No observations with sounds found.");
            }
        } catch (error) {
            logger.error('Could not play animal sound:', error);
        }
    },

    fart: function () {
        // placeholder
        const soundUrl = './sound/fart.mp3';
        // Create a new Audio object

        const audio = new Audio(soundUrl);
        audio.play({ playbackMode: 'background' })
            .then(() => { logger.info("Everybody plays their fart."); /* Audio started playing successfully*/ }).catch(error => { logger.error('Could not play my fart:', error); });
    },

    hasKeyboard: function () {
        // Check if the device is mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Check if it's a tablet
        const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(navigator.userAgent);

        // If it's not mobile and not a tablet, assume it has a keyboard
        const result = !isMobile && !isTablet;

        //        logger.debug(`hasKeyboard detected: ${result}`);
        //        logger.debug(`UserAgent: ${navigator.userAgent}`);

        return result;
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

    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    resetDraggables: function () {
        const leftNameContainer = document.getElementsByClassName('name-pair__container--left')[0];
        const rightNameContainer = document.getElementsByClassName('name-pair__container--right')[0];
        const dropOne = document.getElementById('drop-1');
        const dropTwo = document.getElementById('drop-2');

        // Move draggables back to the names container
        leftNameContainer.appendChild(document.getElementById('left-name'));
        rightNameContainer.appendChild(document.getElementById('right-name'));

        // Clear drop zones
        dropOne.innerHTML = ''; dropTwo.innerHTML = '';
    },

    capitalizeFirstLetter: function (string) {
        if (!string) {
            return '';
        } else { return string.charAt(0).toUpperCase() + string.slice(1); }
    },

    shortenSpeciesName: function (string) {
        if (!string) { return ''; }

        let parts = string.split(' ');
        if (parts.length < 2) {
            return string; // Return the original string if it doesn't contain at least two parts
        }

        let genusInitial = parts[0].charAt(0).toUpperCase() + '.';
        let species = parts.slice(1).join(' '); // Join the remaining parts in case the species name has multiple words

        return genusInitial + ' ' + species;
    },

    // Returns a taxon pair from the index, or a random one if none indicated
    selectTaxonPair: async function (index = null) {
        const taxonPairs = await api.fetchTaxonPairs();
        if (taxonPairs.length === 0) {
            logger.error("No taxon pairs available");
            return null;
        }

        let filteredPairs = taxonPairs;

        if (gameState.selectedTags.length > 0) {
            filteredPairs = taxonPairs.filter(pair =>
                pair.tags.some(tag => gameState.selectedTags.includes(tag))
            );
        }

        if (filteredPairs.length === 0) {
            logger.warn("No pairs match the selected tags. Using all pairs.");
            filteredPairs = taxonPairs;
        }

        return index !== null ? filteredPairs[index] : filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
    },

}; // const utils

export default utils;
