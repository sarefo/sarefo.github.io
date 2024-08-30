import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import logger from './logger.js';
import state from './state.js';

const utils = {
    game: {
        async selectTaxonPair(filters = {}) {
            try {
                const filteredPairs = await filtering.getFilteredTaxonPairs(filters);

                if (filteredPairs.length === 0) {
                    logger.warn("No pairs match the selected criteria. Using all pairs.");
                    return this.selectRandomPair(await api.taxonomy.fetchTaxonPairs());
                }

                return this.selectRandomPair(filteredPairs);
            } catch (error) {
                logger.error("Error in selectTaxonPair:", error);
                return null;
            }
        },

        selectRandomPair(pairs) {
            if (pairs.length === 0) {
                logger.error("No taxon pairs available");
                return null;
            }

            const selectedPair = pairs[Math.floor(Math.random() * pairs.length)];
            logger.debug(`Selected pair: ${selectedPair.taxon1} / ${selectedPair.taxon2}, Skill Level: ${selectedPair.level}`);
            return selectedPair;
        },

        resetDraggables() {
            const leftNameContainer = document.getElementsByClassName('name-pair__container--left')[0];
            const rightNameContainer = document.getElementsByClassName('name-pair__container--right')[0];
            const dropOne = document.getElementById('drop-1');
            const dropTwo = document.getElementById('drop-2');

            leftNameContainer.appendChild(document.getElementById('left-name'));
            rightNameContainer.appendChild(document.getElementById('right-name'));

            dropOne.innerHTML = '';
            dropTwo.innerHTML = '';
        },
    },

    ui: {
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

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        // TODO move to config.js
        getLoadingMessage() {
            return config.loadingMessage;
        },
    },

    sound: {
        surprise() {
            logger.debug("Surprise!");
            this.randomAnimalSound();
        },

        async randomAnimalSound() {
            try {
                const observation = await this.fetchRandomObservationWithSound();
                if (observation) {
                    await this.playSound(observation.sounds[0].file_url);
                    logger.info(`Playing sound from observation: ${observation.species_guess || 'Unknown species'}`);
                }
            } catch (error) {
                logger.error('Could not play animal sound:', error);
            }
        },

        async fetchRandomObservationWithSound() {
            const url = "https://api.inaturalist.org/v1/observations?order_by=random&sounds=true";
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch observations');
            }
            const data = await response.json();
            const observationsWithSounds = data.results.filter(obs => obs.sounds && obs.sounds.length > 0);
            return observationsWithSounds.length > 0 ? observationsWithSounds[Math.floor(Math.random() * observationsWithSounds.length)] : null;
        },

        async playSound(soundUrl) {
            if (soundUrl) {
                const audio = new Audio(soundUrl);
                await audio.play();
            } else {
                logger.warn("Sound URL not found in the selected observation.");
            }
        },

        fart() {
            const soundUrl = './sound/fart.mp3';
            const audio = new Audio(soundUrl);
            audio.play({ playbackMode: 'background' })
                .then(() => logger.info("Everybody plays their fart."))
                .catch(error => logger.error('Could not play my fart:', error));
        }
    },

    string: {
        capitalizeFirstLetter(string) {
            return string ? string.charAt(0).toUpperCase() + string.slice(1) : '';
        },

        shortenSpeciesName(string) {
            if (!string) return '';
            let parts = string.split(' ');
            if (parts.length < 2) return string;
            let genusInitial = parts[0].charAt(0).toUpperCase() + '.';
            let species = parts.slice(1).join(' ');
            return genusInitial + ' ' + species;
        },

        truncate: (str, maxLength) => {
            if (str.length <= maxLength) return str;
            return str.slice(0, maxLength - 1) + '…';
        },
    },

    array: {
        arraysEqual(a, b) {
            if (a === b) return true;
            if (a == null || b == null) return false;
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; ++i) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }
    },
};

// Bind all methods in nested objects
['game', 'ui', 'sound', 'string', 'array'].forEach(nestedObj => {
    Object.keys(utils[nestedObj]).forEach(key => {
        if (typeof utils[nestedObj][key] === 'function') {
            utils[nestedObj][key] = utils[nestedObj][key].bind(utils[nestedObj]);
        }
    });
});

const publicAPI = {
    game: {
        selectTaxonPair: utils.game.selectTaxonPair,
        resetDraggables: utils.game.resetDraggables
    },
    ui: {
        debounce: utils.ui.debounce,
        sleep: utils.ui.sleep,
        getLoadingMessage: utils.ui.getLoadingMessage
    },
    sound: {
        surprise: utils.sound.surprise,
        fart: utils.sound.fart
    },
    string: {
        capitalizeFirstLetter: utils.string.capitalizeFirstLetter,
        shortenSpeciesName: utils.string.shortenSpeciesName,
        truncate: utils.string.truncate
    },
    array: {
        arraysEqual: utils.array.arraysEqual
    }
};

export default publicAPI;
