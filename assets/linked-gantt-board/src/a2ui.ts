namespace CP {
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
  export namespace A2UI {
    export type DynamicValue =
      | string
      | number
      | boolean
      | { "@path": string }
      | { "@call": string; args?: { [k: string]: unknown } };

    export interface WireComponent {
      id: string;
      component: string;
      [key: string]: unknown;
    }

    export interface WireMessage {
      [k: string]: unknown;
    }

    export interface ActionEvent {
      name: string;
      userMessage?: DynamicValue;
    }

    export const GOVERNANCE_CATALOG_ID =
      "https://example.com/catalogs/agent-governance/v1/catalog.json";

    // ------------------------------------------------------------------ S2
    export function createSurface(
      surfaceId: string,
      catalogId: string,
      components?: WireComponent[],
      dataModel?: { [k: string]: unknown }
    ): WireMessage {
      const surface: { [k: string]: unknown } = { surfaceId: surfaceId, catalogId: catalogId };
      if (components && components.length > 0) surface["components"] = components;
      if (dataModel) surface["dataModel"] = dataModel;
      return { version: "1.0", createSurface: surface };
    }

    export function updateComponents(
      surfaceId: string,
      components: WireComponent[]
    ): WireMessage {
      return { version: "1.0", updateComponents: { surfaceId: surfaceId, components: components } };
    }

    export function updateDataModel(
      surfaceId: string,
      dataModel: { [k: string]: unknown }
    ): WireMessage {
      return { version: "1.0", updateDataModel: { surfaceId: surfaceId, dataModel: dataModel } };
    }

    // -------------------------------------------------- renderer functions
    export interface RendererFn {
      (args: { [k: string]: unknown }): string | number | boolean;
    }

    export function formatAskAge(openedAt: string, now?: Date): string {
      const t0 = Date.parse(openedAt);
      const t1 = now ? now.getTime() : Date.now();
      if (isNaN(t0)) return "unknown age";
      let mins = Math.max(0, Math.floor((t1 - t0) / 60000));
      const days = Math.floor(mins / 1440);
      mins -= days * 1440;
      const hours = Math.floor(mins / 60);
      mins -= hours * 60;
      if (days > 0) return days + "d " + hours + "h";
      if (hours > 0) return hours + "h " + mins + "m";
      return mins + "m";
    }

    const RENDERER_FUNCTIONS: { [k: string]: RendererFn } = {
      formatAskAge: function (args) {
        return formatAskAge(String(args["openedAt"]));
      }
    };

    /** Names the renderer may execute. agentOnly functions are absent by design. */
    export function rendererFunctionNames(): string[] {
      return Object.keys(RENDERER_FUNCTIONS);
    }

    // ------------------------------------------------------------------ S3
    export interface DomText {
      nodeValue: string | null;
    }

    export interface DomNode {
      appendChild(child: DomNode): DomNode;
      setAttribute(name: string, value: string): void;
      onclick?: ((ev?: unknown) => void) | null;
    }

    export interface DomDoc {
      createElement(tag: string): DomNode;
      createTextNode(text: string): DomText;
    }

    export interface RenderOptions {
      doc?: DomDoc;
      onEvent?: (name: string, userMessage: string | null) => void;
    }

    export interface SurfaceHandle {
      root: DomNode;
      updateDataModel(next: { [k: string]: unknown }): void;
    }

    interface Binding {
      node: DomText;
      value: DynamicValue;
    }

    function readPath(model: { [k: string]: unknown }, path: string): unknown {
      const parts = path.split("/").filter(function (p) { return p.length > 0; });
      let cur: unknown = model;
      for (let i = 0; i < parts.length; i++) {
        if (cur === null || typeof cur !== "object") return undefined;
        cur = (cur as { [k: string]: unknown })[parts[i]];
      }
      return cur;
    }

    export function resolve(value: unknown, model: { [k: string]: unknown }): string {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      if (value !== null && typeof value === "object") {
        const v = value as { [k: string]: unknown };
        if (typeof v["@path"] === "string") {
          const got = readPath(model, v["@path"] as string);
          return got === undefined || got === null ? "" : String(got);
        }
        const call = v["@call"];
        if (typeof call === "string") {
          const fn = RENDERER_FUNCTIONS[call];
          if (!fn) {
            throw new Error(
              "function '" + call + "' is not rendererOnly - it must run agent-side"
            );
          }
          const raw = (v["args"] as { [k: string]: unknown }) || {};
          const args: { [k: string]: unknown } = {};
          const keys = Object.keys(raw);
          for (let i = 0; i < keys.length; i++) {
            args[keys[i]] = resolve(raw[keys[i]], model);
          }
          return String(fn(args));
        }
      }
      return "";
    }

    class SurfaceImpl implements SurfaceHandle {
      root: DomNode;
      private doc: DomDoc;
      private model: { [k: string]: unknown };
      private byId: { [k: string]: WireComponent };
      private nodes: { [k: string]: DomNode };
      private bindings: Binding[];
      private onEvent?: (name: string, userMessage: string | null) => void;

      constructor(
        doc: DomDoc,
        components: WireComponent[],
        model: { [k: string]: unknown },
        onEvent?: (name: string, userMessage: string | null) => void
      ) {
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

      updateDataModel(next: { [k: string]: unknown }): void {
        const keys = Object.keys(next);
        for (let i = 0; i < keys.length; i++) {
          this.model[keys[i]] = next[keys[i]];
        }
        for (let i = 0; i < this.bindings.length; i++) {
          const b = this.bindings[i];
          b.node.nodeValue = resolve(b.value, this.model);
        }
      }

      private children(parent: DomNode, ids: unknown, slot: string): void {
        if (!Array.isArray(ids)) return;
        const wrap = this.doc.createElement("div");
        wrap.setAttribute("class", "a2ui-" + slot);
        for (let i = 0; i < ids.length; i++) {
          wrap.appendChild(this.build(String(ids[i])));
        }
        parent.appendChild(wrap);
      }

      private build(id: string): DomNode {
        const cached = this.nodes[id];
        if (cached) return cached;
        const comp = this.byId[id];
        if (!comp) throw new Error("unknown component id: " + id);
        const kind = String(comp["component"]);
        const el = this.doc.createElement(kind === "Button" ? "button" : "section");
        el.setAttribute("data-a2ui-id", id);
        this.nodes[id] = el;

        if (kind === "Text") {
          el.setAttribute("class", "a2ui-text");
          this.bindInto(el, comp["text"] as DynamicValue);
        } else if (kind === "Button") {
          el.setAttribute("class", "a2ui-btn");
          this.bindInto(el, comp["label"] as DynamicValue);
          const action = comp["action"] as { event?: ActionEvent } | undefined;
          if (action && action.event) {
            const ev: ActionEvent = action.event;
            const self = this;
            el.onclick = function () {
              const msg = ev.userMessage === undefined ? null : resolve(ev.userMessage, self.model);
              if (self.onEvent) self.onEvent(ev.name, msg);
            };
          }
        } else if (kind === "AskCard") {
          el.setAttribute("class", "a2ui-card a2ui-ask");
          el.setAttribute("data-ask-id", String(comp["askId"]));
          this.bindInto(el, comp["title"] as DynamicValue, "h3", "a2ui-card-title");
          this.bindInto(el, comp["question"] as DynamicValue, "p", "a2ui-card-question");
          this.children(el, comp["evidence"], "evidence");
          this.children(el, comp["options"], "options");
        } else if (kind === "ReviewCard") {
          el.setAttribute("class", "a2ui-card a2ui-review");
          el.setAttribute("data-review-id", String(comp["reviewId"]));
          this.bindInto(el, comp["title"] as DynamicValue, "h3", "a2ui-card-title");
          this.bindInto(el, comp["summary"] as DynamicValue, "p", "a2ui-card-summary");
          this.children(el, comp["fields"], "fields");
          this.children(el, comp["actions"], "actions");
        } else if (kind === "DecisionRecord") {
          el.setAttribute("class", "a2ui-decision a2ui-decision-" + String(comp["decision"]));
          el.setAttribute("data-ask-id", String(comp["askId"]));
          this.bindInto(el, comp["decision"] as DynamicValue, "span", "a2ui-decision-kind");
          this.bindInto(el, comp["decidedBy"] as DynamicValue, "span", "a2ui-decision-by");
          this.bindInto(el, comp["decidedAt"] as DynamicValue, "span", "a2ui-decision-at");
          if (comp["note"] !== undefined) {
            this.bindInto(el, comp["note"] as DynamicValue, "p", "a2ui-decision-note");
          }
        } else {
          throw new Error("component not in renderer subset: " + kind);
        }
        return el;
      }

      private bindInto(
        parent: DomNode,
        value: DynamicValue,
        tag?: string,
        cls?: string
      ): void {
        const el = this.doc.createElement(tag || "span");
        el.setAttribute("class", cls || "a2ui-value");
        const text = this.doc.createTextNode(resolve(value, this.model));
        this.bindings.push({ node: text, value: value });
        el.appendChild(text as unknown as DomNode);
        parent.appendChild(el);
      }
    }

    export function renderSurface(
      container: DomNode,
      components: WireComponent[],
      dataModel: { [k: string]: unknown },
      options?: RenderOptions
    ): SurfaceHandle {
      const doc: DomDoc =
        (options && options.doc) || (globalThis as unknown as { document: DomDoc }).document;
      const surface = new SurfaceImpl(
        doc,
        components,
        dataModel,
        options ? options.onEvent : undefined
      );
      container.appendChild(surface.root);
      return surface;
    }
  }
}
