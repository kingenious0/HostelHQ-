"use client";

import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Hostel } from '@/lib/data';
import { Map, Layers } from 'lucide-react';

interface MapboxMapProps {
    hostelLocation: Hostel | null;
}

const mapStyles = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';

export const MapboxMap = React.memo(function MapboxMap({ hostelLocation }: MapboxMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const hostelMarkerRef = useRef<mapboxgl.Marker | null>(null);
    
    const [mapLoaded, setMapLoaded] = useState(false);
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('satellite');
    const [styleUrl, setStyleUrl] = useState(mapStyles.satellite);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    useEffect(() => {
        if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_API_KEY_HERE') {
            console.error("Mapbox token is not set.");
            return;
        }
        if (mapRef.current || !mapContainerRef.current) return; 

        const center = hostelLocation 
            ? [hostelLocation.lng, hostelLocation.lat]
            : [-0.1870, 5.6037]; // Fallback (Ghana coordinates)

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: styleUrl,
            center: center as [number, number],
            zoom: 15
        });

        mapRef.current = map;
        
        map.on('load', () => {
             setMapLoaded(true);
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return;

        // Create or update hostel marker
        if (hostelLocation?.lat && hostelLocation?.lng) {
            if (hostelMarkerRef.current) {
                hostelMarkerRef.current.setLngLat([hostelLocation.lng, hostelLocation.lat]);
            } else {
                const el = document.createElement('div');
                el.className = 'w-5 h-5 rounded-full bg-primary border-2 border-white shadow-lg ring-4 ring-primary/20 animate-pulse';
                hostelMarkerRef.current = new mapboxgl.Marker(el)
                    .setLngLat([hostelLocation.lng, hostelLocation.lat])
                    .addTo(mapRef.current!);
            }
        }
    }, [mapLoaded, hostelLocation?.lat, hostelLocation?.lng]);

    const switchStyle = (newStyle: 'streets' | 'satellite') => {
        if (!mapRef.current) return;
        setActiveStyle(newStyle);
        setStyleUrl(mapStyles[newStyle]);
        mapRef.current.setStyle(mapStyles[newStyle]);
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
});
