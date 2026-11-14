"use strict";
var CP;
(function (CP) {
    /**
     * A2UI v1.0 contract layer for agent-governance decision cards (AUI-01).
     * S2 emitter: builds v1.0 wire messages. S3 renderer: draws the
     * agent-governance catalog subset plus a minimal basic-catalog subset
     * (Text, Button) into any DOM-like container.
     * Rules enforced here:
     *  - dynamic values are literals, {"@path"} bindings, or {"@call"} functions;
     *  - only rendererOnly functions run in the renderer (formatAskAge);
     *  - agentOnly functions (recordDecision) NEVER execute here - decision
     *    clicks emit agent-side events and the agent does the ledger write;
     *  - updateDataModel refreshes bound text without touching structure.
     */
    let A2UI;
    (function (A2UI) {
        A2UI.GOVERNANCE_CATALOG_ID = "https://example.com/catalogs/agent-governance/v1/catalog.json";
        // ------------------------------------------------------------------ S2
        function createSurface(surfaceId, catalogId, components, dataModel) {
            const surface = { surfaceId: surfaceId, catalogId: catalogId };
            if (components && components.length > 0)
                surface["components"] = components;
            if (dataModel)
                surface["dataModel"] = dataModel;
            return { version: "1.0", createSurface: surface };
        }
        A2UI.createSurface = createSurface;
        function updateComponents(surfaceId, components) {
            return { version: "1.0", updateComponents: { surfaceId: surfaceId, components: components } };
        }
        A2UI.updateComponents = updateComponents;
        function updateDataModel(surfaceId, dataModel) {
            return { version: "1.0", updateDataModel: { surfaceId: surfaceId, dataModel: dataModel } };
        }
        A2UI.updateDataModel = updateDataModel;
        function formatAskAge(openedAt, now) {
            const t0 = Date.parse(openedAt);
            const t1 = now ? now.getTime() : Date.now();
            if (isNaN(t0))
                return "unknown age";
            let mins = Math.max(0, Math.floor((t1 - t0) / 60000));
            const days = Math.floor(mins / 1440);
            mins -= days * 1440;
            const hours = Math.floor(mins / 60);
            mins -= hours * 60;
            if (days > 0)
                return days + "d " + hours + "h";
            if (hours > 0)
                return hours + "h " + mins + "m";
            return mins + "m";
        }
        A2UI.formatAskAge = formatAskAge;
        const RENDERER_FUNCTIONS = {
            formatAskAge: function (args) {
                return formatAskAge(String(args["openedAt"]));
            }
        };
        /** Names the renderer may execute. agentOnly functions are absent by design. */
        function rendererFunctionNames() {
            return Object.keys(RENDERER_FUNCTIONS);
        }
        A2UI.rendererFunctionNames = rendererFunctionNames;
        function readPath(model, path) {
            const parts = path.split("/").filter(function (p) { return p.length > 0; });
            let cur = model;
            for (let i = 0; i < parts.length; i++) {
                if (cur === null || typeof cur !== "object")
                    return undefined;
                cur = cur[parts[i]];
            }
            return cur;
        }
        function resolve(value, model) {
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                return String(value);
            }
            if (value !== null && typeof value === "object") {
                const v = value;
                if (typeof v["@path"] === "string") {
                    const got = readPath(model, v["@path"]);
                    return got === undefined || got === null ? "" : String(got);
                }
                const call = v["@call"];
                if (typeof call === "string") {
                    const fn = RENDERER_FUNCTIONS[call];
                    if (!fn) {
                        throw new Error("function '" + call + "' is not rendererOnly - it must run agent-side");
                    }
                    const raw = v["args"] || {};
                    const args = {};
                    const keys = Object.keys(raw);
                    for (let i = 0; i < keys.length; i++) {
                        args[keys[i]] = resolve(raw[keys[i]], model);
                    }
                    return String(fn(args));
                }
            }
            return "";
        }
        A2UI.resolve = resolve;
        class SurfaceImpl {
            constructor(doc, components, model, onEvent) {
                this.doc = doc;
                this.model = model;
                this.onEvent = onEvent;
                this.nodes = {};
                this.bindings = [];
                this.byId = {};
                for (let i = 0; i < components.length; i++) {
                    this.byId[components[i].id] = components[i];
                }
                this.root = doc.createElement("div");
                this.root.setAttribute("class", "a2ui-surface");
                for (let i = 0; i < components.length; i++) {
                    const comp = components[i];
                    const isRootEntry = comp["role"] === "root" || comp.id === "root";
                    if (isRootEntry) {
                        const child = this.build(comp.id);
                        this.root.appendChild(child);
                    }
                }
                if (Object.keys(this.nodes).length === 0 && components.length > 0) {
                    const child = this.build(components[0].id);
                    this.root.appendChild(child);
                }
            }
            updateDataModel(next) {
                const keys = Object.keys(next);
                for (let i = 0; i < keys.length; i++) {
                    this.model[keys[i]] = next[keys[i]];
                }
                for (let i = 0; i < this.bindings.length; i++) {
                    const b = this.bindings[i];
                    b.node.nodeValue = resolve(b.value, this.model);
                }
            }
            children(parent, ids, slot) {
                if (!Array.isArray(ids))
                    return;
                const wrap = this.doc.createElement("div");
                wrap.setAttribute("class", "a2ui-" + slot);
                for (let i = 0; i < ids.length; i++) {
                    wrap.appendChild(this.build(String(ids[i])));
                }
                parent.appendChild(wrap);
            }
            build(id) {
                const cached = this.nodes[id];
                if (cached)
                    return cached;
                const comp = this.byId[id];
                if (!comp)
                    throw new Error("unknown component id: " + id);
                const kind = String(comp["component"]);
                const el = this.doc.createElement(kind === "Button" ? "button" : "section");
                el.setAttribute("data-a2ui-id", id);
                this.nodes[id] = el;
                if (kind === "Text") {
                    el.setAttribute("class", "a2ui-text");
                    this.bindInto(el, comp["text"]);
                }
                else if (kind === "Button") {
                    el.setAttribute("class", "a2ui-btn");
                    this.bindInto(el, comp["label"]);
                    const action = comp["action"];
                    if (action && action.event) {
                        const ev = action.event;
                        const self = this;
                        el.onclick = function () {
                            const msg = ev.userMessage === undefined ? null : resolve(ev.userMessage, self.model);
                            if (self.onEvent)
                                self.onEvent(ev.name, msg);
                        };
                    }
                }
                else if (kind === "AskCard") {
                    el.setAttribute("class", "a2ui-card a2ui-ask");
                    el.setAttribute("data-ask-id", String(comp["askId"]));
                    this.bindInto(el, comp["title"], "h3", "a2ui-card-title");
                    this.bindInto(el, comp["question"], "p", "a2ui-card-question");
                    this.children(el, comp["evidence"], "evidence");
                    this.children(el, comp["options"], "options");
                }
                else if (kind === "ReviewCard") {
                    el.setAttribute("class", "a2ui-card a2ui-review");
                    el.setAttribute("data-review-id", String(comp["reviewId"]));
                    this.bindInto(el, comp["title"], "h3", "a2ui-card-title");
                    this.bindInto(el, comp["summary"], "p", "a2ui-card-summary");
                    this.children(el, comp["fields"], "fields");
                    this.children(el, comp["actions"], "actions");
                }
                else if (kind === "DecisionRecord") {
                    el.setAttribute("class", "a2ui-decision a2ui-decision-" + String(comp["decision"]));
                    el.setAttribute("data-ask-id", String(comp["askId"]));
                    this.bindInto(el, comp["decision"], "span", "a2ui-decision-kind");
                    this.bindInto(el, comp["decidedBy"], "span", "a2ui-decision-by");
                    this.bindInto(el, comp["decidedAt"], "span", "a2ui-decision-at");
                    if (comp["note"] !== undefined) {
                        this.bindInto(el, comp["note"], "p", "a2ui-decision-note");
                    }
                }
                else {
                    throw new Error("component not in renderer subset: " + kind);
                }
                return el;
            }
            bindInto(parent, value, tag, cls) {
                const el = this.doc.createElement(tag || "span");
                el.setAttribute("class", cls || "a2ui-value");
                const text = this.doc.createTextNode(resolve(value, this.model));
                this.bindings.push({ node: text, value: value });
                el.appendChild(text);
                parent.appendChild(el);
            }
        }
        function renderSurface(container, components, dataModel, options) {
            const doc = (options && options.doc) || globalThis.document;
            const surface = new SurfaceImpl(doc, components, dataModel, options ? options.onEvent : undefined);
            container.appendChild(surface.root);
            return surface;
        }
        A2UI.renderSurface = renderSurface;
    })(A2UI = CP.A2UI || (CP.A2UI = {}));
})(CP || (CP = {}));
