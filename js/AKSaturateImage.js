import { app } from "/scripts/app.js";

app.registerExtension({
    name: "AK.AKSaturateImage",
    nodeCreated(node) {
        if (node.comfyClass !== "AKSaturateImage") return;

        const resetWidget = node.addWidget("button", "Reset", "Reset", () => {
            if (!node.widgets) return;
            const namesToReset = [
                "master",
                "reds",
                "yellows",
                "greens",
                "cyans",
                "blues",
                "magentas",
            ];

            for (const w of node.widgets) {
                if (namesToReset.includes(w.name)) {
                    w.value = 0;
                }
            }

            if (node.graph) {
                node.graph.setDirtyCanvas(true, true);
            }
        });

        if (resetWidget) {
            resetWidget.serialize = false;
        }
    },
});
