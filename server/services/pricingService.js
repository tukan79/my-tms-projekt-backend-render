// server/services/pricingService.js
const { 
    PostcodeZone, 
    CustomerRateCardAssignment, 
    RateEntry, 
    SurchargeType, 
    Sequelize 
} = require('../models');

const { Op } = Sequelize;
const logger = require('../config/logger.js');

// Stałe
const RATE_TYPES = {
    COLLECTION: 'collection',
    DELIVERY: 'delivery',
};

// ---------------------------------------------
// PUBLIC API
// ---------------------------------------------
async function calculateOrderPrice(order) {
    validateOrder(order);

    const zones = await resolveZones(order);
    const rateCardId = await getRateCardId(order.customer_id);
    const baseResult = await calculateScenarioPrice(order, zones, rateCardId);
    const resultWithSurcharges = await applySurcharges(order, baseResult);

    return formatFinalPrice(resultWithSurcharges);
}

// ---------------------------------------------
// VALIDATION
// ---------------------------------------------
function validateOrder(order) {
    if (!order.customer_id) throw new Error('customer_id is missing');
    if (!order.sender_details?.postCode) throw new Error('Sender postcode missing');
    if (!order.recipient_details?.postCode) throw new Error('Recipient postcode missing');
}

// ---------------------------------------------
// ZONE RESOLUTION
// ---------------------------------------------
async function resolveZones(order) {
    const source = await findZone(order.sender_details.postCode);
    const dest = await findZone(order.recipient_details.postCode);

    if (!source || !dest) {
        throw new Error(`Unable to resolve zones for postcodes (${order.sender_details.postCode}, ${order.recipient_details.postCode})`);
    }

    return { sourceZone: source, destZone: dest };
}

async function findZone(postcode) {
    return await PostcodeZone.findOne({
        where: {
            postcodePrefix: {
                [Op.like]: `${postcode.substring(0, 3)}%`
            }
        }
    });
}

// ---------------------------------------------
// RATE CARD
// ---------------------------------------------
async function getRateCardId(customerId) {
    const assignment = await CustomerRateCardAssignment.findOne({
        where: { customerId }
    });

    if (!assignment) {
        throw new Error(`Customer ${customerId} has no rate card assigned.`);
    }

    return assignment.rateCardId;
}

// ---------------------------------------------
// SCENARIO HANDLING
// ---------------------------------------------
async function calculateScenarioPrice(order, zones, rateCardId) {
    if (isLocalScenario(zones)) {
        return await priceLocal(order, zones, rateCardId);
    }

    if (isStandardCollectionScenario(zones)) {
        return await priceStandardCollection(order, zones, rateCardId);
    }

    if (isStandardDeliveryScenario(zones)) {
        return await priceStandardDelivery(order, zones, rateCardId);
    }

    return await priceP2P(order, zones, rateCardId);
}

// Scenario checks
function isLocalScenario({ sourceZone, destZone }) {
    return sourceZone.id === destZone.id;
}

function isStandardCollectionScenario({ sourceZone }) {
    return sourceZone.id === 1; // "main zone"
}

function isStandardDeliveryScenario({ sourceZone }) {
    return sourceZone.id !== 1;
}

// ---------------------------------------------
// RATE ENTRY FETCHING
// ---------------------------------------------
async function findRateEntries(rateCardId, types, zones, order) {
    return await RateEntry.findAll({
        where: {
            rateCardId,
            rate_type: { [Op.in]: types },
            zone_id: { [Op.in]: zones },
            weight_from: { [Op.lte]: order.parcel_weight },
            weight_to: { [Op.gte]: order.parcel_weight },
        },
    });
}

// ---------------------------------------------
// PRICING SCENARIOS
// ---------------------------------------------
async function priceLocal(order, zones, rateCardId) {
    const entries = await findRateEntries(rateCardId, [RATE_TYPES.DELIVERY], [zones.destZone.id], order);
    return entries.length ? convertToResult(entries[0], order) : emptyPrice(order);
}

async function priceStandardCollection(order, zones, rateCardId) {
    const entries = await findRateEntries(rateCardId, [RATE_TYPES.DELIVERY], [zones.destZone.id], order);
    return entries.length ? convertToResult(entries[0], order) : emptyPrice(order);
}

async function priceStandardDelivery(order, zones, rateCardId) {
    const entries = await findRateEntries(rateCardId, [RATE_TYPES.COLLECTION], [zones.sourceZone.id], order);
    return entries.length ? convertToResult(entries[0], order) : emptyPrice(order);
}

async function priceP2P(order, zones, rateCardId) {
    const entries = await findRateEntries(
        rateCardId,
        [RATE_TYPES.COLLECTION, RATE_TYPES.DELIVERY],
        [zones.sourceZone.id, zones.destZone.id],
        order
    );

    const collection = entries.find(e => e.rate_type === RATE_TYPES.COLLECTION) || emptyPrice(order);
    const delivery = entries.find(e => e.rate_type === RATE_TYPES.DELIVERY) || emptyPrice(order);

    const collectionResult = convertToResult(collection, order);
    const deliveryResult = convertToResult(delivery, order);

    return mergeScenarioResults(collectionResult, deliveryResult, order);
}

// ---------------------------------------------
// CONVERSION HELPERS
// ---------------------------------------------
function convertToResult(rateEntry, order) {
    if (!rateEntry.rate_type) return emptyPrice(order);

    return {
        total: Number.parseFloat(rateEntry.price || 0),
        finalPrice: Number.parseFloat(rateEntry.price || 0),
        breakdown: [
            {
                type: rateEntry.rate_type,
                description: `${rateEntry.rate_type} base charge`,
                amount: Number.parseFloat(rateEntry.price || 0),
            }
        ],
    };
}

function mergeScenarioResults(col, del, order) {
    return {
        total: col.total + del.total,
        finalPrice: col.finalPrice + del.finalPrice,
        breakdown: [...col.breakdown, ...del.breakdown],
    };
}

function emptyPrice(order) {
    return {
        total: 0,
        finalPrice: 0,
        breakdown: [],
    };
}

// ---------------------------------------------
// SURCHARGES
// ---------------------------------------------
async function applySurcharges(order, base) {
    if (!order.surcharges?.length) return base;

    const surchargeTypes = await SurchargeType.findAll({
        where: { id: { [Op.in]: order.surcharges } },
    });

    let total = base.total;
    let final = base.finalPrice;
    const breakdown = [...base.breakdown];

    for (const s of surchargeTypes) {
        const amount = Number.parseFloat(s.amount || 0);

        breakdown.push({
            type: 'surcharge',
            description: s.name,
            amount,
        });

        total += amount;
        final += amount;
    }

    return { total, finalPrice: final, breakdown };
}

// ---------------------------------------------
// FINAL FORMAT
// ---------------------------------------------
function formatFinalPrice(result) {
    return {
        calculatedPrice: round(result.total),
        finalPrice: round(result.finalPrice),
        breakdown: result.breakdown,
        currency: 'GBP',
    };
}

function round(n) {
    return Math.round(n * 100) / 100;
}

module.exports = { calculateOrderPrice };
