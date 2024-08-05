// Utility functions

import api from './api.js';
import game from './game.js';
import dialogManager from './dialogManager.js';
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
        const skillLevel = params.get('skillLevel');
        const setID = params.get('setID');

        return { taxon1, taxon2, tags, skillLevel, setID };
    },

    shareCurrentPair: function() {
        let currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('taxon1');
        currentUrl.searchParams.delete('taxon2');
        currentUrl.searchParams.delete('tags');
        currentUrl.searchParams.delete('skillLevel');
        currentUrl.searchParams.delete('setID');

        currentUrl.searchParams.set('taxon1', gameState.taxonImageOne);
        currentUrl.searchParams.set('taxon2', gameState.taxonImageTwo);

        // Add active tags to the URL
        const activeTags = gameState.selectedTags;
        if (activeTags && activeTags.length > 0) {
            currentUrl.searchParams.set('tags', activeTags.join(','));
        }

        // Add skillLevel only if it's set (not empty)
        if (gameState.selectedLevel && gameState.selectedLevel !== '') {
            currentUrl.searchParams.set('skillLevel', gameState.selectedLevel);
        }

        // Add setID if available
        if (gameState.currentTaxonImageCollection && gameState.currentTaxonImageCollection.pair) {
            const { setID } = gameState.currentTaxonImageCollection.pair;
            if (setID) {
                currentUrl.searchParams.set('setID', setID);
            }
        }

        let shareUrl = currentUrl.toString();

        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            logger.info('Share URL copied to clipboard');
            
            // Generate QR code
            const qrCodeContainer = document.getElementById('qr-container');
            qrCodeContainer.innerHTML = ''; // Clear previous QR code
            new QRCode(qrCodeContainer, {
                text: shareUrl,
                width: 256,
                height: 256
            });

            // Open the QR code dialog
            dialogManager.openDialog('qr-dialog');
        }).catch(err => {
            logger.error('Failed to copy: ', err);
            alert('Failed to copy link. Please try again.');
        });
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
    selectTaxonPair: async function (setID = null) {
        try {
            const taxonPairs = await api.fetchTaxonPairs();
            if (taxonPairs.length === 0) {
                logger.error("No taxon pairs available");
                return null;
            }

            let filteredPairs = taxonPairs;

            // Filter by setID if provided
            if (setID) {
                filteredPairs = filteredPairs.filter(pair => pair.setID === setID);
            }

            // Filter by tags and selected level from gameState
            filteredPairs = filteredPairs.filter(pair => {
                const matchesTags = gameState.selectedTags.length === 0 || 
                    pair.tags.some(tag => gameState.selectedTags.includes(tag));
                const matchesLevel = gameState.selectedLevel === '' || 
                    pair.skillLevel === gameState.selectedLevel;
                return matchesTags && matchesLevel;
            });

            if (filteredPairs.length === 0) {
                logger.warn("No pairs match the selected criteria. Using all pairs.");
                filteredPairs = taxonPairs;
            }

            return filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
        } catch (error) {
            logger.error("Error in selectTaxonPair:", error);
            return null;
        }
    }
}; // const utils

export default utils;
