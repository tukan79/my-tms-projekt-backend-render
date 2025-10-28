// Plik server/services/pricingService.js
const db = require('../db/index.js');
const logger = require('../config/logger.js');

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
    logger.debug(`Zone search for postcode ${postcode}: found ${rows.length} zones`, { context: 'findZoneForPostcode' });
    return rows[0] || null;
  } catch (error) {
    logger.error(`Error finding zone for postcode ${postcode}`, { context: 'findZoneForPostcode', error: error.message });
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
  const context = 'findRateForLeg';
  logger.debug('Starting rate calculation for leg', { context, rateCardId, rateTypes, zoneIds, serviceLevel: order.service_level });
  
  try {
    const query = `
      SELECT * FROM rate_entries
      WHERE rate_card_id = $1 AND rate_type = ANY($2::varchar[]) AND zone_id = ANY($3::int[]) AND service_level = $4
    `;
    
    const { rows } = await db.query(query, [rateCardId, rateTypes, zoneIds, order.service_level]);
    logger.debug(`Found ${rows.length} rate entries in database`, { context });

    if (rows.length === 0) {
      logger.warn('No rate entries found for the given criteria', { context, rateCardId, rateTypes, zoneIds, serviceLevel: order.service_level });
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
      logger.debug('Pallets from order', { context, pallets });

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
          logger.debug(`Calculated cost for pallet type '${type}'`, { context, quantity, spaces, cost: cost.toFixed(2) });
        } else {
          const errorMessage = `Price for ${quantity}x '${type}' pallet(s) is missing or zero in the rate card for zone ID ${rate.zone_id} and service level ${order.service_level}.`;
          logger.error(errorMessage, { context });
          throw new Error(errorMessage);
        }
      });

      const total = Object.values(priceBreakdown).reduce((sum, price) => sum + price, 0);
      logger.debug(`Total for leg`, { context, rate_type: rate.rate_type, zone_id: rate.zone_id, total: total.toFixed(2) });
      
      return { total, breakdown: priceBreakdown, rate_type: rate.rate_type };
    });

    return results;
  } catch (error) {
    logger.error('Error in findRateForLeg', {
      context,
      rateCardId, 
      rateTypes, 
      zoneIds, 
      serviceLevel: order.service_level, 
      error: error.message 
    });
    throw error; // Rzucamy błąd dalej, aby transakcja mogła zostać wycofana
  }
};

/**
 * Calculates the price for a given order based on client's rate card.
 * @param {object} order - The full order object.
 * @returns {Promise<{total: number, breakdown: object}|null>} The calculated price with breakdown or null.
 */
const calculateOrderPrice = async (order) => {
  const context = 'calculateOrderPrice';
  logger.info(`Starting price calculation for order ${order.id || 'new'}`, {
    context,
    customer_id: order.customer_id,
    service_level: order.service_level,
    sender_postcode: order.sender_details?.postCode,
    recipient_postcode: order.recipient_details?.postCode,
  });

  if (!order.customer_id || !order.sender_details?.postCode || !order.recipient_details?.postCode) {
    logger.warn(`Order ${order.id || 'new'} is missing required fields for pricing`, { context, orderId: order.id });
    return null;
  }

  // 1. Find source and destination zones
  logger.debug('Finding zones for postcodes', { context });
  const sourceZone = await findZoneForPostcode(order.sender_details.postCode);
  const destinationZone = await findZoneForPostcode(order.recipient_details.postCode);

  logger.debug('Zones found', {
    context,
    sourceZone: sourceZone ? `${sourceZone.zone_name} (ID: ${sourceZone.id}, is_home_zone: ${sourceZone.is_home_zone})` : 'NOT FOUND',
    destinationZone: destinationZone ? `${destinationZone.zone_name} (ID: ${destinationZone.id}, is_home_zone: ${destinationZone.is_home_zone})` : 'NOT FOUND'
  });

  if (!sourceZone || !destinationZone) {
    logger.warn(`Could not determine zones for order ${order.id || 'new'}`, { context });
    return null;
  }

  // 2. Find the rate card assigned to the client
  logger.debug(`Finding rate card for customer ${order.customer_id}`, { context });
  const { rows: rateCards } = await db.query(
    'SELECT rate_card_id as id FROM customer_rate_card_assignments WHERE customer_id = $1 LIMIT 1',
    [order.customer_id]
  );
  
  if (rateCards.length === 0) {
    logger.warn(`No rate card assigned to client ${order.customer_id}`, { context });
    return null;
  }
  
  const rateCardId = rateCards[0].id;
  logger.debug(`Using rate card ID: ${rateCardId}`, { context });

  // 3. Calculate price based on the scenario
  let basePriceResult = { total: 0, breakdown: {} };
  const isStandardCollection = sourceZone.is_home_zone && !destinationZone.is_home_zone;
  const isStandardDelivery = !sourceZone.is_home_zone && destinationZone.is_home_zone;
  const isPointToPoint = !sourceZone.is_home_zone && !destinationZone.is_home_zone;
  const isLocal = sourceZone.is_home_zone && destinationZone.is_home_zone;

  logger.debug('Scenario analysis', {
    context,
    isStandardCollection,
    isStandardDelivery, 
    isPointToPoint,
    isLocal
  });

  if (isStandardCollection) {
    logger.debug('Scenario: STANDARD COLLECTION', { context });
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.DELIVERY], [destinationZone.id], order);
    if (legPrices.length === 0 || legPrices[0].total === 0) logger.warn(`No rate entry for delivery to zone '${destinationZone.zone_name}'`, { context });
    basePriceResult = legPrices[0] || { total: 0, breakdown: {} };
  } else if (isStandardDelivery) {
    logger.debug('Scenario: STANDARD DELIVERY', { context });
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.COLLECTION], [sourceZone.id], order);
    if (legPrices.length === 0 || legPrices[0].total === 0) logger.warn(`No rate entry for collection from zone '${sourceZone.zone_name}'`, { context });
    basePriceResult = legPrices[0] || { total: 0, breakdown: {} };
  } else if (isLocal) {
    logger.debug('Scenario: LOCAL DELIVERY', { context });
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.DELIVERY], [destinationZone.id], order);
    if (legPrices.length === 0 || legPrices[0].total === 0) logger.warn(`No rate entry for local delivery to zone '${destinationZone.zone_name}'`, { context });
    basePriceResult = legPrices[0] || { total: 0, breakdown: {} };
  } else if (isPointToPoint) {
    logger.debug('Scenario: POINT TO POINT', { context });
    const legPrices = await findRateForLeg(rateCardId, [RATE_TYPES.COLLECTION, RATE_TYPES.DELIVERY], [sourceZone.id, destinationZone.id], order);
    
    const collectionPrice = legPrices.find(p => p.rate_type === RATE_TYPES.COLLECTION) || { total: 0, breakdown: {} };
    const deliveryPrice = legPrices.find(p => p.rate_type === RATE_TYPES.DELIVERY) || { total: 0, breakdown: {} };

    // Ulepszona logika: jeśli brakuje jednej ze stawek, logujemy ostrzeżenie, ale kontynuujemy.
    if (collectionPrice.total === 0) {
      logger.warn(`No rate entry for P2P collection from zone '${sourceZone.zone_name}'`, { context });
    }
    if (deliveryPrice.total === 0) {
      logger.warn(`No rate entry for P2P delivery to zone '${destinationZone.zone_name}'`, { context });
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

  logger.debug(`Calculated price (before surcharges): £${calculatedPrice.toFixed(2)}`, { context, breakdown: priceBreakdown });

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
    logger.debug(`Applying surcharges for codes: ${selectedSurcharges.join(', ')}`, { context });
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
        logger.debug(`Applying surcharge '${rule.name}': £${surchargeAmount.toFixed(2)}`, { context });
        finalPrice += surchargeAmount;
        priceBreakdown[rule.code.toLowerCase()] = (priceBreakdown[rule.code.toLowerCase()] || 0) + surchargeAmount;
      }
    });
  }

  if (calculatedPrice <= 0) {
    logger.warn(`Calculated price is £0 or negative: £${calculatedPrice}`, { context, orderId: order.id });
    return null;
  }

  const result = {
    calculatedPrice: parseFloat(calculatedPrice.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
    breakdown: priceBreakdown,
    currency: 'GBP',
  };

  logger.info(`Price calculation complete for order ${order.id || 'new'}`, { context, result });

  return result;
};

module.exports = {
  calculateOrderPrice,
};