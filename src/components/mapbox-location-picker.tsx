'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Search, Crosshair, Map, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Set Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '';

const mapStyles = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12'
};

interface MapboxLocationPickerProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
  initialLocation?: { lat: number; lng: number };
  initialAddress?: string;
}

// Waterfall Routing Service - 3-tier fallback system
export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  instructions: string[];
  geometry: number[][]; // [lng, lat] coordinates
  provider: string;
}

class CombinedRoutingService {
  // API Keys for managed services
  private orsApiKey = process.env.NEXT_PUBLIC_OPENROUTE_API_KEY;
  private tomtomApiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  private graphHopperApiKey = process.env.NEXT_PUBLIC_GRAPHHOPPER_API_KEY;
  
  // Public OSRM Instances (Tertiary Fallback)
  // Note: Most public OSRM servers have CORS issues when called from browser
  // Only router.project-osrm.org sometimes works
  private publicOsrmServers = [
    'https://router.project-osrm.org',
  ];

  async getDirections(start: RoutePoint, end: RoutePoint, profile: 'driving' | 'walking' = 'driving'): Promise<RouteResult> {
    let result = null;

    // 1. PRIMARY: OpenRouteService (2000 requests/day FREE)
    try {
      console.log("🎯 Attempting OpenRouteService (Primary)...");
      result = await this.callOpenRouteService(start, end, profile);
      if (result) return result;
    } catch (e: any) {
      console.warn(`❌ ORS failed/rate-limited: ${e.message}`);
    }

    // 2. SECONDARY: TomTom (2500 requests/day FREE)
    try {
      console.log("🎯 Attempting TomTom (Secondary)...");
      result = await this.callTomTomService(start, end, profile);
      if (result) return result;
    } catch (e: any) {
      console.warn(`❌ TomTom failed/rate-limited: ${e.message}`);
    }

    // 3. TERTIARY: GraphHopper (500 requests/day FREE)
    try {
      console.log("🎯 Attempting GraphHopper (Tertiary)...");
      result = await this.callGraphHopperService(start, end, profile);
      if (result) return result;
    } catch (e: any) {
      console.warn(`❌ GraphHopper failed/rate-limited: ${e.message}`);
    }

    // 4. QUATERNARY: Public OSRM Cascade (Unlimited but unreliable)
    console.log("🎯 Attempting public OSRM servers (Tertiary)...");
    for (const server of this.publicOsrmServers) {
      try {
        result = await this.callPublicOsrm(server, start, end, profile);
        if (result) return result;
      } catch (e) {
        console.warn(`❌ ${server} failed, trying next...`);
      }
    }

    // FINAL FAILURE - Create fallback route
    console.log("⚠️ All services failed, creating fallback route");
    return this.createFallbackRoute(start, end, profile);
  }

  private async callOpenRouteService(start: RoutePoint, end: RoutePoint, profile: string): Promise<RouteResult | null> {
    if (!this.orsApiKey || this.orsApiKey === 'your_openroute_api_key_here') return null;

    const orsProfile = profile === 'walking' ? 'foot-walking' : 'driving-car';
    
    const response = await fetch(`https://api.openrouteservice.org/v2/directions/${orsProfile}`, {
      method: 'POST',
      headers: {
        'Authorization': this.orsApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [[start.lng, start.lat], [end.lng, end.lat]],
        format: 'geojson',
        instructions: true
      })
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.features || !data.features[0] || !data.features[0].properties) {
      console.warn('ORS returned invalid response structure:', data);
      return null;
    }
    
    const route = data.features[0];
    const props = route.properties;
    const segment = props.segments?.[0];
    
    if (!segment) {
      console.warn('ORS response missing segments');
      return null;
    }

    return {
      distance: segment.distance || 0,
      duration: segment.duration || 0,
      instructions: segment.steps?.map((step: any) => step.instruction) || [],
      geometry: route.geometry?.coordinates || [],
      provider: 'OpenRouteService'
    };
  }

  private async callTomTomService(start: RoutePoint, end: RoutePoint, profile: string): Promise<RouteResult | null> {
    if (!this.tomtomApiKey || this.tomtomApiKey === 'your_tomtom_api_key_here') return null;

    const travelMode = profile === 'walking' ? 'pedestrian' : 'car';
    const locations = `${start.lat},${start.lng}:${end.lat},${end.lng}`;
    
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${locations}/json?` +
      `key=${this.tomtomApiKey}&` +
      `travelMode=${travelMode}&` +
      `instructionsType=text&` +
      `language=en-GB&` +
      `routeType=fastest`;

    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) throw new Error('Rate limit exceeded');
      if (response.status === 403) throw new Error('Invalid API key');
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.routes || !data.routes[0]) {
      console.warn('TomTom returned invalid response:', data);
      return null;
    }
    
    const route = data.routes[0];
    const summary = route.summary;
    const legs = route.legs || [];
    const guidance = route.guidance;
    
    // Extract instructions from guidance object (TomTom's detailed turn-by-turn)
    const instructions: string[] = [];
    
    if (guidance?.instructions && guidance.instructions.length > 0) {
      guidance.instructions.forEach((inst: any) => {
        // Build human-readable instruction from TomTom's data
        const message = inst.message || '';
        const street = inst.street || '';
        const maneuver = inst.maneuver || '';
        
        if (message) {
          instructions.push(message);
        } else if (maneuver && street) {
          instructions.push(`${this.formatTomTomManeuver(maneuver)} onto ${street}`);
        } else if (maneuver) {
          instructions.push(this.formatTomTomManeuver(maneuver));
        }
      });
    }
    
    // Fallback: try to extract from legs if guidance is empty
    if (instructions.length === 0) {
      legs.forEach((leg: any) => {
        leg.points?.forEach((point: any) => {
          if (point.instruction) {
            instructions.push(point.instruction);
          }
        });
      });
    }
    
    // Final fallback
    if (instructions.length === 0) {
      instructions.push('Head towards your destination');
      instructions.push('You have arrived at your destination');
    }
    
    // Extract geometry from legs
    const geometry: number[][] = [];
    legs.forEach((leg: any) => {
      leg.points?.forEach((point: any) => {
        if (point.latitude && point.longitude) {
          geometry.push([point.longitude, point.latitude]);
        }
      });
    });

    return {
      distance: summary?.lengthInMeters || 0,
      duration: summary?.travelTimeInSeconds || 0,
      instructions,
      geometry,
      provider: 'TomTom'
    };
  }

  private async callGraphHopperService(start: RoutePoint, end: RoutePoint, profile: string): Promise<RouteResult | null> {
    if (!this.graphHopperApiKey || this.graphHopperApiKey === 'your_graphhopper_api_key_here') return null;

    const vehicle = profile === 'walking' ? 'foot' : 'car';
    
    const url = `https://graphhopper.com/api/1/route?` +
      `point=${start.lat},${start.lng}&` +
      `point=${end.lat},${end.lng}&` +
      `vehicle=${vehicle}&` +
      `instructions=true&` +
      `points_encoded=false&` +
      `key=${this.graphHopperApiKey}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.paths || !data.paths[0]) {
      console.warn('GraphHopper returned invalid response:', data);
      return null;
    }
    
    const path = data.paths[0];

    return {
      distance: path.distance || 0,
      duration: (path.time || 0) / 1000, // Convert ms to seconds
      instructions: path.instructions?.map((inst: any) => inst.text) || [],
      geometry: path.points?.coordinates || [],
      provider: 'GraphHopper'
    };
  }

  private async callPublicOsrm(server: string, start: RoutePoint, end: RoutePoint, profile: string): Promise<RouteResult | null> {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const osrmProfile = profile === 'walking' ? 'foot' : 'driving';
    
    const response = await fetch(
      `${server}/route/v1/${osrmProfile}/${coords}?overview=full&steps=true&geometries=geojson`,
      { 
        method: 'GET',
        headers: { 'User-Agent': 'HostelHQ/1.0' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      distance: route.distance,
      duration: route.duration,
      instructions: leg.steps?.map((step: any) => this.formatOsrmInstruction(step)) || [],
      geometry: route.geometry.coordinates,
      provider: `OSRM (${server.split('//')[1]})`
    };
  }

  private createFallbackRoute(start: RoutePoint, end: RoutePoint, profile: string): RouteResult {
    const distance = this.calculateDistance(start, end);
    const speed = profile === 'walking' ? 5 : 50; // km/h
    const duration = (distance / 1000) / speed * 3600; // seconds

    return {
      distance: Math.round(distance),
      duration: Math.round(duration),
      instructions: [
        `Head ${this.getDirection(start, end)} towards destination`,
        `Continue for ${this.formatDistance(distance)}`,
        'Arrive at destination'
      ],
      geometry: [[start.lng, start.lat], [end.lng, end.lat]],
      provider: 'Fallback Estimation'
    };
  }

  private calculateDistance(start: RoutePoint, end: RoutePoint): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = start.lat * Math.PI / 180;
    const lat2 = end.lat * Math.PI / 180;
    const deltaLat = (end.lat - start.lat) * Math.PI / 180;
    const deltaLng = (end.lng - start.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getDirection(start: RoutePoint, end: RoutePoint): string {
    const deltaLat = end.lat - start.lat;
    const deltaLng = end.lng - start.lng;
    
    if (Math.abs(deltaLat) > Math.abs(deltaLng)) {
      return deltaLat > 0 ? 'north' : 'south';
    } else {
      return deltaLng > 0 ? 'east' : 'west';
    }
  }

  formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  }

  formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  // Convert TomTom maneuver codes to human-readable text
  private formatTomTomManeuver(maneuver: string): string {
    const maneuverMap: Record<string, string> = {
      'ARRIVE': 'Arrive at your destination',
      'ARRIVE_LEFT': 'Arrive at your destination on the left',
      'ARRIVE_RIGHT': 'Arrive at your destination on the right',
      'DEPART': 'Depart',
      'STRAIGHT': 'Continue straight',
      'KEEP_RIGHT': 'Keep right',
      'BEAR_RIGHT': 'Bear right',
      'TURN_RIGHT': 'Turn right',
      'SHARP_RIGHT': 'Take a sharp right',
      'KEEP_LEFT': 'Keep left',
      'BEAR_LEFT': 'Bear left',
      'TURN_LEFT': 'Turn left',
      'SHARP_LEFT': 'Take a sharp left',
      'MAKE_UTURN': 'Make a U-turn',
      'ENTER_MOTORWAY': 'Enter the motorway',
      'ENTER_FREEWAY': 'Enter the freeway',
      'ENTER_HIGHWAY': 'Enter the highway',
      'TAKE_EXIT': 'Take the exit',
      'MOTORWAY_EXIT_LEFT': 'Take the exit on the left',
      'MOTORWAY_EXIT_RIGHT': 'Take the exit on the right',
      'TAKE_FERRY': 'Take the ferry',
      'ROUNDABOUT_CROSS': 'Cross the roundabout',
      'ROUNDABOUT_RIGHT': 'At the roundabout, turn right',
      'ROUNDABOUT_LEFT': 'At the roundabout, turn left',
      'ROUNDABOUT_BACK': 'At the roundabout, go back',
      'TRY_MAKE_UTURN': 'Try to make a U-turn',
      'FOLLOW': 'Follow the road',
      'SWITCH_PARALLEL_ROAD': 'Switch to the parallel road',
      'SWITCH_MAIN_ROAD': 'Switch to the main road',
      'ENTRANCE_RAMP': 'Take the entrance ramp',
      'WAYPOINT_LEFT': 'Waypoint on the left',
      'WAYPOINT_RIGHT': 'Waypoint on the right',
      'WAYPOINT_REACHED': 'Waypoint reached',
    };
    
    return maneuverMap[maneuver] || maneuver.replace(/_/g, ' ').toLowerCase();
  }

  // Turn OSRM maneuvers into human-readable instructions
  private formatOsrmInstruction(step: any): string {
    const maneuver = step?.maneuver || {};
    const type: string = maneuver.type || '';
    const modifier: string = maneuver.modifier || '';
    const name: string = step?.name || '';

    const road = name && name !== '-' ? name : 'the road';
    const prettyModifier = modifier ? modifier.replace(/_/g, ' ') : '';

    switch (type) {
      case 'depart':
        return road !== 'the road' 
          ? `Head ${prettyModifier || 'along'} ${road}`.trim()
          : `Start and head ${prettyModifier || 'straight'}`.trim();

      case 'arrive':
        return 'You have arrived at your destination';

      case 'roundabout':
      case 'rotary': {
        const exit = maneuver.exit && Number.isFinite(maneuver.exit) ? `exit ${maneuver.exit}` : 'the exit';
        return `At the roundabout, take ${exit}${road !== 'the road' ? ` onto ${road}` : ''}`.trim();
      }

      case 'fork':
        if (modifier === 'left') return `Keep left to stay on ${road}`;
        if (modifier === 'right') return `Keep right to stay on ${road}`;
        return `Keep ${prettyModifier || 'straight'} on ${road}`.trim();

      case 'merge':
        return `Merge ${prettyModifier || ''} onto ${road}`.trim();

      case 'on ramp':
      case 'off ramp':
        return `Take the ramp ${prettyModifier || ''} onto ${road}`.trim();

      case 'turn':
      case 'continue':
      case 'new name':
        if (prettyModifier) {
          return `Turn ${prettyModifier} onto ${road}`.trim();
        }
        return `Continue on ${road}`;

      default:
        return road !== 'the road' ? `Continue on ${road}` : 'Continue towards your destination';
    }
  }
}

export const combinedRoutingService = new CombinedRoutingService();

export default function MapboxLocationPicker({ 
  onLocationSelect, 
  initialLocation, 
  initialAddress = '' 
}: MapboxLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  
  const [searchAddress, setSearchAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStyle, setActiveStyle] = useState<'streets' | 'satellite'>('satellite');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(initialLocation || null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

  // Fallback if no API key is provided
  if (!mapboxToken || mapboxToken === 'YOUR_MAPBOX_API_KEY_HERE') {
    return (
      <Card className="p-6 text-center">
        <div className="space-y-4">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">Mapbox API Key Required</h3>
            <p className="text-sm text-muted-foreground mt-2">
              To use the interactive map location picker, please add your Mapbox API key to the environment variables.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Add NEXT_PUBLIC_MAPBOX_API_KEY to your .env.local file
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-location">Manual Location Entry</Label>
            <Input
              id="manual-location"
              placeholder="Enter address or coordinates (e.g., Pizzaman Chickenman, Accra)"
              value={searchAddress}
              onChange={(e) => {
                const address = e.target.value;
                setSearchAddress(address);
                // Simple coordinate detection (lat, lng format)
                const coordMatch = address.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
                if (coordMatch) {
                  const lat = parseFloat(coordMatch[1]);
                  const lng = parseFloat(coordMatch[2]);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    onLocationSelect({ lat, lng, address });
                    return;
                  }
                }
                onLocationSelect({ lat: 0, lng: 0, address });
              }}
            />
          </div>
        </div>
      </Card>
    );
  }

  // Reverse geocode coordinates to get address
  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&country=gh`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name;
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, [mapboxToken]);

  // Update marker position
  const updateMarker = useCallback((lng: number, lat: number) => {
    if (!mapRef.current) {
      console.log('Map not ready for marker');
      return;
    }

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    try {
      // Create a simple red marker element
      const el = document.createElement('div');
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#ef4444'; // red-500
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      
      console.log('Creating marker at:', lng, lat);
      
      markerRef.current = new mapboxgl.Marker({ 
        element: el, 
        draggable: true 
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
        
      console.log('Marker created successfully');
        
      // Handle marker drag
      markerRef.current.on('dragend', async () => {
        const lngLat = markerRef.current!.getLngLat();
        console.log('Marker dragged to:', lngLat.lng, lngLat.lat);
        const address = await reverseGeocode(lngLat.lng, lngLat.lat);
        setSearchAddress(address);
        setCurrentLocation({ lat: lngLat.lat, lng: lngLat.lng });
        onLocationSelect({ lat: lngLat.lat, lng: lngLat.lng, address });
      });
    } catch (error) {
      console.error('Error creating marker:', error);
    }
  }, [reverseGeocode, onLocationSelect]);

  // Use Geoapify for superior geocoding, especially for Ghana businesses
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
    
    // Primary: Geoapify Geocoding (excellent for businesses in Ghana)
    if (geoapifyKey && geoapifyKey !== 'your_geoapify_api_key_here') {
      try {
        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&filter=countrycode:gh&limit=5&apiKey=${geoapifyKey}`
        );
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const [lng, lat] = feature.geometry.coordinates;
          const address = feature.properties.formatted || feature.properties.address_line1 || query;
          
          console.log('Geoapify found:', address, 'at', lat, lng);
          
          setCurrentLocation({ lat, lng });
          setSearchAddress(address);
          onLocationSelect({ lat, lng, address });
          
          if (mapRef.current) {
            mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
            updateMarker(lng, lat);
          }
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.log('Geoapify geocoding failed, trying fallback...', error);
      }
    }
    
    // Fallback to Mapbox if Geoapify fails or no key
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=gh&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;
        const address = feature.place_name;
        
        console.log('Mapbox fallback found:', address, 'at', lat, lng);
        
        setCurrentLocation({ lat, lng });
        setSearchAddress(address);
        onLocationSelect({ lat, lng, address });
        
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
          updateMarker(lng, lat);
        }
      } else {
        console.log('No results found for:', query);
      }
    } catch (error) {
      console.error('All geocoding services failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mapboxToken, onLocationSelect, updateMarker]);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await reverseGeocode(lng, lat);
          
          setCurrentLocation({ lat, lng });
          setSearchAddress(address);
          onLocationSelect({ lat, lng, address });
          
          if (mapRef.current) {
            mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
            updateMarker(lng, lat);
          }
          setIsLoading(false);
        },
        (error) => {
          let errorMessage = 'Unable to get your location';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          console.error('Geolocation error:', errorMessage, error);
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setIsLoading(false);
    }
  }, [reverseGeocode, onLocationSelect, updateMarker]);

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyles[activeStyle],
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [-0.1870, 5.6037], // Default to Accra
      zoom: currentLocation ? 16 : 12
    });

    mapRef.current = map;

    map.on('load', () => {
      // Add click handler for map
      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        const address = await reverseGeocode(lng, lat);
        
        setCurrentLocation({ lat, lng });
        setSearchAddress(address);
        onLocationSelect({ lat, lng, address });
        updateMarker(lng, lat);
      });

      // Initialize marker if we have a location
      if (currentLocation) {
        updateMarker(currentLocation.lng, currentLocation.lat);
      }
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      map.remove();
      mapRef.current = null;
    };
  }, [activeStyle, currentLocation, reverseGeocode, onLocationSelect, updateMarker]);

  // Switch map style
  const switchStyle = (newStyle: 'streets' | 'satellite') => {
    if (!mapRef.current) return;
    setActiveStyle(newStyle);
    mapRef.current.setStyle(mapStyles[newStyle]);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-green-900 mb-2">🚀 Enhanced Business Search with Geoapify</h4>
          <div className="text-sm text-green-800 space-y-2">
            <p><strong>Now using Geoapify:</strong> Much better at finding specific businesses like "Tanoso Pizza Man Chicken Man"!</p>
            <div className="bg-green-100 p-3 rounded-md">
              <p className="font-medium mb-1">🎯 Try searching for:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>"Pizza Man Chicken Man Tanoso"</strong> - Should find the exact business</li>
                <li><strong>"PureFM Patasi"</strong> - Radio station locations</li>
                <li><strong>"University of Ghana Legon"</strong> - Educational institutions</li>
                <li><strong>"Accra Mall"</strong> - Shopping centers</li>
              </ul>
            </div>
            <p className="text-xs"><strong>Backup:</strong> If search doesn't find exact location, drag the red pin to fine-tune position</p>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Search Address</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Try: Pizza Man Chicken Man Tanoso, PureFM Patasi, University of Ghana, etc."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchLocation(searchAddress);
                  }
                }}
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => searchLocation(searchAddress)}
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={getCurrentLocation}
              disabled={isLoading}
              title="Use my current location"
            >
              <Crosshair className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            🎯 Geoapify can find specific businesses! Try "Pizza Man Chicken Man Tanoso" or "PureFM Patasi" for exact locations.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Or Enter Coordinates Manually</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Latitude (e.g., 5.6037)"
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                if (!isNaN(lat) && currentLocation?.lng) {
                  const location = { lat, lng: currentLocation.lng };
                  setCurrentLocation(location);
                  onLocationSelect({ ...location, address: `${lat}, ${currentLocation.lng}` });
                  if (mapRef.current) {
                    mapRef.current.flyTo({ center: [currentLocation.lng, lat], zoom: 16 });
                    updateMarker(currentLocation.lng, lat);
                  }
                }
              }}
            />
            <Input
              placeholder="Longitude (e.g., -0.1870)"
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                if (!isNaN(lng) && currentLocation?.lat) {
                  const location = { lat: currentLocation.lat, lng };
                  setCurrentLocation(location);
                  onLocationSelect({ ...location, address: `${currentLocation.lat}, ${lng}` });
                  if (mapRef.current) {
                    mapRef.current.flyTo({ center: [lng, currentLocation.lat], zoom: 16 });
                    updateMarker(lng, currentLocation.lat);
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            📍 You can get coordinates from Google Maps: Right-click → "What's here?" → Copy coordinates
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Location on Map</Label>
        <Card>
          <CardContent className="p-0">
            <div className="relative w-full h-[400px]">
              <div ref={mapContainerRef} className="w-full h-full rounded-lg overflow-hidden" />
              
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
          </CardContent>
        </Card>
        <div className="flex items-center justify-between text-xs">
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Click on the map or drag the red pin to set the exact hostel location
          </p>
          {currentLocation ? (
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Pin placed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>No pin yet</span>
            </div>
          )}
        </div>
      </div>

      {currentLocation && (
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <div className="text-sm">
              <p className="font-medium">Selected Location:</p>
              <p className="text-muted-foreground">
                Latitude: {currentLocation.lat.toFixed(6)}, Longitude: {currentLocation.lng.toFixed(6)}
              </p>
              {searchAddress && (
                <p className="text-muted-foreground mt-1">{searchAddress}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
