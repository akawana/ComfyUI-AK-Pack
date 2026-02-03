// js/IndexMultiple.js
import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "AKCLIPEncodeMultiple.dynamicOutputs",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "AKCLIPEncodeMultiple") return;

        function updateOutputs(node) {
            const lengthWidget = node.widgets?.find(w => w.name === "length");
            if (!lengthWidget) return;

            const currentLength = Math.max(1, lengthWidget.value || 1);

            // Ensure first output is always combined_con
            if (!node.outputs) {
                node.outputs = [];
            }

            if (node.outputs.length === 0) {
                node.addOutput("combined_con", "*");
            } else {
                node.outputs[0].name = "combined_con";
                node.outputs[0].label = "combined_con";
            }

            // We want: 1 combined + currentLength cond_* outputs
            const targetTotal = 1 + currentLength;

            // Remove extra outputs from the end
            while (node.outputs.length > targetTotal) {
                node.removeOutput(node.outputs.length - 1);
            }

            // Add missing cond_* outputs
            while (node.outputs.length < targetTotal) {
                const idx = node.outputs.length - 1; // cond index
                node.addOutput(`cond_${idx}`, "*");
            }

            // Rename cond_* outputs to match their indices
            for (let i = 1; i < node.outputs.length; i++) {
                const idx = i - 1;
                const out = node.outputs[i];
                out.name = `cond_${idx}`;
                out.label = `cond_${idx}`;
            }

            node.setSize(node.computeSize());
        }

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (onNodeCreated) {
                onNodeCreated.apply(this, arguments);
            }
            this.serialize_widgets = true;
            updateOutputs(this);
        };

        const onWidgetChanged = nodeType.prototype.onWidgetChanged;
        nodeType.prototype.onWidgetChanged = function (name, value, ...rest) {
            const r = onWidgetChanged
                ? onWidgetChanged.call(this, name, value, ...rest)
                : undefined;

            if (name === "starting_index" || name === "length") {
                updateOutputs(this);
            }
            return r;
        };

        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (...args) {
            const r = onConnectionsChange
                ? onConnectionsChange.apply(this, args)
                : undefined;

            setTimeout(() => updateOutputs(this), 10);
            return r;
        };
    }
});
