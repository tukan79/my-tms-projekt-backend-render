// Plik server/services/pricingService.js
const { PostcodeZone, CustomerRateCardAssignment, RateEntry, SurchargeType, Sequelize } = require('../models');
const { Op } = Sequelize;
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
    // Używamy Sequelize.literal, aby skorzystać z funkcji PostgreSQL `ILIKE ANY`
    const zone = await PostcodeZone.findOne({
      where: Sequelize.literal(`'${postcode.replace(/'/g, "''")}' ILIKE ANY(postcode_patterns)`)
    });
    const rows = zone ? [zone.get({ plain: true })] : [];
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
 * @param {string[]} rateTypes - An array of 'collection' or 'delivery'.
 * @param {number} zoneId - The ID of the zone for which the rate is being calculated.
 * @param {object} order - The order object containing service level and pallet details.
 * @returns {Promise<Array>} An array of calculated prices for each leg with breakdown.
 */
const findRateForLeg = async (rateCardId, rateTypes, zoneIds, order) => {
  const context = 'findRateForLeg'; // Keep context for logging
  logger.debug('Starting rate calculation for leg', { context, rateCardId, rateTypes, zoneIds, serviceLevel: order.serviceLevel });
  
  try {
    const rateEntries = await RateEntry.findAll({
      where: {
        rateCardId: rateCardId,
        rateType: { [Op.in]: rateTypes },
        zoneId: { [Op.in]: zoneIds },
        serviceLevel: order.serviceLevel
      }
    });
    const rows = rateEntries.map(entry => entry.get({ plain: true }));
    logger.debug(`Found ${rows.length} rate entries in database`, { context });

    if (rows.length === 0) { // Keep context for logging
      logger.warn('No rate entries found for the given criteria', { context, rateCardId, rateTypes, zoneIds, serviceLevel: order.serviceLevel });
      return [];
    }

    const results = rows.map(rate => {
      const priceBreakdown = {};
      logger.debug(`Rate entry found:`, {
        id: rate.id,
        rate_type: rate.rateType,
        zone_id: rate.zoneId,
        price_full_1: rate.priceFull1,
        price_half_plus: rate.priceHalfPlus,
        price_half: rate.priceHalf,
        price_quarter: rate.priceQuarter,
        price_micro: rate.priceMicro
      });

      // Poprawka: Logika musi obsługiwać tablicę palet, a nie obiekt.
      const pallets = Array.isArray(order.cargoDetails?.pallets) ? order.cargoDetails.pallets : [];
      logger.debug('Pallets from order', { context, pallets });

      const columnMapping = {
        'micro': 'priceMicro',
        'quarter': 'priceQuarter',
        'half': 'priceHalf',
        'half_plus': 'priceHalfPlus',
      };

      pallets.forEach(pallet => {
        const { type, quantity, spaces } = pallet;
        const priceColumn = type === 'full' ? `priceFull${quantity}` : columnMapping[type];
        const priceValue = parseFloat(rate[priceColumn]) || 0;

        if (priceValue > 0) {
          // Dla palet niepełnych, cena jest za miejsce; dla pełnych, jest to cena ryczałtowa za daną ilość.
          const cost = type === 'full' ? priceValue : priceValue * (Number(spaces) || 0);
          priceBreakdown[type] = (priceBreakdown[type] || 0) + cost; // Poprawka: Sumujemy koszty dla tego samego typu palety
          logger.debug(`Calculated cost for pallet type '${type}'`, { context, quantity, spaces, cost: cost.toFixed(2) });
        } else {
          const errorMessage = `Price for ${quantity}x '${type}' pallet(s) is missing or zero in the rate card for zone ID ${rate.zoneId} and service level ${order.serviceLevel}.`; // Keep context for logging
          logger.error(errorMessage, { context });
          throw new Error(errorMessage);
        }
      });

      const total = Object.values(priceBreakdown).reduce((sum, price) => sum + price, 0);
      logger.debug(`Total for leg`, { context, rate_type: rate.rateType, zone_id: rate.zoneId, total: total.toFixed(2) });
      
      return { total, breakdown: priceBreakdown, rate_type: rate.rate_type };
    });

    return results;
  } catch (error) {
    logger.error('Error in findRateForLeg', {
      context,
      rateCardId, 
      rateTypes, 
      zoneIds, 
      serviceLevel: order.serviceLevel, 
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
    customerId: order.customer_id,
    serviceLevel: order.service_level,
    senderPostcode: order.sender_details?.postCode,
    recipientPostcode: order.recipient_details?.postCode,
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
  const rateCardAssignment = await CustomerRateCardAssignment.findOne({
    where: { customerId: order.customer_id }
  });
  
  if (!rateCardAssignment) {
    logger.warn(`No rate card assigned to client ${order.customer_id}`, { context });
    return null;
  }
  
  const rateCardId = rateCardAssignment.rateCardId;
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
  const surchargeRules = (await SurchargeType.findAll()).map(rule => rule.get({ plain: true }));

  const selectedSurcharges = order.selectedSurcharges || [];
  
  // Dodajemy automatyczne dopłaty, jeśli warunki są spełnione
  surchargeRules.forEach(rule => {
    if (rule.isAutomatic) {
      if (rule.code === 'SAT' && order.serviceLevel === SERVICE_LEVELS.SATURDAY && !selectedSurcharges.includes('SAT')) {
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
        if (rule.calculationMethod === 'per_order') {
          surchargeAmount = parseFloat(rule.amount);
        } else if (rule.calculationMethod === 'per_pallet_space') {
          const totalSpaces = order.cargoDetails?.totalSpaces || 0;
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