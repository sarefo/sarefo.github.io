import dialogManager from './dialogManager.js';
import logger from './logger.js';
import state from './state.js';
import ui from './ui.js';

const reporting = {

    initialize: function () {
        const reportDialog = document.getElementById('report-dialog');
        if (!reportDialog) {
            logger.error('Report dialog not found in the DOM');
            return;
        }

        const reportForm = reportDialog.querySelector('#report-dialog__form');
        if (!reportForm) {
            logger.error('Report form not found in the report dialog');
            return;
        }

        reporting.setupReportForm(reportForm);
    },

    setupReportForm: function(form) {
        const reportOptions = form.querySelectorAll('input[name="report-type"]');
        const reportDetails = form.querySelector('#report-dialog__details');

        if (!reportDetails) {
            logger.error('Report details textarea not found in the report dialog');
            return;
        }

        reportOptions.forEach(option => {
            option.addEventListener('change', () => {
                const isOtherChecked = Array.from(reportOptions).some(opt => opt.value === 'other' && opt.checked);
                reportDetails.style.display = isOtherChecked ? 'block' : 'none';
            });
        });

        form.addEventListener('submit', reporting.handleReportSubmit);
    },

    sendReportEmail: function (body) {
        const subject = "DuoNat Report";
        const recipient = "sarefo@gmail.com";
        const fullEmailContent = `To: ${recipient}\nSubject: ${subject}\n\n${body}`;

        // Copy to clipboard
        reporting.copyToClipboard(fullEmailContent);

        // Attempt to open email client
        const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;

        // Show popup notification
        ui.showPopupNotification(
            "Attempting to open your email client. If it doesn't open, the report has been copied to your clipboard. Please paste it into your email client and send to " + recipient,
            6000  // Increased duration to 6 seconds for longer message
        );

        // Log the actions for debugging
        logger.debug('Report content copied to clipboard and mailto link opened');

        // Close the report dialog and reset it
        setTimeout(() => {
            dialogManager.closeDialog('report-dialog');
            reporting.resetReportDialog();
        }, 6000);  // Increased to match notification duration
    },

    copyToClipboard: function (text) {
        if (navigator.clipboard && window.isSecureContext) {
            // Use the Clipboard API when available
            navigator.clipboard.writeText(text).then(() => {
                logger.debug('Text successfully copied to clipboard using Clipboard API');
            }).catch(err => {
                logger.error('Failed to copy text using Clipboard API: ', err);
                reporting.fallbackCopyToClipboard(text);
            });
        } else {
            // Fallback to older method
            reporting.fallbackCopyToClipboard(text);
        }
    },

    fallbackCopyToClipboard: function (text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'successful' : 'unsuccessful';
            logger.debug('Fallback: Copying text command was ' + msg);
        } catch (err) {
            logger.error('Fallback: Unable to copy to clipboard', err);
            ui.showPopupNotification("Failed to copy report. Please try again.");
        }
        document.body.removeChild(textArea);
    },

    resetReportDialog: async function () {
        const dialog = document.getElementById('report-dialog');
        if (!dialog) {
            logger.error('Report dialog not found when trying to reset');
            return;
        }

        // Fetch the original dialog content
        try {
            const response = await fetch('./html/dialogs/report-dialog.html');
            const html = await response.text();
            
            // Create a temporary element to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // Find the dialog content
            const newDialogContent = temp.querySelector('.dialog-content');
            if (!newDialogContent) {
                throw new Error('Dialog content not found in the fetched HTML');
            }

            // Replace only the content of the dialog
            const dialogContent = dialog.querySelector('.dialog-content');
            if (dialogContent) {
                dialogContent.innerHTML = newDialogContent.innerHTML;
            } else {
                throw new Error('Existing dialog content not found');
            }

            // Set up the form again
            const newForm = dialog.querySelector('#report-dialog__form');
            if (newForm) {
                reporting.setupReportForm(newForm);
            } else {
                throw new Error('New report form not found after resetting dialog');
            }
        } catch (error) {
            logger.error('Error resetting report dialog:', error);
        }
    },

    getReportTypeText: function (type) {
        const typeMap = {
            'wrong-image': 'The image is wrong',
            'wrong-range': 'Range is wrong',
            'wrong-name': 'Name is wrong',
            'wrong-info': 'Info is wrong',
            'other': 'Something else is wrong'
        };
        return typeMap[type] || type;
    },

    handleReportSubmit: function (event) {
        event.preventDefault();
        const reportData = reporting.collectReportData(event.target);
        if (!reporting.validateReportData(reportData)) return;

        const emailBody = reporting.constructEmailBody(reportData);
        //reporting.sendReportEmail(emailBody);
        reporting.showReportConfirmation(emailBody);
    },

    collectReportData(form) {
        const formData = new FormData(form);
        return {
            reportTypes: formData.getAll('report-type'),
            details: document.getElementById('report-dialog__details').value
        };
    },

    validateReportData(reportData) {
        if (reportData.reportTypes.length === 0) {
            ui.showPopupNotification("Please select at least one issue to report.", 3000);
            return false;
        }
        return true;
    },

    constructEmailBody(reportData) {
        let emailBody = "Report Types:\n";
        reportData.reportTypes.forEach(type => {
            emailBody += `- ${reporting.getReportTypeText(type)}\n`;
        });

        if (reportData.details.trim() !== '') {
            emailBody += `\nAdditional Details:\n${reportData.details}\n`;
        }

        emailBody += reporting.getGameStateInfo();
        emailBody += reporting.getCurrentImageURLs();

        return emailBody;
    },

    getGameStateInfo() {
        let info = "\nGame State Information:\n";
        let currentTaxonImageCollection = state.getCurrentTaxonImageCollection();
        if (currentTaxonImageCollection && currentTaxonImageCollection.pair) {
            const pair = currentTaxonImageCollection.pair;
            info += `Taxon 1: ${pair.taxon1}\n`;
            info += `Taxon 2: ${pair.taxon2}\n`;
            info += `Set Name: ${pair.setName || 'N/A'}\n`;
            info += `Set ID: ${pair.setID || 'N/A'}\n`;
            info += `Level: ${pair.level || 'N/A'}\n`;
        } else {
            info += "Current taxon pair information not available\n";
        }
        return info;
    },

    getCurrentImageURLs() {
        let urls = "\nCurrent Image URLs:\n";
        const currentRound = state.getCurrentRound();
        if (currentRound) {
            urls += `Image 1 URL: ${currentRound.imageOneURL || 'N/A'}\n`;
            urls += `Image 2 URL: ${currentRound.imageTwoURL || 'N/A'}\n`;
        } else {
            urls += "Current image URLs not available\n";
        }
        return urls;
    },

    showReportConfirmation: function (emailBody) {
        const dialog = document.getElementById('report-dialog');
        const form = dialog.querySelector('#report-dialog__form');
        const confirmationMessage = document.createElement('div');
        confirmationMessage.className = 'report-dialog__confirmation';
        confirmationMessage.innerHTML = `
            <p>Attempting to open your email client. If it doesn't open, the report has been copied to your clipboard. Please paste it into your email client and send to sarefo@gmail.com</p>
            <p>Report content:</p>
            <pre>${emailBody}</pre>
        `;

        // Replace the form with the confirmation message
        form.replaceWith(confirmationMessage);

        // Copy to clipboard and open mailto link
        reporting.copyToClipboard(emailBody);
        const mailtoLink = `mailto:sarefo@gmail.com?subject=${encodeURIComponent("DuoNat Report")}&body=${encodeURIComponent(emailBody)}`;
        window.location.href = mailtoLink;

        // Add a close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.className = 'dialog-button report-dialog__close-button';
        closeButton.addEventListener('click', () => {
            dialogManager.closeDialog('report-dialog');
            reporting.resetReportDialog();
        });
        confirmationMessage.appendChild(closeButton);
    },

};

const publicAPI = {
    initialize: reporting.initialize,
    handleReportSubmit: reporting.handleReportSubmit.bind(reporting),
    resetReportDialog: reporting.resetReportDialog.bind(reporting),
};

export default publicAPI;