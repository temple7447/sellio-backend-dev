# Mailtrap Email Configuration

This application has been updated to use Mailtrap API with Nodemailer for sending emails.

## Required Environment Variables

Add the following variables to your `.env` file:

```env
# Mailtrap Configuration
MAILTRAP_TOKEN=your_mailtrap_api_token_here
MAILTRAP_SENDER_EMAIL=hello@demomailtrap.co
MAILTRAP_SENDER_NAME=Sellio Marketplace
```

## Getting Mailtrap Credentials

1. **Sign up for Mailtrap**: Go to [Mailtrap.io](https://mailtrap.io/) and create an account
2. **Get API Token**: 
   - Go to Settings > API Tokens
   - Create a new token or copy an existing one
3. **Configure Sender**: 
   - Use the default sender email (`hello@demomailtrap.co`) for testing
   - Or configure your own verified domain

## Features

- **Email Testing**: Perfect for development and testing environments
- **Email Analytics**: Track email opens, clicks, and delivery status
- **HTML & Text Support**: Send both HTML and text versions of emails
- **Safe Testing**: Emails are caught and displayed in Mailtrap interface
- **Integration**: Uses Nodemailer with Mailtrap transport

## Migration Notes

- The `sendOTP` function interface remains the same
- No changes required to existing code that uses the email utility
- Mailtrap provides both HTML and text versions of emails
- Better error handling and logging included
- Includes email categorization for better organization

## Testing

The application will log Mailtrap configuration status on startup:
- ✓ Success: Mailtrap is configured and ready
- ✗ Error: Missing API token or configuration

## Production Notes

For production use:
1. Consider using Mailtrap's sending service or switch to a production email provider
2. Update the sender email to your verified domain
3. Configure proper email templates and branding

## Fallback

If you need to revert or change email providers:
1. Update the transport configuration in `src/utils/email.js`
2. Modify environment variables accordingly
3. Test the new configuration thoroughly
