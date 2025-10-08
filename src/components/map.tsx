"use client"
import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Hostel } from '@/lib/data';
import { Pin, Car } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

interface MapboxMapProps {
    agentLocation?: { lat: number; lng: number };
    hostelLocation: Hostel | null;
}

// Set the access token for Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';

export function MapboxMap({ agentLocation, hostelLocation }: MapboxMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const hostelMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const agentMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    useEffect(() => {
        if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_API_KEY_HERE') return;
        if (mapRef.current || !mapContainerRef.current) return; // Initialize map only once

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [hostelLocation?.lng || -0.1870, hostelLocation?.lat || 5.6037],
            zoom: 14
        });

        mapRef.current.on('load', () => {
            setMapLoaded(true);
        });

        // Cleanup on unmount
        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [hostelLocation, mapboxToken]);

    // Effect to handle hostel marker
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !hostelLocation?.lat || !hostelLocation.lng) return;

        if (hostelMarkerRef.current) {
            hostelMarkerRef.current.setLngLat([hostelLocation.lng, hostelLocation.lat]);
        } else {
             const el = document.createElement('div');
             el.className = "text-red-500";
             el.innerHTML = renderToStaticMarkup(<Pin className="h-10 w-10" style={{transform: 'translate(-50%, -100%)'}}/>);
            
            hostelMarkerRef.current = new mapboxgl.Marker(el)
                .setLngLat([hostelLocation.lng, hostelLocation.lat])
                .addTo(mapRef.current);
        }

    }, [mapLoaded, hostelLocation]);

    // Effect to handle agent marker
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !agentLocation?.lat || !agentLocation.lng) return;
        
        const coordinates: [number, number] = [agentLocation.lng, agentLocation.lat];

        if (agentMarkerRef.current) {
            agentMarkerRef.current.setLngLat(coordinates);
        } else {
            const el = document.createElement('div');
            el.className = "bg-primary rounded-full p-2 shadow-lg";
            el.innerHTML = renderToStaticMarkup(<Car className="h-6 w-6 text-primary-foreground" />);

            agentMarkerRef.current = new mapboxgl.Marker(el)
                .setLngLat(coordinates)
                .addTo(mapRef.current);
        }
        
        // Pan the map to the new agent location
        mapRef.current.panTo(coordinates);

    }, [mapLoaded, agentLocation]);
    
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
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    );
}