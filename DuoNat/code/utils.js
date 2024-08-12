import api from './api.js';
import dialogManager from './dialogManager.js';
import { gameState, updateGameState } from './state.js';
import logger from './logger.js';

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

        shareCurrentPair: function () {
            let currentUrl = new URL(window.location.href);

            currentUrl.searchParams.delete('taxon1');
            currentUrl.searchParams.delete('taxon2');
            currentUrl.searchParams.delete('tags');
            currentUrl.searchParams.delete('level');
            currentUrl.searchParams.delete('setID');
            currentUrl.searchParams.delete('ranges');

            if (gameState.currentTaxonImageCollection && gameState.currentTaxonImageCollection.pair) {
                const { setID, taxon1, taxon2 } = gameState.currentTaxonImageCollection.pair;

                if (setID) {
                    currentUrl.searchParams.set('setID', setID);
                }

                currentUrl.searchParams.set('taxon1', taxon1);
                currentUrl.searchParams.set('taxon2', taxon2);

                const activeTags = gameState.selectedTags;
                if (activeTags && activeTags.length > 0) {
                    currentUrl.searchParams.set('tags', activeTags.join(','));
                }
                if (gameState.selectedLevel && gameState.selectedLevel !== '') {
                    currentUrl.searchParams.set('level', gameState.selectedLevel);
                }
                if (gameState.selectedRanges && gameState.selectedRanges.length > 0) {
                    currentUrl.searchParams.set('ranges', gameState.selectedRanges.join(','));
                }
            }

            let shareUrl = currentUrl.toString();

            // Copy to clipboard
            navigator.clipboard.writeText(shareUrl).then(() => {
                logger.info('Share URL copied to clipboard');

                // Load QR code script if not already loaded
                loadQRCodeScript().then(() => {
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
                    logger.error('Failed to load QR code script:', err);
                    alert('Failed to generate QR code. Please try again.');
                });
            }).catch(err => {
                logger.error('Failed to copy:', err);
                alert('Failed to copy link. Please try again.');
            });
        },
   
    },

    game: {
        getFilteredTaxonPairs: async function (filters = {}) {
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();
            return taxonPairs.filter(pair => {
                const matchesLevel = !filters.level || pair.level === filters.level;
                const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
                    (pair.range && pair.range.some(range => filters.ranges.includes(range)));
                const matchesTags = !filters.tags || filters.tags.length === 0 ||
                    pair.tags.some(tag => filters.tags.includes(tag));

                return matchesLevel && matchesRanges && matchesTags;
            });
        },

        // Returns a taxon pair from the index, or a random one if none indicated
        selectTaxonPair: async function (filters = {}) {
            try {
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                if (taxonPairs.length === 0) {
                    logger.error("No taxon pairs available");
                    return null;
                }

                let filteredPairs = taxonPairs.filter(pair => {
                    const matchesLevel = !filters.level || pair.level === filters.level;
                    const matchesRanges = !filters.ranges || filters.ranges.length === 0 ||
                        (pair.range && pair.range.some(range => filters.ranges.includes(range)));
                    const matchesTags = !filters.tags || filters.tags.length === 0 ||
                        pair.tags.some(tag => filters.tags.includes(tag));

                    return matchesLevel && matchesRanges && matchesTags;
                });

                if (filteredPairs.length === 0) {
                    logger.warn("No pairs match the selected criteria. Using all pairs.");
                    filteredPairs = taxonPairs;
                }

                const selectedPair = filteredPairs[Math.floor(Math.random() * filteredPairs.length)];
                logger.debug(`Selected pair: ${selectedPair.taxon1} / ${selectedPair.taxon2}, Skill Level: ${selectedPair.level}`);

                return selectedPair;
            } catch (error) {
                logger.error("Error in selectTaxonPair:", error);
                return null;
            }
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
        }
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

        // Canis lupus to C. lupus
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
    }
};

export default utils;
