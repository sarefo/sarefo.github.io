let deferredPrompt;

// Function to check if the device is mobile
function isMobileDevice() {
    return (window.innerWidth <= 800 && window.innerHeight <= 900) || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

window.addEventListener('beforeinstallprompt', (e) => {
    if (isMobileDevice()) {
        e.preventDefault();
        deferredPrompt = e;
        showInstallPrompt();
    }
});

function showInstallPrompt() {
    if (deferredPrompt && isMobileDevice()) {
        const installBanner = document.createElement('div');
        installBanner.id = 'install-banner';
        installBanner.innerHTML = `
            <p>Use DuoNat as a web app for the best experience!</p>
            <button id="install-button">Add to Home Screen</button>
            <button id="close-banner">Not Now</button>
        `;
        document.body.appendChild(installBanner);

        document.getElementById('install-button').addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {

                }
                deferredPrompt = null;
            });
            installBanner.remove();
        });

        document.getElementById('close-banner').addEventListener('click', () => {
            installBanner.remove();
        });
    }
}

// Show custom prompt for iOS
if (isMobileDevice()) {
    // Check if it's iOS
    if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g) && !navigator.standalone) {
        showIOSInstallPrompt();
    }
}

function showIOSInstallPrompt() {
    const iosPrompt = document.createElement('div');
    iosPrompt.id = 'ios-install-prompt';
    iosPrompt.innerHTML = `
        <p>To add DuoNat to your home screen: tap <img src="./images/ios-share.png" alt="Share icon" style="height: 20px; vertical-align: middle;"> and then "Add to Home Screen".</p>
        <button id="close-ios-prompt">Got it</button>
    `;
    document.body.appendChild(iosPrompt);

    document.getElementById('close-ios-prompt').addEventListener('click', () => {
        iosPrompt.remove();
    });
}

// Add event listener for resize to handle orientation changes
window.addEventListener('resize', () => {
    if (!isMobileDevice()) {
        const installBanner = document.getElementById('install-banner');
        const iosPrompt = document.getElementById('ios-install-prompt');
        if (installBanner) installBanner.remove();
        if (iosPrompt) iosPrompt.remove();
    }
});
