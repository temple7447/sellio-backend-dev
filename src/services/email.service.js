const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        // Initialize Mailtrap or your email service
        this.transporter = nodemailer.createTransport({
            host: process.env.MAILTRAP_HOST || 'smtp.mailtrap.io',
            port: process.env.MAILTRAP_PORT || 465,
            secure: true,
            auth: {
                user: process.env.MAILTRAP_USER,
                pass: process.env.MAILTRAP_PASSWORD
            }
        });
    }

    /**
     * Send email with template
     */
    async sendEmail(to, subject, htmlContent) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@campustrade.com',
                to,
                subject,
                html: htmlContent,
                text: htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${to}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error(`❌ Email failed for ${to}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Order Confirmation Email
     */
    orderConfirmation(userEmail, userName, orderId, items, total) {
        const itemsHtml = items.map(item => `
            <tr>
                <td style="padding: 8px;">${item.productName}</td>
                <td style="padding: 8px; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; text-align: right;">₦${item.price.toLocaleString()}</td>
                <td style="padding: 8px; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
            </tr>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Order Confirmation</h1>
                <p>Hi ${userName},</p>
                <p>Thank you for your order! Here are your order details:</p>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <h3>Order Items</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <thead style="background: #f0f0f0;">
                        <tr>
                            <th style="padding: 8px; text-align: left;">Product</th>
                            <th style="padding: 8px; text-align: center;">Qty</th>
                            <th style="padding: 8px; text-align: right;">Price</th>
                            <th style="padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="border-top: 2px solid #ddd; padding-top: 15px; text-align: right;">
                    <p style="font-size: 18px;"><strong>Total Amount: ₦${total.toLocaleString()}</strong></p>
                </div>

                <p>You will receive updates about your order status via email.</p>
                <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
            </div>
        `;

        return html;
    }

    /**
     * Payment Successful Email
     */
    paymentSuccessful(userEmail, userName, orderId, amount, reference) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #28a745;">✓ Payment Successful</h1>
                <p>Hi ${userName},</p>
                <p>Your payment has been successfully processed. Thank you!</p>
                
                <div style="background: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Amount Paid:</strong> ₦${amount.toLocaleString()}</p>
                    <p><strong>Reference:</strong> ${reference}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <p>Your order has been confirmed and is being processed by our sellers. You will receive tracking information once it ships.</p>
            </div>
        `;

        return html;
    }

    /**
     * Order Shipped Email
     */
    orderShipped(userEmail, userName, orderId, items, trackingNumber) {
        const itemsHtml = items.map(item => `
            <li>${item.productName} (Qty: ${item.quantity}) - 
                <span style="color: #666;">from ${item.sellerName}</span>
            </li>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2196F3;">📦 Your Order Is Shipped!</h1>
                <p>Hi ${userName},</p>
                <p>Great news! Your order has been shipped and is on its way to you.</p>
                
                <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Tracking Number:</strong> ${trackingNumber || 'Will be updated soon'}</p>
                    <p><strong>Shipped Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <h3>Items Shipped:</h3>
                <ul>
                    ${itemsHtml}
                </ul>

                <p>You can track your package using the tracking number above. Please confirm receipt when your order arrives.</p>
            </div>
        `;

        return html;
    }

    /**
     * Order Delivered Email (with review request)
     */
    orderDelivered(userEmail, userName, orderId, items) {
        const itemsHtml = items.map(item => `
            <li>${item.productName} - from <strong>${item.sellerName}</strong></li>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #4caf50;">✓ Order Delivered</h1>
                <p>Hi ${userName},</p>
                <p>Your order has been delivered! We hope you're happy with your purchase.</p>
                
                <div style="background: #f1f8e9; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Delivered Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <h3>Items Received:</h3>
                <ul>
                    ${itemsHtml}
                </ul>

                <p>Please take a moment to leave a review for the items you received. Your feedback helps other customers make informed decisions and helps sellers improve their service.</p>
                
                <p style="text-align: center; margin: 20px 0;">
                    <a href="${process.env.FRONTEND_URL}/orders/${orderId}/review" 
                       style="background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Leave a Review
                    </a>
                </p>
            </div>
        `;

        return html;
    }

    /**
     * Order Cancelled Email
     */
    orderCancelled(userEmail, userName, orderId, reason, refundAmount) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #f44336;">Order Cancelled</h1>
                <p>Hi ${userName},</p>
                <p>Your order has been cancelled.</p>
                
                <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p><strong>Refund Amount:</strong> ₦${refundAmount.toLocaleString()}</p>
                    <p><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <p>The refund has been initiated and will be credited to your wallet within 2-3 business days.</p>
            </div>
        `;

        return html;
    }

    /**
     * Wallet Credited Email
     */
    walletCredited(userEmail, userName, amount, reason, reference) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #4caf50;">💰 Wallet Credited</h1>
                <p>Hi ${userName},</p>
                <p>Your wallet has been credited with funds.</p>
                
                <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0;">
                    <p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p><strong>Reference:</strong> ${reference}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <p>You can now use this amount for future purchases or request a withdrawal.</p>
            </div>
        `;

        return html;
    }

    /**
     * Withdrawal Request Status Email
     */
    withdrawalStatus(userEmail, userName, amount, status, reason = '', feeDetails = null) {
        const statusMap = {
            approved: { color: '#4caf50', icon: '✓', title: 'Withdrawal Approved' },
            rejected: { color: '#f44336', icon: '✗', title: 'Withdrawal Rejected' },
            completed: { color: '#2196F3', icon: '✓', title: 'Withdrawal Completed' }
        };

        const statusInfo = statusMap[status] || statusMap.approved;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto;">
                <h1 style="color: ${statusInfo.color};">${statusInfo.icon} ${statusInfo.title}</h1>
                <p>Hi ${userName},</p>

                <div style="background: #f5f5f5; border-left: 4px solid ${statusInfo.color}; padding: 15px; margin: 15px 0;">
                    ${feeDetails ? `
                    <p><strong>Original Amount:</strong> ₦${feeDetails.originalAmount?.toLocaleString()}</p>
                    <p><strong>Fee (${feeDetails.feePercentage}%):</strong> ₦${feeDetails.feeAmount?.toLocaleString()}</p>
                    <p><strong>Amount Transferred:</strong> ₦${feeDetails.amountAfterFee?.toLocaleString()}</p>
                    ` : `<p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>`}
                    <p><strong>Status:</strong> ${status.toUpperCase()}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                </div>

                ${status === 'completed' ? '<p>The funds have been transferred to your bank account.</p>' : ''}
                ${status === 'rejected' ? '<p>The withdrawal has been rejected. The funds are still available in your wallet.</p>' : ''}
            </div>
        `;

        return html;
    }

    /**
     * Complaint Resolution Email
     */
    complaintResolved(userEmail, userName, complaintId, resolution, decision) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2196F3;">Your Complaint Has Been Resolved</h1>
                <p>Hi ${userName},</p>
                <p>We have reviewed your complaint and the decision has been made.</p>
                
                <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0;">
                    <p><strong>Complaint ID:</strong> ${complaintId}</p>
                    <p><strong>Decision:</strong> ${decision}</p>
                    <p><strong>Resolution:</strong> ${resolution}</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <p>If you have any questions about this decision, please contact our support team.</p>
            </div>
        `;

        return html;
    }

    /**
     * Seller: New Order Received
     */
    sellerNewOrder(sellerEmail, sellerName, orderId, items, totalAmount, buyerName) {
        const itemsHtml = items.map(item => `
            <tr>
                <td style="padding: 8px;">${item.productName} (${item.sku || 'N/A'})</td>
                <td style="padding: 8px; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
            </tr>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ff9800;">🎉 New Order Received!</h1>
                <p>Hi ${sellerName},</p>
                <p>You have a new order from a customer. Please prepare for shipment.</p>
                
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Buyer:</strong> ${buyerName}</p>
                    <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <h3>Items to Ship:</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <thead style="background: #f0f0f0;">
                        <tr>
                            <th style="padding: 8px; text-align: left;">Product</th>
                            <th style="padding: 8px; text-align: center;">Qty</th>
                            <th style="padding: 8px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="border-top: 2px solid #ddd; padding-top: 15px; text-align: right;">
                    <p style="font-size: 18px;"><strong>Total: ₦${totalAmount.toLocaleString()}</strong></p>
                </div>

                <p style="text-align: center; margin: 20px 0;">
                    <a href="${process.env.FRONTEND_URL}/seller/orders/${orderId}" 
                       style="background: #ff9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        View Order Details
                    </a>
                </p>
            </div>
        `;

        return html;
    }

    /**
     * Seller: Low Stock Alert
     */
    lowStockAlert(sellerEmail, sellerName, productName, currentStock, threshold) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ff9800;">⚠️ Low Stock Alert</h1>
                <p>Hi ${sellerName},</p>
                <p>One of your products is running low on stock.</p>
                
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                    <p><strong>Product:</strong> ${productName}</p>
                    <p><strong>Current Stock:</strong> ${currentStock} units</p>
                    <p><strong>Alert Threshold:</strong> ${threshold} units</p>
                </div>

                <p>Please restock this product soon to avoid running out of inventory.</p>
            </div>
        `;

        return html;
    }

    /**
     * OTP Email
     */
    otpEmail(email, userName, otp, purpose = 'verification') {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Email ${purpose.charAt(0).toUpperCase() + purpose.slice(1)}</h1>
                <p>Hi ${userName},</p>
                <p>Your one-time password (OTP) for ${purpose} is:</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
                    <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333;">${otp}</p>
                </div>

                <p>This OTP will expire in 10 minutes. Do not share this code with anyone.</p>
                <p style="color: #666; font-size: 12px;">If you did not request this code, please ignore this email.</p>
            </div>
        `;

        return html;
    }

    /**
     * Password Reset Email
     */
    passwordReset(email, userName, resetLink) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>Password Reset Request</h1>
                <p>Hi ${userName},</p>
                <p>You requested to reset your password. Click the link below to proceed:</p>
                
                <p style="text-align: center; margin: 20px 0;">
                    <a href="${resetLink}" 
                       style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </p>

                <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
            </div>
        `;

        return html;
    }

    /**
     * Payment Proof Submitted Email (to customer)
     */
    paymentProofSubmitted(userEmail, userName, orderId, amount) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ff9800;">📋 Payment Proof Submitted</h1>
                <p>Hi ${userName},</p>
                <p>Thank you for submitting your payment proof. Your payment is now being verified.</p>
                
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>
                    <p><strong>Status:</strong> Pending Verification</p>
                    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <p>Our team will verify your payment within 24-48 hours. Once verified, you will receive a confirmation email and your order will be processed.</p>
                
                <p>If you have any questions, please contact our support team.</p>
            </div>
        `;

        return html;
    }

    /**
     * Admin: New Payment Proof Alert
     */
    adminPaymentProofAlert(orderId, buyerName, buyerEmail, amount, proofUrl) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #d32f2f;">🔔 Payment Proof Needs Review</h1>
                <p>A buyer has uploaded a payment proof and is awaiting your verification.</p>

                <div style="background: #fce4ec; border-left: 4px solid #d32f2f; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Buyer:</strong> ${buyerName} (${buyerEmail})</p>
                    <p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>
                    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                </div>

                ${proofUrl ? `<p><strong>Payment Proof:</strong> <a href="${proofUrl}" target="_blank">View Proof Screenshot</a></p>` : ''}

                <p style="text-align: center; margin: 20px 0;">
                    <a href="${process.env.FRONTEND_URL}/admin/orders/${orderId}"
                       style="background: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Review &amp; Verify Payment
                    </a>
                </p>

                <p style="color: #666; font-size: 12px;">Please approve or decline this payment so the order can proceed.</p>
            </div>
        `;
        return html;
    }

    /**
     * Payment Verified Email (to customer)
     */
    paymentVerified(userEmail, userName, orderId, amount) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #28a745;">✅ Payment Verified!</h1>
                <p>Hi ${userName},</p>
                <p>Great news! Your payment has been verified and your order has been confirmed.</p>
                
                <div style="background: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0;">
                    <p><strong>Order ID:</strong> ${orderId}</p>
                    <p><strong>Amount Paid:</strong> ₦${amount.toLocaleString()}</p>
                    <p><strong>Status:</strong> Confirmed - Processing</p>
                    <p><strong>Verified:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <p>Your order is now being processed and will be shipped soon. You will receive a shipping notification once your items are on their way.</p>
                
                <p>Thank you for shopping with Campus Trade!</p>
            </div>
        `;

        return html;
    }

    /**
     * Admin: New Withdrawal Request Alert
     */
    adminWithdrawalAlert(userName, userEmail, userRole, amount, feeDetails = null) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #d32f2f;">🔔 New Withdrawal Request</h1>
                <p>A user has submitted a withdrawal request that requires your attention.</p>

                <div style="background: #fce4ec; border-left: 4px solid #d32f2f; padding: 15px; margin: 15px 0;">
                    <p><strong>User:</strong> ${userName} (${userEmail})</p>
                    <p><strong>Role:</strong> ${userRole}</p>
                    ${feeDetails ? `
                    <p><strong>Requested Amount:</strong> ₦${feeDetails.originalAmount?.toLocaleString()}</p>
                    <p><strong>Fee (${feeDetails.feePercentage}%):</strong> ₦${feeDetails.feeAmount?.toLocaleString()}</p>
                    <p><strong>Amount to Transfer:</strong> ₦${feeDetails.amountAfterFee?.toLocaleString()}</p>
                    ` : `<p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>`}
                    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <p style="text-align: center; margin: 20px 0;">
                    <a href="${process.env.FRONTEND_URL}/admin/withdrawals"
                       style="background: #d32f2f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Review Withdrawal Requests
                    </a>
                </p>

                <p style="color: #666; font-size: 12px;">Please review and process this request promptly.</p>
            </div>
        `;

        return html;
    }

    /**
     * Withdrawal Request Received Email (to user)
     */
    withdrawalRequested(userEmail, userName, amount, feeDetails = null) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #ff9800;">⏳ Withdrawal Request Received</h1>
                <p>Hi ${userName},</p>
                <p>Your withdrawal request has been received and is being processed.</p>

                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                    ${feeDetails ? `
                    <p><strong>Requested Amount:</strong> ₦${feeDetails.originalAmount?.toLocaleString()}</p>
                    <p><strong>Fee (${feeDetails.feePercentage}%):</strong> ₦${feeDetails.feeAmount?.toLocaleString()}</p>
                    <p><strong>Amount to be Transferred:</strong> ₦${feeDetails.amountAfterFee?.toLocaleString()}</p>
                    ` : `<p><strong>Amount:</strong> ₦${amount.toLocaleString()}</p>`}
                    <p><strong>Status:</strong> PENDING</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                </div>

                <p>We will notify you once your withdrawal has been processed. This typically takes 1-3 business days.</p>
                <p style="color: #666; font-size: 12px;">If you did not initiate this request, please contact our support team immediately.</p>
            </div>
        `;

        return html;
    }
}

module.exports = new EmailService();
