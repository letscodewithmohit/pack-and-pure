import fs from 'fs';

const filePath = 'c:/Appzeto-Quick-Commerce/backend/app/controller/orderController.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Selection
content = content.replace(
  '.select("_id purchasePrice salePrice price")',
  '.select("_id purchasePrice salePrice price gstRate")'
);

// 2. Update Normalization
const normalizationOld = `        normalizedItems.push({
          ...item,
          product: String(productData._id),
          purchasePrice: productData.purchasePrice || 0,
          // Re-validate price from DB if needed, but for now we trust the payload's price or fallback
          price: item.price || productData.salePrice || productData.price,
        });`;

const normalizationNew = `        normalizedItems.push({
          ...item,
          product: String(productData._id),
          purchasePrice: productData.purchasePrice || 0,
          // Re-validate price from DB if needed, but for now we trust the payload's price or fallback
          price: item.price || productData.salePrice || productData.price,
          gstRate: productData.gstRate || 0,
        });`;

content = content.replace(normalizationOld, normalizationNew);

// 3. Update Pricing Logic
const pricingOld = `      // Distance-based delivery fee
      validatedPricing.deliveryFee = calc.deliveryFee;
      validatedPricing.distanceKm = calc.distanceKm;
      validatedPricing.platformFee = calc.platformFee;

      // Free delivery: if subtotal >= threshold, waive the delivery fee
      if ((validatedPricing.subtotal || 0) >= calc.freeDeliveryThreshold) {
        validatedPricing.deliveryFee = 0;
      }

      // GST on (Subtotal - Discount + Delivery + Platform)
      const taxableAmount = (validatedPricing.subtotal || 0) - (validatedPricing.discount || 0) + validatedPricing.deliveryFee + validatedPricing.platformFee;
      validatedPricing.gst = Math.round(taxableAmount * (calc.gstPercentage / 100));

      // Final Total Recalculation
      validatedPricing.total = (validatedPricing.subtotal || 0) 
        - (validatedPricing.discount || 0)
        + validatedPricing.deliveryFee 
        + validatedPricing.platformFee
        + validatedPricing.gst 
        + (validatedPricing.tip || 0);`;

const pricingNew = `      // Recalculate Subtotal and calculate GST per item
      let calculatedSubtotal = 0;
      let totalGstAmount = 0;

      for (const item of orderItems) {
        const itemSubtotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
        calculatedSubtotal += itemSubtotal;
        
        // Per-item GST
        const itemGstRate = Number(item.gstRate || 0);
        const itemGstAmount = Math.round(itemSubtotal * (itemGstRate / 100));
        
        item.gstRate = itemGstRate;
        item.gstAmount = itemGstAmount;
        totalGstAmount += itemGstAmount;
      }

      validatedPricing.subtotal = calculatedSubtotal;
      validatedPricing.deliveryFee = calc.deliveryFee;
      validatedPricing.distanceKm = calc.distanceKm;
      validatedPricing.platformFee = calc.platformFee;

      // Free delivery: if subtotal >= threshold, waive the delivery fee
      if ((validatedPricing.subtotal || 0) >= calc.freeDeliveryThreshold) {
        validatedPricing.deliveryFee = 0;
      }

      // GST on platform fee and delivery fee (using global rate)
      const serviceFees = validatedPricing.deliveryFee + validatedPricing.platformFee;
      const serviceGst = Math.round(serviceFees * (calc.gstPercentage / 100));
      
      validatedPricing.gst = totalGstAmount + serviceGst;

      // Final Total Recalculation
      validatedPricing.total = (validatedPricing.subtotal || 0) 
        - (validatedPricing.discount || 0)
        + validatedPricing.deliveryFee 
        + validatedPricing.platformFee
        + validatedPricing.gst 
        + (validatedPricing.tip || 0);`;

content = content.replace(pricingOld, pricingNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log("OrderController updated successfully");
