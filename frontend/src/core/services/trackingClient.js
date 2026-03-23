import { onValue, ref } from "firebase/database";
import { getRealtimeDb } from "../firebase/client";

/**
 * Live rider position: prefers `deliveryLocations/{orderId}/{deliveryBoyId}` (v2),
 * falls back to `orders/{orderId}/rider`.
 */
export const subscribeToOrderLocation = (orderId, handler) => {
  if (!orderId || typeof handler !== "function") return () => {};

  const db = getRealtimeDb();
  if (!db) {
    console.warn(
      "[tracking] Realtime DB not available; location subscription is disabled.",
    );
    return () => {};
  }

  console.log(`[tracking] Subscribing to location for order ${orderId}`);
  console.log(`[tracking] Path 1: /deliveryLocations/${orderId}`);
  console.log(`[tracking] Path 2: /orders/${orderId}/rider`);

  const r1 = ref(db, `/deliveryLocations/${orderId}`);
  const off1 = onValue(r1, (snap) => {
    const val = snap.val();
    console.log(`[tracking] deliveryLocations snapshot for ${orderId}:`, val);
    if (!val || typeof val !== "object") {
      console.log(`[tracking] No valid data at /deliveryLocations/${orderId}`);
      return;
    }
    for (const k of Object.keys(val)) {
      const p = val[k];
      console.log(`[tracking] Checking delivery location key ${k}:`, p);
      if (
        p &&
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng)
      ) {
        console.log(`[tracking] ✓ Valid location found:`, { lat: p.lat, lng: p.lng });
        handler({
          lat: p.lat,
          lng: p.lng,
          lastUpdatedAt: p.timestamp,
        });
        return;
      }
    }
    console.log(`[tracking] No valid location coordinates found in deliveryLocations`);
  });

  const r2 = ref(db, `/orders/${orderId}/rider`);
  const off2 = onValue(r2, (snap) => {
    const val = snap.val();
    console.log(`[tracking] orders/rider snapshot for ${orderId}:`, val);
    if (val) {
      console.log(`[tracking] ✓ Location from orders/rider:`, val);
      handler(val);
    } else {
      console.log(`[tracking] No data at /orders/${orderId}/rider`);
    }
  });

  return () => {
    console.log(`[tracking] Unsubscribing from location for order ${orderId}`);
    off1();
    off2();
  };
};

export const subscribeToOrderTrail = (orderId, handler) => {
  if (!orderId || typeof handler !== "function") return () => {};

  const db = getRealtimeDb();
  if (!db) {
    console.warn(
      "[tracking] Realtime DB not available; trail subscription is disabled.",
    );
    return () => {};
  }

  const r = ref(db, `/orders/${orderId}/trail`);
  const off = onValue(r, (snap) => {
    const raw = snap.val() || {};
    const points = Object.values(raw);
    handler(points);
  });

  return () => off();
};

export const subscribeToOrderRoute = (orderId, handler) => {
  if (!orderId || typeof handler !== "function") return () => {};

  const db = getRealtimeDb();
  if (!db) {
    console.warn(
      "[tracking] Realtime DB not available; route subscription is disabled.",
    );
    return () => {};
  }

  console.log(`[tracking] Subscribing to route for order ${orderId} at path /orders/${orderId}/route`);
  const r = ref(db, `/orders/${orderId}/route`);
  const off = onValue(r, (snap) => {
    const routeData = snap.val();
    if (routeData && routeData.polyline) {
      console.log(`[tracking] ✓ Route data received for order ${orderId}:`, {
        polylineLength: routeData.polyline?.length,
        distance: routeData.distance,
        duration: routeData.duration,
        cachedAt: routeData.cachedAt,
      });
      handler(routeData);
    } else {
      console.log(`[tracking] No route data available for order ${orderId}`);
    }
  });

  return () => {
    console.log(`[tracking] Unsubscribing from route for order ${orderId}`);
    off();
  };
};
