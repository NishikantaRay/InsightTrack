import geoip from 'geoip-lite';

// Map ISO 3166-1 alpha-2 codes to full country names
const ISO_TO_COUNTRY = {
    AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AD: 'Andorra', AO: 'Angola',
    AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia', AU: 'Australia',
    AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh',
    BB: 'Barbados', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin',
    BT: 'Bhutan', BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana',
    BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
    CV: 'Cabo Verde', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada',
    CF: 'Central African Republic', TD: 'Chad', CL: 'Chile', CN: 'China',
    CO: 'Colombia', KM: 'Comoros', CG: 'Congo', CR: 'Costa Rica', HR: 'Croatia',
    CU: 'Cuba', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark', DJ: 'Djibouti',
    DM: 'Dominica', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt',
    SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia',
    SZ: 'Eswatini', ET: 'Ethiopia', FJ: 'Fiji', FI: 'Finland', FR: 'France',
    GA: 'Gabon', GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana',
    GR: 'Greece', GD: 'Grenada', GT: 'Guatemala', GN: 'Guinea',
    GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras', HU: 'Hungary',
    IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq',
    IE: 'Ireland', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan',
    JO: 'Jordan', KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KW: 'Kuwait',
    KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon', LS: 'Lesotho',
    LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania',
    LU: 'Luxembourg', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia',
    MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands',
    MR: 'Mauritania', MU: 'Mauritius', MX: 'Mexico', FM: 'Micronesia',
    MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco',
    MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal',
    NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger',
    NG: 'Nigeria', NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PW: 'Palau',
    PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru',
    PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania',
    RU: 'Russia', RW: 'Rwanda', KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia',
    VC: 'Saint Vincent and the Grenadines', WS: 'Samoa', SM: 'San Marino',
    ST: 'Sao Tome and Principe', SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia',
    SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia',
    SI: 'Slovenia', SB: 'Solomon Islands', SO: 'Somalia', ZA: 'South Africa',
    SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka', SD: 'Sudan', SR: 'Suriname',
    SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan',
    TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga',
    TT: 'Trinidad and Tobago', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan',
    TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates',
    GB: 'United Kingdom', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
    VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia',
    ZW: 'Zimbabwe',
};

export const geoipService = {
    /**
     * Look up geographic location from an IP address
     * @param {string} ip - IP address to lookup
     * @returns {object} - { country, city, region, latitude, longitude }
     */
    getLocation(ip) {
        if (!ip) {
            return { country: null, city: null, region: null, latitude: null, longitude: null };
        }

        try {
            const geo = geoip.lookup(ip);
            if (!geo) {
                return { country: null, city: null, region: null, latitude: null, longitude: null };
            }

            const countryCode = geo.country || null;
            const countryName = countryCode ? (ISO_TO_COUNTRY[countryCode] || countryCode) : null;
            return {
                country: countryName,
                city: geo.city || null,
                region: geo.region || null,
                latitude: geo.ll ? geo.ll[0] : null,
                longitude: geo.ll ? geo.ll[1] : null,
            };
        } catch (error) {
            console.warn(`GeoIP lookup failed for IP ${ip}:`, error.message);
            return { country: null, city: null, region: null, latitude: null, longitude: null };
        }
    },

    /**
     * Extract client IP from request headers
     * Checks X-Forwarded-For (proxy), X-Real-IP, and req.ip as fallbacks
     * @param {object} req - Express request object
     * @returns {string} - IP address
     */
    getClientIp(req) {
        const forwarded = req.get('X-Forwarded-For');
        if (forwarded) {
            // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
            // We want the first one (original client)
            return forwarded.split(',')[0].trim();
        }

        const realIp = req.get('X-Real-IP');
        if (realIp) {
            return realIp.trim();
        }

        // Express adds req.ip and req.ips
        return req.ip || req.connection.remoteAddress || null;
    },

    /**
     * Get location from request IP address
     * @param {object} req - Express request object
     * @returns {object} - { country, city, region, latitude, longitude }
     */
    getLocationFromRequest(req) {
        const ip = this.getClientIp(req);
        return this.getLocation(ip);
    },
};

export default geoipService;
