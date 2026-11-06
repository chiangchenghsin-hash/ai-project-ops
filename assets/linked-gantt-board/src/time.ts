namespace CP {
  const p = (n: number) => String(n).padStart(2, '0');

  export function parse(s: string): Date {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return new Date(s);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  }

  export function fmt(d: Date): string {
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  export function addHours(s: string, n: number): string {
    return fmt(new Date(parse(s).getTime() + n * 3600000));
  }

  export function diffHours(a: string, b: string): number {
    return (parse(b).getTime() - parse(a).getTime()) / 3600000;
  }

  export function axisStart(): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setDate(d.getDate() - 7);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0);
    return fmt(d);
  }

  export function tickLabel(s: string): string {
    const d = parse(s);
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00`;
  }

  export function isMidnight(s: string): boolean { return parse(s).getHours() === 0; }

  export function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  export function hoursUntil(dateStr: string): number {
    if (!dateStr) return Number.POSITIVE_INFINITY;
    const d = new Date(dateStr + 'T23:59');
    return (d.getTime() - Date.now()) / 3600000;
  }
}
