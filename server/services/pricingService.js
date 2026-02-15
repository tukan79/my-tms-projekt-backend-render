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
    const where = {
        rateCardId,
        rateType: { [Op.in]: types },
        zoneId: { [Op.in]: zones },
    };

    if (order?.service_level || order?.serviceLevel) {
        where.serviceLevel = order.service_level ?? order.serviceLevel;
    }

    return await RateEntry.findAll({ where });
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
        ? convertToResult(entries[0], order)
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

    const colRes = collection ? convertToResult(collection, order) : emptyPrice();
    const delRes = delivery ? convertToResult(delivery, order) : emptyPrice();

    return mergeScenarioResults(colRes, delRes);
}

// ============================================================================
// RESULT HELPERS
// ============================================================================

async function priceSingleLeg(rateCardId, rateTypes, zoneId, order) {
    const entries = await findRateEntries(rateCardId, rateTypes, [zoneId], order);
    return entries.length ? convertToResult(entries[0], order) : emptyPrice();
}

function convertToResult(entry, order) {
    const baseAmount = calculateEntryAmount(entry, order);
    return {
        total: baseAmount,
        finalPrice: baseAmount,
        breakdown: [
            {
                type: entry.rateType || entry.rate_type || 'delivery',
                description: `${entry.rateType || entry.rate_type || 'delivery'} base charge`,
                amount: baseAmount,
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

function calculateEntryAmount(entry, order) {
    const qty = getPalletQuantities(order);

    const linear =
        qty.micro * toNumber(entry.priceMicro) +
        qty.quarter * toNumber(entry.priceQuarter) +
        qty.half * toNumber(entry.priceHalf) +
        qty.halfPlus * toNumber(entry.priceHalfPlus);

    const full = calculateFullAmount(toNumberMap(entry), qty.full);
    return round(linear + full);
}

function getPalletQuantities(order) {
    const quantities = {
        micro: 0,
        quarter: 0,
        half: 0,
        halfPlus: 0,
        full: 0,
    };

    const cargo = order?.cargo_details ?? order?.cargoDetails ?? {};

    const fromPallets = Array.isArray(cargo.pallets) ? cargo.pallets : [];
    for (const p of fromPallets) {
        const type = String(p?.type || '').toLowerCase();
        const q = toNumber(p?.quantity);
        if (!q) continue;
        if (type === 'micro') quantities.micro += q;
        if (type === 'quarter') quantities.quarter += q;
        if (type === 'half') quantities.half += q;
        if (type === 'halfplus' || type === 'half_plus') quantities.halfPlus += q;
        if (type === 'full') quantities.full += q;
    }

    const fromQuantities = cargo.quantities || {};
    quantities.micro += toNumber(fromQuantities.micro);
    quantities.quarter += toNumber(fromQuantities.quarter);
    quantities.half += toNumber(fromQuantities.half);
    quantities.halfPlus += toNumber(fromQuantities.halfPlus);
    quantities.full += toNumber(fromQuantities.full);

    return quantities;
}

function toNumberMap(entry) {
    return {
        1: toNumber(entry.priceFull1),
        2: toNumber(entry.priceFull2),
        3: toNumber(entry.priceFull3),
        4: toNumber(entry.priceFull4),
        5: toNumber(entry.priceFull5),
        6: toNumber(entry.priceFull6),
        7: toNumber(entry.priceFull7),
        8: toNumber(entry.priceFull8),
        9: toNumber(entry.priceFull9),
        10: toNumber(entry.priceFull10),
    };
}

function calculateFullAmount(fullPriceMap, fullQty) {
    let qty = toNumber(fullQty);
    if (!qty) return 0;

    let total = 0;
    while (qty > 0) {
        const chunk = Math.min(qty, 10);
        const chunkPrice = fullPriceMap[chunk] || 0;
        total += chunkPrice;
        qty -= chunk;
    }
    return total;
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
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
