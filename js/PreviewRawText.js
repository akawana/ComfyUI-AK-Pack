import { app } from "../../../scripts/app.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";

app.registerExtension({
	name: "PreviewRawText",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "PreviewRawText") {
			function populate(raw) {
				const isConvertedWidget = +!!this.inputs?.[0]?.widget;
				if (this.widgets) {
					for (let i = isConvertedWidget; i < this.widgets.length; i++) {
						this.widgets[i].onRemove?.();
					}
					this.widgets.length = isConvertedWidget;
				}

				function toSingleString(v) {
					if (v == null) return "";

					if (typeof v === "string") return v;

					if (Array.isArray(v)) {
						const flat = [];
						for (const item of v) {
							if (Array.isArray(item)) {
								for (const inner of item) {
									flat.push(inner);
								}
							} else {
								flat.push(item);
							}
						}

						if (
							flat.length > 0 &&
							flat.every((x) => typeof x === "string" && x.length === 1)
						) {
							return flat.join("");
						}

						return flat
							.map((x) => (x == null ? "" : String(x)))
							.join("\n");
					}

					return String(v);
				}

				const value = toSingleString(raw);

				const w = ComfyWidgets["STRING"](
					this,
					"text_preview",
					["STRING", { multiline: true }],
					app
				).widget;
				w.inputEl.readOnly = true;
				w.inputEl.style.opacity = 0.6;
				w.value = value;

				requestAnimationFrame(() => {
					const sz = this.computeSize();
					if (sz[0] < this.size[0]) {
						sz[0] = this.size[0];
					}
					if (sz[1] < this.size[1]) {
						sz[1] = this.size[1];
					}
					this.onResize?.(sz);
					// app.graph.setDirtyCanvas(true, false);
				});
			}

			const onExecuted = nodeType.prototype.onExecuted;
			nodeType.prototype.onExecuted = function (message) {
				onExecuted?.apply(this, arguments);
				populate.call(this, message?.text);
			};

			const VALUES = Symbol();
			const configure = nodeType.prototype.configure;
			nodeType.prototype.configure = function () {
				this[VALUES] = arguments[0]?.widgets_values;
				return configure?.apply(this, arguments);
			};

			const onConfigure = nodeType.prototype.onConfigure;
			nodeType.prototype.onConfigure = function () {
				onConfigure?.apply(this, arguments);
				const widgets_values = this[VALUES];
				if (widgets_values?.length) {
					requestAnimationFrame(() => {
						const raw = widgets_values.slice(
							+(widgets_values.length > 1 && this.inputs?.[0]?.widget)
						);
						populate.call(this, raw);
					});
				}
			};
		}
	},
});
