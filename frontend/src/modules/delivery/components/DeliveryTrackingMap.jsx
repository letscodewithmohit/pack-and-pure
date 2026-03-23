import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { deliveryApi } from "../services/deliveryApi";
import {
  getCachedDeliveryPartnerLocation,
  saveDeliveryPartnerLocation,
} from "../utils/deliveryLastLocation";

const libraries = ["geometry"];

// Container style will be 100% to fill parent
const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "200px",
};

/** GeoJSON [lng, lat] → { lat, lng } */
function coordsToLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function destinationForPhase(order, phase) {
  if (phase === "pickup") {
    return coordsToLatLng(order?.seller?.location?.coordinates);
  }
  const loc = order?.address?.location;
  if (
    loc &&
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

/**
 * Live tracking map: rider + one road route from GET /orders/workflow/:orderId/route.
 * Uses a single native google.maps.Polyline (ref) so the React wrapper cannot leave
 * duplicate overlays. No geodesic rider→dest line — that caused a second “straight” path.
 */
const DeliveryTrackingMapComponent = ({ orderId, phase, order }) => {
  const mapRef = useRef(null);
  const routePolylineRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [rider, setRider] = useState(() => {
    const c = getCachedDeliveryPartnerLocation();
    return c ? { lat: c.lat, lng: c.lng } : null;
  });
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const lastFetchRef = useRef(0);
  const watchIdRef = useRef(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "delivery-tracking-map",
    googleMapsApiKey: apiKey,
    libraries,
  });

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const heading = pos.coords.heading;
        const speed = pos.coords.speed;
        
        saveDeliveryPartnerLocation(lat, lng);
        setRider({ lat, lng });
        
        // Send location update to backend
        deliveryApi.postLocation({
          lat,
          lng,
          accuracy,
          heading,
          speed,
          orderId: orderId || null,
        }).catch((err) => {
          console.error("Failed to send location update:", err);
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [orderId]);

  const fetchRoute = useCallback(async () => {
    if (!orderId || !rider) return;
    const now = Date.now();
    // Increase throttle to 5 minutes (300000ms) since route is cached in Firebase
    if (lastFetchRef.current && now - lastFetchRef.current < 300000) return;
    lastFetchRef.current = now;
    setRouteLoading(true);
    try {
      const res = await deliveryApi.getOrderRoute(orderId, {
        phase,
        originLat: rider.lat,
        originLng: rider.lng,
        _t: now,
      });
      if (res.data?.success) {
        setRouteData(res.data.result || res.data.data || null);
      }
    } catch {
      setRouteData((prev) => prev || { degraded: true });
    } finally {
      setRouteLoading(false);
    }
  }, [orderId, phase, rider]);

  useEffect(() => {
    if (!rider) return undefined;
    fetchRoute();
    // Increase interval to 5 minutes (300000ms) since route doesn't change frequently
    const iv = setInterval(fetchRoute, 300000);
    return () => clearInterval(iv);
  }, [rider, fetchRoute, phase, orderId]);

  const dest = useMemo(() => destinationForPhase(order, phase), [order, phase]);

  const decodedPath = useMemo(() => {
    const encoded = routeData?.polyline;
    if (!encoded || !isLoaded || !window.google?.maps?.geometry?.encoding) {
      return null;
    }
    try {
      return window.google.maps.geometry.encoding.decodePath(encoded);
    } catch {
      return null;
    }
  }, [routeData?.polyline, isLoaded]);

  /** Only the road polyline from the API — never a 2-point geodesic “fallback”. */
  const linePath = useMemo(() => {
    if (decodedPath?.length) return decodedPath;
    return [];
  }, [decodedPath]);

  const mapCenter = useMemo(() => {
    if (rider) return rider;
    if (dest) return dest;
    return { lat: 20.5937, lng: 78.9629 };
  }, [rider, dest]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  const strokeColor = "#2563eb";

  useEffect(() => {
    if (!isLoaded || !mapInstance || !window.google?.maps) return undefined;

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    if (!linePath?.length) return undefined;

    const pl = new window.google.maps.Polyline({
      path: linePath,
      strokeColor,
      strokeOpacity: 0.95,
      strokeWeight: 4,
      map: mapInstance,
    });
    routePolylineRef.current = pl;

    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
    };
  }, [isLoaded, mapInstance, linePath, strokeColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    try {
      const bounds = new window.google.maps.LatLngBounds();
      if (linePath?.length) {
        linePath.forEach((p) => bounds.extend(p));
      }
      if (rider) bounds.extend(rider);
      if (dest) bounds.extend(dest);
      map.fitBounds(bounds, 32);
    } catch {
      /* ignore */
    }
  }, [linePath, rider, dest]);

  // Add resize observer to handle dynamic height changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return undefined;

    const handleResize = () => {
      window.google.maps.event.trigger(map, 'resize');
      // Re-fit bounds after resize
      try {
        const bounds = new window.google.maps.LatLngBounds();
        if (linePath?.length) {
          linePath.forEach((p) => bounds.extend(p));
        }
        if (rider) bounds.extend(rider);
        if (dest) bounds.extend(dest);
        map.fitBounds(bounds, 32);
      } catch {
        /* ignore */
      }
    };

    // Listen for window resize events
    window.addEventListener('resize', handleResize);
    
    // Create a resize observer for the map container
    const mapContainer = map.getDiv()?.parentElement;
    let resizeObserver;
    
    if (mapContainer && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(mapContainer);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [linePath, rider, dest]);

  if (!apiKey) {
    return (
      <div className="relative w-full h-48 bg-slate-100 rounded-2xl flex items-center justify-center text-center px-4">
        <p className="text-xs text-slate-500">
          Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to show live
          tracking.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="relative w-full h-48 bg-rose-50 rounded-2xl flex items-center justify-center text-xs text-rose-700 px-4">
        Map failed to load. Check the API key and billing.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative w-full h-48 bg-slate-50 rounded-2xl flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        {rider && (
          <Marker
            position={rider}
            title="Your location"
            icon="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
          />
        )}
        {dest && (
          <Marker
            position={dest}
            title={phase === "pickup" ? "Pickup (store)" : "Drop (customer)"}
            icon={
              phase === "pickup"
                ? "https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                : "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
            }
          />
        )}
      </GoogleMap>
      <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur px-2 py-1 rounded-md text-[10px] text-slate-600 font-bold border border-slate-200 shadow-sm">
        {routeLoading ? "Updating route…" : "Tracking View"}
      </div>
      {routeData?.degraded && (
        <div className="absolute top-2 left-2 bg-amber-50/95 text-amber-900 text-[10px] px-2 py-1 rounded border border-amber-200 max-w-[85%] leading-snug">
          Route unavailable. Add{" "}
          <span className="font-mono">GOOGLE_MAPS_API_KEY</span> to the{" "}
          <strong>backend</strong> <span className="font-mono">.env</span>, enable
          Directions API + billing, then restart the API server.
        </div>
      )}
    </div>
  );
}


// Memoized export to prevent unnecessary re-renders and reduce Google Maps API costs
const DeliveryTrackingMap = memo(DeliveryTrackingMapComponent, (prevProps, nextProps) => {
  // Only re-render if these props actually change
  const destPrev = destinationForPhase(prevProps.order, prevProps.phase);
  const destNext = destinationForPhase(nextProps.order, nextProps.phase);
  
  return (
    prevProps.orderId === nextProps.orderId &&
    prevProps.phase === nextProps.phase &&
    destPrev?.lat === destNext?.lat &&
    destPrev?.lng === destNext?.lng
  );
});

DeliveryTrackingMap.displayName = 'DeliveryTrackingMap';

export default DeliveryTrackingMap;
