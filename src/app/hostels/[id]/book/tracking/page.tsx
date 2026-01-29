// src/app/hostels/[id]/book/tracking/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
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
    const hostelMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('satellite');

    const mapStyles = {
        streets: 'mapbox://styles/mapbox/streets-v12',
        satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
    };

    // Clear markers helper
    const clearMarkers = useCallback(() => {
        if (hostelMarkerRef.current) {
            hostelMarkerRef.current.remove();
            hostelMarkerRef.current = null;
        }
        if (userMarkerRef.current) {
            userMarkerRef.current.remove();
            userMarkerRef.current = null;
        }
    }, []);

    // Helper to add markers
    const setupMarkers = useCallback((map: mapboxgl.Map) => {
        if (!map || !map.getContainer()) return;
        clearMarkers();

        // Add hostel marker
        const hostelEl = document.createElement('div');
        hostelEl.innerHTML = `
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <span style="transform: rotate(45deg); color: white; font-size: 16px;">🏠</span>
            </div>
        `;
        hostelMarkerRef.current = new mapboxgl.Marker({ element: hostelEl })
            .setLngLat([hostelLocation.lng, hostelLocation.lat])
            .setPopup(new mapboxgl.Popup().setHTML(`<strong>🏠 ${hostelName}</strong>`))
            .addTo(map);

        // Add user marker if location is available
        if (userLocation) {
            const userEl = document.createElement('div');
            userEl.innerHTML = `
                <div style="width: 24px; height: 24px; background: #3b82f6; border: 4px solid white; box-shadow: 0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>
                <style>@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }</style>
            `;
            userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
                .setLngLat([userLocation.lng, userLocation.lat])
                .setPopup(new mapboxgl.Popup().setHTML('<strong>📍 You are here</strong>'))
                .addTo(map);

            // Fit bounds to show both markers
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([userLocation.lng, userLocation.lat]);
            bounds.extend([hostelLocation.lng, hostelLocation.lat]);
            map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        }
    }, [hostelLocation, hostelName, userLocation, clearMarkers]);


    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const center: [number, number] = userLocation
            ? [userLocation.lng, userLocation.lat]
            : [hostelLocation.lng, hostelLocation.lat];

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: mapStyles[activeStyle],
            center,
            zoom: userLocation ? 10 : 14,
        });

        mapInstanceRef.current = map;

        const handleLoad = () => {
            if (map.getContainer()) setupMarkers(map);
        };

        map.on('load', handleLoad);
        map.on('style.load', handleLoad);

        // Add navigation controls (Moved to top-left to avoid HUD overlap)
        if (map.getContainer()) {
            map.addControl(new mapboxgl.NavigationControl(), 'top-left');
        }

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
            clearMarkers();
            map.remove();
            mapInstanceRef.current = null;
        };
    }, [hostelLocation, hostelName, clearMarkers, setupMarkers]);

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
    routeGeometry: number[][];
    hostelName: string;
    onUserLocationUpdate?: (loc: { lat: number; lng: number }) => void;
    activeStyle: 'streets' | 'satellite';
    mapInstanceRef: React.MutableRefObject<mapboxgl.Map | null>;
}

// DirectionsMap Component - Premium Visual map for live navigation
function DirectionsMap({ userLocation, hostelLocation, routeGeometry, hostelName, onUserLocationUpdate, activeStyle, mapInstanceRef }: DirectionsMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const hostelMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // Sync layers and sources
    const syncRouteLayer = useCallback(() => {
        const map = mapInstanceRef.current;
        if (!map || !map.isStyleLoaded() || !routeGeometry || routeGeometry.length === 0) return;

        if (map.getSource('route')) {
            (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
                type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeGeometry }
            });
        } else {
            map.addSource('route', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeGeometry } }
            });

            // 1. Shadow/Outer Glow for depth
            map.addLayer({
                id: 'route-glow', type: 'line', source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#3b82f6', 'line-width': 14, 'line-opacity': 0.15, 'line-blur': 12 }
            });

            // 2. High Contrast White Outline (Critical for Satellite)
            map.addLayer({
                id: 'route-outline', type: 'line', source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.8 }
            });

            // 3. Primary Direction Line (Ultra-bright Blue)
            map.addLayer({
                id: 'route-line', type: 'line', source: 'route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#2563eb', 'line-width': 6 }
            });
        }
    }, [routeGeometry, mapInstanceRef]);

    // Live Tracking Setup (Watch Position)
    useEffect(() => {
        if (typeof window === 'undefined' || !navigator.geolocation) return;

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                if (userMarkerRef.current) userMarkerRef.current.setLngLat([loc.lng, loc.lat]);
                onUserLocationUpdate?.(loc);
            },
            (err) => console.warn("Tracking:", err.message),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );

        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        };
    }, [onUserLocationUpdate]);

    const setupMarkers = useCallback((map: mapboxgl.Map) => {
        if (!map || !map.getContainer()) return;

        // Clear old markers if they exist
        if (userMarkerRef.current) userMarkerRef.current.remove();
        if (hostelMarkerRef.current) hostelMarkerRef.current.remove();

        const createHostelMarker = () => {
            const el = document.createElement('div');
            el.innerHTML = `<div style="width: 44px; height: 44px; background: #ef4444; border: 4px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.3);"><span style="transform: rotate(45deg); font-size: 22px;">🏠</span></div>`;
            return el;
        };

        const createUserMarker = () => {
            const el = document.createElement('div');
            el.innerHTML = `<div style="width: 28px; height: 28px; background: #3b82f6; border: 4px solid white; border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.4); position: relative;"><div style="position: absolute; inset: -8px; border-radius: 50%; background: rgba(59,130,246,0.3); animation: ping 2s infinite;"></div></div><style>@keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }</style>`;
            return el;
        };

        hostelMarkerRef.current = new mapboxgl.Marker({ element: createHostelMarker() }).setLngLat([hostelLocation.lng, hostelLocation.lat]).addTo(map);
        userMarkerRef.current = new mapboxgl.Marker({ element: createUserMarker() }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    }, [hostelLocation, userLocation]);

    // Map Initialization
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            pitch: 50,
        });

        mapInstanceRef.current = map;

        map.on('load', () => {
            syncRouteLayer();
            setupMarkers(map);
        });

        map.on('style.load', () => {
            syncRouteLayer();
            setupMarkers(map);
        });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Re-sync layer when geometry changes
    useEffect(() => {
        syncRouteLayer();
    }, [routeGeometry, syncRouteLayer]);

    // Update style when external state changes
    useEffect(() => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setStyle(
                activeStyle === 'streets' ? 'mapbox://styles/mapbox/streets-v12' : 'mapbox://styles/mapbox/satellite-streets-v12'
            );
        }
    }, [activeStyle, mapInstanceRef]);

    return <div ref={mapContainerRef} className="w-full h-full" />;
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
    const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('satellite');
    const [showInstructions, setShowInstructions] = useState(false);
    const mapInstanceRefGlobal = useRef<mapboxgl.Map | null>(null);

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

    // Stable handler for live location updates from DirectionsMap
    const handleUserLocationUpdate = useCallback((loc: { lat: number, lng: number }) => {
        setUserLocation(prev => {
            if (!prev) return loc;
            // Only update if moved more than ~1 meter to avoid jitter
            const latDiff = Math.abs(prev.lat - loc.lat);
            const lngDiff = Math.abs(prev.lng - loc.lng);
            if (latDiff < 0.00001 && lngDiff < 0.00001) return prev;
            return loc;
        });
    }, []);

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
                            <p className="font-semibold text-slate-900">{hostel.name}</p>
                        </div>
                    </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-14 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all" onClick={getDirections} disabled={loadingDirections}>
                    {loadingDirections ? <Loader2 className="h-6 w-6 animate-spin" /> : <Navigation className="mr-2 h-5 w-5" />}
                    GET LIVE DIRECTIONS
                </Button>
                <Button variant="outline" className="w-full h-12 rounded-xl font-bold" onClick={handleStudentComplete} disabled={isCompleting}>
                    {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                    MARK VISIT DONE
                </Button>
            </div>
        );
    };

    const renderNavOverlay = () => {
        if (!showDirections || !route || !userLocation || !hostel) return null;

        return (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
                <div className="absolute inset-0 z-0">
                    <DirectionsMap
                        userLocation={userLocation}
                        hostelLocation={{ lat: hostel.lat!, lng: hostel.lng! }}
                        routeGeometry={route.geometry}
                        hostelName={hostel.name}
                        onUserLocationUpdate={handleUserLocationUpdate}
                        activeStyle={activeStyle}
                        mapInstanceRef={mapInstanceRefGlobal}
                    />
                </div>

                {/* MAP CONTROLS (Always on top) */}
                <div className="absolute bottom-[35%] right-4 flex flex-col gap-3 z-50 lg:bottom-10 lg:right-auto lg:left-[calc(100vw-500px)]">
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => setActiveStyle(s => s === 'streets' ? 'satellite' : 'streets')}
                        className="w-12 h-12 rounded-2xl shadow-2xl bg-white/95 backdrop-blur-xl border border-white/40 hover:bg-white active:scale-95 transition-all text-slate-700"
                    >
                        {activeStyle === 'streets' ? <Layers className="h-6 w-6" /> : <Map className="h-6 w-6" />}
                    </Button>
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => mapInstanceRefGlobal.current?.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 18, pitch: 60, duration: 1500 })}
                        className="w-12 h-12 rounded-2xl shadow-2xl bg-white/95 backdrop-blur-xl border border-white/40 hover:bg-white active:scale-95 transition-all text-blue-600"
                    >
                        <Navigation className="h-6 w-6" />
                    </Button>
                </div>

                {/* PREMIUM HUD */}
                <div className="absolute top-6 left-6 right-6 z-40 pointer-events-none">
                    <div className="mx-auto max-w-xl pointer-events-auto">
                        <div className="bg-white/90 backdrop-blur-3xl border border-white/50 shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-[32px] p-5 flex items-center justify-between gap-6 transition-all hover:shadow-[0_30px_80px_rgba(0,0,0,0.15)]">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className="bg-blue-600/10 p-3.5 rounded-2xl hidden sm:block shrink-0">
                                    <Route className="h-7 w-7 text-blue-600" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <h2 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">{hostel.name}</h2>
                                    <div className="flex items-center gap-3 text-[11px] font-black text-blue-600 uppercase mt-0.5">
                                        <span className="bg-blue-50 px-2 py-1 rounded-md border border-blue-100/30">
                                            {combinedRoutingService.formatDuration(route.duration)}
                                        </span>
                                        <span className="text-slate-400 font-bold tracking-wider">
                                            {combinedRoutingService.formatDistance(route.distance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-[22px] border border-slate-100 shrink-0">
                                <button
                                    onClick={() => { setTravelMode('driving'); recalculateRoute('driving'); }}
                                    className={`px-4 py-2.5 rounded-[18px] transition-all duration-300 flex items-center gap-2 text-[11px] font-black uppercase ${travelMode === 'driving' ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Navigation className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => { setTravelMode('walking'); recalculateRoute('walking'); }}
                                    className={`px-4 py-2.5 rounded-[18px] transition-all duration-300 flex items-center gap-2 text-[11px] font-black uppercase ${travelMode === 'walking' ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Route className="h-4 w-4" />
                                </button>
                                <Separator orientation="vertical" className="h-8 mx-1 bg-slate-200/60" />
                                <Button variant="ghost" size="icon" onClick={() => setShowDirections(false)} className="rounded-[18px] hover:bg-red-50 hover:text-red-500 w-11 h-11 shrink-0">
                                    <XCircle className="h-6 w-6" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM SHEET */}
                <div className={`absolute transition-all duration-700 z-40 inset-x-6 bottom-6 lg:left-auto lg:right-6 lg:w-[440px] lg:bottom-6
                    ${showInstructions ? 'top-1/4 lg:top-auto lg:h-[75vh]' : 'h-24 lg:h-auto'}
                `}>
                    <div className="bg-white/95 backdrop-blur-3xl shadow-[0_-10px_60px_rgba(0,0,0,0.12)] rounded-[40px] h-full flex flex-col border border-white/60 overflow-hidden">
                        <div className="h-24 shrink-0 flex items-center justify-between px-10 cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-1.5 bg-slate-200/50 rounded-full absolute top-4 left-1/2 -translate-x-1/2"></div>
                                <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl">
                                    <Route className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-slate-900 uppercase text-xs tracking-tighter">Instructions</span>
                                    <span className="text-[10px] font-bold text-slate-400">{route.instructions.length} steps to target</span>
                                </div>
                            </div>
                            <Button variant="outline" className="rounded-2xl h-11 px-6 border-slate-200 font-black text-[11px] uppercase tracking-wider hover:bg-slate-50">
                                {showInstructions ? 'Close' : 'View Steps'}
                            </Button>
                        </div>

                        <div className={`flex-1 overflow-y-auto p-10 pt-2 space-y-4 custom-scrollbar-nav ${!showInstructions ? 'hidden lg:block' : 'block'}`}>
                            {route.instructions.map((step, idx) => (
                                <div key={idx} className="flex gap-6 p-6 rounded-[32px] bg-slate-50/40 border border-slate-100/40 items-center transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/20 group">
                                    <div className="w-10 h-10 rounded-2xl bg-white text-blue-600 border-2 border-slate-50 flex items-center justify-center text-[13px] font-black shrink-0 transition-all group-hover:bg-blue-600 group-hover:text-white">
                                        {idx + 1}
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-600 leading-tight group-hover:text-slate-900">{step}</p>
                                </div>
                            ))}
                            <div className="p-12 rounded-[48px] bg-slate-900 text-white text-center space-y-8 mt-10 shadow-2xl">
                                <Home className="h-14 w-14 mx-auto text-blue-400 animate-bounce-slow" />
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] opacity-80">Arrival Goal</p>
                                    <p className="font-black text-xl tracking-tighter leading-none">{hostel.name}</p>
                                </div>
                                <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-16 rounded-[24px] shadow-2xl shadow-blue-500/30 active:scale-95 transition-all text-sm tracking-widest uppercase" onClick={handleStudentComplete} disabled={isCompleting}>
                                    MARK VISIT DONE
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <style jsx global>{`
                    .custom-scrollbar-nav::-webkit-scrollbar { width: 5px; }
                    .custom-scrollbar-nav::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .animate-bounce-slow { animation: bounce 3s ease-in-out infinite; }
                    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                `}</style>
            </div>
        );
    };


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
        <div className="flex flex-col min-h-screen bg-slate-50/50">
            {renderNavOverlay()}
            {!showDirections && <Header />}
            <audio ref={notificationAudioRef} src="/sounds/visit-notification.mp3" preload="auto" />

            <main className="flex-1 grid md:grid-cols-2 overflow-hidden">
                <div className="flex items-center justify-center p-6 md:p-12 relative z-10">
                    <Card className="w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-none ring-1 ring-slate-200/60 rounded-[32px] overflow-hidden">
                        <CardHeader className="p-8 pb-4">
                            <Badge className="w-fit mb-4 bg-blue-600 text-white font-black px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest leading-none">
                                {visit?.status || 'loading'}
                            </Badge>
                            <CardTitle className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                                {getCardTitle()}
                            </CardTitle>
                            <CardDescription className="text-slate-400 font-bold text-sm mt-2">
                                {getCardDescription()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                            {isSelfVisit ? renderSelfVisitContent() : renderAgentVisitContent()}
                        </CardContent>
                    </Card>
                </div>

                <div className="relative h-96 md:h-full bg-slate-200">
                    {isSelfVisit && hostel?.lat && hostel?.lng ? (
                        <PreviewMap
                            hostelLocation={{ lat: hostel.lat, lng: hostel.lng }}
                            userLocation={userLocation}
                            hostelName={hostel.name}
                        />
                    ) : (
                        <MapboxMap agentId={visit?.agentId} hostelLocation={hostel} />
                    )}

                    {/* Floating Mobile Status */}
                    <div className="absolute top-6 left-6 md:hidden z-20">
                        <div className="bg-white/90 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl border border-white/40 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Live Tracking Active</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
