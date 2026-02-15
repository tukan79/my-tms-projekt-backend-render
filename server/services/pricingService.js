// server/services/pricingService.js
const {
    PostcodeZone,
    CustomerRateCardAssignment,
    RateEntry,
    SurchargeType,
    Sequelize,
} = require('../models');

const { Op } = Sequelize;
const logger = require('../config/logger.js');

// ----------------------
// CONST
// ----------------------
const RATE_TYPES = {
    COLLECTION: 'collection',
    DELIVERY: 'delivery',
};

// ============================================================================
// PUBLIC API
// ============================================================================
async function calculateOrderPrice(order) {
    try {
        normalizeOrder(order);
        validateOrder(order);

        const zones = await resolveZones(order);
        const rateCardId = await getRateCardId(order.customer_id);

        const baseResult = await calculateScenarioPrice(order, zones, rateCardId);

        const resultWithSurcharges = await applySurcharges(order, baseResult);

        return formatFinalPrice(resultWithSurcharges);
    } catch (error) {
        logger.warn('Pricing fallback applied', {
            reason: error?.message || 'unknown',
            customerId: order?.customer_id ?? order?.customerId ?? null,
        });
        return formatFinalPrice(emptyPrice());
    }
}

// ============================================================================
// NORMALIZATION (fixes inconsistent naming from orderService)
// ============================================================================
function normalizeOrder(order) {
    order.customer_id = order.customer_id ?? order.customerId;
    order.parcel_weight =
        order.parcel_weight ??
        order.cargoDetails?.weight ??
        order.cargo_details?.weight ??
        0;

    order.sender_details =
        order.sender_details ?? order.senderDetails ?? {};
    order.recipient_details =
        order.recipient_details ?? order.recipientDetails ?? {};

    // THE BIG FIX: orderService sends "selectedSurcharges"
    order.surcharges =
        order.surcharges ??
        order.selectedSurcharges ??
        [];
}

// ============================================================================
// VALIDATION
// ============================================================================
function validateOrder(order) {
    if (!order.customer_id) throw new Error('customer_id missing');
    if (!order.sender_details?.postCode) throw new Error('Sender postCode missing');
    if (!order.recipient_details?.postCode)
        throw new Error('Recipient postCode missing');
}

// ============================================================================
// ZONE RESOLUTION
// ============================================================================
async function resolveZones(order) {
    const source = await findZone(order.sender_details.postCode);
    const dest = await findZone(order.recipient_details.postCode);

    if (!source || !dest) {
        throw new Error(
            `Unable to resolve zones for postcodes ${order.sender_details.postCode}, ${order.recipient_details.postCode}`
        );
    }

    return { sourceZone: source, destZone: dest };
}

async function findZone(postcode) {
    if (!postcode || typeof postcode !== 'string') return null;
    const normalizedPostcode = normalizePostcode(postcode);
    const zones = await PostcodeZone.findAll({
        attributes: ['id', 'zoneName', 'postcodePatterns', 'isHomeZone'],
    });

    let bestMatch = null;
    let bestScore = -1;

    for (const zone of zones) {
        const patterns = Array.isArray(zone.postcodePatterns) ? zone.postcodePatterns : [];

        for (const rawPattern of patterns) {
            const matchScore = getPatternMatchScore(rawPattern, normalizedPostcode);
            if (matchScore > bestScore) {
                bestScore = matchScore;
                bestMatch = zone;
            }
        }
    }

    return bestMatch;
}

function normalizePostcode(value) {
    return String(value || '')
        .toUpperCase()
        .replace(/\s+/g, '');
}

function getPatternMatchScore(rawPattern, normalizedPostcode) {
    if (!rawPattern || !normalizedPostcode) return -1;

    const normalizedPattern = normalizePostcode(rawPattern);
    if (!normalizedPattern) return -1;

    const wildcardSuffix = normalizedPattern.endsWith('%') || normalizedPattern.endsWith('*');
    const basePattern = wildcardSuffix
        ? normalizedPattern.slice(0, -1)
        : normalizedPattern;

    if (!basePattern) return -1;

    if (wildcardSuffix) {
        return normalizedPostcode.startsWith(basePattern) ? basePattern.length : -1;
    }

    if (normalizedPostcode === basePattern) {
        return basePattern.length + 1000;
    }

    return normalizedPostcode.startsWith(basePattern) ? basePattern.length : -1;
}

// ============================================================================
// RATE CARD
// ============================================================================
async function getRateCardId(customerId) {
    const assignment = await CustomerRateCardAssignment.findOne({
        where: { customerId },
    });

    if (!assignment) {
        throw new Error(
            `Customer ${customerId} has no rate card assigned.`
        );
    }

    return assignment.rateCardId;
}

// ============================================================================
// SCENARIOS
// ============================================================================
async function calculateScenarioPrice(order, zones, rateCardId) {
    if (isLocalScenario(zones)) return priceLocal(order, zones, rateCardId);

    if (isStandardCollectionScenario(zones))
        return priceStandardCollection(order, zones, rateCardId);

    if (isStandardDeliveryScenario(zones))
        return priceStandardDelivery(order, zones, rateCardId);

    return priceP2P(order, zones, rateCardId);
}

function isLocalScenario({ sourceZone, destZone }) {
    return sourceZone.id === destZone.id;
}

function isStandardCollectionScenario({ sourceZone }) {
    return sourceZone.id === 1;
}

function isStandardDeliveryScenario({ sourceZone }) {
    return sourceZone.id !== 1;
}

// ============================================================================
// RATE ENTRY FETCH
// ============================================================================
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

// ============================================================================
// PRICING LOGIC
// ============================================================================
async function priceLocal(order, zones, rateCardId) {
    return priceSingleLeg(rateCardId, [RATE_TYPES.DELIVERY], zones.destZone.id, order);
}

async function priceStandardCollection(order, zones, rateCardId) {
    return priceSingleLeg(rateCardId, [RATE_TYPES.DELIVERY], zones.destZone.id, order);
}

async function priceStandardDelivery(order, zones, rateCardId) {
    const entries = await findRateEntries(
        rateCardId,
        [RATE_TYPES.COLLECTION],
        [zones.sourceZone.id],
        order
    );

    return entries.length
        ? convertToResult(entries[0])
        : emptyPrice();
}

async function priceP2P(order, zones, rateCardId) {
    const entries = await findRateEntries(
        rateCardId,
        [RATE_TYPES.COLLECTION, RATE_TYPES.DELIVERY],
        [zones.sourceZone.id, zones.destZone.id],
        order
    );

    const collection = entries.find(e => e.rate_type === RATE_TYPES.COLLECTION);
    const delivery = entries.find(e => e.rate_type === RATE_TYPES.DELIVERY);

    const colRes = collection ? convertToResult(collection) : emptyPrice();
    const delRes = delivery ? convertToResult(delivery) : emptyPrice();

    return mergeScenarioResults(colRes, delRes);
}

// ============================================================================
// RESULT HELPERS
// ============================================================================

async function priceSingleLeg(rateCardId, rateTypes, zoneId, order) {
    const entries = await findRateEntries(rateCardId, rateTypes, [zoneId], order);
    return entries.length ? convertToResult(entries[0]) : emptyPrice();
}

function convertToResult(entry) {
    return {
        total: Number(entry.price || 0),
        finalPrice: Number(entry.price || 0),
        breakdown: [
            {
                type: entry.rate_type,
                description: `${entry.rate_type} base charge`,
                amount: Number(entry.price || 0),
            },
        ],
    };
}

function mergeScenarioResults(c, d) {
    return {
        total: c.total + d.total,
        finalPrice: c.finalPrice + d.finalPrice,
        breakdown: [...c.breakdown, ...d.breakdown],
    };
}

function emptyPrice() {
    return { total: 0, finalPrice: 0, breakdown: [] };
}

// ============================================================================
// SURCHARGES
// ============================================================================
async function applySurcharges(order, base) {
    if (!order.surcharges || order.surcharges.length === 0) return base;

    const surchargeTypes = await SurchargeType.findAll({
        where: { id: { [Op.in]: order.surcharges } },
    });

    let total = base.total;
    let final = base.finalPrice;
    const breakdown = [...base.breakdown];

    for (const s of surchargeTypes) {
        const amount = Number(s.amount || 0);

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

// ============================================================================
// FINAL FORMAT
// ============================================================================
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
