import { app } from "../../../scripts/app.js";

function getNodesInGroup(graph, group) {
    const allNodes = graph._nodes || [];

    const pos = group.pos || [0, 0];
    const size = group.size || [0, 0];

    const gx = pos[0] ?? 0;
    const gy = pos[1] ?? 0;
    const gw = size[0] ?? 0;
    const gh = size[1] ?? 0;

    return allNodes.filter((n) => {
        if (!n || !n.pos) return false;
        const nx = n.pos[0];
        const ny = n.pos[1];
        return nx >= gx && ny >= gy && nx <= gx + gw && ny <= gy + gh;
    });
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

function setNodeMuted(node, muted) {
    node.flags = node.flags || {};

    if (muted) {
        node.mode = 2;
        node.flags.muted = true;
        delete node.flags.bypassed;
        delete node.flags.bypass;
    } else {
        node.mode = 0;
        delete node.flags.muted;
        delete node.flags.mute;
    }
}

function updateMuteOnBooleanNode(graph, node) {
    if (!node.widgets) return;

    const boolWidget = node.widgets.find((w) => w.name === "state");
    if (!boolWidget) return;

    const enabled = boolWidget.value === true;

    const myGroup = findGroupOfNode(graph, node);
    if (!myGroup) return;

    const nodesInGroup = getNodesInGroup(graph, myGroup);
    for (const n of nodesInGroup) {
        if (!n) continue;
        setNodeMuted(n, !enabled);
    }
}

let muteIntervalStarted = false;

app.registerExtension({
    name: "akawana.MuteOnBoolean",

    init() {
        const origQueuePrompt = app.queuePrompt;
        app.queuePrompt = async function (number, batchSize, ...rest) {
            const graph = app.graph;
            if (graph) {
                const nodes = graph._nodes || [];
                for (const node of nodes) {
                    if (node?.comfyClass === "MuteOnBoolean") {
                        updateMuteOnBooleanNode(graph, node);
                    }
                }
            }
            return await origQueuePrompt.call(this, number, batchSize, ...rest);
        };

        if (!muteIntervalStarted) {
            muteIntervalStarted = true;
            setInterval(() => {
                const graph = app.graph;
                if (!graph) return;
                const nodes = graph._nodes || [];
                for (const node of nodes) {
                    if (node?.comfyClass === "MuteOnBoolean") {
                        updateMuteOnBooleanNode(graph, node);
                    }
                }
            }, 50);
        }
    },
});
