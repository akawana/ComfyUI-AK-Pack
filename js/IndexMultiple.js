// js/IndexMultiple.js
import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "IndexMultiple.dynamicOutputs",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "IndexMultiple") return;

        function updateOutputs(node) {
            const lengthWidget = node.widgets.find(w => w.name === "length");
            if (!lengthWidget) return;

            const currentLength = lengthWidget.value || 1;

            while (node.outputs.length > currentLength) {
                node.removeOutput(node.outputs.length - 1);
            }

            while (node.outputs.length < currentLength) {
                const idx = node.outputs.length;
                node.addOutput(`item_${idx}`, "*");
            }

            for (let i = 0; i < node.outputs.length; i++) {
                node.outputs[i].name = `item_${i}`;
                node.outputs[i].label = `item_${i}`;
            }

            node.setSize(node.computeSize());
            // app.graph.setDirtyCanvas(true, true);
        }

        nodeType.prototype.onNodeCreated = function () {
            this.serialize_widgets = true;
            updateOutputs(this);
        };

        nodeType.prototype.onWidgetChanged = function (name, value) {
            if (name === "starting_index" || name === "length") {
                updateOutputs(this);
            }
        };

        nodeType.prototype.onConnectionsChange = function () {
            setTimeout(() => updateOutputs(this), 10);
        };
    }
});