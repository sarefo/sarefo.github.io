import api from './api.js';
import config from './config.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import logger from './logger.js';
import state from './state.js';

const utils = {
    url: {
        getURLParameters() {
            const params = new URLSearchParams(window.location.search);
            return {
                taxon1: params.get('taxon1'),
                taxon2: params.get('taxon2'),
                tags: params.get('tags'),
                level: params.get('level'),
                setID: params.get('setID'),
                ranges: params.get('ranges')
            };
        },

        buildShareUrl() {
            let currentUrl = new URL(window.location.href);
            currentUrl.search = ''; // Clear existing parameters
            let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
            
            if (currentTaxonImageCollection && currentTaxonImageCollection.pair) {
                const { setID, taxon1, taxon2 } = currentTaxonImageCollection.pair;
                if (setID) currentUrl.searchParams.set('setID', setID);
                currentUrl.searchParams.set('taxon1', taxon1);
                currentUrl.searchParams.set('taxon2', taxon2);
            }

            utils.url.addOptionalParameters(currentUrl);
            return currentUrl.toString();
        },

        addOptionalParameters(url) {
            const activeTags = state.getSelectedTags();
            if (activeTags && activeTags.length > 0) {
                url.searchParams.set('tags', activeTags.join(','));
            }

            const selectedLevel = state.getSelectedLevel();
            if (selectedLevel && selectedLevel !== '') {
                url.searchParams.set('level', selectedLevel);
            }

            const selectedRanges = state.getSelectedRanges();
            if (selectedRanges && selectedRanges.length > 0) {
                url.searchParams.set('ranges', selectedRanges.join(','));
            }
        },

        shareCurrentPair() {
            const shareUrl = utils.url.buildShareUrl();
            utils.url.copyToClipboard(shareUrl)
                .then(() => utils.url.generateAndShowQRCode(shareUrl))
                .catch(utils.url.handleShareError);
        },

        copyToClipboard(text) {
            return navigator.clipboard.writeText(text)
                .then(() => logger.info('Share URL copied to clipboard'));
        },

        generateAndShowQRCode(url) {
            loadQRCodeScript()
                .then(() => {
                    const qrCodeContainer = document.getElementById('qr-container');
                    qrCodeContainer.innerHTML = '';
                    new QRCode(qrCodeContainer, {
                        text: url,
                        width: 256,
                        height: 256
                    });
                    dialogManager.openDialog('qr-dialog');
                })
                .catch(err => {
                    logger.error('Failed to load QR code script:', err);
                    alert('Failed to generate QR code. Please try again.');
                });
        },

        handleShareError(err) {
            logger.error('Failed to copy:', err);
            alert('Failed to copy link. Please try again.');
        }
    },

    game: {
        async selectTaxonPair(filters = {}) {
            try {
                const filteredPairs = await filtering.getFilteredTaxonPairs(filters);
                
                if (filteredPairs.length === 0) {
                    logger.warn("No pairs match the selected criteria. Using all pairs.");
                    return utils.game.selectRandomPair(await api.taxonomy.fetchTaxonPairs());
                }

                return utils.game.selectRandomPair(filteredPairs);
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

    device: {
        hasKeyboard() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(navigator.userAgent);
            return !isMobile && !isTablet;
        }
    },

    sound: {
        surprise() {
            logger.debug("Surprise!");
            utils.sound.randomAnimalSound();
        },

        async randomAnimalSound() {
            try {
                const observation = await utils.sound.fetchRandomObservationWithSound();
                if (observation) {
                    await utils.sound.playSound(observation.sounds[0].file_url);
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
        }
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

const publicAPI = {
    url: {
        getURLParameters: utils.url.getURLParameters,
        shareCurrentPair: utils.url.shareCurrentPair
    },
    game: {
        selectTaxonPair: utils.game.selectTaxonPair,
        resetDraggables: utils.game.resetDraggables
    },
    ui: {
        debounce: utils.ui.debounce,
        sleep: utils.ui.sleep,
        getLoadingMessage: utils.ui.getLoadingMessage
    },
    device: {
        hasKeyboard: utils.device.hasKeyboard
    },
    sound: {
        surprise: utils.sound.surprise,
        fart: utils.sound.fart
    },
    string: {
        capitalizeFirstLetter: utils.string.capitalizeFirstLetter,
        shortenSpeciesName: utils.string.shortenSpeciesName
    },
    array: {
        arraysEqual: utils.array.arraysEqual
    }
};

export default publicAPI;
