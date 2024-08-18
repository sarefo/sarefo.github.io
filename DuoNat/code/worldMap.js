// Constants and global variables
const continentMap = {
    'North America': 'NA',
    'South America': 'SA',
    'Europe': 'EU',
    'Africa': 'AF',
    'Asia': 'AS',
    'Oceania': 'OC',
};

let isGlobeView = false;
let worldMaps = [];

// SVG manipulation functions
function setSVGAttributes(svg) {
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 1775.8327 853.5303');
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';
}

function colorContinents(svg, highlightedContinents, isClickable, onContinentClick) {
    const paths = svg.querySelectorAll('path');
    paths.forEach(path => {
        const continentName = path.getAttribute('inkscape:label');
        path.setAttribute('fill', highlightedContinents.includes(continentName) ? '#ac0028' : '#888');
        path.setAttribute('stroke', '#33a02c');
        path.setAttribute('stroke-width', '0.5');

        if (isClickable && onContinentClick) {
            path.style.cursor = 'pointer';
            path.addEventListener('click', () => onContinentClick(continentName));
        }
    });
}

// Core function to draw the world map
function drawWorldMap(container, highlightedContinents, isClickable = false, onContinentClick = null) {
    const mapContainer = container.querySelector('.image-container__world-map') || container;
    if (!mapContainer) {
        console.error('World map container not found');
        return null;
    }

    return fetch('./images/world.svg')
        .then(response => response.text())
        .then(svgData => {
            const parser = new DOMParser();
            const svgDOM = parser.parseFromString(svgData, "image/svg+xml");
            const svg = svgDOM.documentElement;

            setSVGAttributes(svg);
            colorContinents(svg, highlightedContinents, isClickable, onContinentClick);

            mapContainer.innerHTML = '';
            mapContainer.appendChild(svg);

            return svg;
        })
        .catch(error => {
            console.error('Error loading SVG:', error);
            return null;
        });
}

// Globe icon creation
function createGlobeIcon() {
    const button = document.createElement('button');
    button.className = 'icon-button image-container__button image-container__button--globe';

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', './images/icons.svg#icon-globe');
    svg.appendChild(use);
    button.appendChild(svg);

    return button;
}

// Toggle functions
function toggleAllWorldMaps() {
    isGlobeView = !isGlobeView;
    worldMaps.forEach(map => map.toggle());
}

function toggleMapView(container, mapContainer, globeIcon) {
    if (isGlobeView) {
        const existingGlobeIcon = container.querySelector('.image-container__button--globe');
        if (existingGlobeIcon) {
            existingGlobeIcon.remove();
        }

        globeIcon = createGlobeIcon();
        container.appendChild(globeIcon);
        globeIcon.addEventListener('click', toggleAllWorldMaps);

        mapContainer.style.display = 'none';
        globeIcon.style.display = 'flex';
    } else {
        if (globeIcon) {
            globeIcon.remove();
            globeIcon = null;
        }
        mapContainer.style.display = 'block';
    }
    return globeIcon;
}

// Public API

export function createWorldMap(container, highlightedContinents) {
    const mapContainer = container.querySelector('.image-container__world-map');
    if (!mapContainer) {
        console.error('World map container not found');
        return;
    }

    let svg = null;
    let globeIcon = null;

    function toggle() {
        globeIcon = toggleMapView(container, mapContainer, globeIcon);
    }

    drawWorldMap(container, highlightedContinents).then(createdSvg => {
        svg = createdSvg;
        if (svg) {
            svg.addEventListener('click', toggleAllWorldMaps);
        }
        toggle(); // Set initial state
    });

    worldMaps.push({ toggle });
}

export function getFullContinentName(abbreviation) {
    return Object.keys(continentMap).find(key => continentMap[key] === abbreviation);
}

export function getContinentAbbreviation(fullName) {
    return continentMap[fullName];
}

export function createClickableWorldMap(container, selectedContinents, onContinentClick) {
    drawWorldMap(container, Array.from(selectedContinents), true, onContinentClick);
}

export function createNonClickableWorldMap(container, selectedContinents) {
    drawWorldMap(container, Array.from(selectedContinents), false);
}

const publicAPI = {
    createWorldMap,
    getFullContinentName,
    getContinentAbbreviation,
    createClickableWorldMap,
    createNonClickableWorldMap,
};

export default publicAPI;
