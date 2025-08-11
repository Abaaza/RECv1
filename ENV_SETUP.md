# Environment Variables Setup Guide

This guide explains how to set up your environment variables for the Dental AI Receptionist application.

## Important Security Notice

⚠️ **NEVER commit your actual API keys or credentials to version control!**

The `.env` files are ignored by git to prevent accidental exposure of sensitive information.

## Setup Instructions

### 1. Backend Environment Variables

1. Navigate to the server directory:
   ```bash
   cd dental-ai-receptionist/server
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file and replace the placeholder values with your actual credentials:

   **Required:**
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A strong, random secret key for JWT tokens
   - `OPENAI_API_KEY`: Your OpenAI API key from https://platform.openai.com/api-keys
   - `DEEPGRAM_API_KEY`: Your Deepgram API key from https://console.deepgram.com/

   **Optional (based on features you want to use):**
   - Twilio credentials for SMS functionality
   - Stripe keys for payment processing
   - Email configuration for notifications

### 2. Frontend Environment Variables

1. Navigate to the frontend directory:
   ```bash
   cd dental-ai-receptionist
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file:
   - `VITE_DEEPGRAM_API_KEY`: Your Deepgram API key (same as backend)
   - Keep other URLs as default for local development

## Getting Your API Keys

### OpenAI API Key
1. Sign up at https://platform.openai.com/
2. Go to API Keys section
3. Create a new secret key
4. Copy and save it securely

### Deepgram API Key
1. Sign up at https://deepgram.com/
2. Go to console at https://console.deepgram.com/
3. Create a new API key
4. Copy and save it securely

### MongoDB Connection String
- **Local MongoDB**: `mongodb://localhost:27017/dental-ai-receptionist`
- **MongoDB Atlas**: 
  1. Create a free cluster at https://www.mongodb.com/cloud/atlas
  2. Get your connection string from the cluster dashboard
  3. Format: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority`

## Security Best Practices

1. **Never share your API keys publicly**
2. **Use different keys for development and production**
3. **Rotate your keys regularly**
4. **Set appropriate API key restrictions and limits**
5. **Use environment-specific `.env` files (.env.development, .env.production)**
6. **Store production secrets in secure services (AWS Secrets Manager, etc.)**

## Verification

After setting up your environment variables:

1. Test backend connection:
   ```bash
   cd dental-ai-receptionist/server
   npm run dev
   ```

2. Test frontend:
   ```bash
   cd dental-ai-receptionist
   npm run dev
   ```

Both should start without errors if your environment variables are correctly configured.

## Troubleshooting

- **MongoDB connection error**: Verify your connection string and network access (for MongoDB Atlas)
- **OpenAI API error**: Check your API key and account credits
- **Deepgram API error**: Verify your API key and project settings
- **CORS errors**: Ensure `ALLOWED_ORIGINS` matches your frontend URL

## Git Safety Check

Before committing, always verify that sensitive files are ignored:

```bash
git status
```

Make sure no `.env` files appear in the list of files to be committed.