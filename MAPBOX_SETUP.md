# Mapbox Integration Setup

## Overview
The HostelHQ platform uses Mapbox for interactive map location picker that allows agents and admins to accurately capture hostel locations with precise latitude and longitude coordinates.

## Features
- **Address Search**: Search for locations using Mapbox Geocoding API
- **Interactive Map**: Click or drag pins to set exact locations
- **Current Location**: Use device GPS to get current location
- **Automatic Geocoding**: Convert addresses to coordinates and vice versa
- **Ghana-focused**: Restricted to Ghana for better search results
- **Map Styles**: Switch between street and satellite views
- **Draggable Markers**: Fine-tune location by dragging the pin

## Setup Instructions

### 1. Get Mapbox API Key
1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Sign up or log in to your account
3. Go to "Access tokens" section
4. Create a new token or use the default public token
5. Copy the access token

### 2. Configure Environment Variables
Add the following to your `.env.local` file:
```
NEXT_PUBLIC_MAPBOX_API_KEY="your_actual_mapbox_api_key_here"
```

### 3. Token Scopes (Recommended)
For security, configure your token with appropriate scopes:
- **Public scopes**: 
  - `styles:read` (for map styles)
  - `fonts:read` (for map fonts)
  - `datasets:read` (for geocoding)
- **URL restrictions**: Add your domains for production use

## How It Works

### For Agents/Admins
1. **Search Address**: Type "Pizzaman Chickenman, Accra" in the search box
2. **Select from Suggestions**: Choose from autocomplete suggestions
3. **Fine-tune Location**: Drag the pin to the exact hostel entrance
4. **Auto-populate**: Coordinates automatically fill in the form

### Data Storage
The system stores:
- `coordinates`: `{ lat: 5.6037, lng: -0.1870 }`
- `location`: Full address string
- `gpsLocation`: Coordinate string for backward compatibility

### For Students
When students tap "Get Directions" or view hostel location:
- **Accurate Navigation**: GPS apps receive precise coordinates
- **Exact Location**: Pin shows hostel entrance, not general area
- **Reliable Directions**: Works with Google Maps, Apple Maps, etc.

## Benefits

### Before (Text Input)
- ❌ "Pizzaman Chickenman" → GPS doesn't understand
- ❌ "5.6037, -0.1870" → Students can't easily use
- ❌ Approximate locations → Students get lost

### After (Map Picker)
- ✅ Exact coordinates captured during onboarding
- ✅ Students get precise directions
- ✅ One-tap navigation to hostel entrance
- ✅ Consistent, reliable location data

## Fallback Mode
If no API key is provided, the system shows a manual input field where users can enter addresses or coordinates directly.

## Cost Considerations
- Mapbox has generous free tier: 50,000 map loads/month
- Geocoding API: 100,000 requests/month free
- After free tier: $5 per 1,000 additional map loads
- Much more cost-effective than Google Maps

For typical usage (100 hostels/month), it's completely free.

## Testing
1. Add API key to `.env.local`
2. Restart development server
3. Go to `/agent/upload` or `/admin/upload`
4. Test the map interface in step 4 (Photos & Location)
5. Search for "University of Ghana" to test
6. Drag pin and verify coordinates update

## Troubleshooting
- **Map not loading**: Check API key in environment variables
- **Search not working**: Verify Mapbox token has geocoding permissions
- **CORS errors**: Check token URL restrictions in Mapbox account
- **Quota exceeded**: Monitor usage in Mapbox account dashboard
- **Styles not loading**: Ensure token has `styles:read` scope
