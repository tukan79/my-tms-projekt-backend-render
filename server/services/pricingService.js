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
 * @returns {Promise<Array>} An array of calculated prices for each leg with breakdown.
 */
const findRateForLeg = async (rateCardId, rateTypes, zoneIds, order) => {
  console.log(`\n=== findRateForLeg START ===`);
  console.log(`Params: rateCardId=${rateCardId}, rateTypes=${JSON.stringify(rateTypes)}, zoneIds=${JSON.stringify(zoneIds)}, serviceLevel=${order.service_level}`);
  
  try {
    const query = `
      SELECT * FROM rate_entries
      WHERE rate_card_id = $1 AND rate_type = ANY($2::varchar[]) AND zone_id = ANY($3::int[]) AND service_level = $4
    `;
    console.log(`Query: ${query}`);
    
    const { rows } = await db.query(query, [rateCardId, rateTypes, zoneIds, order.service_level]);
    console.log(`Found ${rows.length} rate entries in database`);

    if (rows.length === 0) {
      console.warn(`❌ No rate entries found for the given criteria`);
      return [];
    }

    const results = rows.map(rate => {
      const priceBreakdown = {};
      console.log(`Rate entry found:`, {
        id: rate.id,
        rate_type: rate.rate_type,
        zone_id: rate.zone_id,
        price_full_1: rate.price_full_1,
        price_half_plus: rate.price_half_plus,
        price_half: rate.price_half,
        price_quarter: rate.price_quarter,
        price_micro: rate.price_micro
      });

      // Poprawka: Logika musi obsługiwać tablicę palet, a nie obiekt.
      const pallets = Array.isArray(order.cargo_details?.pallets) ? order.cargo_details.pallets : [];
      console.log(`Pallets from order:`, JSON.stringify(pallets, null, 2));

      const columnMapping = {
        'micro': 'price_micro',
        'quarter': 'price_quarter',
        'half': 'price_half',
        'half_plus': 'price_half_plus',
      };

      pallets.forEach(pallet => {
        const { type, quantity, spaces } = pallet;
        const priceColumn = type === 'full' ? `price_full_${quantity}` : columnMapping[type];
        const priceValue = parseFloat(rate[priceColumn]) || 0;

        if (priceValue > 0) {
          // Dla palet niepełnych, cena jest za miejsce; dla pełnych, jest to cena ryczałtowa za daną ilość.
          const cost = type === 'full' ? priceValue : priceValue * (Number(spaces) || 0);
          priceBreakdown[type] = (priceBreakdown[type] || 0) + cost; // Poprawka: Sumujemy koszty dla tego samego typu palety
          console.log(`📦 ${quantity}x ${type} pallet(s) occupying ${spaces} space(s) = £${cost.toFixed(2)}`);
        } else {
          const errorMessage = `Price for ${quantity}x '${type}' pallet(s) is missing or zero in the rate card for zone ID ${rate.zone_id} and service level ${order.service_level}.`;
          console.error(`❌ ${errorMessage}`);
          throw new Error(errorMessage);
        }
      });

      const total = Object.values(priceBreakdown).reduce((sum, price) => sum + price, 0);
      console.log(`💰 Total for leg (type: ${rate.rate_type}, zone: ${rate.zone_id}): £${total.toFixed(2)}`);
      
      return { total, breakdown: priceBreakdown, rate_type: rate.rate_type };
    });
    console.log(`=== findRateForLeg END ===\n`);

    return results;
  } catch (error) {
    console.error(`❌ Error in findRateForLeg:`, { 
      rateCardId, 
      rateTypes, 
      zoneIds, 
      serviceLevel: order.service_level, 
      error: error.message 
    });
  }
  return [];
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
  let basePriceResult = { total: 0, breakdown: {} };
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
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.DELIVERY], [destinationZone.id], order);
    if (legPrices.length === 0 || legPrices[0].total === 0) console.warn(`⚠️ No rate entry for delivery to zone '${destinationZone.zone_name}'`);
    basePriceResult = legPrices[0] || { total: 0, breakdown: {} };
  } else if (isStandardDelivery) {
    console.log(`🚛 Scenario: STANDARD DELIVERY`);
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.COLLECTION], [sourceZone.id], order);
    if (legPrices.length === 0 || legPrices[0].total === 0) console.warn(`⚠️ No rate entry for collection from zone '${sourceZone.zone_name}'`);
    basePriceResult = legPrices[0] || { total: 0, breakdown: {} };
  } else if (isLocal) {
    console.log(`🏠 Scenario: LOCAL DELIVERY`);
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.DELIVERY], [destinationZone.id], order);
    if (legPrices.length === 0 || legPrices[0].total === 0) console.warn(`⚠️ No rate entry for local delivery to zone '${destinationZone.zone_name}'`);
    basePriceResult = legPrices[0] || { total: 0, breakdown: {} };
  } else if (isPointToPoint) {
    console.log(`🔀 Scenario: POINT TO POINT`);
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.COLLECTION, RATE_TYPES.DELIVERY], [sourceZone.id, destinationZone.id], order);
    
    const collectionPrice = legPrices.find(p => p.rate_type === RATE_TYPES.COLLECTION) || { total: 0, breakdown: {} };
    const deliveryPrice = legPrices.find(p => p.rate_type === RATE_TYPES.DELIVERY) || { total: 0, breakdown: {} };

    // Ulepszona logika: jeśli brakuje jednej ze stawek, logujemy ostrzeżenie, ale kontynuujemy.
    if (collectionPrice.total === 0) {
      console.warn(`⚠️ No rate entry for P2P collection from zone '${sourceZone.zone_name}'`);
    }
    if (deliveryPrice.total === 0) {
      console.warn(`⚠️ No rate entry for P2P delivery to zone '${destinationZone.zone_name}'`);
    }

    const combinedBreakdown = { ...collectionPrice.breakdown };
    for (const type in deliveryPrice.breakdown) {
      combinedBreakdown[type] = (combinedBreakdown[type] || 0) + deliveryPrice.breakdown[type];
    }

    basePriceResult = {
      total: collectionPrice.total + deliveryPrice.total,
      breakdown: combinedBreakdown,
    };
  }

  const calculatedPrice = basePriceResult.total;
  let finalPrice = calculatedPrice;
  const priceBreakdown = { ...basePriceResult.breakdown };

  console.log(`📦 Calculated price (before surcharges): £${calculatedPrice}`);
  console.log(`Breakdown:`, JSON.stringify(priceBreakdown, null, 2));

  // 4. Add surcharges
  const { rows: surchargeRules } = await db.query('SELECT * FROM surcharge_types');
  const selectedSurcharges = order.selected_surcharges || [];

  // Dodajemy automatyczne dopłaty, jeśli warunki są spełnione
  surchargeRules.forEach(rule => {
    if (rule.is_automatic) {
      if (rule.code === 'SAT' && order.service_level === SERVICE_LEVELS.SATURDAY && !selectedSurcharges.includes('SAT')) {
        selectedSurcharges.push('SAT');
      }
    }
  });

  if (selectedSurcharges.length > 0) {
    console.log(`🔍 Applying surcharges for codes: ${selectedSurcharges.join(', ')}`);
    selectedSurcharges.forEach(code => {
      const rule = surchargeRules.find(r => r.code === code);
      if (rule) {
        let surchargeAmount = 0;
        if (rule.calculation_method === 'per_order') {
          surchargeAmount = parseFloat(rule.amount);
        } else if (rule.calculation_method === 'per_pallet_space') {
          const totalSpaces = order.cargo_details?.total_spaces || 0;
          surchargeAmount = totalSpaces * parseFloat(rule.amount);
        }

        // Zawsze dodajemy dopłatę do podsumowania, nawet jeśli jest darmowa
        console.log(`➕ Applying surcharge '${rule.name}': £${surchargeAmount.toFixed(2)}`);
        finalPrice += surchargeAmount;
        priceBreakdown[rule.code.toLowerCase()] = (priceBreakdown[rule.code.toLowerCase()] || 0) + surchargeAmount;
      }
    });
  }

  if (calculatedPrice <= 0) {
    console.warn(`❌ Calculated price is £0 or negative: £${calculatedPrice}`);
    return null;
  }

  const result = {
    calculatedPrice: parseFloat(calculatedPrice.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    breakdown: priceBreakdown,
    currency: 'GBP',
  };

  console.log(`✅ FINAL RESULT:`);
  console.log(`   - Calculated Price: £${result.calculatedPrice}`);
  console.log(`   - Final Price (with surcharges): £${result.finalPrice}`);
  console.log(`FINAL BREAKDOWN:`, JSON.stringify(result.breakdown, null, 2));
  console.log(`🎯 PRICE CALCULATION COMPLETE\n`);

  return result;
};

module.exports = { calculateOrderPrice };