import logger from './logger.js';

import api from './api.js'; // for sound

const utils = {
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
    },

    sound: {
        surprise() {
            logger.debug("Surprise!");
            this.randomAnimalSound();
        },

        async playSound(soundUrl) {
            if (soundUrl) {
                const audio = new Audio(soundUrl);
                await audio.play();
            } else {
                logger.warn("Sound URL not found in the selected observation.");
            }
        },

        async randomAnimalSound() {
            try {
                const observation = await api.sound.fetchRandomObservationWithSound();
                if (observation) {
                    await this.playSound(observation.sounds[0].file_url);
                    logger.info(`Playing sound from observation: ${observation.species_guess || 'Unknown species'}`);
                }
            } catch (error) {
                logger.error('Could not play animal sound:', error);
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
['ui', 'sound', 'string', 'array'].forEach(nestedObj => {
    Object.keys(utils[nestedObj]).forEach(key => {
        if (typeof utils[nestedObj][key] === 'function') {
            utils[nestedObj][key] = utils[nestedObj][key].bind(utils[nestedObj]);
        }
    });
});

const publicAPI = {
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
