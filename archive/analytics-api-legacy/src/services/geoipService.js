import geoip from 'geoip-lite';

export const geoipService = {
    /**
     * Look up geographic location from an IP address
     * @param {string} ip - IP address to lookup
     * @returns {object} - { country, city, region, latitude, longitude }
     */
    getLocation(ip) {
        if (!ip) {
            return { country: null, city: null, region: null };
        }

        try {
            const geo = geoip.lookup(ip);
            if (!geo) {
                return { country: null, city: null, region: null };
            }

            return {
                country: geo.country || null,
                city: geo.city || null,
                region: geo.region || null,
            };
        } catch (error) {
            console.warn(`GeoIP lookup failed for IP ${ip}:`, error.message);
            return { country: null, city: null, region: null };
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
            return forwarded.split(',')[0].trim();
        }

        const realIp = req.get('X-Real-IP');
        if (realIp) {
            return realIp.trim();
        }

        return req.ip || req.connection.remoteAddress || null;
    },

    /**
     * Get location from request IP address
     * @param {object} req - Express request object
     * @returns {object} - { country, city, region }
     */
    getLocationFromRequest(req) {
        const ip = this.getClientIp(req);
        return this.getLocation(ip);
    },
};

export default geoipService;
