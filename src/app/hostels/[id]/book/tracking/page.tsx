// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/header';
import { Agent, Hostel, getAgent, AppUser, getHostel } from '@/lib/data';
import { notFound, useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Clock, User, CheckCheck, Loader2, Calendar, Phone, MessageCircle, Navigation, Route, Home, UserCheck, XCircle, Map, Layers } from "lucide-react";
import { combinedRoutingService, RouteResult } from "@/components/mapbox-location-picker";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { MapboxMap } from '@/components/map';
import { ably } from '@/lib/ably';
import type * as Ably from 'ably';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

type Visit = {
    id: string;
    studentId: string;
    agentId: string | null;
    hostelId: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled' | 'scheduling';
    studentCompleted: boolean;
    agentCompleted?: boolean;
    createdAt: string;
    visitDate: string;
    visitTime: string;
    visitType?: 'agent' | 'self';
};

// Set Mapbox access token
if (process.env.NEXT_PUBLIC_MAPBOX_API_KEY) {
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
}

// PreviewMap Component - Shows hostel location and user's "You are here" marker
interface PreviewMapProps {
    hostelLocation: { lat: number; lng: number };
    userLocation?: { lat: number; lng: number } | null;
    hostelName: string;
}

function PreviewMap({ hostelLocation, userLocation, hostelName }: PreviewMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('satellite');

    const mapStyles = {
        streets: 'mapbox://styles/mapbox/streets-v12',
        satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
    };

    // Helper to add markers (needs to be called on style change too)
    const setupMarkers = (map: mapboxgl.Map) => {
        // Clear existing user marker if any
        if (userMarkerRef.current) {
            userMarkerRef.current.remove();
            userMarkerRef.current = null;
        }

        // Add hostel marker
        const hostelEl = document.createElement('div');
        hostelEl.innerHTML = `
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <span style="transform: rotate(45deg); color: white; font-size: 16px;">🏠</span>
            </div>
        `;
        new mapboxgl.Marker({ element: hostelEl })
            .setLngLat([hostelLocation.lng, hostelLocation.lat])
            .setPopup(new mapboxgl.Popup().setHTML(`<strong>🏠 ${hostelName}</strong>`))
            .addTo(map);

        // Add user marker if location is available
        if (userLocation) {
            const userEl = document.createElement('div');
            userEl.innerHTML = `
                <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>
                <style>@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }</style>
            `;
            const marker = new mapboxgl.Marker({ element: userEl })
                .setLngLat([userLocation.lng, userLocation.lat])
                .setPopup(new mapboxgl.Popup().setHTML('<strong>📍 You are here</strong>'))
                .addTo(map);
            userMarkerRef.current = marker;

            // Fit bounds to show both markers
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([userLocation.lng, userLocation.lat]);
            bounds.extend([hostelLocation.lng, hostelLocation.lat]);
            map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        }
    };

    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Calculate center - if user location exists, center between both points
        const center: [number, number] = userLocation
            ? [(userLocation.lng + hostelLocation.lng) / 2, (userLocation.lat + hostelLocation.lat) / 2]
            : [hostelLocation.lng, hostelLocation.lat];

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: mapStyles[activeStyle],
            center,
            zoom: userLocation ? 10 : 14,
        });

        mapInstanceRef.current = map;

        map.on('load', () => setupMarkers(map));
        map.on('style.load', () => setupMarkers(map));

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add geolocate control for "find my location" button
        const geolocate = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: false,
            showUserHeading: false
        });
        map.addControl(geolocate, 'top-right');

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, [hostelLocation, hostelName]); // Don't re-init on userLocation change

    // Update user marker when location changes (without re-initializing map)
    useEffect(() => {
        if (!mapInstanceRef.current || !userLocation) return;
        if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
        }
    }, [userLocation]);

    // Switch map style
    const switchStyle = (newStyle: 'streets' | 'satellite') => {
        if (!mapInstanceRef.current) return;
        setActiveStyle(newStyle);
        mapInstanceRef.current.setStyle(mapStyles[newStyle]);
    };

    return (
        <div className="relative h-full w-full">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Map style switcher */}
            <div className="absolute top-4 right-4 bg-background p-1 rounded-lg shadow-md flex gap-1">
                <button
                    onClick={() => switchStyle('streets')}
                    className={`p-2 rounded-md ${activeStyle === 'streets' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Street View"
                >
                    <Map className="h-4 w-4" />
                </button>
                <button
                    onClick={() => switchStyle('satellite')}
                    className={`p-2 rounded-md ${activeStyle === 'satellite' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Satellite View"
                >
                    <Layers className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

// DirectionsMap Component - Visual map with route line and LIVE TRACKING
interface DirectionsMapProps {
    userLocation: { lat: number; lng: number };
    hostelLocation: { lat: number; lng: number };
    routeGeometry: number[][]; // [lng, lat] coordinates
    hostelName: string;
    onUserLocationUpdate?: (location: { lat: number; lng: number }) => void;
}

function DirectionsMap({ userLocation, hostelLocation, routeGeometry, hostelName, onUserLocationUpdate }: DirectionsMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const [isTracking, setIsTracking] = useState(true);
    const [currentUserLocation, setCurrentUserLocation] = useState(userLocation);
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('satellite');

    // Live GPS tracking
    useEffect(() => {
        if (!isTracking) return;

        if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const newLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setCurrentUserLocation(newLocation);

                    // Update marker position on map
                    if (userMarkerRef.current) {
                        userMarkerRef.current.setLngLat([newLocation.lng, newLocation.lat]);
                    }

                    // Notify parent component
                    if (onUserLocationUpdate) {
                        onUserLocationUpdate(newLocation);
                    }
                },
                (error) => {
                    // Silently log tracking issues - very common on desktops/Windows
                    console.log('Live tracking status:', error.code === 1 ? 'Permission Denied' : error.code === 3 ? 'Timeout' : 'Unavailable');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 10000 // Update only every 10s to be more stable
                }
            );
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [isTracking, onUserLocationUpdate]);

    // Initialize Map and handle Style changes
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const mapStyles = {
            streets: 'mapbox://styles/mapbox/streets-v12',
            satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
        };

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: mapStyles[activeStyle],
            center: [userLocation.lng, userLocation.lat],
            zoom: 12,
        });

        mapInstanceRef.current = map;

        // Add standard controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        const geolocate = new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
        });
        map.addControl(geolocate, 'top-right');

        // This function adds everything that gets wiped when style changes
        const loadMapFeatures = () => {
            console.log('🗺️ Loading map features (Markers & Route)...');

            // Add route source
            if (map.getSource('route')) return;

            map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: routeGeometry
                    }
                }
            });

            // Route Layers
            map.addLayer({
                id: 'route-line-bg',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#1d4ed8', 'line-width': 10, 'line-opacity': 0.3 }
            });

            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#3b82f6', 'line-width': 6 }
            });

            // User Marker (Custom HTML)
            const userEl = document.createElement('div');
            userEl.innerHTML = `
                <div style="width: 28px; height: 28px; background: #3b82f6; border: 4px solid white; border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.4); position: relative;">
                    <div style="position: absolute; top: -10px; left: -10px; right: -10px; bottom: -10px; border-radius: 50%; background: rgba(59,130,246,0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                </div>
                <style>@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }</style>
            `;
            const userMarker = new mapboxgl.Marker({ element: userEl })
                .setLngLat([userLocation.lng, userLocation.lat])
                .addTo(map);
            userMarkerRef.current = userMarker;

            // Hostel Marker
            const hostelEl = document.createElement('div');
            hostelEl.innerHTML = `
                <div style="width: 40px; height: 40px; background: #ef4444; border: 4px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
                    <span style="transform: rotate(45deg); font-size: 20px;">🏠</span>
                </div>
            `;
            new mapboxgl.Marker({ element: hostelEl })
                .setLngLat([hostelLocation.lng, hostelLocation.lat])
                .addTo(map);

            // AUTO-FIT BOUNDS - Very important to see both points
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([userLocation.lng, userLocation.lat]);
            bounds.extend([hostelLocation.lng, hostelLocation.lat]);

            // Add some padding by extending invisible points
            map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
        };

        map.on('load', loadMapFeatures);
        map.on('style.load', loadMapFeatures);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            userMarkerRef.current = null;
        };
    }, [activeStyle, hostelLocation, routeGeometry, userLocation]);

    // Center map on user when tracking
    const centerOnUser = () => {
        if (mapInstanceRef.current && currentUserLocation) {
            mapInstanceRef.current.flyTo({
                center: [currentUserLocation.lng, currentUserLocation.lat],
                zoom: 16,
                duration: 1000
            });
        }
    };

    // Switch map style
    const switchStyle = (newStyle: 'streets' | 'satellite') => {
        if (!mapInstanceRef.current) return;
        setActiveStyle(newStyle);
        const mapStyles = {
            streets: 'mapbox://styles/mapbox/streets-v12',
            satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
        };
        mapInstanceRef.current.setStyle(mapStyles[newStyle]);
    };

    return (
        <div className="relative h-full w-full">
            {/* Map container - fills parent */}
            <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />

            {/* Map style switcher */}
            <div className="absolute top-4 right-4 bg-background p-1 rounded-lg shadow-md flex gap-1">
                <button
                    onClick={() => switchStyle('streets')}
                    className={`p-2 rounded-md ${activeStyle === 'streets' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Street View"
                >
                    <Map className="h-4 w-4" />
                </button>
                <button
                    onClick={() => switchStyle('satellite')}
                    className={`p-2 rounded-md ${activeStyle === 'satellite' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    title="Satellite View"
                >
                    <Layers className="h-4 w-4" />
                </button>
            </div>

            {/* Legend and controls overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                {/* Legend */}
                <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 text-sm flex items-center gap-4 shadow-md">
                    <span className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm animate-pulse"></span>
                        <span className="font-medium">You</span>
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
                        <span className="font-medium">Hostel</span>
                    </span>
                </div>

                {/* Center on me button */}
                <button
                    onClick={centerOnUser}
                    className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 text-sm font-medium shadow-md hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                    <Navigation className="h-4 w-4 text-blue-600" />
                    Center on me
                </button>
            </div>

            {/* Live tracking indicator */}
            <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2 shadow-md">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Live Tracking
            </div>
        </div>
    );
}

type OnlineAgent = {
    clientId: string;
    data: {
        id: string;
        fullName: string;
        email: string;
    }
}

export default function TrackingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { id: hostelId } = params;
    const visitId = searchParams.get('visitId');

    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [hostel, setHostel] = useState<Hostel | null>(null);
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCompleting, setIsCompleting] = useState(false);
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
    const previousAgentCompletedRef = useRef<boolean | null>(null);

    // Directions state
    const [route, setRoute] = useState<RouteResult | null>(null);
    const [loadingDirections, setLoadingDirections] = useState(false);
    const [showDirections, setShowDirections] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('driving');
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    const isSelfVisit = visit?.visitType === 'self';

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!hostelId || !visitId) {
            notFound();
            return;
        }

        const unsubscribes: (() => void)[] = [];

        const fetchHostelData = async () => {
            const hostelData = await getHostel(hostelId as string);
            if (hostelData) {
                setHostel(hostelData);
            } else {
                notFound();
            }
        };
        fetchHostelData();

        const visitDocRef = doc(db, 'visits', visitId as string);

        const setupAgentDetails = (agentId: string) => {
            getAgent(agentId).then(agentDetails => {
                if (agentDetails) {
                    setAgent(agentDetails);
                }
            });
        };

        const unsubVisit = onSnapshot(visitDocRef, (docSnap: any) => {
            if (!docSnap.exists()) {
                toast({ title: "Visit Not Found", description: "The visit you are looking for does not exist.", variant: "destructive" });
                router.push('/');
                return;
            }

            const visitData = { id: docSnap.id, ...docSnap.data() } as Visit;

            const previousAgentCompleted = previousAgentCompletedRef.current ?? false;
            const currentAgentCompleted = !!visitData.agentCompleted;

            const storageKey = `visit_agentCompleted_notified_${visitData.id}`;
            const alreadyNotified = typeof window !== 'undefined' && window.localStorage.getItem(storageKey) === '1';

            const justCompletedByAgent = !alreadyNotified && !previousAgentCompleted && currentAgentCompleted && !visitData.studentCompleted;

            if (justCompletedByAgent) {
                if (notificationAudioRef.current) {
                    console.log('Playing visit notification sound (student tracking)');
                    notificationAudioRef.current.play().catch((err) => {
                        console.error('Audio play failed:', err);
                    });
                }
                toast({
                    title: 'Agent marked your visit as complete',
                    description: 'Please confirm if you actually completed this tour.',
                });

                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(storageKey, '1');
                }
            }

            previousAgentCompletedRef.current = currentAgentCompleted;

            setVisit(visitData);
            setLoading(false);

            if (visitData.agentId && (!agent || agent.id !== visitData.agentId)) {
                setupAgentDetails(visitData.agentId);
            }
        });

        unsubscribes.push(unsubVisit);

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [visitId, hostelId, router, toast, agent]);

    // Fetch user location on page load for self-visits (to show "You are here" marker)
    useEffect(() => {
        if (!isSelfVisit || userLocation) return;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log('Could not get initial location:', error.message);
                    // Silent fail - user can still use "Get Directions" button
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, [isSelfVisit, userLocation]);

    const handleStudentComplete = async () => {
        if (!visitId) return;
        setIsCompleting(true);
        try {
            if (isSelfVisit) {
                await updateDoc(doc(db, 'visits', visitId as string), {
                    studentCompleted: true,
                    status: 'completed',
                });
                toast({
                    title: 'Visit Complete!',
                    description: 'Thank you for using HostelHQ. Please rate your experience.',
                });
                router.push(`/hostels/${hostelId}/book/rating?visitId=${visitId}`);
            } else {
                const currentAgentCompleted = visit?.agentCompleted;
                const updatePayload: Record<string, any> = { studentCompleted: true };
                if (currentAgentCompleted) {
                    updatePayload.status = 'completed';
                }
                await updateDoc(doc(db, 'visits', visitId as string), updatePayload);

                if (currentAgentCompleted) {
                    toast({
                        title: 'Visit Complete!',
                        description: 'Thank you for confirming. Please rate your experience.',
                    });
                    router.push(`/hostels/${hostelId}/book/rating?visitId=${visitId}`);
                } else {
                    toast({
                        title: 'Waiting for agent confirmation',
                        description: 'Your agent has been notified to confirm that this visit was truly completed.',
                    });
                }
            }
        } catch (error) {
            console.error('Failed to mark visit as complete:', error);
            toast({
                title: 'Update Failed',
                description: 'Could not mark visit as complete.',
                variant: 'destructive',
            });
        } finally {
            setIsCompleting(false);
        }
    }

    // Fast recalculation when switching travel modes (reuses existing location)
    const recalculateRoute = async (mode: 'driving' | 'walking') => {
        if (!userLocation || !hostel?.lat || !hostel?.lng) return;

        setLoadingDirections(true);
        try {
            const hostelLocation = { lat: hostel.lat!, lng: hostel.lng! };
            console.log(`🔄 Recalculating route for ${mode}...`);

            const routeResult = await combinedRoutingService.getDirections(
                userLocation,
                hostelLocation,
                mode
            );

            setRoute(routeResult);
            toast({
                title: `${mode === 'driving' ? '🚗' : '🚶'} ${mode.charAt(0).toUpperCase() + mode.slice(1)} directions`,
                description: `${combinedRoutingService.formatDistance(routeResult.distance)} • ${combinedRoutingService.formatDuration(routeResult.duration)}`,
            });
        } catch (error) {
            console.error('Recalculation failed:', error);
        } finally {
            setLoadingDirections(false);
        }
    };

    // Get directions to hostel
    const getDirections = async () => {
        if (!hostel?.lat || !hostel?.lng) {
            toast({
                title: 'Location Error',
                description: 'Hostel location not available.',
                variant: 'destructive',
            });
            return;
        }

        // Show directions UI immediately - even if we don't have location yet
        // This allows user to see the map and use the map's own geolocate button if needed
        setShowDirections(true);
        setLoadingDirections(true);

        const statusToast = toast({
            title: 'Connecting to GPS...',
            description: 'This may take up to 20 seconds on some devices.',
        });

        // Check for secure context
        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            statusToast.dismiss();
            setLoadingDirections(false);
            toast({
                title: 'Insecure Connection',
                description: 'Browser blocks location on non-HTTPS sites. Use http://localhost:8080.',
                variant: 'destructive',
            });
            return;
        }

        try {
            if (navigator.geolocation) {
                const getPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
                    return new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, options);
                    });
                };

                let position: GeolocationPosition | null = null;
                try {
                    // Increased timeout to 15s - Windows often needs more time for a cold fix
                    position = await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
                } catch (err: any) {
                    if (err.code === 3 || err.code === 2) {
                        console.warn('High accuracy failed/timed out, trying low accuracy fallback...');
                        try {
                            position = await getPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
                        } catch (err2: any) {
                            console.warn('Low accuracy fallback also failed.');
                        }
                    }
                }

                // --- IP FALLBACK ---
                // If browser geolocation completely failed (Denied or Timeout), try IP-based location
                if (!position) {
                    console.log('🌐 Browser GPS failed. Attempting IP-based location fallback...');
                    try {
                        const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
                        const ipResponse = await fetch(`https://api.geoapify.com/v1/ipinfo?apiKey=${geoapifyKey}`);
                        const ipData = await ipResponse.json();

                        if (ipData.location) {
                            console.log('📍 IP-based location fix obtained:', ipData.location);
                            position = {
                                coords: {
                                    latitude: ipData.location.latitude,
                                    longitude: ipData.location.longitude,
                                    accuracy: 1000, // IP is approximate
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null
                                },
                                timestamp: Date.now()
                            } as GeolocationPosition;

                            toast({
                                title: 'Using Network Location',
                                description: 'GPS failed, so we used your IP address. This is less exact but works!',
                            });
                        }
                    } catch (ipErr) {
                        console.error('IP Fallback failed too:', ipErr);
                    }
                }

                if (!position) {
                    throw new Error('All location attempts failed');
                }

                const userLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
                const hostelLoc = { lat: hostel.lat!, lng: hostel.lng! };

                setUserLocation(userLoc);

                const routeResult = await combinedRoutingService.getDirections(userLoc, hostelLoc, travelMode);
                setRoute(routeResult);

                statusToast.dismiss();
                setLoadingDirections(false);

            } else {
                throw new Error('Geolocation not supported');
            }
        } catch (error: any) {
            statusToast.dismiss();
            setLoadingDirections(false);

            // Explicitly extract properties because Error objects log as {}
            const errCode = error.code || 0;
            const errMsg = error.message || 'Unknown error';

            let isAllowedInBrowser = false;
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' });
                isAllowedInBrowser = (status.state === 'granted');
            } catch (e) { }

            let errorTitle = 'Location Error';
            let detail = 'Please ensure location is enabled and you have a clear GPS or WiFi signal.';

            if (errCode === 1) {
                errorTitle = 'Permission Denied';
                detail = 'Please click the padlock in your browser address bar and set Location to "Allow".';
            } else if (isAllowedInBrowser) {
                errorTitle = 'Windows is Blocking Access';
                detail = 'Browser is allowed, but Windows is blocking it. FIX: Settings > Privacy > Location > Enable "Allow apps to access location".';
            } else if (errCode === 3) {
                errorTitle = 'Connection Timeout';
                detail = 'It took too long to find you. Try moving near a window or turning on WiFi (even on Ethernet).';
            }

            toast({ title: errorTitle, description: detail, variant: 'destructive' });
            console.error('Directions diagnosis:', { code: errCode, message: errMsg, allowed: isAllowedInBrowser });
        }
    };

    if (loading || !hostel || !visit) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                    <p className="ml-4 text-muted-foreground">Loading your visit details...</p>
                </main>
            </div>
        )
    }

    const agentPhoneNumber = agent?.phone || '1234567890'; // Placeholder phone

    const renderSelfVisitContent = () => {
        if (!hostel?.lat || !hostel?.lng) {
            return (
                <div className="text-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Loading hostel location...</p>
                </div>
            )
        }
        if (visit?.studentCompleted) {
            return (
                <div className="text-center py-8">
                    <CheckCheck className="h-10 w-10 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Your visit is complete. We hope you liked it!</p>
                    <Button onClick={() => router.push(`/hostels/${hostelId}/book/rating?visitId=${visit.id}`)}>Rate Your Visit</Button>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="space-y-4 rounded-lg border bg-card text-card-foreground p-4">
                    <div className="flex items-start gap-3">
                        <Home className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="text-sm text-muted-foreground">Hostel</p>
                            <p className="font-semibold">{hostel.name}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="text-sm text-muted-foreground">Location</p>
                            <p className="font-semibold">{hostel.location}</p>
                        </div>
                    </div>
                </div>
                <Button className="w-full" onClick={getDirections} disabled={loadingDirections}>
                    {loadingDirections ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting Directions...
                        </>
                    ) : (
                        <>
                            <Navigation className="mr-2 h-4 w-4" />
                            Get Live Directions
                        </>
                    )}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleStudentComplete} disabled={isCompleting}>
                    {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                    Mark Visit as Complete
                </Button>

                {/* Live Directions Display - Full Screen Overlay Style */}
                {showDirections && route && userLocation && hostel && (
                    <div className="fixed inset-0 z-50 bg-background">
                        {/* Header */}
                        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-lg flex items-center gap-2">
                                    <Route className="h-5 w-5 text-green-600" />
                                    Live Navigation
                                </h2>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        {combinedRoutingService.formatDuration(route.duration)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        {combinedRoutingService.formatDistance(route.distance)}
                                    </span>
                                    <Badge variant="secondary">
                                        {route.provider}
                                    </Badge>
                                </div>
                            </div>
                            {/* Travel mode toggle + Close */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center rounded-full border bg-muted/40 p-0.5 text-xs">
                                    <button
                                        type="button"
                                        disabled={loadingDirections}
                                        onClick={() => { setTravelMode('driving'); recalculateRoute('driving'); }}
                                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors ${travelMode === 'driving'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-muted-foreground hover:bg-white'
                                            } ${loadingDirections ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        🚗 Drive
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loadingDirections}
                                        onClick={() => { setTravelMode('walking'); recalculateRoute('walking'); }}
                                        className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors ${travelMode === 'walking'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-muted-foreground hover:bg-white'
                                            } ${loadingDirections ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        🚶 Walk
                                    </button>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDirections(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>

                        {/* Main Content - Map takes most space */}
                        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
                            {/* Map - Full width on mobile, 70% on desktop */}
                            <div className="flex-1 lg:w-[70%] h-[50vh] lg:h-full">
                                <DirectionsMap
                                    userLocation={userLocation}
                                    hostelLocation={{ lat: hostel.lat!, lng: hostel.lng! }}
                                    routeGeometry={route.geometry}
                                    hostelName={hostel.name}
                                />
                            </div>

                            {/* Instructions Panel - Below on mobile, Right side on desktop */}
                            <div className="lg:w-[30%] h-[50vh] lg:h-full bg-white border-t lg:border-t-0 lg:border-l overflow-hidden flex flex-col">
                                <div className="p-4 border-b bg-muted/30">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <Navigation className="h-4 w-4 text-blue-600" />
                                        Turn-by-Turn Directions
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {route.instructions.length} steps to {hostel.name}
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {route.instructions.map((instruction, index) => (
                                        <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center font-semibold">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm leading-relaxed pt-1">{instruction}</span>
                                        </div>
                                    ))}
                                    {/* Destination */}
                                    <div className="flex gap-3 p-3 rounded-lg bg-green-100 border border-green-200">
                                        <span className="flex-shrink-0 w-8 h-8 bg-green-600 text-white text-sm rounded-full flex items-center justify-center">
                                            🏠
                                        </span>
                                        <span className="text-sm font-medium text-green-800 pt-1">
                                            Arrive at {hostel.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }


    const renderAgentVisitContent = () => {
        if (!visit) return null;

        if (visit.status === 'scheduling') {
            return (
                <div className="text-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Your visit is being scheduled.</p>
                    <p className="text-sm text-muted-foreground mt-1">Please select an agent and time on the scheduling page.</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push(`/hostels/book/schedule?visitId=${visitId}`)}>
                        Go to Scheduling
                    </Button>
                </div>
            )
        }

        if (visit.status === 'pending' && agent) {
            return (
                <div className="text-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="font-semibold">Waiting for {agent.fullName || 'Agent'} to accept...</p>
                    <p className="text-sm text-muted-foreground mt-1">You will be notified once they confirm your visit request.</p>
                </div>
            );
        }

        if (visit.status === 'accepted' && agent) {
            if (visit.studentCompleted && !visit.agentCompleted) {
                return (
                    <div className="text-center py-8">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto mb-4" />
                        <p className="font-semibold">Waiting for agent to confirm completion...</p>
                        <p className="text-sm text-muted-foreground mt-1">Your visit will be fully completed once your agent confirms.</p>
                    </div>
                );
            }

            if (visit.agentCompleted && !visit.studentCompleted) {
                return (
                    <div className="space-y-4">
                        <div className="space-y-4 rounded-lg border bg-card text-card-foreground p-4">
                            <div className="flex items-start gap-3">
                                <Home className="h-5 w-5 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Hostel</p>
                                    <p className="font-semibold">{hostel.name}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <UserCheck className="h-5 w-5 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Your Agent</p>
                                    <p className="font-semibold">{agent.fullName}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Date</p>
                                        <p className="font-semibold">{format(new Date(visit.visitDate), "PPP")}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Clock className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Time</p>
                                        <p className="font-semibold">{visit.visitTime}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <p className="text-sm text-muted-foreground text-center">
                            Your agent has confirmed that the visit is complete. Please confirm your side to fully complete this visit.
                        </p>

                        <Button variant="outline" className="w-full" onClick={handleStudentComplete} disabled={isCompleting}>
                            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                            Mark Visit as Complete
                        </Button>
                    </div>
                );
            }

            return (
                <div className="space-y-4">
                    <div className="space-y-4 rounded-lg border bg-card text-card-foreground p-4">
                        <div className="flex items-start gap-3">
                            <Home className="h-5 w-5 text-muted-foreground mt-1" />
                            <div>
                                <p className="text-sm text-muted-foreground">Hostel</p>
                                <p className="font-semibold">{hostel.name}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <UserCheck className="h-5 w-5 text-muted-foreground mt-1" />
                            <div>
                                <p className="text-sm text-muted-foreground">Your Agent</p>
                                <p className="font-semibold">{agent.fullName}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                                <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Date</p>
                                    <p className="font-semibold">{format(new Date(visit.visitDate), "PPP")}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Clock className="h-5 w-5 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Time</p>
                                    <p className="font-semibold">{visit.visitTime}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />


                    <Button variant="outline" className="w-full" onClick={handleStudentComplete} disabled={isCompleting}>
                        {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                        Mark Visit as Complete
                    </Button>
                </div>
            );
        }

        if (visit.status === 'completed') {
            return (
                <div className="text-center py-8">
                    <CheckCheck className="h-10 w-10 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Your visit is complete. We hope you liked it!</p>
                    <Button onClick={() => router.push(`/hostels/${hostelId}/book/rating?visitId=${visit.id}`)}>Rate Your Visit</Button>
                </div>
            );
        }

        if (visit.status === 'cancelled') {
            return (
                <div className="text-center py-8">
                    <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
                    <p className="font-semibold">Visit Cancelled</p>
                    <p className="text-muted-foreground mb-4">This request was cancelled or timed out.</p>
                    <Button variant="outline" onClick={() => router.push('/')}>Find Another Hostel</Button>
                </div>
            );
        }

        return <div className="text-center py-8"><p>Loading...</p></div>;
    }

    const getCardTitle = () => {
        if (isSelfVisit) return "Self-Guided Visit";
        if (!visit) return "Loading Visit...";
        if (visit.status === 'scheduling') return "Schedule Your Visit";
        if (visit.status === 'pending' && agent) return "Visit Request Pending";
        if (visit.status === 'accepted') return <span className="text-green-600">Visit Confirmed!</span>;
        if (visit.status === 'completed') return <span className="text-blue-600">Visit Complete</span>;
        if (visit.status === 'cancelled') return <span className="text-red-500">Visit Cancelled</span>;
        return "Visit Details";
    }

    const getCardDescription = () => {
        if (isSelfVisit) return "You've opted to visit the hostel by yourself. Use the map for navigation.";
        if (!visit) return "";
        if (visit.status === 'scheduling') return "Please select an agent and time to finalize your tour.";
        if (visit.status === 'pending' && agent) return `Waiting for ${agent.fullName} to accept your request.`;
        if (visit.status === 'accepted' && agent) return `Your tour with agent ${agent.fullName} is confirmed. Track their location here.`;
        if (visit.status === 'completed') return "Thank you for using HostelHQ!";
        if (visit.status === 'cancelled') return `This visit request was cancelled.`;
        return "";
    }


    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <audio ref={notificationAudioRef} src="/sounds/visit-notification.mp3" preload="auto" />
            <main className="flex-1 grid md:grid-cols-2">
                <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-gray-50/50">
                    <Card className="w-full max-w-md shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                {getCardTitle()}
                            </CardTitle>
                            <CardDescription>
                                {getCardDescription()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isSelfVisit ? renderSelfVisitContent() : renderAgentVisitContent()}
                        </CardContent>
                    </Card>
                </div>
                <div className="relative bg-muted h-96 md:h-full">
                    {isSelfVisit && hostel?.lat && hostel?.lng ? (
                        <PreviewMap
                            hostelLocation={{ lat: hostel.lat, lng: hostel.lng }}
                            userLocation={userLocation}
                            hostelName={hostel.name}
                        />
                    ) : (
                        <MapboxMap agentId={visit?.agentId} hostelLocation={hostel} />
                    )}
                </div>
            </main>
        </div>
    );
}
