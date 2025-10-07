
"use client"

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Hostel } from '@/lib/data';

interface MapProps {
    agentLocation?: { lat: number; lng: number };
    hostelLocation: Hostel | null;
}

export function Map({ agentLocation, hostelLocation }: MapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const agentMarkerRef = useRef<google.maps.Marker | null>(null);

    useEffect(() => {
        const loader = new Loader({
            apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
            version: 'weekly',
        });

        loader.load().then(async () => {
            const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;


            if (mapRef.current && hostelLocation?.lat && hostelLocation?.lng) {
                const map = new Map(mapRef.current, {
                    center: { lat: hostelLocation.lat, lng: hostelLocation.lng },
                    zoom: 15,
                    mapId: 'HOSTEL_TRACKING_MAP',
                    disableDefaultUI: true,
                });

                // Hostel Marker
                new AdvancedMarkerElement({
                    map: map,
                    position: { lat: hostelLocation.lat, lng: hostelLocation.lng },
                    title: hostelLocation.name,
                });


                // Agent Marker (initial creation)
                if (agentLocation) {
                    agentMarkerRef.current = new google.maps.Marker({
                        position: agentLocation,
                        map: map,
                        title: 'Agent',
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#4285F4',
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: 'white',
                        }
                    });
                }
            }
        });
    }, [hostelLocation]); // Re-initialize map only if hostel location changes


    useEffect(() => {
        // Update agent marker position without re-creating the map
        if (agentMarkerRef.current && agentLocation) {
            agentMarkerRef.current.setPosition(agentLocation);
            agentMarkerRef.current.getMap()?.panTo(agentLocation);
        }
    }, [agentLocation]);

    return <div className="h-full w-full" ref={mapRef} />;
}
