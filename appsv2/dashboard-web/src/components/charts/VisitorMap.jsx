import { memo, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatNumber } from '../../utils/formatters';

// Country name → [lat, lng] for marker placement
const COUNTRY_COORDINATES = {
    'United States': [39, -98],
    'United Kingdom': [54, -2],
    'Germany': [51, 10],
    'France': [47, 2],
    'Canada': [56, -106],
    'India': [21, 79],
    'Australia': [-25, 134],
    'Japan': [36, 138],
    'Brazil': [-10, -51],
    'Spain': [40, -4],
    'China': [35, 104],
    'Russia': [60, 90],
    'Mexico': [24, -102],
    'Italy': [43, 12],
    'Netherlands': [52, 5],
    'Sweden': [62, 16],
    'South Korea': [36, 128],
    'Indonesia': [-2, 118],
    'Turkey': [39, 35],
    'Argentina': [-34, -64],
    'Ireland': [53, -8],
    'Switzerland': [47, 8],
    'Austria': [48, 14],
    'Belgium': [51, 4],
    'Portugal': [40, -8],
    'Poland': [52, 20],
    'Czech Republic': [50, 15],
    'Hungary': [47, 19],
    'Romania': [46, 25],
    'Bulgaria': [43, 25],
    'Greece': [39, 22],
    'Finland': [64, 26],
    'Norway': [62, 10],
    'Denmark': [56, 10],
    'Ukraine': [49, 32],
    'Serbia': [44, 21],
    'Colombia': [4, -74],
    'Peru': [-10, -76],
    'Chile': [-33, -71],
    'Venezuela': [8, -67],
    'Costa Rica': [10, -84],
    'Panama': [9, -80],
    'Singapore': [1, 104],
    'Malaysia': [4, 102],
    'Thailand': [15, 101],
    'Philippines': [13, 122],
    'Vietnam': [16, 108],
    'Taiwan': [24, 121],
    'Hong Kong': [22, 114],
    'Pakistan': [30, 69],
    'Bangladesh': [24, 90],
    'Sri Lanka': [7, 81],
    'United Arab Emirates': [24, 54],
    'UAE': [24, 54],
    'Saudi Arabia': [24, 45],
    'Iran': [33, 53],
    'Israel': [31, 35],
    'Kazakhstan': [48, 67],
    'New Zealand': [-41, 174],
    'Egypt': [27, 30],
    'Nigeria': [10, 8],
    'South Africa': [-29, 25],
    'Kenya': [0, 38],
    'Morocco': [32, -6],
    'Ghana': [8, -2],
    'Ethiopia': [9, 40],
};

// Recenter map when countries change
function MapUpdater({ countries }) {
    const map = useMap();
    useEffect(() => {
        if (countries.length === 1) {
            const pos = COUNTRY_COORDINATES[countries[0].country];
            if (pos) map.flyTo(pos, 4, { duration: 1 });
        }
    }, [countries, map]);
    return null;
}

function VisitorMap({ countries = [], className = '' }) {
    const knownCountries = useMemo(
        () => countries.filter(c => c.country !== 'Unknown' && COUNTRY_COORDINATES[c.country]),
        [countries]
    );
    const unknownEntry = countries.find(c => c.country === 'Unknown');
    const unknownVisitors = unknownEntry?.visitors || 0;
    const maxVisitors = knownCountries.length > 0
        ? Math.max(...knownCountries.map(c => c.visitors))
        : 1;

    return (
        <div className={`relative ${className}`}>
            <div className="rounded-lg overflow-hidden" style={{ height: '380px' }}>
                <MapContainer
                    center={[20, 0]}
                    zoom={2}
                    minZoom={2}
                    maxZoom={10}
                    scrollWheelZoom={true}
                    dragging={true}
                    touchZoom={true}
                    doubleClickZoom={true}
                    zoomControl={true}
                    style={{ height: '100%', width: '100%' }}
                    worldCopyJump={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    />
                    <MapUpdater countries={knownCountries} />

                    {knownCountries.map((country) => {
                        const pos = COUNTRY_COORDINATES[country.country];
                        if (!pos) return null;
                        const ratio = country.visitors / maxVisitors;
                        const radius = Math.max(4, ratio * 12);

                        return (
                            <CircleMarker
                                key={country.country}
                                center={pos}
                                radius={radius}
                                pathOptions={{
                                    fillColor: '#4f46e5',
                                    fillOpacity: 0.4 + ratio * 0.5,
                                    color: '#6366f1',
                                    weight: 2,
                                }}
                            >
                                <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                                    <div className="text-center">
                                        <div className="font-semibold">{country.country}</div>
                                        <div className="text-indigo-600">{formatNumber(country.visitors)} visitors</div>
                                    </div>
                                </Tooltip>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-2 px-1">
                <div>
                    {unknownVisitors > 0 && (
                        <span className="text-[11px] text-text-muted dark:text-text-muted-dark">
                            + {formatNumber(unknownVisitors)} from unresolved locations
                        </span>
                    )}
                </div>
                {knownCountries.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-text-muted dark:text-text-muted-dark">
                        <span>{formatNumber(Math.min(...knownCountries.map(c => c.visitors)))}</span>
                        <div className="w-20 h-2 rounded-full" style={{
                            background: 'linear-gradient(to right, #c7d2fe, #4f46e5, #312e81)',
                        }} />
                        <span>{formatNumber(maxVisitors)}</span>
                    </div>
                )}
            </div>

            {/* Fix leaflet z-index & dark mode tiles */}
            <style>{`
                .leaflet-container { z-index: 0; font-family: inherit; }
                .leaflet-control-zoom { border-radius: 8px !important; overflow: hidden; }
                .leaflet-control-zoom a { width: 32px !important; height: 32px !important; line-height: 32px !important; }
                .dark .leaflet-tile { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }
                .dark .leaflet-control-zoom a { background: #1f2937 !important; color: #e5e7eb !important; border-color: #374151 !important; }
            `}</style>
        </div>
    );
}

export default memo(VisitorMap);
