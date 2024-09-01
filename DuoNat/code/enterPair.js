import api from './api.js';
import dialogManager from './dialogManager.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import state from './state.js';

const enterPair = {

        initialize() {
            const dialog = document.getElementById('enter-pair-dialog');
            const form = dialog.querySelector('form');
            const taxon1Input = document.getElementById('taxon1');
            const taxon2Input = document.getElementById('taxon2');
            const submitButton = document.getElementById('submit-dialog');
            const dialogMessage = document.getElementById('dialog-message');

            if (!form || !taxon1Input || !taxon2Input || !submitButton || !dialogMessage) {
                logger.error('One or more elements not found in Enter Pair Dialog');
                return;
            }

            form.addEventListener('submit', async (event) => {
                logger.debug('Form submitted');
                event.preventDefault();
                await this.handleEnterPairSubmit(taxon1Input.value, taxon2Input.value, dialogMessage, submitButton);
            });

            [taxon1Input, taxon2Input].forEach(input => {
                input.addEventListener('input', () => {
                    submitButton.disabled = !taxon1Input.value || !taxon2Input.value;
                    logger.debug(`Input changed. Submit button disabled: ${submitButton.disabled}`);
                });
            });
        },

    async handleNewPairSubmit(event) {
        event.preventDefault();
        const { taxon1, taxon2 } = this.getAndValidateInputs();
        if (!taxon1 || !taxon2) return;

        this.setSubmitState(true);

        try {
            const validatedTaxa = await this.validateTaxa(taxon1, taxon2);
            if (validatedTaxa) {
                await this.saveAndSetupNewPair(validatedTaxa);
            } else {
                this.displayValidationError();
            }
        } catch (error) {
            this.handleSubmitError(error);
        } finally {
            this.setSubmitState(false);
        }
    },

    getAndValidateInputs() {
        const taxon1 = this.taxon1Input.value.trim();
        const taxon2 = this.taxon2Input.value.trim();
        if (!taxon1 || !taxon2) {
            this.dialogMessage.textContent = 'Please enter both taxa.';
        }
        return { taxon1, taxon2 };
    },

    setSubmitState(isSubmitting) {
        this.dialogMessage.textContent = isSubmitting ? 'Validating taxa...' : '';
        this.submitButton.disabled = isSubmitting;
        if (isSubmitting) {
            this.addLoadingSpinner();
        } else {
            this.removeLoadingSpinner();
        }
    },

    // TODO should probably not be here
    addLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        this.dialogMessage.appendChild(spinner);
    },
    removeLoadingSpinner() {
        const spinner = this.dialogMessage.querySelector('.loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    },

    async validateTaxa(taxon1, taxon2) {
        const [validatedTaxon1, validatedTaxon2] = await Promise.all([
            api.taxonomy.validateTaxon(taxon1),
            api.taxonomy.validateTaxon(taxon2)
        ]);
        return validatedTaxon1 && validatedTaxon2 ? { validatedTaxon1, validatedTaxon2 } : null;
    },

    async saveAndSetupNewPair({ validatedTaxon1, validatedTaxon2 }) {
        const newPair = {
            taxon1: validatedTaxon1.name,
            taxon2: validatedTaxon2.name
        };
        this.dialogMessage.textContent = 'Saving new pair...';
        try {
            await this.savePairToJson(newPair);
            state.setNextSelectedPair(newPair);
            dialogManager.closeDialog();
            gameSetup.setupGame(true);
        } catch (error) {
            throw new Error('Error saving new pair');
        }
    },

    async savePairToJson(newPair) {
        const response = await fetch('./data/taxonPairs.json');
        const taxonPairs = await response.json();
        taxonPairs.push(newPair);
        // Here you would typically save the updated taxonPairs back to the server
        // For now, we'll just simulate that it was saved successfully
    },

    displayValidationError() {
        this.dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
    },

    handleSubmitError(error) {
        logger.error('Error in handleNewPairSubmit:', error);
        this.dialogMessage.textContent = 'An error occurred. Please try again.';
    },


    async handleEnterSetSubmit(taxon1, taxon2, messageElement, submitButton) {
        logger.debug(`Handling submit for taxa: ${taxon1}, ${taxon2}`);
        this.setSubmitState(messageElement, submitButton, true);

        try {
            const [validatedTaxon1, validatedTaxon2] = await this.validateTaxa(taxon1, taxon2);
            this.handleValidationResult(validatedTaxon1, validatedTaxon2, messageElement);
        } catch (error) {
            this.handleValidationError(error, messageElement);
        } finally {
            this.setSubmitState(messageElement, submitButton, false);
        }
    },

    async validateTaxa(taxon1, taxon2) {
        return await Promise.all([
            api.taxonomy.validateTaxon(taxon1),
            api.taxonomy.validateTaxon(taxon2)
        ]);
    },

    handleValidationResult(validatedTaxon1, validatedTaxon2, messageElement) {
        logger.debug(`Validation results: Taxon1: ${JSON.stringify(validatedTaxon1)}, Taxon2: ${JSON.stringify(validatedTaxon2)}`);

        if (validatedTaxon1 && validatedTaxon2) {
            this.processValidTaxa(validatedTaxon1, validatedTaxon2);
        } else {
            messageElement.textContent = 'One or both taxa are invalid. Please check and try again.';
            logger.debug('Taxa validation failed');
        }
    },

    processValidTaxa(validatedTaxon1, validatedTaxon2) {
        const newPair = {
            taxon1: validatedTaxon1.name,
            taxon2: validatedTaxon2.name,
            vernacular1: validatedTaxon1.preferred_common_name || '',
            vernacular2: validatedTaxon2.preferred_common_name || ''
        };

        logger.debug('New pair created:', newPair);
        state.setNextSelectedPair(newPair);
        dialogManager.closeDialog('enter-pair-dialog');
        gameSetup.setupGame(true);
    },

    handleValidationError(error, messageElement) {
        logger.error('Error validating taxa:', error);
        messageElement.textContent = 'Error validating taxa. Please try again.';
    },

    setSubmitState(messageElement, submitButton, isSubmitting) {
        messageElement.textContent = isSubmitting ? 'Validating taxa...' : '';
        submitButton.disabled = isSubmitting;
    },
};

// Bind all methods in enterPair
Object.keys(enterPair).forEach(key => {
    if (typeof enterPair[key] === 'function') {
        enterPair[key] = enterPair[key].bind(enterPair);
    }
});

const publicAPI = {
    initialize: enterPair.initialize,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(enterPair);
    }
});

export default publicAPI;