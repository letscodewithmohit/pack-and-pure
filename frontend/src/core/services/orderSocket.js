import { io } from "socket.io-client";

let socket = null;

function socketBaseUrl() {
  const env = import.meta.env.VITE_SOCKET_URL;
  if (env) return env.replace(/\/$/, "");
  const api = import.meta.env.VITE_API_URL || "http://localhost:7000/api";
  return api.replace(/\/api\/?$/, "");
}

/**
 * Singleton Socket.IO client with JWT auth.
 */
export function getOrderSocket(getToken) {
  const token = typeof getToken === "function" ? getToken() : getToken;
  if (!token) return null;

  if (!socket || !socket.connected) {
    socket = io(socketBaseUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectOrderSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinOrderRoom(orderId, getToken) {
  const s = getOrderSocket(getToken);
  if (!s || !orderId) return;
  s.emit("join_order", orderId);
}

export function leaveOrderRoom(orderId, getToken) {
  const s = getOrderSocket(getToken);
  if (!s || !orderId) return;
  s.emit("leave_order", orderId);
}

export function onOrderStatusUpdate(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order:status:update", handler);
  return () => s.off("order:status:update", handler);
}

export function onDeliveryBroadcast(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("delivery:broadcast", handler);
  return () => s.off("delivery:broadcast", handler);
}

export function onSellerOrderNew(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order:new", handler);
  return () => s.off("order:new", handler);
}

export function onCustomerOtp(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("order:otp", handler);
  return () => s.off("order:otp", handler);
}

export function onDeliveryOtpGenerated(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("delivery:otp:generated", handler);
  return () => s.off("delivery:otp:generated", handler);
}

export function onDeliveryOtpValidated(getToken, handler) {
  const s = getOrderSocket(getToken);
  if (!s || typeof handler !== "function") return () => {};
  s.on("delivery:otp:validated", handler);
  return () => s.off("delivery:otp:validated", handler);
}
