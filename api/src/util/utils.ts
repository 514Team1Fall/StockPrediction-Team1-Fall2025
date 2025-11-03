/**
 * Function that parses a date string in the format YYYYMMDDTHHMMSS and returns a Date object
 * This is the type of format that is returned from the Vantage API.
 * @param dateString string in the format YYYYMMDDTHHMMSS
 * @returns Date object or null if the string is not in the correct format
 */
export function getDateFromCompact(dateString: string) {
    const compactRe = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/;
    let parsed: Date;
    const m = dateString.match(compactRe);
    if (m) {
        const [, y, mo, d, hh, mm, ss] = m;
        const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`;
        parsed = new Date(iso);
        return parsed;
    } else {
        return null;
    }
}
