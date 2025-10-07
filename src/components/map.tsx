
"use client"
import 'mapbox-gl/dist/mapbox-gl.css';
import * as React from 'react';
import { Map, Marker } from 'react-map-gl';
import { Hostel } from '@/lib/data';
import { Pin, Car } from 'lucide-react';

interface MapboxMapProps {
    agentLocation?: { lat: number; lng: number };
    hostelLocation: Hostel | null;
}

export function MapboxMap({ agentLocation, hostelLocation }: MapboxMapProps) {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';

    const initialViewState = {
        longitude: hostelLocation?.lng || -0.1870,
        latitude: hostelLocation?.lat || 5.6037,
        zoom: 14
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
        <Map
            mapboxAccessToken={mapboxToken}
            initialViewState={initialViewState}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v11"
        >
            {hostelLocation?.lat && hostelLocation.lng && (
                <Marker longitude={hostelLocation.lng} latitude={hostelLocation.lat}>
                    <div className="text-red-500">
                        <Pin className="h-10 w-10" style={{transform: 'translate(-50%, -100%)'}}/>
                    </div>
                </Marker>
            )}
            {agentLocation?.lat && agentLocation.lng && (
                 <Marker longitude={agentLocation.lng} latitude={agentLocation.lat}>
                    <div className="bg-primary rounded-full p-2 shadow-lg">
                        <Car className="h-6 w-6 text-primary-foreground" />
                    </div>
                </Marker>
            )}
        </Map>
    );
}
