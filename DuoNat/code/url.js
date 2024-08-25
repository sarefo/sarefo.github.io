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
                logger.debug("Skill level from URL:", urlParams.level);
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
        generateShareLink() {
            let currentUrl = new URL(window.location.href);
            currentUrl.search = ''; // Clear existing parameters
            let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();

            const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
            const selectedOptions = Array.from(shareOptions).filter(option => option.checked).map(option => option.id.replace('-toggle', ''));

            if (selectedOptions.includes('taxa') && currentTaxonImageCollection && currentTaxonImageCollection.pair) {
                const { taxon1, taxon2 } = currentTaxonImageCollection.pair;
                currentUrl.searchParams.set('taxon1', taxon1);
                currentUrl.searchParams.set('taxon2', taxon2);
            }

            if (selectedOptions.includes('setID') && currentTaxonImageCollection && currentTaxonImageCollection.pair) {
                const { setID } = currentTaxonImageCollection.pair;
                if (setID) currentUrl.searchParams.set('setID', setID);
            }

            if (selectedOptions.includes('tags')) {
                const activeTags = state.getSelectedTags();
                if (activeTags && activeTags.length > 0) {
                    currentUrl.searchParams.set('tags', activeTags.join(','));
                }
            }

            if (selectedOptions.includes('level')) {
                const selectedLevel = state.getSelectedLevel();
                if (selectedLevel && selectedLevel !== '') {
                    currentUrl.searchParams.set('level', selectedLevel);
                }
            }

            if (selectedOptions.includes('ranges')) {
                const selectedRanges = state.getSelectedRanges();
                if (selectedRanges && selectedRanges.length > 0) {
                    currentUrl.searchParams.set('ranges', selectedRanges.join(','));
                }
            }

            if (selectedOptions.includes('phylogenyID')) {
                const phylogenyID = state.getPhylogenyId();
                if (phylogenyID) {
                    currentUrl.searchParams.set('phylogenyID', phylogenyID);
                }
            }

            return currentUrl.toString();
        },

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

            this.addOptionalParameters(currentUrl);
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
            url.write.updateShareDialog(shareUrl);
        },

        updateShareDialog(shareUrl) {
            const shareLinkInput = document.getElementById('share-link-input');
            shareLinkInput.value = shareUrl;

            this.generateAndShowQRCode(shareUrl);
            this.createShareOptionToggles(shareUrl);

            const copyLinkButton = document.getElementById('copy-link-button');
            copyLinkButton.onclick = () => {
                const currentShareUrl = shareLinkInput.value;
                this.copyToClipboard(currentShareUrl)
                    .then(() => {
                        const shareMessage = document.getElementById('qr-dialog__share-message');
                        if (shareMessage) {
                            shareMessage.textContent = 'Link copied to clipboard!';
                            shareMessage.style.opacity = 1;
                            setTimeout(() => {
                                shareMessage.style.opacity = 0;
                            }, 3000);
                        }
                    })
                    .catch(this.handleShareError);
            };

            // Add event listeners to checkboxes
            const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
            shareOptions.forEach(option => {
                option.addEventListener('change', () => {
                    const newShareUrl = this.generateShareLink();
                    shareLinkInput.value = newShareUrl;
                    this.generateAndShowQRCode(newShareUrl);
                });
            });

            dialogManager.openDialog('qr-dialog');
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
        },

        createShareOptionToggles(shareUrl) {
            const shareOptionsToggles = document.getElementById('share-options-toggles');
            shareOptionsToggles.innerHTML = ''; // Clear existing toggles

            const url = new URL(shareUrl);
            const params = url.searchParams;

            const options = [
                { value: 'taxa', label: 'Taxa', isPresent: params.has('taxon1') || params.has('taxon2') },
                { value: 'setID', label: 'Set ID', isPresent: params.has('setID') },
                { value: 'tags', label: 'Tags', isPresent: params.has('tags') },
                { value: 'level', label: 'Level', isPresent: params.has('level') },
                { value: 'ranges', label: 'Ranges', isPresent: params.has('ranges') },
                { value: 'phylogenyID', label: 'Phylogeny', isPresent: params.has('phylogenyID') }
            ];

            options.forEach(option => {
                if (option.isPresent) {
                    const toggleContainer = document.createElement('div');
                    toggleContainer.className = 'share-toggle-container';
                    toggleContainer.innerHTML = `
                        <input type="checkbox" id="${option.value}-toggle" class="share-toggle__checkbox" checked>
                        <label for="${option.value}-toggle" class="share-toggle__label"></label>
                        <span class="share-toggle__text">${option.label}</span>
                    `;
                    shareOptionsToggles.appendChild(toggleContainer);
                }
            });

            // Add event listeners to checkboxes
            const shareOptions = document.querySelectorAll('#share-options-toggles input[type="checkbox"]');
            shareOptions.forEach(option => {
                option.addEventListener('change', () => {
                    const newShareUrl = this.generateShareLink();
                    const shareLinkInput = document.getElementById('share-link-input');
                    shareLinkInput.value = newShareUrl;
                    this.generateAndShowQRCode(newShareUrl);
                });
            });
        },

        isParameterPresent(paramName) {
            const currentUrl = new URL(window.location.href);
            return currentUrl.searchParams.has(paramName) || 
                   (paramName === 'taxa' && (currentUrl.searchParams.has('taxon1') || currentUrl.searchParams.has('taxon2')));
        },
    },
};

const publicAPI = {
    handleUrlParameters: url.read.handleUrlParameters,
    getURLParameters: url.write.getURLParameters,
    shareCurrentPair: url.write.shareCurrentPair
};

export default publicAPI;
