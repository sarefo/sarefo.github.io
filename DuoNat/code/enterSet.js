import api from './api.js';
import dialogManager from './dialogManager.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import state from './state.js';

const enterSet = {

        initialize() {
            logger.debug('Initializing Enter Set Dialog');
            const dialog = document.getElementById('enter-set-dialog');
            const form = dialog.querySelector('form');
            const taxon1Input = document.getElementById('taxon1');
            const taxon2Input = document.getElementById('taxon2');
            const submitButton = document.getElementById('submit-dialog');
            const dialogMessage = document.getElementById('dialog-message');

            if (!form || !taxon1Input || !taxon2Input || !submitButton || !dialogMessage) {
                logger.error('One or more elements not found in Enter Set Dialog');
                return;
            }

            form.addEventListener('submit', async (event) => {
                logger.debug('Form submitted');
                event.preventDefault();
                await enterSet.handleEnterSetSubmit(taxon1Input.value, taxon2Input.value, dialogMessage, submitButton);
            });

            [taxon1Input, taxon2Input].forEach(input => {
                input.addEventListener('input', () => {
                    submitButton.disabled = !taxon1Input.value || !taxon2Input.value;
                    logger.debug(`Input changed. Submit button disabled: ${submitButton.disabled}`);
                });
            });

            logger.debug('Enter Set Dialog initialized');
        },

    async handleNewPairSubmit(event) {
        event.preventDefault();
        const { taxon1, taxon2 } = enterSet.getAndValidateInputs();
        if (!taxon1 || !taxon2) return;

        enterSet.setSubmitState(true);

        try {
            const validatedTaxa = await enterSet.validateTaxa(taxon1, taxon2);
            if (validatedTaxa) {
                await enterSet.saveAndSetupNewPair(validatedTaxa);
            } else {
                enterSet.displayValidationError();
            }
        } catch (error) {
            enterSet.handleSubmitError(error);
        } finally {
            enterSet.setSubmitState(false);
        }
    },

    getAndValidateInputs() {
        const taxon1 = enterSet.taxon1Input.value.trim();
        const taxon2 = enterSet.taxon2Input.value.trim();
        if (!taxon1 || !taxon2) {
            enterSet.dialogMessage.textContent = 'Please enter both taxa.';
        }
        return { taxon1, taxon2 };
    },

    setSubmitState(isSubmitting) {
        enterSet.dialogMessage.textContent = isSubmitting ? 'Validating taxa...' : '';
        enterSet.submitButton.disabled = isSubmitting;
        if (isSubmitting) {
            enterSet.addLoadingSpinner();
        } else {
            enterSet.removeLoadingSpinner();
        }
    },

    // TODO should probably not be here
    addLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        enterSet.dialogMessage.appendChild(spinner);
    },
    removeLoadingSpinner() {
        const spinner = enterSet.dialogMessage.querySelector('.loading-spinner');
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
        enterSet.dialogMessage.textContent = 'Saving new pair...';
        try {
            await enterSet.savePairToJson(newPair);
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
        enterSet.dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
    },

    handleSubmitError(error) {
        logger.error('Error in handleNewPairSubmit:', error);
        enterSet.dialogMessage.textContent = 'An error occurred. Please try again.';
    },


    async handleEnterSetSubmit(taxon1, taxon2, messageElement, submitButton) {
        logger.debug(`Handling submit for taxa: ${taxon1}, ${taxon2}`);
        enterSet.setSubmitState(messageElement, submitButton, true);

        try {
            const [validatedTaxon1, validatedTaxon2] = await enterSet.validateTaxa(taxon1, taxon2);
            enterSet.handleValidationResult(validatedTaxon1, validatedTaxon2, messageElement);
        } catch (error) {
            enterSet.handleValidationError(error, messageElement);
        } finally {
            enterSet.setSubmitState(messageElement, submitButton, false);
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
            enterSet.processValidTaxa(validatedTaxon1, validatedTaxon2);
        } else {
            messageElement.textContent = 'One or both taxa are invalid. Please check and try again.';
            logger.debug('Taxa validation failed');
        }
    },

    processValidTaxa(validatedTaxon1, validatedTaxon2) {
        const newSet = {
            taxon1: validatedTaxon1.name,
            taxon2: validatedTaxon2.name,
            vernacular1: validatedTaxon1.preferred_common_name || '',
            vernacular2: validatedTaxon2.preferred_common_name || ''
        };

        logger.debug('New set created:', newSet);
        state.setNextSelectedPair(newSet);
        dialogManager.closeDialog('enter-set-dialog');
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

const publicAPI = {
    initialize: enterSet.initialize,
};

export default publicAPI;
