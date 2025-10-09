
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
    const agentMarkerRef = useRef<mapboxgl.Marker | null>(null);
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

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: styleUrl,
            center: [hostelLocation?.lng || -0.1870, hostelLocation?.lat || 5.6037],
            zoom: 14
        });
        
        mapRef.current.on('load', () => {
             setMapLoaded(true);
        });

        return () => {
            mapRef.current?.remove();
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
                    .addTo(mapRef.current);
            }
        }

        // Create or update agent marker
        if (agentLocation?.lat && agentLocation.lng) {
            if (agentMarkerRef.current) {
                agentMarkerRef.current.setLngLat([agentLocation.lng, agentLocation.lat]);
            } else {
                 const el = document.createElement('div');
                el.className = 'w-5 h-5 rounded-full bg-primary border-2 border-white shadow-lg';
                agentMarkerRef.current = new mapboxgl.Marker(el)
                    .setLngLat([agentLocation.lng, agentLocation.lat])
                    .addTo(mapRef.current);
            }
            mapRef.current.panTo([agentLocation.lng, agentLocation.lat], { duration: 1000 });
        } else {
            // If agent location becomes null, remove the marker
            if (agentMarkerRef.current) {
                agentMarkerRef.current.remove();
                agentMarkerRef.current = null;
            }
        }

    }, [mapLoaded, agentLocation, hostelLocation]);

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
