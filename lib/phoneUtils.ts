/**
 * Puhelinnumeroiden muotoilu- ja normalisointiapurit Pesunille.
 *
 * UI-muoto: +358 12 3456789 tai +358 40 1234567
 * Tietokantamuoto: +358123456789
 */

/**
 * Muotoilee puhelinnumeron näyttöä varten selkeällä välilyönnillä:
 * Esim. "+358401234567" -> "+358 40 1234567"
 * Esim. "0401234567" -> "+358 40 1234567"
 * Esim. "+358123456789" -> "+358 12 3456789"
 */
export function formatPhoneNumberDisplay(phone: any): string {
    if (phone === null || phone === undefined) return '';
    const trimmed = String(phone).trim();
    if (!trimmed) return '';

    let normalized = trimmed;
    if (normalized.startsWith('0') && !normalized.startsWith('00')) {
        normalized = '+358' + normalized.substring(1).replace(/\s+/g, '');
    }

    const isPlus = normalized.startsWith('+');
    const digits = normalized.replace(/\D/g, '');

    if (!digits) return trimmed;

    // Suomalainen numero (358)
    if (digits.startsWith('358')) {
        const rest = digits.substring(3);
        if (rest.length === 0) return '+358';
        if (rest.length <= 2) return `+358 ${rest}`;

        const prefix = rest.substring(0, 2);
        const main = rest.substring(2);

        return `+358 ${prefix} ${main}`.trim();
    }

    // Muut maat
    if (isPlus) {
        if (digits.length <= 3) return `+${digits}`;
        if (digits.startsWith('46') || digits.startsWith('47') || digits.startsWith('49') || digits.startsWith('372')) {
            const country = digits.substring(0, digits.startsWith('372') ? 3 : 2);
            const rest = digits.substring(country.length);
            if (rest.length <= 2) return `+${country} ${rest}`;
            return `+${country} ${rest.substring(0, 2)} ${rest.substring(2)}`.trim();
        }
        if (digits.startsWith('1')) {
            const rest = digits.substring(1);
            if (rest.length <= 3) return `+1 ${rest}`;
            return `+1 ${rest.substring(0, 3)} ${rest.substring(3)}`.trim();
        }
        return `+${digits.substring(0, 3)} ${digits.substring(3)}`.trim();
    }

    return trimmed;
}

/**
 * Muotoilee paikallisen numeron syöttökentässä käyttäjän kirjoittaessa (esim. "12 3456789")
 */
export function formatLocalPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    return `${digits.substring(0, 2)} ${digits.substring(2)}`.trim();
}

/**
 * Normalisoi puhelinnumeron puhtaaseen tietokantamuotoon (+358123456789)
 */
export function normalizePhoneNumberData(phone: string | null | undefined, defaultCallingCode = '358'): string {
    if (!phone) return '';
    const trimmed = phone.trim();
    if (!trimmed) return '';

    let clean = trimmed.replace(/[^\d+]/g, '');

    if (clean.startsWith('0')) {
        clean = `+${defaultCallingCode}${clean.substring(1)}`;
    } else if (!clean.startsWith('+')) {
        clean = `+${defaultCallingCode}${clean}`;
    }

    return clean;
}
