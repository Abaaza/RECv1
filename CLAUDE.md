# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Frontend (dental-ai-receptionist directory)
```bash
# Development
npm run dev           # Start Vite dev server (port 5173)
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # Run ESLint

# Testing
npm test              # Run Vitest tests
```

### Backend (dental-ai-receptionist/server directory)
```bash
# Development
cd server && npm run dev    # Start with nodemon
cd server && npm start      # Production server (port 5001)

# Testing
cd server && npm test       # Run Jest tests
```

### Docker Development
```bash
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose logs -f      # View logs
```

### AWS Deployment
```bash
# Serverless deployment
npm run deploy              # Deploy to AWS Lambda

# Terraform infrastructure
cd terraform
terraform init
terraform plan
terraform apply
```

### Test Execution
```bash
# PowerShell test runners
./start-and-test.ps1        # Automated testing
./test-runner.ps1           # Run specific test suites

# Windows batch
run-test.bat                # Windows test execution
```

## Architecture Overview

### Technology Stack
- **Frontend**: React 19 with Vite, TailwindCSS, Framer Motion, i18next (8 languages)
- **Backend**: Express 4.x with JWT authentication, MongoDB/Mongoose, Socket.io
- **AI Integration**: Deepgram (voice recognition), OpenAI (chat capabilities)
- **Infrastructure**: AWS (Lambda/Serverless, ECS Fargate, CloudFront), Docker, Terraform
- **Communication**: Twilio (SMS), Nodemailer (email), WebSocket (real-time)

### Project Structure
```
dental-ai-receptionist/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page-level components
│   ├── services/           # API clients and integrations
│   ├── i18n/               # Internationalization (8 languages)
│   └── utils/              # Utility functions
├── server/                 # Backend Express API
│   ├── routes/             # API endpoints
│   ├── models/             # Mongoose schemas
│   ├── middleware/         # Auth, security, error handling
│   ├── services/           # Business logic (AI, scheduling)
│   └── tests/              # Jest test suites
├── terraform/              # AWS infrastructure as code
└── deployment files        # Docker, Serverless configs
```

### Key Architectural Patterns

1. **Authentication & Security**
   - JWT-based authentication with refresh tokens
   - Role-based access control (admin, dentist, receptionist, patient)
   - Security middleware: Helmet, CORS, rate limiting, input sanitization
   - Protected routes with auth middleware

2. **API Design**
   - RESTful endpoints: `/api/auth`, `/api/appointments`, `/api/patients`, `/api/ai`
   - WebSocket support for real-time updates
   - Standard error handling middleware
   - Request validation and sanitization

3. **Database Schema**
   - MongoDB with Mongoose ODM
   - Core models: User, Patient, Appointment, Treatment, Analytics
   - Audit trails with timestamps
   - Appointment conflict detection logic

4. **AI Integration Pipeline**
   - Deepgram SDK for voice recognition
   - OpenAI for natural language processing
   - Real-time transcription via WebSocket
   - Emergency triage system with severity assessment

5. **Deployment Architecture**
   - **Serverless**: AWS Lambda + API Gateway + DynamoDB
   - **Containerized**: ECS Fargate + ALB + CloudFront
   - **Local**: Docker Compose with MongoDB, Redis, Nginx
   - Environment-based configuration

### Environment Variables

Frontend (.env):
```
VITE_API_URL=http://localhost:5001/api
VITE_DEEPGRAM_API_KEY=your-deepgram-key
```

Backend (.env):
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/dental-ai
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=your-openai-key
DEEPGRAM_API_KEY=your-deepgram-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### Testing Approach
- **Backend**: Jest with comprehensive API endpoint testing (16 test suites)
- **Frontend**: Vitest with React Testing Library
- **Coverage**: HTML reports in coverage/ directory
- Run specific test: `npm test -- path/to/test.js`
- Watch mode: `npm test -- --watch`

### Important Implementation Details

1. **Voice Processing Flow**
   - Frontend captures audio via MediaRecorder API
   - WebSocket connection to Deepgram for real-time transcription
   - Processed text sent to OpenAI for intent recognition
   - Response synthesized back to voice

2. **Appointment Scheduling**
   - Conflict detection algorithm in `server/services/appointmentService.js`
   - Time slot availability checking
   - Automatic reminder system via SMS/email
   - Rescheduling and cancellation workflows

3. **Multi-language Support**
   - i18next configuration in `src/i18n/`
   - Supported languages: EN, ES, FR, DE, IT, PT, JA, ZH
   - Dynamic language switching without page reload

4. **Real-time Features**
   - Socket.io for WebSocket communication
   - Live appointment updates
   - Real-time dashboard analytics
   - Instant notification delivery

### Deployment Notes
- Frontend runs on port 5173 (dev) / 3000 (production)
- Backend API runs on port 5001
- MongoDB default port 27017
- Redis default port 6379
- AWS deployment requires configured AWS CLI credentials
- Terraform state management for infrastructure