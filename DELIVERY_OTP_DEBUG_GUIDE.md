# Delivery OTP Display - Debug Guide

## Issue
Delivery OTP is not showing on the customer app's order detail page when the delivery partner generates it.

## Debug Logging Added

Comprehensive console logging has been added throughout the Socket.IO event flow to help identify the issue.

## How to Test

### 1. Open Customer App
1. Open the customer app in a browser
2. Open browser DevTools (F12) and go to Console tab
3. Navigate to an active order's detail page
4. Look for these logs:
   ```
   [DeliveryOtpDisplay] Setting up Socket.IO listeners for order {orderId}
   [DeliveryOtpDisplay] Socket connection status: true/false
   [DeliveryOtpDisplay] Socket ID: {socketId}
   [orderSocket] Creating new Socket.IO connection to: {url}
   [orderSocket] Socket connected, ID: {socketId}
   [orderSocket] Registering delivery:otp:generated listener
   [orderSocket] Registering delivery:otp:validated listener
   ```

### 2. Check Socket.IO Connection
In the browser console, verify:
- Socket is connected: Look for `[orderSocket] Socket connected`
- Customer joined rooms: Look for backend logs showing customer room join

### 3. Generate OTP from Delivery App
1. Open delivery app
2. Navigate to the order
3. Click "Generate OTP" button
4. Watch both browser consoles

### 4. Expected Logs

#### Backend (Node.js console):
```
[generateDeliveryOtp] Emitting delivery:otp:generated event: { orderId, otp, expiresAt, deliveryPersonNearby }
[generateDeliveryOtp] Customer ID: {customerId}
[generateDeliveryOtp] Order ID: {orderId}
[generateDeliveryOtp] Emitting to customer room: customer:{customerId}
[generateDeliveryOtp] Emitting to order room: order:{orderId}
[generateDeliveryOtp] Socket.IO events emitted successfully
```

#### Frontend (Browser console):
```
[orderSocket] delivery:otp:generated event received: { orderId, otp, expiresAt, deliveryPersonNearby }
[DeliveryOtpDisplay] Received delivery:otp:generated event: { orderId, otp, expiresAt, deliveryPersonNearby }
[DeliveryOtpDisplay] OTP matches current order, displaying OTP: {otp}
```

## Common Issues to Check

### Issue 1: Socket Not Connected
**Symptoms**: No `[orderSocket] Socket connected` log
**Solutions**:
- Check if auth token exists: `localStorage.getItem("auth_customer")`
- Check VITE_SOCKET_URL or VITE_API_URL in frontend/.env
- Check backend is running and Socket.IO is initialized

### Issue 2: Customer Not in Room
**Symptoms**: Backend emits event but frontend doesn't receive it
**Solutions**:
- Verify customer joins room: Look for `[SocketManager] Customer joined room: customer:{userId}`
- Verify order room join: Look for `[SocketManager] Socket {socketId} joined order room: order:{orderId}`
- Check if customer ID matches between backend emission and room join

### Issue 3: Wrong Order ID
**Symptoms**: Event received but log shows "OTP for different order"
**Solutions**:
- Verify orderId format matches between delivery app and customer app
- Check if order uses numeric ID vs string ID
- Ensure orderId parameter in URL matches order.orderId in database

### Issue 4: Event Not Emitted
**Symptoms**: No backend emission logs
**Solutions**:
- Check if OTP generation succeeded
- Check if order.customer._id exists
- Check if Socket.IO is initialized (getIO() doesn't throw error)

## Quick Verification Commands

### Check Socket.IO Connection (Browser Console)
```javascript
// Get socket instance
const socket = window.io?.sockets?.[0] || null;
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
console.log('Socket rooms:', socket?.rooms);
```

### Check Auth Token (Browser Console)
```javascript
console.log('Customer token:', localStorage.getItem('auth_customer'));
```

### Check Order ID (Browser Console)
```javascript
// On order detail page
const orderId = window.location.pathname.split('/').pop();
console.log('Current order ID:', orderId);
```

## Next Steps

1. **Run the test** following the steps above
2. **Collect logs** from both backend and frontend consoles
3. **Identify the break point** where the event flow stops
4. **Report findings** with the specific logs showing where it fails

## Files Modified

- `frontend/src/modules/customer/components/DeliveryOtpDisplay.jsx` - Added component-level logging
- `frontend/src/core/services/orderSocket.js` - Added Socket.IO service logging
- `backend/app/controller/deliveryController.js` - Added emission logging
- `backend/app/socket/socketManager.js` - Added connection and room join logging
