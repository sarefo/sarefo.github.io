// version.js
const version = '1.4.17';

function updateVersion() {
    const noCacheFiles = document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"], script[src], link[rel="manifest"]');
    noCacheFiles.forEach(element => {
        const url = new URL(element.href || element.src);
        url.searchParams.set('v', version);
        if (element.href) {
            element.href = url.toString();
        } else {
            element.src = url.toString();
        }
    });
}

document.addEventListener('DOMContentLoaded', updateVersion);
