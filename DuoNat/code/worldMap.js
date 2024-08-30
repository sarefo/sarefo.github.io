const worldMap = {
    state: {
        isGlobeView: false,
        worldMaps: [],
        continentMap: {
            'North America': 'NA',
            'South America': 'SA',
            'Europe': 'EU',
            'Africa': 'AF',
            'Asia': 'AS',
            'Oceania': 'OC',
        },
    },

    svgManipulation: {
        setSVGAttributes(svg) {
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.setAttribute('viewBox', '0 0 1775.8327 853.5303');
            svg.style.maxWidth = '100%';
            svg.style.height = 'auto';
        },

        colorContinents(svg, highlightedContinents, isClickable, onContinentClick) {
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
        },
    },

    mapCreation: {
        drawWorldMap(container, highlightedContinents, isClickable = false, onContinentClick = null) {
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

                    worldMap.svgManipulation.setSVGAttributes(svg);
                    worldMap.svgManipulation.colorContinents(svg, highlightedContinents, isClickable, onContinentClick);

                    mapContainer.innerHTML = '';
                    mapContainer.appendChild(svg);

                    return svg;
                })
                .catch(error => {
                    console.error('Error loading SVG:', error);
                    return null;
                });
        },

        createGlobeIcon() {
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
        },
    },

    mapToggle: {
        toggleAllWorldMaps() {
            worldMap.state.isGlobeView = !worldMap.state.isGlobeView;
            worldMap.state.worldMaps.forEach(map => map.toggle());
        },

        toggleMapView(container, mapContainer, globeIcon) {
            if (worldMap.state.isGlobeView) {
                const existingGlobeIcon = container.querySelector('.image-container__button--globe');
                if (existingGlobeIcon) {
                    existingGlobeIcon.remove();
                }

                globeIcon = worldMap.mapCreation.createGlobeIcon();
                container.appendChild(globeIcon);
                globeIcon.addEventListener('click', worldMap.mapToggle.toggleAllWorldMaps);

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
        },
    },

    publicMethods: {
        createWorldMap(container, highlightedContinents) {
            const mapContainer = container.querySelector('.image-container__world-map');
            if (!mapContainer) {
                console.error('World map container not found');
                return;
            }

            let svg = null;
            let globeIcon = null;

            function toggle() {
                globeIcon = worldMap.mapToggle.toggleMapView(container, mapContainer, globeIcon);
            }

            worldMap.mapCreation.drawWorldMap(container, highlightedContinents).then(createdSvg => {
                svg = createdSvg;
                if (svg) {
                    svg.addEventListener('click', worldMap.mapToggle.toggleAllWorldMaps);
                }
                toggle(); // Set initial state
            });

            worldMap.state.worldMaps.push({ toggle });
        },

        getFullContinentName(abbreviation) {
            return Object.keys(worldMap.state.continentMap).find(key => worldMap.state.continentMap[key] === abbreviation);
        },

        getContinentAbbreviation(fullName) {
            return worldMap.state.continentMap[fullName];
        },

        createClickableWorldMap(container, selectedContinents, onContinentClick) {
            worldMap.mapCreation.drawWorldMap(container, Array.from(selectedContinents), true, onContinentClick);
        },

        createNonClickableWorldMap(container, selectedContinents) {
            worldMap.mapCreation.drawWorldMap(container, Array.from(selectedContinents), false);
        },
    },
};

const bindAllMethods = (obj) => {
    for (let prop in obj) {
        if (typeof obj[prop] === 'function') {
            obj[prop] = obj[prop].bind(obj);
        } else if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            bindAllMethods(obj[prop]);
        }
    }
};

bindAllMethods(worldMap);

const publicAPI = {
    createWorldMap: worldMap.publicMethods.createWorldMap,
    getFullContinentName: worldMap.publicMethods.getFullContinentName,
    getContinentAbbreviation: worldMap.publicMethods.getContinentAbbreviation,
    createClickableWorldMap: worldMap.publicMethods.createClickableWorldMap,
    createNonClickableWorldMap: worldMap.publicMethods.createNonClickableWorldMap,
};

export default publicAPI;

