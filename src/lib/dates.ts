/** Business date in Bangladesh time (UTC+6, no daylight saving): YYYY-MM-DD and HH:MM */
const dhaka = (d = new Date()) => new Date(d.getTime() + 6 * 3600_000).toISOString();
export const dhakaDate = (d?: Date) => dhaka(d).slice(0, 10);
export const dhakaTime = (d?: Date) => dhaka(d).slice(11, 16);
export const dhakaMonth = (d?: Date) => dhaka(d).slice(0, 7);
export const daysInMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
