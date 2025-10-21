
"use client"
import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Hostel } from '@/lib/data';
import { Map, Layers } from 'lucide-react';
import { ably } from '@/lib/ably';

interface MapboxMapProps {
    agentId?: string | null;
    hostelLocation: Hostel | null;
}

const mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';

export function MapboxMap({ agentId, hostelLocation }: MapboxMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const hostelMarkerRef = useRef<mapboxgl.Marker | null>(null);
    
    const [mapLoaded, setMapLoaded] = useState(false);
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('streets');
    const [styleUrl, setStyleUrl] = useState(mapStyles.streets);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    useEffect(() => {
        if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_API_KEY_HERE') {
            console.error("Mapbox token is not set.");
            return;
        }
        if (mapRef.current || !mapContainerRef.current) return; 

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: styleUrl,
            center: [hostelLocation?.lng || -0.1870, hostelLocation?.lat || 5.6037],
            zoom: 14
        });

        mapRef.current = map;
        
        map.on('load', () => {
             setMapLoaded(true);

             // Add empty source for agent location
             if (!map.getSource('agent')) {
                map.addSource('agent', {
                    type: 'geojson',
                    data: {
                        type: 'Point',
                        coordinates: [0, 0] // Start with an empty point
                    }
                });
             }
            
             // Add a layer for the agent's location (a circle)
             if (!map.getLayer('agent')) {
                map.addLayer({
                    id: 'agent',
                    type: 'circle',
                    source: 'agent',
                    paint: {
                        'circle-radius': 10,
                        'circle-color': '#008080', // Deep Teal
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });
             }
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [styleUrl, hostelLocation, mapboxToken]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;

        // Create or update hostel marker
        if (hostelLocation?.lat && hostelLocation?.lng) {
            if (hostelMarkerRef.current) {
                hostelMarkerRef.current.setLngLat([hostelLocation.lng, hostelLocation.lat]);
            } else {
                const el = document.createElement('div');
                el.className = 'w-4 h-4 rounded-full bg-red-700 border-2 border-white shadow-lg';
                hostelMarkerRef.current = new mapboxgl.Marker(el)
                    .setLngLat([hostelLocation.lng, hostelLocation.lat])
                    .addTo(mapRef.current!);
            }
        }
        
    }, [mapLoaded, hostelLocation]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !agentId) {
            return;
        }

        const channel = ably.channels.get(`agent:${agentId}:gps`);
        
        const onLocationUpdate = (message: any) => {
            const { lat, lng } = message.data;
            const map = mapRef.current;
            if (map) {
                const agentSource = map.getSource('agent') as mapboxgl.GeoJSONSource;
                if (agentSource) {
                     agentSource.setData({
                        type: 'Point',
                        coordinates: [lng, lat]
                    });
                    map.panTo([lng, lat]);
                }
            }
        };

        channel.subscribe('location', onLocationUpdate);
        
        return () => {
            channel.unsubscribe('location', onLocationUpdate);
        };

    }, [mapLoaded, agentId]);


    const switchStyle = (newStyle: 'streets' | 'satellite') => {
        if (!mapRef.current) return;
        setActiveStyle(newStyle);
        setStyleUrl(mapStyles[newStyle]);
    };
    
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
