"use strict";
var CP;
(function (CP) {
    CP.HOUR_W = 8;
    CP.LABEL_W = 252;
    CP.ROW_H = 46;
    CP.MIN_BAR_H = 12;
    CP.AXIS_HOURS = 24 * 21;
    /** ASCII separator used in cost-first labels; safe to split on. */
    CP.LABEL_SEP = ' | ';
    CP.OWNER_TYPES = {
        human: 'Human member', main: 'AI main session', subagent: 'Subagent', team: 'Agent team',
    };
    CP.PALETTE = ['#8e8e93', '#0071e3', '#34c759', '#ff9f0a', '#af52de', '#ff2d55', '#5856d6', '#00a6a6'];
    function esc(s) {
        return String(s).replace(/[&<>"']/g, (c) => {
            const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return m[c];
        });
    }
    CP.esc = esc;
    function rgba(hex, a) {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    CP.rgba = rgba;
    /** cost-first: spend never hidden by truncation */
    function costLabel(t) {
        return `${(t.billed / 1e6).toFixed(1)}M/$${Number(t.cost).toFixed(2)}${CP.LABEL_SEP}${t.title}`;
    }
    CP.costLabel = costLabel;
    /** Prefix-only cost label (spend before the name, name omitted). */
    function costShort(t) { return costLabel(t).split(CP.LABEL_SEP)[0]; }
    CP.costShort = costShort;
    function ownerLabel(k) { return CP.OWNER_TYPES[k] || k; }
    CP.ownerLabel = ownerLabel;
})(CP || (CP = {}));
