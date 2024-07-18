// Utility functions

import game from './game.js';

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
        console.log("Surprise!");
        game.showTaxaRelationship();
//        fart();
    },

    fart: function () {
        // placeholder
        const soundUrl = './sound/fart.mp3';
        // Create a new Audio object

    const audio = new Audio(soundUrl);
        audio.play({ playbackMode: 'background' })
          .then(() => { console.log("Everybody plays their fart."); /* Audio started playing successfully*/ }).catch(error => { console.error('Could not play my fart:', error); });
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

}; // const utils

export default utils;
