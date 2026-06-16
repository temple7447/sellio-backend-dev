/**
 * Helpers for working with optional product variants.
 * Products without a `variants` array behave exactly as before.
 */

/** Build a human label from a variant's attributes, e.g. "Red / M". */
function variantLabel(variant) {
    if (!variant || !Array.isArray(variant.attributes)) return null;
    const parts = variant.attributes.map((a) => a && a.value).filter(Boolean);
    return parts.length ? parts.join(' / ') : null;
}

/**
 * Locate a variant subdocument on a product by its _id.
 * Returns null when not found (or when no variantId is supplied).
 */
function findVariant(product, variantId) {
    if (!variantId || !product || !Array.isArray(product.variants)) return null;
    return product.variants.find((v) => String(v._id) === String(variantId)) || null;
}

/**
 * Resolve the effective stock + buyer price for a (product, variant) pair.
 * Falls back to base inventory/price when no variant is selected.
 */
function resolvePurchasable(product, variant) {
    if (variant) {
        return {
            stock: variant.stock ?? 0,
            price: variant.price != null ? variant.price : product.price.current,
            label: variantLabel(variant),
            image: variant.image || null,
        };
    }
    return {
        stock: product.inventory?.quantity ?? 0,
        price: product.price.current,
        label: null,
        image: null,
    };
}

module.exports = { variantLabel, findVariant, resolvePurchasable };
