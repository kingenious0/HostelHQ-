"use client"
import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Hostel } from '@/lib/data';
import { Map, Layers } from 'lucide-react';

interface MapboxMapProps {
    agentLocation?: { lat: number; lng: number };
    hostelLocation: Hostel | null;
}

const mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

// Set the access token for Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';

export function MapboxMap({ agentLocation, hostelLocation }: MapboxMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    
    const [mapLoaded, setMapLoaded] = useState(false);
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('streets');

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    const addSourcesAndLayers = (map: mapboxgl.Map) => {
        // Add hostel source and layer
        if (hostelLocation) {
             if(!map.getSource('hostel-pin-source')) {
                map.addSource('hostel-pin-source', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [hostelLocation.lng || 0, hostelLocation.lat || 0]
                        },
                        properties: {}
                    }
                });
            }
             if(!map.getLayer('hostel-pin-layer')) {
                map.addLayer({
                    id: 'hostel-pin-layer',
                    type: 'circle',
                    source: 'hostel-pin-source',
                    paint: {
                        'circle-radius': 8,
                        'circle-color': 'hsl(var(--primary))', // Use primary theme color
                        'circle-stroke-color': 'white',
                        'circle-stroke-width': 2,
                    }
                });
             }
        }
        
        // Add agent source and layer
        if(!map.getSource('agent-location-source')) {
            map.addSource('agent-location-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [0, 0]
                    },
                    properties: {}
                }
            });
        }
        if(!map.getLayer('agent-location-layer')) {
            map.addLayer({
                id: 'agent-location-layer',
                type: 'circle',
                source: 'agent-location-source',
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#008080', // Teal color for agent
                    'circle-stroke-color': 'white',
                    'circle-stroke-width': 2,
                }
            });
        }
    };
    
    const switchStyle = (newStyle: 'streets' | 'satellite') => {
        if (!mapRef.current) return;
        setActiveStyle(newStyle);
        mapRef.current.setStyle(mapStyles[newStyle]);
    };

    useEffect(() => {
        if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_API_KEY_HERE') return;
        if (mapRef.current || !mapContainerRef.current) return; 

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: mapStyles.streets,
            center: [hostelLocation?.lng || -0.1870, hostelLocation?.lat || 5.6037],
            zoom: 14
        });

        mapRef.current.on('load', () => {
             const map = mapRef.current;
             if (!map) return;
             addSourcesAndLayers(map);
             setMapLoaded(true);
        });
        
         // When style changes, 'styledata' event is fired. Re-add sources and layers.
        mapRef.current.on('styledata', () => {
            if (mapRef.current?.isStyleLoaded()) {
                addSourcesAndLayers(mapRef.current);
            }
        });

        // Cleanup on unmount
        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [hostelLocation, mapboxToken]);

    // Effect to handle hostel marker and agent location updates
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;

        // Update agent location
        if (agentLocation?.lat && agentLocation.lng) {
            const agentSource = mapRef.current.getSource('agent-location-source') as mapboxgl.GeoJSONSource;
            if (agentSource) {
                const coordinates: [number, number] = [agentLocation.lng, agentLocation.lat];
                agentSource.setData({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coordinates },
                    properties: {}
                });
                 mapRef.current.panTo(coordinates);
            }
        }
        
        // Update hostel location (if it changes, though unlikely)
        if (hostelLocation?.lat && hostelLocation.lng) {
            const hostelSource = mapRef.current.getSource('hostel-pin-source') as mapboxgl.GeoJSONSource;
            if (hostelSource) {
                 hostelSource.setData({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [hostelLocation.lng, hostelLocation.lat] },
                    properties: {}
                });
            }
        }

    }, [mapLoaded, agentLocation, hostelLocation]);
    
    if (!mapboxToken || mapboxToken === "YOUR_MAPBOX_API_KEY_HERE") {
        return (
            <div className="h-full w-full bg-muted flex items-center justify-center text-center p-4">
                <p className="text-muted-foreground">
                    Please add your Mapbox API key to the <code className="bg-background p-1 rounded-sm">.env</code> file to enable maps.
                </p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
             <div className="absolute top-4 right-4 bg-background p-1 rounded-lg shadow-md flex gap-1">
                <button 
                    onClick={() => switchStyle('streets')}
                    className={`p-2 rounded-md ${activeStyle === 'streets' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Street View"
                >
                    <Map className="h-5 w-5" />
                </button>
                 <button 
                    onClick={() => switchStyle('satellite')}
                    className={`p-2 rounded-md ${activeStyle === 'satellite' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Satellite View"
                >
                    <Layers className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
