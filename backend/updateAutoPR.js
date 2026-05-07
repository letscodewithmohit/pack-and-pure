import fs from 'fs';

const filePath = 'c:/Appzeto-Quick-Commerce/backend/app/services/hubOrderOrchestrator.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update selection in selectCheapestSellers (already done by previous step)

// 2. Update enrichedShortages mapping logic
// Case 1: Direct vendor mapping
const directOld = `        vendorUnitCost: selfCost,
        vendorQuotedPrice: selfCost,
        pricingStrategy: "direct_vendor_mapping",`;
const directNew = `        vendorUnitCost: selfCost,
        vendorQuotedPrice: selfCost,
        pricingStrategy: "direct_vendor_mapping",
        gstRate: baseProduct?.gstRate || 0,
        gstAmount: Math.round(selfCost * (item.shortageQty || 0) * ((baseProduct?.gstRate || 0) / 100)),`;

content = content.replace(directOld, directNew);

// Case 2: Fallback catalog price
const fallbackOld = `          vendorUnitCost: normalizeMoney(effectiveCatalogPrice(baseProduct)),
          vendorQuotedPrice: normalizeMoney(effectiveCatalogPrice(baseProduct)),
          pricingStrategy: "fallback_catalog_price",`;
const fallbackNew = `          vendorUnitCost: normalizeMoney(effectiveCatalogPrice(baseProduct)),
          vendorQuotedPrice: normalizeMoney(effectiveCatalogPrice(baseProduct)),
          pricingStrategy: "fallback_catalog_price",
          gstRate: baseProduct?.gstRate || 0,
          gstAmount: Math.round(normalizeMoney(effectiveCatalogPrice(baseProduct)) * (item.shortageQty || 0) * ((baseProduct?.gstRate || 0) / 100)),`;

content = content.replace(fallbackOld, fallbackNew);

// Case 3: Selection result
const selectOld = `            vendorUnitCost: sel.vendorUnitCost,
            vendorQuotedPrice: sel.vendorQuotedPrice,
            pricingStrategy: sel.pricingStrategy,`;
const selectNew = `            vendorUnitCost: sel.vendorUnitCost,
            vendorQuotedPrice: sel.vendorQuotedPrice,
            pricingStrategy: sel.pricingStrategy,
            gstRate: sel.gstRate || 0,
            gstAmount: Math.round(sel.vendorUnitCost * (sel.qtyToProcure || 0) * ((sel.gstRate || 0) / 100)),`;

content = content.replace(selectOld, selectNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log("hubOrderOrchestrator updated successfully");
