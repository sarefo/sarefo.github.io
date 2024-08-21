import logger from './logger.js';
import phylogenySelector from './phylogenySelector.js';
import state from './state.js';

let d3;

async function loadD3() {
    if (!d3) {
        d3 = await import('https://cdn.jsdelivr.net/npm/d3@7/+esm');
    }
    return d3;
}

class BaseTree {
    constructor(container, rootNode) {
        this.container = container;
        this.rootNode = rootNode;
        this.svg = null;
        this.treeLayout = null;
        this.d3 = null;
        this.root = null;
    }

    async initialize() {
        this.d3 = await loadD3();
        this.root = this.d3.hierarchy(this.rootNode);
        if (!this.root) {
            logger.error('Failed to create hierarchy from root node');
            return false;
        }
        return true;
    }

    _setupSvg(width, height) {
        this.svg = this.d4.select(this.container)
            .append('svg')
            .attr('width', '101%')
            .attr('height', '101%')
            .attr('viewBox', `1 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${width / 3},${height / 2})`);
    }

    _setupTreeLayout(width, height) {
        // Default implementation, can be overridden by subclasses
        return this.d3.tree().size([height, width]);
    }

    _addStyles() {
        // Default styles, can be overridden or extended by subclasses
        this.svg.append('style').text(`
            .node circle {
                fill: #fff;
                stroke: #74ac00;
                stroke-width: 3px;
            }
            .node text {
                font: 18px sans-serif;
            }
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 2px;
            }
        `);
    }

    _updateNodes(visibleNodes, source, duration) {
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${source.x0 || 0},${source.y0 || 0})`)
            .on('click', (event, d) => this._handleClick(d));

        // Add circle and text as before
        nodeEnter.append('circle')
            .attr('r', 1e-6)
            .style('fill', d => d._children ? 'lightsteelblue' : '#fff')
            .style('stroke', '#74ac00')
            .style('stroke-width', '1.5px');

        nodeEnter.append('text')
            .attr('dy', '.31em')
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            .text(d => d.data.taxonName)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${d.x},${d.y})`);

        nodeUpdate.select('circle')
            .attr('r', d => d === this.parentNode ? 8 : 5)
            .style('fill', d => d === this.parentNode ? '#74ac00' : (d._children ? 'lightsteelblue' : '#fff'));

        nodeUpdate.select('text')
            .style('fill-opacity', 1)
            .attr('transform', 'rotate(0)')
            .attr('dy', '.35em')
            .attr('x', 0)
            .style('font-weight', d => (d === this.parentNode || d === this.activeNode) ? 'bold' : 'normal')
            .style('fill', d => {
                if (d === this.parentNode) return '#74ac00';
                if (d === this.activeNode) return '#ac0028';
                return 'black';
            });

        node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.x},${source.y})`)
            .remove();

        node.exit().select('circle')
            .attr('r', 1e-6);

        node.exit().select('text')
            .style('fill-opacity', 1e-6);
    }

    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return this._diagonal(o, o);
            });

        link.merge(linkEnter).transition()
            .duration(duration)
            .attr('d', d => this._diagonal(d.source, d.target));

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();
    }

    update(source) {
        // Default implementation, can be overridden by subclasses
        const duration = 750;
        const nodes = this.root.descendants();
        const links = this.root.links();

        this._updateNodes(nodes, source, duration);
        this._updateLinks(links, source, duration);
    }

    _getDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        return {
            width: containerRect.width,
            height: containerRect.height
        };
    }

    _setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            const { width, height } = this._getDimensions();
            this.svg.attr('width', width).attr('height', height);
            this.treeLayout.size([height, width - 200]);
            this.update(this.root);
        });

        resizeObserver.observe(this.container);
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this.treeLayout = this._setupTreeLayout(width, height);
        this.update(this.root);
        this._setupResizeObserver();
    }
}

class RadialTree extends BaseTree {
    constructor(container, rootNode, showTaxonomicNames) {
        super(container, rootNode);
        this.showTaxonomicNames = showTaxonomicNames;
        this.parentNode = null;
        this.activeNode = null;
        this.dragOffset = [0, 0];
        this.radius = 120;  // Initialize with the same value as the slider's default
        this.onNodeSelect = null;
        this.simulation = null;
    }

    calculateRadius(pairCount, maxCount) {
        const minRadius = 3;
        const maxRadius = 15;
        const minCount = 1;
        
        if (pairCount === 0) return minRadius;
        
        const scale = this.d3.scaleLog()
            .domain([minCount, maxCount])
            .range([minRadius, maxRadius]);
        
        return scale(pairCount);
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height, radius } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this._setupDrag();
        this._setupZoom();
        //this._setupSlider();

        this.parentNode = this.root;
        this.activeNode = this.root;
        this.treeLayout = this._setupTreeLayout(radius);

        // Initialize nodes directly here instead of calling _initializeNodes
        this.root.descendants().forEach(d => {
            if (d.depth > 0) {
                d._children = d.children;
                d.children = null;
            }
        });

        this._setupSimulation();
        this.update(this.root);
        this._setupResizeObserver();
    }

    _setupSimulation() {
        this.simulation = this.d3.forceSimulation()
            .force("link", this.d3.forceLink().id(d => d.data.id).distance(this.radius / 2))
            .force("charge", this.d3.forceManyBody().strength(-30))
            .force("collide", this.d3.forceCollide(30))
            .force("radial", this.d3.forceRadial(d => d.depth * this.radius / 2).strength(0.8))
            .force("center", this.d3.forceCenter(0, 0));
    }

    _setupZoom() {
        const zoom = this.d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                this.svg.attr("transform", event.transform);
            });

        this.d3.select(this.container).select("svg")
            .call(zoom)
            .on("dblclick.zoom", null);
    }

    _setupSlider() {
        const slider = document.getElementById('radiusSlider');
        slider.addEventListener('input', (event) => {
            const oldRadius = this.radius;
            this.radius = +event.target.value;
            this._redrawGraph();
        });
    }

    _redrawGraph() {
        // Remove all existing nodes and links
        this.svg.selectAll('g.node').remove();
        this.svg.selectAll('path.link').remove();

        // Recompute the layout
        this.treeLayout(this.parentNode);

        // Update the graph
        this.update(this.parentNode);
    }

    _getDimensions() {
        const containerRect = this.container.getBoundingClientRect();
        const width = containerRect.width;
        const height = containerRect.height;
        //const radius = Math.min(width, height) / 2 - 120;
        return { width, height };
    }

    _setupSvg(width, height) {
        // Remove any existing SVG elements
        this.d3.select(this.container).selectAll("svg").remove();

        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`)
            .attr('class', 'draggable-group');

        // Add styles directly to the SVG
        /*this.svg.append('style').text(`
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 1.5px;
            }
            .node text {
                font: 16px sans-serif;
            }
            .node--central circle {
                fill: #333;
                r: 8;
            }
            .node--central text {
                font-weight: bold;
                fill: #333;
            }
            .node--active circle {
                stroke: #99f;
                stroke-width: 3px;
            }
            .node--active text {
                fill: #99f;
                font-weight: bold;
            }
        `);*/
    }

    _setupDrag() {
        const drag = this.d3.drag()
            .on('start', this._dragStarted.bind(this))
            .on('drag', this._dragged.bind(this))
            .on('end', this._dragEnded.bind(this));

        this.svg.call(drag);
    }

    _dragStarted() {
        this.d3.select(this.container).style('cursor', 'grabbing');
    }

    _dragged(event) {
        const [x, y] = this.d3.pointer(event, this.svg.node());
        const transform = this.d3.zoomTransform(this.svg.node());
        this.dragOffset[0] += event.dx;
        this.dragOffset[1] += event.dy;
        this.svg.attr('transform', `translate(${this.dragOffset[0] + this.container.clientWidth / 2},${this.dragOffset[1] + this.container.clientHeight / 2})`);
    }

    _dragEnded() {
        this.d3.select(this.container).style('cursor', 'grab');
    }

    _addStyles() {
        this.svg.append('style').text(`
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 1.5px;
            }
            `);
    }

    _setupTreeLayout() {
        return this.d3.tree()
            .size([2 * Math.PI, 1]) // Use a fixed size of 1 for the radius
            .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);
    }

    _getVisibleNodes() {
        return [this.parentNode, this.activeNode, ...(this.activeNode.children || [])];
    }

    _getVisibleLinks(visibleNodes) {
        return this.parentNode.links().filter(link =>
            visibleNodes.includes(link.source) && visibleNodes.includes(link.target)
        );
    }

    _normalizeDepth(visibleNodes) {
        const maxDepth = Math.max(...visibleNodes.map(d => d.depth - this.parentNode.depth));
        visibleNodes.forEach(d => {
            d.y = ((d.depth - this.parentNode.depth) / maxDepth);
        });
    }

    _updateNodes(visibleNodes, source, duration) {
        const maxCount = Math.max(...visibleNodes.map(d => d.data.pairCount));
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${this._radialPoint(source.x0 || 0, source.y0 || 0)})`)
            .on('click', (event, d) => this._handleClick(d));

        // circle around all nodes
        nodeEnter.append('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d._children ? '#dfe9c8' : '#fff')
            .style('stroke', '#74ac00')
            .style('stroke-width', '1.5px');

        nodeEnter.append('text')
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5; // Position text 5px above the circle's border
            })
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            /*.text(d => `${d.data.taxonName} (${d.data.pairCount})`)*/ // with number of taxa in brackets
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "N/a" ? 
                d.data.vernacularName : d.data.taxonName)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${this._radialPoint(d.x, d.y)})`);

        nodeUpdate.select('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d === this.parentNode ? '#74ac00' : (d._children ? '#dfe9c8' : '#fff'));

        nodeUpdate.select('text')
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "n/a" ? 
                d.data.vernacularName : d.data.taxonName)
            .style('fill-opacity', 1)
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5; // Update position during transitions
            })
            .attr('x', 0)
            .style('font-weight', d => (d === this.parentNode || d === this.activeNode) ? 'bold' : 'normal')
            .style('fill', d => {
                if (d === this.parentNode) return '#74ac00';
                if (d === this.activeNode) return '#ac0028';
                return 'black';
            });

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${this._radialPoint(source.x, source.y)})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);
    }


    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return this._diagonal(o, o);
            });

        link.merge(linkEnter).transition()
            .duration(duration)
            .attr('d', d => {
                const sourcePoint = this._radialPoint(d.source.x, d.source.y);
                const targetPoint = this._radialPoint(d.target.x, d.target.y);
                return `M${sourcePoint[0]},${sourcePoint[1]}L${targetPoint[0]},${targetPoint[1]}`;
            });

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();
    }

    _diagonal(source, target) {
        const sourcePoint = this._radialPoint(source.x, source.y);
        const targetPoint = this._radialPoint(target.x, target.y);
        return `M${sourcePoint[0]},${sourcePoint[1]}L${targetPoint[0]},${targetPoint[1]}`;
    }

    _radialPoint(x, y) {
        return [(y * this.radius) * Math.cos(x - Math.PI / 2), (y * this.radius) * Math.sin(x - Math.PI / 2)];
    }

    _handleClick(d) {
        logger.debug(`Clicked node: Taxon ID = ${d.data.id}, Taxon Name = ${d.data.taxonName}`);

        if (d === this.activeNode) {
            logger.debug("Active node is not clickable.");
            return;
        }

        if (d.data.taxonName === "Life") {
            logger.debug("Life node clicked. Clearing selection.");
            phylogenySelector.clearSelection();
            return;
        }

        if (d !== this.parentNode) {
            // Make the clicked node's parent the new center node (root)
            this.parentNode = d.parent || this.parentNode;
            this.activeNode = d;
        } else if (d.parent) {
            // If the center node is clicked again, make its parent the new center node
            this.parentNode = d.parent;
            this.activeNode = d;
        }

        // Ensure that the active node's children are always expanded
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }

        // Traverse children if the active node has only one child
        //this._traverseChildren();
        // TODO not ready for primetime yet

        // Update the tree with the new layout and expanded nodes
        this.update(this.activeNode);

        // Call the onNodeSelect callback if it exists
        if (this.onNodeSelect) {
            this.onNodeSelect(this.activeNode.data.id);
        }
        state.setCurrentActiveNodeId(this.activeNode.data.id);
    }

    _traverseChildren() {
        let currentNode = this.activeNode;

        // Traverse until we find a node with more than one child or no children
        while (currentNode.children && currentNode.children.length === 1) {
            currentNode = currentNode.children[0];
            this.activeNode = currentNode;

            // Ensure that the current active node's children are expanded
            if (currentNode._children) {
                currentNode.children = currentNode._children;
                currentNode._children = null;
            }
        }
    }

    logTreeStructure() {
        const logNode = (node, depth = 0) => {
            console.log(' '.repeat(depth * 2) + `${node.data.id}: ${node.data.taxonName}`);
            if (node.children) {
                node.children.forEach(child => logNode(child, depth + 1));
            }
        };
        console.log("Tree structure:");
        logNode(this.root);
    }

    setActiveNode(nodeId) {
        console.log(`Attempting to set active node: ${nodeId}`);
        this.logTreeStructure(); // Log the tree structure for debugging
        state.setCurrentActiveNodeId(nodeId);

        const node = this.root.descendants().find(d => d.data.id === nodeId);
        if (node) {
            console.log(`Found node: ${node.data.taxonName}`);
            this.parentNode = node.parent || this.root;
            this.activeNode = node;
            this.update(this.activeNode);
        } else {
            console.warn(`Node with id ${nodeId} not found in the tree`);
        }
    }

    getActiveNodeId() {
        return this.activeNode ? this.activeNode.data.id : null;
    }

    setActiveNodePath(pathToRoot) {
        console.log(`Setting active node path: ${pathToRoot.join(' -> ')}`);
        
        let currentNode = this.root;
        for (let i = 1; i < pathToRoot.length; i++) {  // Start from 1 to skip the root
            const targetId = pathToRoot[i];
            if (currentNode._children) {
                currentNode.children = currentNode._children;
            }
            if (currentNode.children) {
                currentNode = currentNode.children.find(child => child.data.id === targetId);
                if (!currentNode) {
                    console.warn(`Node with id ${targetId} not found in the tree`);
                    break;
                }
            } else {
                console.warn(`Node with id ${currentNode.data.id} has no children`);
                break;
            }
        }

        if (currentNode && currentNode.data.id === pathToRoot[pathToRoot.length - 1]) {
            console.log(`Found target node: ${currentNode.data.taxonName}`);
            this.parentNode = currentNode.parent || this.root;
            this.activeNode = currentNode;

            // Expand children of the active node
            if (this.activeNode._children) {
                this.activeNode.children = this.activeNode._children;
            }

            // If the active node has no children, expand its siblings
            if (!this.activeNode.children && this.parentNode.children) {
                this.parentNode.children.forEach(sibling => {
                    if (sibling._children) {
                        sibling.children = sibling._children;
                    }
                });
            }

            this.update(this.activeNode);
        } else {
            console.warn(`Failed to reach target node ${pathToRoot[pathToRoot.length - 1]}`);
            this.logTreeStructure();
        }
    }

    update(source) {
        const duration = 750;
        
        this.treeLayout(this.parentNode);

        const visibleNodes = this._getVisibleNodes();
        const links = this._getVisibleLinks(visibleNodes);
        this._normalizeDepth(visibleNodes);

        this.simulation.nodes(visibleNodes);
        this.simulation.force("link").links(links);

        this._updateNodes(visibleNodes, source, duration);
        this._updateLinks(links, source, duration);

        this.simulation.alpha(1).restart();

       /*
        // Store old positions directly here
        visibleNodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });*/

        // Center the active node on the screen
        const activeNodeCoords = this._radialPoint(this.activeNode.x, this.activeNode.y);
        const svgGroupTransform = `translate(${this.dragOffset[0] + this.container.clientWidth / 2 - activeNodeCoords[0]},${this.dragOffset[1] + this.container.clientHeight / 2 - activeNodeCoords[1]})`;

        this.svg.transition()
            .duration(duration)
            .attr('transform', svgGroupTransform);

        // Fit the graph to view
        this._fitToView();

        // style active note
        this.svg.selectAll('.node')
            .filter(d => d === this.activeNode)
            .raise() // Bring the active node to the front
            .select('circle')
            .transition()
            .duration(duration)
            .style('stroke', '#ac0028')
            .attr('r', 8) // Make the active node slightly larger
            .style('fill', '#ac0028'); // Highlight color
    }

    _fitToView() {
        const bounds = this.svg.node().getBBox();
        const parent = this.svg.node().parentElement;
        const fullWidth = parent.clientWidth;
        const fullHeight = parent.clientHeight;
        const width = bounds.width;
        const height = bounds.height;
        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;

        if (width === 0 || height === 0) return; // nothing to fit

        const scale = 0.95 / Math.max(width / fullWidth, height / fullHeight);
        const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

        const transform = this.d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale);

        this.d3.select(parent)
            .transition()
            .duration(750)
            .call(this.d3.zoom().transform, transform);
    }

    _setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            const { width, height, radius } = this._getDimensions();
            this.svg.attr('viewBox', `0 0 ${width} ${height}`);
            this.svg.attr('transform', `translate(${width / 2},${height / 2})`);
            this.treeLayout.size([2 * Math.PI, radius]);
            this.update(this.parentNode);
        });

        resizeObserver.observe(this.container);
    }

}

/*class HierarchicalTree extends BaseTree {
    constructor(container, rootNode) {
        super(container, rootNode);
    }

    async create() {
        if (!await this.initialize()) return;

        const width = 800;
        const height = 600;

        this._setupSvg(width, height);
        this._addStyles();
        this.treeLayout = this._setupTreeLayout(width, height);

        this._initializeNodes();
        this._expandInitialNodes();
        this.update(this.root);
    }

    _setupSvg(width, height) {
        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(40,0)');
    }

    _addStyles() {
        this.svg.append('style').text(`
            .testing-dialog__node circle {
                fill: #fff;
                stroke: steelblue;
                stroke-width: 3px;
            }
            .testing-dialog__node text {
                font: 12px sans-serif;
            }
            .testing-dialog__link {
                fill: none;
                stroke: #ccc;
                stroke-width: 2px;
            }
        `);
    }

    _setupTreeLayout(width, height) {
        return this.d3.tree().size([height, width - 200]);
    }

    _initializeNodes() {
        this.root.descendants().forEach(d => {
            if (d.depth > 1) {
                d._children = d.children;
                d.children = null;
            }
        });
    }

    _expandInitialNodes() {
        this._expandNode(this.root);
        this.root.children.forEach(this._expandNode);
    }

    _expandNode(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(this._expandNode);
        }
    }

    _updateNodes(nodes, links, source, duration) {
        const node = this.svg.selectAll('.testing-dialog__node')
            .data(nodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', 'testing-dialog__node')
            .attr('transform', d => {
                const x = isNaN(source.x0) ? 0 : source.x0;
                const y = isNaN(source.y0) ? 0 : source.y0;
                return `translate(${y},${x})`;
            })
            .on('click', (event, d) => {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                this.update(d);
            });

        nodeEnter.append('circle')
            .attr('r', 1e-6)
            .attr('fill', d => d._children ? "lightsteelblue" : "#fff");

        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => d.data.taxonName);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('transform', d => {
                if (isNaN(d.x) || isNaN(d.y)) {
                    logger.error('Invalid node position:', d);
                    return 'translate(0,0)';
                }
                return `translate(${d.y},${d.x})`;
            });

        nodeUpdate.attr('transform', d => {
            const point = this._radialPoint(d.x, d.y);
            return `translate(${point[0]},${point[1]})`;
        });

        nodeUpdate.select('circle')
            .attr('r', 5)
            .attr('fill', d => d._children ? "lightsteelblue" : "#fff");

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        this._updateLinks(links, source, duration);
    }

    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('.testing-dialog__link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'testing-dialog__link')
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return this._diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => this._diagonal(d.source, d.target));

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();
    }

    _diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    update(source) {
        const duration = 750;
        const tree = this.treeLayout(source);
        const nodes = tree.descendants();
        const links = tree.links();

        nodes.forEach(d => d.y = d.depth * 180);

        this._updateNodes(nodes, links, source, duration);
        this._updateLinks(links, source, duration);

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
}*/

const publicAPI = {
    createRadialTree: async function (container, rootNode, showTaxonomicNames) {
        const tree = new RadialTree(container, rootNode, showTaxonomicNames);
        await tree.create();
        this.lastCreatedTree = tree;
        return tree; // Return the tree instance
    },

/*    createHierarchicalTree: async function (container, rootNode) {
        const tree = new HierarchicalTree(container, rootNode);
        await tree.create();
    },*/

    getActiveNodeId: function () {
        // This assumes that the last created tree is the active one
        return this.lastCreatedTree ? this.lastCreatedTree.getActiveNodeId() : null;
    },
    setActiveNode: function (nodeId) {
        if (this.lastCreatedTree) {
            this.lastCreatedTree.setActiveNode(nodeId);
        } else {
            logger.warn('No tree instance available to set active node');
        }
    },
};

export default publicAPI
