const version = '1.6.12'; // Increment the version number

function updateUrlParams(element, attributeName) {
    const url = new URL(element[attributeName], window.location.href);
    url.searchParams.set('v', version);
    element[attributeName] = url.toString();
}

function updateStyleAndScriptVersions() {
    const noCacheFiles = document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"], script[src], link[rel="manifest"]');
    noCacheFiles.forEach(element => {
        updateUrlParams(element, element.href ? 'href' : 'src');
    });
}

function updateSvgIconVersions() {
    const svgIcons = document.querySelectorAll('use[href^="./images/icons.svg"]');
    svgIcons.forEach(icon => {
        const iconHref = icon.getAttribute('href');
        const url = new URL(iconHref, window.location.href);
        url.searchParams.set('v', version);
        icon.setAttribute('href', url.toString());
    });
}

function updateVersion() {
    updateStyleAndScriptVersions();
    updateSvgIconVersions();
}

function fadeInLogo() {
    const logo = document.querySelector('.loading-screen__content');
    if (logo) {
        setTimeout(() => {
            logo.classList.add('fade-in');
        }, 100);
    }
}

function initializeLoadingScreen() {
    fadeInLogo();
    document.getElementById('loading-screen').style.display = 'flex';
}

function showSvgIcons() {
    document.querySelectorAll('svg.icon').forEach(icon => {
        icon.style.display = 'inline-block';
    });
}

function fadeInBody() {
    document.body.classList.add('loaded');
}

window.loadQRCodeScript = function () {
    return new Promise((resolve, reject) => {
        if (window.QRCode) {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        }
    });
};

function setupShareButton() {
    const shareButton = document.getElementById('share-button');
    if (shareButton) {
        shareButton.addEventListener('click', window.loadQRCodeScript);
    } else {
        console.error('Share button not found');
    }
}

function onDOMContentLoaded() {
    updateVersion();
    setTimeout(updateVersion, 100);
    showSvgIcons();
    fadeInBody();
    setupShareButton();
}

// Event Listeners
window.addEventListener('load', initializeLoadingScreen);
document.addEventListener('DOMContentLoaded', onDOMContentLoaded);

// No Public API - no calls from other modules
// This file is only invoked from the index.html header
