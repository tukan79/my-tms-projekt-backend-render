// Plik server/services/pricingService.js
const db = require('../db/index.js');

/**
 * Finds a postcode zone that matches a given postcode.
 * @param {string} postcode - The postcode to match.
 * @returns {Promise<object|null>} The matching zone object or null.
 */
const findZoneForPostcode = async (postcode) => {
  if (!postcode) return null;
  // This query checks if the postcode starts with any of the patterns in the array.
  const { rows } = await db.query(
    `SELECT * FROM postcode_zones WHERE EXISTS (
      SELECT 1 FROM unnest(postcode_patterns) AS pattern
      WHERE $1 ILIKE pattern
    ) LIMIT 1`,
    [postcode]
  );
  return rows[0] || null;
};

/**
 * Finds the rate for a single leg of a journey (collection or delivery).
 * @param {number} rateCardId - The ID of the rate card.
 * @param {string} rateType - 'collection' or 'delivery'.
 * @param {number} zoneId - The ID of the zone for which the rate is being calculated.
 * @param {object} order - The order object containing service level and pallet details.
 * @returns {Promise<number>} The calculated price for the leg.
 */
const findRateForLeg = async (rateCardId, rateType, zoneId, order) => {
  const query = `
    SELECT * FROM rate_entries
    WHERE rate_card_id = $1 AND rate_type = $2 AND zone_id = $3 AND service_level = $4
  `;
  const { rows } = await db.query(query, [rateCardId, rateType, zoneId, order.service_level]);

  if (rows.length === 0) {
    // Log zostanie teraz wygenerowany w `calculateOrderPrice` z nazwą strefy
    return 0;
  }
  const rate = rows[0];
  let legPrice = 0;
  const pallets = order.cargo_details?.pallets || {};

  const palletPriceMap = {
    micro: 'price_micro', quarter: 'price_quarter', half: 'price_half', plus_half: 'price_half_plus',
  };

  for (const type in palletPriceMap) {
    if (pallets[type] && Number(pallets[type].count) > 0) {
      legPrice += (parseFloat(rate[palletPriceMap[type]]) || 0) * Number(pallets[type].count);
    }
  }

  const fullPalletCount = Number(pallets.full?.count || 0);
  if (fullPalletCount > 0) {
    if (fullPalletCount <= 10) {
      // Użyj indywidualnych cen dla 1 do 10 palet
      legPrice += parseFloat(rate[`price_full_${fullPalletCount}`]) || 0;
    } else {
      // Dla palet powyżej 10, można dodać osobną logikę, na razie cena za 10 palet
      legPrice += parseFloat(rate.price_full_10) || 0;
    }
  }
  return legPrice;
};

/**
 * Calculates the price for a given order based on client's rate card.
 * @param {object} order - The full order object.
 * @returns {Promise<number|null>} The calculated price or null if no rate is found.
 */
const calculateOrderPrice = async (order) => {
  if (!order.customer_id || !order.sender_details?.postCode || !order.recipient_details?.postCode) {
    console.warn(`Order ${order.id || 'new'} is missing customer_id or postcodes. Skipping price calculation.`);
    return null;
  }

  // 1. Find source and destination zones
  const sourceZone = await findZoneForPostcode(order.sender_details.postCode);
  const destinationZone = await findZoneForPostcode(order.recipient_details.postCode);

  if (!sourceZone || !destinationZone) {
    console.warn(`Could not determine zones for order ${order.id || 'new'}. Source: ${sourceZone?.zone_name || 'not found'}, Dest: ${destinationZone?.zone_name || 'not found'}`);
    return null;
  }

  // 2. Find the rate card assigned to the client
  const { rows: rateCards } = await db.query(
    'SELECT rate_card_id as id FROM customer_rate_card_assignments WHERE customer_id = $1 LIMIT 1',
    [order.customer_id]
  );
  if (rateCards.length === 0) {
    console.warn(`No rate card assigned to client ${order.customer_id}.`);
    return null;
  }
  const rateCardId = rateCards[0].id;

  // 3. Calculate price based on the scenario
  let totalPrice = 0;
  const isStandardCollection = sourceZone.is_home_zone && !destinationZone.is_home_zone;
  const isStandardDelivery = !sourceZone.is_home_zone && destinationZone.is_home_zone;
  const isPointToPoint = !sourceZone.is_home_zone && !destinationZone.is_home_zone;
  const isLocal = sourceZone.is_home_zone && destinationZone.is_home_zone;

  if (isStandardCollection) {
    // Standard: We collect, so we only charge for delivery to the destination zone.
    const legPrice = await findRateForLeg(rateCardId, 'delivery', destinationZone.id, order);
    if (legPrice === 0) console.warn(`No rate entry for delivery to zone '${destinationZone.zone_name}' (ID: ${destinationZone.id}) with service '${order.service_level}' in rate card ${rateCardId}.`);
    totalPrice = legPrice;
  } else if (isStandardDelivery) {
    // Standard: We deliver, so we only charge for collection from the source zone.
    const legPrice = await findRateForLeg(rateCardId, 'collection', sourceZone.id, order);
    if (legPrice === 0) console.warn(`No rate entry for collection from zone '${sourceZone.zone_name}' (ID: ${sourceZone.id}) with service '${order.service_level}' in rate card ${rateCardId}.`);
    totalPrice = legPrice;
  } else if (isLocal) {
    // Local: Both start and end are in a home zone. Charge for the delivery leg.
    const legPrice = await findRateForLeg(rateCardId, 'delivery', destinationZone.id, order);
    if (legPrice === 0) console.warn(`No rate entry for local delivery to zone '${destinationZone.zone_name}' (ID: ${destinationZone.id}) with service '${order.service_level}' in rate card ${rateCardId}.`);
    totalPrice = legPrice;
  } else if (isPointToPoint) {
    // Point to Point: Charge for both collection and delivery.
    const collectionPrice = await findRateForLeg(rateCardId, 'collection', sourceZone.id, order);
    const deliveryPrice = await findRateForLeg(rateCardId, 'delivery', destinationZone.id, order);
    totalPrice = collectionPrice + deliveryPrice;
  }
  // If sourceZone and destinationZone are both home_zone, price remains 0.

  // 4. Add surcharges (e.g., for Saturday service)
  if (order.service_level === 'D') { // Assuming 'D' is Saturday
    totalPrice += 40.00;
  }

  return totalPrice > 0 ? totalPrice.toFixed(2) : null;
};

module.exports = { calculateOrderPrice };