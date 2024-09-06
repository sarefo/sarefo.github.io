import { BaseTree } from './BaseTree.js';
import logger from '../logger.js';
import state from '../state.js';
import utils from '../utils.js';

export class HierarchicalTree extends BaseTree {
    constructor(container, rootNode, showTaxonomicNames) {
        super(container, rootNode, showTaxonomicNames);
        this.nodeWidth = 200;
        this.nodeHeight = 50;
        this.margin = {top: 20, right: 90, bottom: 30, left: 90};
    }

    async create() {
        if (!await this.initialize()) return;

        const { width, height } = this._getDimensions();
        this._setupSvg(width, height);
        this._addStyles();
        this._setupDrag();

        this.parentNode = this.root;
        this.activeNode = this.root;
        this.treeLayout = this._setupTreeLayout();

        this.root.x0 = height / 2;
        this.root.y0 = 0;

        this.root.descendants().forEach(d => {
            if (d.depth > 0) {
                d._children = d.children;
                d.children = null;
            }
        });

        this.update(this.root);
        this._setupResizeObserver();
    }

    _setupTreeLayout() {
        return this.d3.tree()
            .nodeSize([this.nodeHeight, this.nodeWidth])
            .separation((a, b) => (a.parent == b.parent ? 1 : 1.5));
    }

    _setupSvg(width, height) {
        this.d3.select(this.container).selectAll("svg").remove();

        this.svg = this.d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    _getVisibleNodes() {
        if (this.activeNode === this.root) {
            return [this.root, ...this.root.children];
        }
        return [this.parentNode, this.activeNode, ...(this.activeNode.children || [])];
    }

    _getVisibleLinks(visibleNodes) {
        return visibleNodes.slice(1).map(node => ({
            source: node.parent || this.parentNode,
            target: node
        }));
    }

    _updateNodes(visibleNodes, source, duration) {
        const maxCount = Math.max(...visibleNodes.map(d => d.data.pairCount));
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => `translate(${source.x0 || 0},${source.y0 || 0})`)
            .on('click', (event, d) => this._handleClick(d));

        nodeEnter.append('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d._children ? '#dfe9c8' : '#fff');

        nodeEnter.append('text')
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5;
            })
            .attr('x', d => d.children || d._children ? -10 : 10)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => !this.showTaxonomicNames && d.data.vernacularName && d.data.vernacularName !== "-" ? 
                utils.string.truncate(d.data.vernacularName, 24) : d.data.taxonName)
            .style('fill-opacity', 1e-6);

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('class', d => `node ${d === this.parentNode ? 'node--central' : ''} ${d === this.activeNode ? 'node--active' : ''}`)
            .attr('transform', d => {
                if (typeof d.x === 'undefined' || typeof d.y === 'undefined') {
                    console.error("Node without coordinates:", d);
                    return 'translate(0,0)';
                }
                return `translate(${d.x},${d.y})`;
            });

        nodeUpdate.select('circle')
            .attr('r', d => this.calculateRadius(d.data.pairCount, maxCount))
            .style('fill', d => d === this.parentNode ? '#74ac00' : (d._children ? '#dfe9c8' : '#fff'));

        nodeUpdate.select('text')
            .style('fill-opacity', 1)
            .attr('dy', d => {
                const radius = this.calculateRadius(d.data.pairCount, maxCount);
                return -radius - 5;
            })
            .attr('x', d => d.children || d._children ? -10 : 10)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .style('font-weight', d => (d === this.parentNode || d === this.activeNode) ? 'bold' : 'normal')
            .style('fill', d => {
                if (d === this.parentNode) return '#74ac00';
                if (d === this.activeNode) return '#ac0028';
                return 'black';
            });

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.x},${source.y})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        // Update node positions and labels
        nodeUpdate.attr("transform", d => {
            let x = d.x;
            let y = d.y;
            if (d === this.parentNode) {
                x = 0;
                y = 0;
            } else if (d === this.activeNode) {
                x = this.nodeHeight;
                y = this.nodeWidth / 2;
            }
            return `translate(${y},${x})`;
        });

        // Update text position
        nodeUpdate.select('text')
            .attr("dy", ".35em")
            .attr("x", d => 15) // Place text to the right of the node
            .attr("text-anchor", "start");
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
            if (!d.source.x || !d.source.y || !d.target.x || !d.target.y) {
                console.error("Link with undefined coordinates:", d);
                return 'M0,0L0,0';
            }
            return this._diagonal(d.source, d.target);
        });

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return this._diagonal(o, o);
            })
            .remove();

        // Update link paths
        linkUpdate.attr('d', d => {
            let sourceX = d.source.x;
            let sourceY = d.source.y;
            let targetX = d.target.x;
            let targetY = d.target.y;

            if (d.source === this.parentNode) {
                sourceX = 0;
                sourceY = 0;
            } else if (d.source === this.activeNode) {
                sourceX = this.nodeHeight;
                sourceY = this.nodeWidth / 2;
            }

            if (d.target === this.activeNode) {
                targetX = this.nodeHeight;
                targetY = this.nodeWidth / 2;
            }

            return `M${sourceY},${sourceX}
                    C${sourceY},${(sourceX + targetX) / 2}
                     ${targetY},${(sourceX + targetX) / 2}
                     ${targetY},${targetX}`;
        });
    }

    update(source) {
        const duration = 750;
        
        const { width, height } = this._getDimensions();

        // Get visible nodes and links
        const visibleNodes = this._getVisibleNodes();
        const links = this._getVisibleLinks(visibleNodes);

        // Assigns the x and y position for the nodes
        this.treeLayout(this.parentNode);

        // Normalize for fixed-depth and position nodes
        this._positionNodes(visibleNodes);

        // Update the nodes...
        this._updateNodes(visibleNodes, source, duration);

        // Update the links...
        this._updateLinks(links, source, duration);

        // Store the old positions for transition.
        visibleNodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        console.log('Tree update complete. Parent node:', this.parentNode);
        console.log('Visible nodes:', visibleNodes.length);
        console.log('Visible links:', links.length);
    }

    _positionNodes(nodes) {
        nodes.forEach(d => {
            if (d === this.parentNode) {
                d.y = 0;
                d.x = 0;
            } else if (d === this.activeNode) {
                d.y = this.nodeWidth / 2;
                d.x = this.nodeHeight;
            } else {
                d.y = this.nodeWidth;
                // Distribute child nodes evenly
                const childIndex = this.activeNode.children ? this.activeNode.children.indexOf(d) : 0;
                const totalChildren = this.activeNode.children ? this.activeNode.children.length : 1;
                d.x = this.nodeHeight * 2 + (childIndex + 1) * (this.nodeHeight * 2) / (totalChildren + 1);
            }
            // Ensure x and y are numbers
            d.x = isNaN(d.x) ? 0 : d.x;
            d.y = isNaN(d.y) ? 0 : d.y;
        });
    }

    _enterNodes(node, source) {
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
            .on('click', (event, d) => this._handleClick(d));

        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");

        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", 15)
            .attr("text-anchor", "start")
            .text(d => d.data.taxonName)
            .style('fill-opacity', 0);

        return nodeEnter;
    }

    _updateNodes(visibleNodes, source, duration) {
        const node = this.svg.selectAll('g.node')
            .data(visibleNodes, d => d.data.id);

        const nodeEnter = this._enterNodes(node, source);
        const nodeUpdate = this._updateExistingNodes(nodeEnter.merge(node), duration);
        this._exitNodes(node, source, duration);

        return nodeUpdate;
    }

    _updateExistingNodes(nodeUpdate, duration) {
        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle.node')
            .attr('r', 10)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff")
            .attr('cursor', 'pointer');

        nodeUpdate.select('text')
            .style('fill-opacity', 1);

        return nodeUpdate;
    }

    _exitNodes(node, source, duration) {
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle')
            .attr('r', 1e-6);

        nodeExit.select('text')
            .style('fill-opacity', 0);
    }

    _enterLinks(link, source) {
        return link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = { x: source.x0 || 0, y: source.y0 || 0 };
                return this._diagonal(o, o);
            });
    }

    _updateLinks(links, source, duration) {
        const link = this.svg.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = this._enterLinks(link, source);
        this._updateExistingLinks(linkEnter.merge(link), duration);
        this._exitLinks(link, source, duration);
    }

    _updateExistingLinks(linkUpdate, duration) {
        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => this._diagonal(d.source, d.target));
    }

    _exitLinks(link, source, duration) {
        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = {x: source.x || 0, y: source.y || 0};
                return this._diagonal(o, o);
            })
            .remove();
    }

    _diagonal(s, d) {
        const sx = isNaN(s.x) ? 0 : s.x;
        const sy = isNaN(s.y) ? 0 : s.y;
        const dx = isNaN(d.x) ? 0 : d.x;
        const dy = isNaN(d.y) ? 0 : d.y;
        return `M ${sy},${sx}
                C ${(sy + dy) / 2},${sx},
                  ${(sy + dy) / 2},${dx},
                  ${dy},${dx}`;
    }
}
