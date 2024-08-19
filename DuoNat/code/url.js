import dialogManager from './dialogManager.js';
import logger from './logger.js';
import state from './state.js';
import tagSelector from './tagSelector.js';
import utils from './utils.js';

const url = {
    read: {
        handleUrlParameters() {
            const urlParams = url.write.getURLParameters();
            url.read.handleLevelParameter(urlParams);
            url.read.handleRangesParameter(urlParams);
            url.read.handleTagsParameter(urlParams);
            url.read.handleSetIDParameter(urlParams);
            url.read.handlePhylogenyIDParameter(urlParams)
        },

        handleLevelParameter(urlParams) {
            if (urlParams.level) {
                // If a level is explicitly provided in the URL, use it
                const level = urlParams.level === 'all' ? '' : urlParams.level;
                state.setSelectedLevel(level);
                logger.debug("Skill level from URL:", urlParams.level, "Stored as:", level);
            } else if (Object.keys(urlParams).some(key => urlParams[key])) {
                // If any URL parameters are provided but level is not specified, clear the default level
                state.setSelectedLevel('');
                logger.debug("Cleared default level due to URL parameters");
            } else {
                // If no URL parameters are provided, set the default level to '1'
                state.setSelectedLevel('1');
                logger.debug("Set default skill level to 1");
            }
        },

        handleRangesParameter(urlParams) {
            if (urlParams.ranges) {
                const ranges = urlParams.ranges.split(',');
                state.updateGameStateMultiple({ selectedRanges: ranges });
                logger.debug("Ranges from URL:", ranges);
            }
        },

        handleTagsParameter(urlParams) {
            if (urlParams.tags) {
                const tags = urlParams.tags.split(',');
                tagSelector.setSelectedTags(tags);
                logger.debug("Tags from URL:", tags);
            }
        },

        handleSetIDParameter(urlParams) {
            if (urlParams.setID) {
                state.updateGameStateMultiple({ currentSetID: urlParams.setID });
                logger.debug("Set ID from URL:", urlParams.setID);
            }
        },

        handlePhylogenyIDParameter(urlParams) {
            if (urlParams.phylogenyID) {
                state.setPhylogenyId(urlParams.phylogenyID);
                logger.debug("Phylogeny ID from URL:", urlParams.phylogenyID);
            }
        },
    },
    write: {
        getURLParameters() {
            const params = new URLSearchParams(window.location.search);
            return {
                taxon1: params.get('taxon1'),
                taxon2: params.get('taxon2'),
                tags: params.get('tags'),
                level: params.get('level'),
                setID: params.get('setID'),
                ranges: params.get('ranges'),
                phylogenyID: params.get('phylogenyID'),
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

            url.write.addOptionalParameters(currentUrl);
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

            const phylogenyID = state.getPhylogenyId();
            if (phylogenyID) {
                url.searchParams.set('phylogenyID', phylogenyID);
            }
        },

        shareCurrentPair() {
            const shareUrl = url.write.buildShareUrl();
            url.write.copyToClipboard(shareUrl)
                .then(() => url.write.generateAndShowQRCode(shareUrl))
                .catch(url.write.handleShareError);
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
};

const publicAPI = {
    handleUrlParameters: url.read.handleUrlParameters,
    getURLParameters: url.write.getURLParameters,
    shareCurrentPair: url.write.shareCurrentPair
};

export default publicAPI;
