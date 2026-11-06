"use strict";
var CP;
(function (CP) {
    const p = (n) => String(n).padStart(2, '0');
    function parse(s) {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (!m)
            return new Date(s);
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    }
    CP.parse = parse;
    function fmt(d) {
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    CP.fmt = fmt;
    function addHours(s, n) {
        return fmt(new Date(parse(s).getTime() + n * 3600000));
    }
    CP.addHours = addHours;
    function diffHours(a, b) {
        return (parse(b).getTime() - parse(a).getTime()) / 3600000;
    }
    CP.diffHours = diffHours;
    function axisStart() {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        d.setDate(d.getDate() - 7);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        d.setHours(0);
        return fmt(d);
    }
    CP.axisStart = axisStart;
    function tickLabel(s) {
        const d = parse(s);
        return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00`;
    }
    CP.tickLabel = tickLabel;
    function isMidnight(s) { return parse(s).getHours() === 0; }
    CP.isMidnight = isMidnight;
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    CP.todayStr = todayStr;
    function hoursUntil(dateStr) {
        if (!dateStr)
            return Number.POSITIVE_INFINITY;
        const d = new Date(dateStr + 'T23:59');
        return (d.getTime() - Date.now()) / 3600000;
    }
    CP.hoursUntil = hoursUntil;
})(CP || (CP = {}));
