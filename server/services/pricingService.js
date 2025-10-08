// Plik server/services/pricingService.js
const db = require('../db/index.js');

// Stałe dla typów stawek i poziomów usług
const RATE_TYPES = {
  COLLECTION: 'collection',
  DELIVERY: 'delivery',
};

const SERVICE_LEVELS = {
  SATURDAY: 'D',
  STANDARD: 'S',
};

/**
 * Finds a postcode zone that matches a given postcode.
 * @param {string} postcode - The postcode to match.
 * @returns {Promise<object|null>} The matching zone object or null.
 */
const findZoneForPostcode = async (postcode) => {
  if (!postcode || typeof postcode !== 'string') return null;
  
  try {
    const { rows } = await db.query(
      `SELECT * FROM postcode_zones WHERE EXISTS (
        SELECT 1 FROM unnest(postcode_patterns) AS pattern
        WHERE $1 ILIKE pattern
      ) LIMIT 1`,
      [postcode]
    );
    console.log(`Zone search for postcode ${postcode}: found ${rows.length} zones`);
    return rows[0] || null;
  } catch (error) {
    console.error(`Error finding zone for postcode ${postcode}:`, error.message);
    return null;
  }
};

/**
 * Finds the rate for a single leg of a journey (collection or delivery).
 * @param {number} rateCardId - The ID of the rate card.
 * @param {string} rateType - 'collection' or 'delivery'.
 * @param {number} zoneId - The ID of the zone for which the rate is being calculated.
 * @param {object} order - The order object containing service level and pallet details.
 * @returns {Promise<{total: number, breakdown: object}>} The calculated price for the leg with breakdown.
 */
const findRateForLeg = async (rateCardId, rateType, zoneId, order) => {
  console.log(`\n=== findRateForLeg START ===`);
  console.log(`Params: rateCardId=${rateCardId}, rateType=${rateType}, zoneId=${zoneId}, serviceLevel=${order.service_level}`);
  
  try {
    const query = `
      SELECT * FROM rate_entries
      WHERE rate_card_id = $1 AND rate_type = $2 AND zone_id = $3 AND service_level = $4
    `;
    console.log(`Query: ${query}`);
    
    const { rows } = await db.query(query, [rateCardId, rateType, zoneId, order.service_level]);
    console.log(`Found ${rows.length} rate entries in database`);

    const priceBreakdown = {};
    if (rows.length === 0) {
      console.warn(`❌ No rate entries found for the given criteria`);
      return { total: 0, breakdown: {} };
    }
    
    const rate = rows[0];
    console.log(`Rate entry found:`, {
      id: rate.id,
      price_full_1: rate.price_full_1,
      price_half: rate.price_half,
      price_quarter: rate.price_quarter,
      price_micro: rate.price_micro
    });

    const pallets = order.cargo_details?.pallets || {};
    console.log(`Pallets from order:`, JSON.stringify(pallets, null, 2));

    // Zmieniamy logikę, aby zawsze liczyć na podstawie 'spaces'
    const palletPriceMap = {
      micro: 'price_micro', 
      quarter: 'price_quarter', 
      half: 'price_half', 
      plus_half: 'price_half_plus',
      full: 'price_full_1', // Dla pełnych palet używamy stawki za jedną paletę jako bazę
    };

    // Calculate prices for each pallet type
    for (const type in palletPriceMap) {
      // ZAWSZE używamy 'spaces' do obliczeń
      const spaces = Number(pallets[type]?.spaces || 0);
      if (spaces > 0) {
        const priceColumn = palletPriceMap[type];
        const price = parseFloat(rate[priceColumn]) || 0;
        priceBreakdown[type] = price * spaces;
        
        console.log(`📦 ${type}: ${spaces} spaces x £${price} = £${priceBreakdown[type]}`);
      }
    }

    const total = Object.values(priceBreakdown).reduce((sum, price) => sum + price, 0);
    console.log(`💰 Total for leg: £${total}`);
    console.log(`=== findRateForLeg END ===\n`);

    return { total, breakdown: priceBreakdown };
  } catch (error) {
    console.error(`❌ Error in findRateForLeg:`, { 
      rateCardId, 
      rateType, 
      zoneId, 
      serviceLevel: order.service_level, 
      error: error.message 
    });
  }
  return { total: 0, breakdown: {} };
};

/**
 * Calculates the price for a given order based on client's rate card.
 * @param {object} order - The full order object.
 * @returns {Promise<{total: number, breakdown: object}|null>} The calculated price with breakdown or null.
 */
const calculateOrderPrice = async (order) => {
  console.log(`\n🎯 STARTING PRICE CALCULATION FOR ORDER ${order.id || 'new'}`);
  console.log(`Order details:`, {
    customer_id: order.customer_id,
    service_level: order.service_level,
    sender_postcode: order.sender_details?.postCode,
    recipient_postcode: order.recipient_details?.postCode,
    pallets: order.cargo_details?.pallets
  });

  if (!order.customer_id || !order.sender_details?.postCode || !order.recipient_details?.postCode) {
    console.warn(`❌ Order ${order.id || 'new'} is missing required fields`);
    return null;
  }

  // 1. Find source and destination zones
  console.log(`🔍 Finding zones...`);
  const sourceZone = await findZoneForPostcode(order.sender_details.postCode);
  const destinationZone = await findZoneForPostcode(order.recipient_details.postCode);

  console.log(`Zones found:`, {
    sourceZone: sourceZone ? `${sourceZone.zone_name} (ID: ${sourceZone.id}, is_home_zone: ${sourceZone.is_home_zone})` : 'NOT FOUND',
    destinationZone: destinationZone ? `${destinationZone.zone_name} (ID: ${destinationZone.id}, is_home_zone: ${destinationZone.is_home_zone})` : 'NOT FOUND'
  });

  if (!sourceZone || !destinationZone) {
    console.warn(`❌ Could not determine zones for order ${order.id || 'new'}`);
    return null;
  }

  // 2. Find the rate card assigned to the client
  console.log(`🔍 Finding rate card for customer ${order.customer_id}...`);
  const { rows: rateCards } = await db.query(
    'SELECT rate_card_id as id FROM customer_rate_card_assignments WHERE customer_id = $1 LIMIT 1',
    [order.customer_id]
  );
  
  console.log(`Rate cards found: ${rateCards.length}`);
  if (rateCards.length === 0) {
    console.warn(`❌ No rate card assigned to client ${order.customer_id}`);
    return null;
  }
  
  const rateCardId = rateCards[0].id;
  console.log(`✅ Using rate card ID: ${rateCardId}`);

  // 3. Calculate price based on the scenario
  let finalPrice = { total: 0, breakdown: {} };
  const isStandardCollection = sourceZone.is_home_zone && !destinationZone.is_home_zone;
  const isStandardDelivery = !sourceZone.is_home_zone && destinationZone.is_home_zone;
  const isPointToPoint = !sourceZone.is_home_zone && !destinationZone.is_home_zone;
  const isLocal = sourceZone.is_home_zone && destinationZone.is_home_zone;

  console.log(`📊 Scenario analysis:`, {
    isStandardCollection,
    isStandardDelivery, 
    isPointToPoint,
    isLocal
  });

  if (isStandardCollection) {
    console.log(`🚚 Scenario: STANDARD COLLECTION`);
    const legPrice = await findRateForLeg(rateCardId, RATE_TYPES.DELIVERY, destinationZone.id, order);
    if (legPrice.total === 0) console.warn(`⚠️ No rate entry for delivery to zone '${destinationZone.zone_name}'`);
    finalPrice = legPrice;
  } else if (isStandardDelivery) {
    console.log(`🚛 Scenario: STANDARD DELIVERY`);
    const legPrice = await findRateForLeg(rateCardId, RATE_TYPES.COLLECTION, sourceZone.id, order);
    if (legPrice.total === 0) console.warn(`⚠️ No rate entry for collection from zone '${sourceZone.zone_name}'`);
    finalPrice = legPrice;
  } else if (isLocal) {
    console.log(`🏠 Scenario: LOCAL DELIVERY`);
    const legPrice = await findRateForLeg(rateCardId, RATE_TYPES.DELIVERY, destinationZone.id, order);
    if (legPrice.total === 0) console.warn(`⚠️ No rate entry for local delivery to zone '${destinationZone.zone_name}'`);
    finalPrice = legPrice;
  } else if (isPointToPoint) {
    console.log(`🔀 Scenario: POINT TO POINT`);
    const collectionPrice = await findRateForLeg(rateCardId, RATE_TYPES.COLLECTION, sourceZone.id, order);
    const deliveryPrice = await findRateForLeg(rateCardId, RATE_TYPES.DELIVERY, destinationZone.id, order);

    const combinedBreakdown = { ...collectionPrice.breakdown };
    for (const type in deliveryPrice.breakdown) {
      combinedBreakdown[type] = (combinedBreakdown[type] || 0) + deliveryPrice.breakdown[type];
    }

    finalPrice = {
      total: collectionPrice.total + deliveryPrice.total,
      breakdown: combinedBreakdown,
    };
  }

  console.log(`📦 Final price before surcharges: £${finalPrice.total}`);
  console.log(`Breakdown:`, JSON.stringify(finalPrice.breakdown, null, 2));

  // 4. Add surcharges (e.g., for Saturday service)
  if (order.service_level === SERVICE_LEVELS.SATURDAY) {
    console.log(`➕ Adding Saturday surcharge: £40.00`);
    finalPrice.total += 40.00;
    finalPrice.breakdown.surcharge = (finalPrice.breakdown.surcharge || 0) + 40.00;
  }

  if (finalPrice.total <= 0) {
    console.warn(`❌ Final price is £0 or negative: £${finalPrice.total}`);
    return null;
  }

  const result = {
    total: parseFloat(finalPrice.total.toFixed(2)),
    breakdown: finalPrice.breakdown,
    currency: 'GBP',
  };

  console.log(`✅ FINAL RESULT: £${result.total}`);
  console.log(`FINAL BREAKDOWN:`, JSON.stringify(result.breakdown, null, 2));
  console.log(`🎯 PRICE CALCULATION COMPLETE\n`);

  return result;
};

module.exports = { calculateOrderPrice };