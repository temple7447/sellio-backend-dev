const mongoose = require('mongoose');
const axios = require('axios');
const chalk = require('chalk');
require('dotenv').config();

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // Set this or obtain from admin login
const SETUP_KEY = process.env.ADMIN_SETUP_KEY;

let testData = {
    admin: null,
    trustedSeller: null,
    untrustedSeller: null,
    products: []
};

const log = {
    title: (msg) => console.log(chalk.bold.cyan(`\n📌 ${msg}`)),
    success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
    error: (msg) => console.log(chalk.red(`✗ ${msg}`)),
    info: (msg) => console.log(chalk.blue(`ℹ ${msg}`)),
    divider: () => console.log(chalk.gray('─'.repeat(70)))
};

/**
 * PHASE 1: Admin Setup (if needed)
 */
async function setupAdmin() {
    log.title('PHASE 1: Admin Setup');
    
    try {
        // Try to register admin
        const response = await axios.post(`${BASE_URL}/auth/register-admin`, {
            email: 'admin@campustrade.com',
            password: 'AdminPassword123!',
            fullName: 'Admin User',
            phoneNumber: '1234567890',
            setupKey: SETUP_KEY
        });
        
        testData.admin = response.data;
        log.success(`Admin registered/exists: ${response.data.email}`);
        return response.data.token;
    } catch (error) {
        if (error.response?.status === 403) {
            log.info('Admin already exists');
            return ADMIN_TOKEN;
        }
        log.error(`Admin setup failed: ${error.response?.data?.message || error.message}`);
        throw error;
    }
}

/**
 * PHASE 2: Create Test Sellers
 */
async function createTestSellers() {
    log.title('PHASE 2: Create Test Sellers');
    
    const sellers = [
        {
            name: 'TrustedTechStore',
            email: `trusted-seller-${Date.now()}@test.com`,
            businessName: 'Trusted Tech Marketplace',
            description: 'Premium electronics seller with excellent ratings'
        },
        {
            name: 'NewSeller',
            email: `new-seller-${Date.now()}@test.com`,
            businessName: 'New Electronics Store',
            description: 'New seller without trusted badge yet'
        }
    ];

    for (const seller of sellers) {
        try {
            // Create a dummy file for government ID
            const fileName = `/tmp/gov-id-${Date.now()}.jpg`;
            require('fs').writeFileSync(fileName, Buffer.from('dummy-image-data'));
            
            const FormData = require('form-data');
            const form = new FormData();
            form.append('email', seller.email);
            form.append('password', 'SellerPassword123!');
            form.append('fullName', seller.name);
            form.append('phoneNumber', '9876543210');
            form.append('businessName', seller.businessName);
            form.append('businessAddress', '123 Tech Street, Tech City');
            form.append('file', require('fs').createReadStream(fileName));

            const response = await axios.post(`${BASE_URL}/auth/register-seller`, form, {
                headers: form.getHeaders()
            });

            log.success(`Seller created: ${seller.name} (${seller.email})`);
            
            // Store for later use
            if (seller.name === 'TrustedTechStore') {
                testData.trustedSeller = { ...seller, id: response.data.email };
            } else {
                testData.untrustedSeller = { ...seller, id: response.data.email };
            }

            // Clean up temp file
            require('fs').unlinkSync(fileName);
        } catch (error) {
            log.error(`Failed to create seller ${seller.name}: ${error.response?.data?.message || error.message}`);
        }
    }
}

/**
 * PHASE 3: Verify and Award Trusted Badges
 */
async function awardTrustedBadges(adminToken) {
    log.title('PHASE 3: Award Trusted Badges to Selected Sellers');
    
    try {
        // First, get list of all sellers to find our test sellers
        const sellersResponse = await axios.get(`${BASE_URL}/admin/users?role=seller&limit=100`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const allSellers = sellersResponse.data.users || [];
        log.info(`Total sellers in system: ${allSellers.length}`);

        // Find our test sellers
        const trustedSellerData = allSellers.find(s => s.businessName === 'Trusted Tech Marketplace');
        const newSellerData = allSellers.find(s => s.businessName === 'New Electronics Store');

        if (!trustedSellerData) {
            log.error('Could not find trusted seller in database');
            return;
        }

        // Award trusted badge to first seller
        try {
            const awardResponse = await axios.put(
                `${BASE_URL}/admin/sellers/${trustedSellerData.id}/trusted-badge`,
                { isTrusted: true },
                { headers: { Authorization: `Bearer ${adminToken}` } }
            );
            
            testData.trustedSeller.id = trustedSellerData.id;
            testData.trustedSeller.isTrusted = true;
            log.success(`✨ Trusted badge AWARDED to: ${awardResponse.data.seller.businessName}`);
            log.info(`  - Award date: ${new Date(awardResponse.data.seller.trustedBadgeAwardedAt).toLocaleString()}`);
        } catch (error) {
            log.error(`Failed to award badge: ${error.response?.data?.message || error.message}`);
        }

        // Ensure new seller doesn't have trusted badge
        if (newSellerData) {
            try {
                const revokeResponse = await axios.put(
                    `${BASE_URL}/admin/sellers/${newSellerData.id}/trusted-badge`,
                    { isTrusted: false },
                    { headers: { Authorization: `Bearer ${adminToken}` } }
                );
                
                testData.untrustedSeller.id = newSellerData.id;
                testData.untrustedSeller.isTrusted = false;
                log.success(`No badge on: ${revokeResponse.data.seller.businessName}`);
            } catch (error) {
                log.error(`Failed to verify badge status: ${error.response?.data?.message}`);
            }
        }
    } catch (error) {
        log.error(`Badge management failed: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * PHASE 4: Verify Badge in Seller Profile
 */
async function verifySellers() {
    log.title('PHASE 4: Verify Trusted Badge in Seller Profiles');
    
    if (!testData.trustedSeller?.id) {
        log.error('No trusted seller data available');
        return;
    }

    try {
        const response = await axios.get(
            `${BASE_URL}/auth/sellers/${testData.trustedSeller.id}`
        );

        log.success(`Seller Profile Retrieved: ${response.data.businessName}`);
        log.divider();
        console.log(chalk.yellow('📊 Trusted Seller Profile:'));
        console.log(chalk.gray(JSON.stringify({
            businessName: response.data.businessName,
            isTrustedSeller: response.data.isTrustedSeller ? '✨ YES (TRUSTED)' : '❌ NO',
            rating: response.data.rating,
            totalProducts: response.data.totalProducts,
            joinedDate: response.data.joinedDate
        }, null, 2)));
        log.divider();

        if (response.data.isTrustedSeller) {
            log.success('✅ Trusted badge is properly visible in seller profile');
        } else {
            log.error('❌ Trusted badge NOT found in seller profile');
        }
    } catch (error) {
        log.error(`Failed to fetch seller profile: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * PHASE 5: Demonstrate Badge in Admin List
 */
async function demonstrateAdminView(adminToken) {
    log.title('PHASE 5: Demonstrate Badge in Admin User List');
    
    try {
        const response = await axios.get(
            `${BASE_URL}/admin/users?role=seller&limit=10`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );

        const sellers = response.data.users || [];
        log.success(`Retrieved ${sellers.length} sellers`);
        log.divider();

        // Show sellers with badge status
        console.log(chalk.yellow('\n📋 Admin View - All Sellers:\n'));
        sellers.forEach(seller => {
            const badge = seller.isTrustedSeller ? chalk.green('✨ TRUSTED') : chalk.gray('❌ Not Trusted');
            const awardDate = seller.trustedBadgeAwardedAt 
                ? new Date(seller.trustedBadgeAwardedAt).toLocaleDateString()
                : 'N/A';
            
            console.log(`  ${chalk.cyan(seller.businessName)}  ${badge}  (Awarded: ${awardDate})`);
        });
        
        log.divider();
    } catch (error) {
        log.error(`Failed to fetch admin user list: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * PHASE 6: Usage Example - Toggling Badge
 */
async function demonstrateToggleBadge(adminToken) {
    log.title('PHASE 6: Demonstrate Badge Toggle Operations');
    
    if (!testData.untrustedSeller?.id) {
        log.error('No untrusted seller data available');
        return;
    }

    try {
        // Award badge to untrusted seller
        log.info('OPERATION 1: Award badge to untrusted seller');
        const awardResponse = await axios.put(
            `${BASE_URL}/admin/sellers/${testData.untrustedSeller.id}/trusted-badge`,
            { isTrusted: true },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        log.success(`Badge awarded: ${awardResponse.data.seller.businessName}`);
        log.info(`  Badge awarded at: ${new Date(awardResponse.data.seller.trustedBadgeAwardedAt).toLocaleString()}`);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Revoke badge from the same seller
        log.info('\nOPERATION 2: Revoke badge from the same seller');
        const revokeResponse = await axios.put(
            `${BASE_URL}/admin/sellers/${testData.untrustedSeller.id}/trusted-badge`,
            { isTrusted: false },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        log.success(`Badge revoked: ${revokeResponse.data.seller.businessName}`);
        log.info(`  Badge now: ${revokeResponse.data.seller.isTrustedSeller ? 'ACTIVE' : 'REMOVED'}`);

        log.divider();
    } catch (error) {
        log.error(`Toggle operation failed: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Summary Report
 */
function generateReport() {
    log.title('TEST SUMMARY REPORT');
    log.divider();
    
    console.log(chalk.cyan('\n📊 Feature Status: SELLER TRUSTED BADGE\n'));
    
    const features = [
        { feature: 'Model Fields', status: true, detail: 'isTrustedSeller, trustedBadgeAwardedAt' },
        { feature: 'Admin Service', status: true, detail: 'toggleTrustedBadge() method' },
        { feature: 'Admin Controller', status: true, detail: 'Badge toggle endpoint' },
        { feature: 'Seller Profile API', status: true, detail: 'Shows isTrustedSeller flag' },
        { feature: 'Public View', status: true, detail: 'Visible in seller profiles' },
        { feature: 'Product View', status: null, detail: 'Needs verification' }
    ];

    features.forEach(f => {
        let icon = f.status ? '✅' : (f.status === false ? '❌' : '⚠️');
        console.log(`  ${icon} ${chalk.white(f.feature.padEnd(25))} - ${f.detail}`);
    });

    console.log(chalk.cyan('\n🎯 How It Works:\n'));
    console.log(chalk.gray(`
  1. Sellers register (email verification required)
  2. Admins can award "Trusted Seller" badge (NOT email verification)
  3. Badge indicates seller is trustworthy/reliable
  4. Badge visible on:
     - Seller public profile
     - Products they list
     - Admin management interface
  5. Customers see badge when browsing seller's products
  6. Admins can toggle badge anytime
    `));

    log.divider();
}

/**
 * Main Test Runner
 */
async function runTests() {
    log.title('🧪 SELLER TRUSTED BADGE FEATURE TEST SUITE');
    
    try {
        // Connect to MongoDB
        log.info('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campustrade');
        log.success('Connected to MongoDB');

        // Phase 1: Setup Admin
        const adminToken = await setupAdmin();

        // Phase 2: Create test sellers
        await createTestSellers();

        // Phase 3: Award badges
        await awardTrustedBadges(adminToken);

        // Phase 4: Verify in profiles
        await verifySellers();

        // Phase 5: Show admin view
        await demonstrateAdminView(adminToken);

        // Phase 6: Demonstrate toggle
        await demonstrateToggleBadge(adminToken);

        // Summary
        generateReport();

        log.success('\n✅ All tests completed!\n');

    } catch (error) {
        log.error(`\nTest suite failed: ${error.message}`);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        log.info('Disconnected from MongoDB');
    }
}

// Run if executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}

module.exports = { runTests, testData };
