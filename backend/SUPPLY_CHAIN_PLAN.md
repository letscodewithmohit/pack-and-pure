# Supply Chain Workflow Implementation Plan

## Goal
Update the existing backend to fully support the requested supply chain workflow while preserving the current modular architecture and existing code.

## Key enhancements
- Add vendor-facing purchase order APIs under `/vendor/orders`
- Add delivery tasks endpoints under `/delivery/tasks`
- Keep existing purchase request and hub inventory workflow, and map it to the new supply chain terms
- Add order creation alias `/orders/create` and set supply chain readiness markers
- Ensure COD restriction and wallet flows are handled cleanly
- Add Firebase FCM helper support and trigger notifications for new order, vendor purchase request, pickup assignment, delivery assignment, and order delivered

## Files to update
- `backend/app/routes/orderRoutes.js`
- `backend/app/routes/purchaseRequestRoutes.js`
- `backend/app/routes/index.js`
- `backend/app/controller/orderController.js`
- `backend/app/controller/purchaseRequestController.js`
- `backend/app/controller/pickupPartnerController.js`
- `backend/app/services/hubOrderOrchestrator.js`
- `backend/app/services/firebaseService.js`
- `backend/app/models/order.js`
- `backend/app/models/purchaseRequest.js`
- `backend/app/models/hubInventory.js`
- `backend/app/models/transaction.js` (if needed)
- `backend/app/models/notification.js` (if needed)

## Implementation approach
1. Add explicit vendor routes:
   - `GET /vendor/orders`
   - `POST /vendor/orders/:id/accept`
   - `POST /vendor/orders/:id/mark-ready`

2. Add delivery partner routes:
   - `GET /delivery/tasks`
   - `POST /delivery/:id/pickup`
   - `POST /delivery/:id/complete`

3. Add or expose backend supply chain status fields:
   - `order.supplyChainStatus` or similar for `READY_FOR_DELIVERY` / `WAITING_VENDOR`
   - Use existing `hubStatus` and `procurementRequired` to determine transitions

4. Ensure hub inventory is checked and reserved before vendor order creation:
   - Use `planHubFulfillment`, `reserveHubInventory`, `createAutoPurchaseRequests`
   - Set order status workflow accordingly

5. Add FCM support:
   - Extend `firebaseService` to send notifications via Firebase Admin messaging when configured
   - Trigger notifications in order, purchase request, and pickup partner lifecycle events

6. Preserve current admin and seller workflows while exposing additional partner APIs.

## Verification
- Run existing backend startup
- Test key APIs manually or with curl/postman:
  - `POST /api/orders/create`
  - `GET /api/vendor/orders`
  - `POST /api/vendor/orders/:id/accept`
  - `POST /api/vendor/orders/:id/mark-ready`
  - `GET /api/pickup-partner/my/assignments`
  - `POST /api/pickup-partner/my/assignments/:id/mark-picked`
  - `POST /api/pickup-partner/my/assignments/:id/mark-hub-delivered`
  - `GET /api/orders/available`
  - `PUT /api/orders/accept/:orderId`

- Confirm COD block logic works by creating order with COD and triggering cancel count >= 3
- Confirm wallet payment and transaction history are recorded
- Confirm hub inventory reservation and purchase request generation

## Notes
- The current backend already contains most supply chain concepts: hub inventory, purchase requests, pickup partner assignments, and delivery dispatch.
- The implementation will refine and expose these flows, rather than rebuild them from scratch.
