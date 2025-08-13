# CETEC ERP API Setup Guide

This guide explains how to set up and use the CETEC ERP API integration in your React application.

## Environment Configuration

1. Create a `.env.local` file in your project root (this file is automatically ignored by git):

```bash
# CETEC ERP API Configuration
VITE_CETEC_DOMAIN=yourdomain.cetecerp.com
VITE_PRESHARED_TOKEN=your_actual_token_here
VITE_API_PROTOCOL=http
```

2. Replace the placeholder values:
   - `yourdomain.cetecerp.com` with your actual CETEC ERP domain
   - `your_actual_token_here` with your actual preshared token
   - `http` with your preferred protocol (http or https)

## API Endpoint Format

The API call follows this format:
```
GET https://{DOMAIN}.cetecerp.com/api/customer?id={ID}&name={NAME}&external_key={KEY}&columns={COLUMNS}&preshared_token={TOKEN}
```

This matches your curl example:
```bash
curl --request GET \
  --url 'https://YOURDOMAIN.cetecerp.com/api/customer?id=SOME_INTEGER_VALUE&name=SOME_STRING_VALUE&external_key=SOME_STRING_VALUE&columns=SOME_STRING_VALUE&preshared_token=SOME_STRING_VALUE'
```

**Query Parameters:**
- `id` (optional): Customer ID as integer
- `name` (optional): Customer name as string
- `external_key` (optional): External key as string
- `columns` (optional): Specific columns to return as string
- `preshared_token` (required): Authentication token

## How It Works

1. **Configuration**: The `src/config.ts` file reads environment variables and provides helper functions
2. **API Call**: The React component uses axios to make HTTP requests to the CETEC ERP API
3. **Authentication**: Uses the preshared token as a query parameter (not in headers)
4. **Data Display**: Shows the API response in a formatted JSON view

## Security Notes

- Never commit your `.env.local` file to version control
- The preshared token is sent as a query parameter (ensure HTTPS is used)
- Consider implementing additional security measures for production use

## Testing

1. Start your development server: `npm run dev`
2. Open the app in your browser
3. Enter a customer ID and click "Fetch Customer Data"
4. Check the browser console for configuration logs
5. Verify the API response is displayed correctly

## Troubleshooting

- **CORS Issues**: Ensure your CETEC ERP server allows requests from your domain
- **Authentication Errors**: Verify your preshared token is correct
- **Network Errors**: Check if the domain is accessible from your network
- **Environment Variables**: Ensure variables are prefixed with `VITE_` for Vite to recognize them

## Production Considerations

- Remove console.log statements from config.ts
- Implement proper error handling and user feedback
- Add loading states and retry mechanisms
- Consider implementing request caching
- Add rate limiting if needed
