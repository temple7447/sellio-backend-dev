/**
 * Order Calculations Utility
 * Handles all order cost calculations including fees
 */

class OrderCalculations {
    /**
     * Calculate complete order totals with fee breakdown
     * @param {Number} subtotal - The sum of all items (price * quantity)
     * @returns {Object} Complete breakdown of all fees and final total
     */
    static calculateOrderTotals(subtotal) {
        const tax = 250; // Fixed tax (₦250)
        const escrowProtection = Math.round(subtotal * 0.025); // 2.5% of subtotal
        const service = 50; // Fixed service fee (₦50)
        
        const final = subtotal + tax + escrowProtection + service;

        return {
            subtotal,
            tax,
            escrowProtection,
            service,
            final
        };
    }

    /**
     * Format currency for display (Nigerian Naira)
     * @param {Number} amount - Amount to format
     * @returns {String} Formatted currency string
     */
    static formatCurrency(amount) {
        return `₦ ${amount.toLocaleString('en-NG', { 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0 
        })}`;
    }

    /**
     * Generate order breakdown display
     * @param {Number} subtotal - The sum of all items
     * @returns {Object} Formatted breakdown for display
     */
    static getOrderBreakdown(subtotal) {
        const totals = this.calculateOrderTotals(subtotal);

        return {
            breakdown: {
                subtotal: {
                    label: 'Subtotal',
                    amount: totals.subtotal,
                    formatted: this.formatCurrency(totals.subtotal)
                },
                tax: {
                    label: 'Tax',
                    amount: totals.tax,
                    formatted: this.formatCurrency(totals.tax),
                    note: 'Fixed fee'
                },
                escrowProtection: {
                    label: 'E.P (Escrow Protection)',
                    amount: totals.escrowProtection,
                    formatted: this.formatCurrency(totals.escrowProtection),
                    note: '2.5% of subtotal'
                },
                service: {
                    label: 'Service',
                    amount: totals.service,
                    formatted: this.formatCurrency(totals.service),
                    note: 'Fixed fee'
                }
            },
            total: {
                label: 'Total',
                amount: totals.final,
                formatted: this.formatCurrency(totals.final)
            }
        };
    }

    /**
     * Print order summary to console
     * @param {Number} subtotal - The sum of all items
     */
    static printOrderSummary(subtotal) {
        const breakdown = this.getOrderBreakdown(subtotal);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('       ORDER SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Subtotal:  ${breakdown.breakdown.subtotal.formatted}`);
        console.log(`Tax:       ${breakdown.breakdown.tax.formatted}`);
        console.log(`E.P:       ${breakdown.breakdown.escrowProtection.formatted} (2.5%)`);
        console.log(`Service:   ${breakdown.breakdown.service.formatted}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`TOTAL:     ${breakdown.total.formatted}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
}

module.exports = OrderCalculations;
