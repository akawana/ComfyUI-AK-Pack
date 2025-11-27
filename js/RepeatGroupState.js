import { app } from "../../../scripts/app.js";

function isNodeActive(node) {
    const flags = node.flags || {};
    const mode = node.mode ?? 0;

    const isMuted =
        mode === 2 ||
        !!flags.muted ||
        !!flags.mute;

    const isBypassed =
        mode === 4 ||
        !!flags.bypassed ||
        !!flags.bypass;

    const active = !(isMuted || isBypassed);
    return active;
}

function getNodesInGroup(graph, group) {
    const allNodes = graph._nodes || [];

    const pos = group.pos || [0, 0];
    const size = group.size || [0, 0];

    const gx = pos[0] ?? 0;
    const gy = pos[1] ?? 0;
    const gw = size[0] ?? 0;
    const gh = size[1] ?? 0;

    const nodesByPosSize = allNodes.filter((n) => {
        if (!n || !n.pos) return false;
        const nx = n.pos[0];
        const ny = n.pos[1];
        return nx >= gx && ny >= gy && nx <= gx + gw && ny <= gy + gh;
    });

    return nodesByPosSize;
}

function findGroupOfNode(graph, node) {
    const groups = graph._groups || [];
    for (const g of groups) {
        const nodesInGroup = getNodesInGroup(graph, g);
        if (nodesInGroup.includes(node)) {
            return g;
        }
    }
    return null;
}

function isGroupActive(graph, group) {
    const nodesInGroup = getNodesInGroup(graph, group);
    for (const n of nodesInGroup) {
        if (!n) continue;
        if (n.comfyClass === "RepeatGroupState") continue;
        if (isNodeActive(n)) {
            return true;
        }
    }
    return false;
}

function setNodeEnabled(node, enabled) {
    node.flags = node.flags || {};

    if (enabled) {
        node.mode = 0;
        delete node.flags.muted;
        delete node.flags.mute;
        delete node.flags.bypassed;
        delete node.flags.bypass;
    } else {
        node.mode = 2;
        node.flags.muted = true;
        delete node.flags.bypassed;
        delete node.flags.bypass;
    }
}

function updateRepeatGroupStateNode(graph, node) {
    if (!node.widgets) return;

    const patternWidget = node.widgets.find((w) => w.name === "group_name_contains");
    if (!patternWidget) return;

    const searchText = (patternWidget.value || "").trim();
    if (!searchText) return;

    const groups = graph._groups || [];

    const matchedGroups = groups.filter((g) => {
        const title = g.title || "";
        return title.includes(searchText);
    });

    if (matchedGroups.length === 0) return;

    let anyTargetGroupActive = false;
    for (const g of matchedGroups) {
        if (isGroupActive(graph, g)) {
            anyTargetGroupActive = true;
            break;
        }
    }

    const myGroup = findGroupOfNode(graph, node);
    if (!myGroup) return;

    const myGroupNodes = getNodesInGroup(graph, myGroup);
    for (const n of myGroupNodes) {
        if (!n) continue;
        setNodeEnabled(n, anyTargetGroupActive);
    }
}

app.registerExtension({
    name: "akawana.RepeatGroupState",

    init() {
        const origQueuePrompt = app.queuePrompt;
        app.queuePrompt = async function (number, batchSize, ...rest) {
            const graph = app.graph;
            if (graph) {
                const nodes = graph._nodes || [];
                for (const node of nodes) {
                    if (node?.comfyClass === "RepeatGroupState") {
                        updateRepeatGroupStateNode(graph, node);
                    }
                }
            }
            return await origQueuePrompt.call(this, number, batchSize, ...rest);
        };
    },
});
