# 🔧 SeniorCare Hub - Required APIs & Integration Setup

## 📋 **CRITICAL APIs NEEDED FOR FULL FUNCTIONALITY**

### **🗄️ TIER 1: Essential Database & Caching (REQUIRED)**

#### **PostgreSQL Database**
```bash
# Local Development Setup
brew install postgresql
# OR
sudo apt-get install postgresql postgresql-contrib

# Create database
createdb seniorcare_hub

# Run schema
psql seniorcare_hub < /app/server/database/schema.sql
```
**Configuration in .env:**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seniorcare_hub
DB_USER=postgres
DB_PASSWORD=your_password
```

#### **Redis Cache**
```bash
# Install Redis
brew install redis
# OR  
sudo apt-get install redis-server

# Start Redis
redis-server
```
**Configuration in .env:**
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

### **🔔 TIER 2: Notification Services (HIGH PRIORITY)**

#### **Firebase (Push Notifications)**
**Setup Steps:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: "SeniorCare Hub"
3. Enable Authentication and Cloud Messaging
4. Download service account key JSON

**Required Keys:**
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=path/to/serviceAccountKey.json
```

**Features Enabled:**
- Real-time push notifications for medication reminders
- Emergency alert notifications to caregivers
- Family message notifications
- Anomaly detection alerts

#### **Twilio (SMS/Voice Alerts)**
**Setup Steps:**
1. Sign up at [Twilio](https://www.twilio.com/)
2. Get Account SID, Auth Token, and Phone Number
3. Verify phone numbers for testing

**Required Keys:**
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VIDEO_API_KEY=your_video_key (for video calls)
TWILIO_VIDEO_API_SECRET=your_video_secret
```

**Features Enabled:**
- Emergency SMS alerts to family members
- Medication reminder SMS
- Voice call notifications
- Video calling functionality (Premium)

#### **SendGrid (Email Notifications)**
**Setup Steps:**
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create API key with Mail Send permissions
3. Set up sender authentication

**Required Keys:**
```
SENDGRID_API_KEY=your_api_key
FROM_EMAIL=noreply@seniorcarehub.com
FROM_NAME=SeniorCare Hub
```

**Features Enabled:**
- Password reset emails
- Family invitation emails
- Weekly wellness summary emails
- Emergency alert emails

---

### **💰 TIER 3: Payment & Premium Features (MEDIUM PRIORITY)**

#### **Stripe (Subscription Payments)**
**Setup Steps:**
1. Sign up at [Stripe](https://stripe.com/)
2. Get publishable and secret keys
3. Set up webhook endpoints

**Required Keys:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Features Enabled:**
- Premium subscription billing ($9.99/month)
- Enterprise billing
- Payment method management
- Subscription lifecycle management

#### **OpenAI (AI Features)**
**Setup Steps:**
1. Sign up at [OpenAI](https://platform.openai.com/)
2. Get API key
3. Set up billing (pay-per-use)

**Required Keys:**
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

**Features Enabled:**
- AI-powered wellness scoring
- Anomaly detection analysis
- Personalized health insights
- Predictive analytics

---

### **📁 TIER 4: File Storage (MEDIUM PRIORITY)**

#### **AWS S3 (File Storage)**
**Setup Steps:**
1. Create AWS account
2. Create S3 bucket: "seniorcare-hub-storage"
3. Create IAM user with S3 permissions

**Required Keys:**
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=seniorcare-hub-storage
```

**Features Enabled:**
- Medication photos storage
- Voice message storage
- Profile picture uploads
- Journal photo attachments
- Backup storage

---

### **🔍 TIER 5: Monitoring & Analytics (LOW PRIORITY)**

#### **Sentry (Error Monitoring)**
```
SENTRY_DSN=your_sentry_dsn
```

#### **Google Analytics**
```
GOOGLE_ANALYTICS_ID=GA-...
```

---

## 🧪 **API TESTING CHECKLIST**

### **Core API Endpoints to Test**

#### **✅ Authentication APIs**
```bash
# Register new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"senior@test.com","password":"password123","firstName":"John","lastName":"Doe","role":"senior"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"senior@test.com","password":"password123"}'

# Get profile (requires token)
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **✅ Daily Check-ins APIs**
```bash
# Create today's check-in
curl -X POST http://localhost:5000/api/checkins \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mood_rating":4,"energy_level":3,"pain_level":2,"sleep_quality":4,"appetite_rating":4,"hydration_glasses":6,"medications_taken":true,"exercise_minutes":30,"social_interaction":true}'

# Get check-in history
curl -X GET http://localhost:5000/api/checkins \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get today's check-in status
curl -X GET http://localhost:5000/api/checkins/today \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **✅ Medication APIs**
```bash
# Add medication
curl -X POST http://localhost:5000/api/medications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Metformin","dosage":"500mg","frequency":"twice_daily","times":["08:00","20:00"],"start_date":"2024-01-01","instructions":"Take with food"}'

# Get medications
curl -X GET http://localhost:5000/api/medications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get today's reminders
curl -X GET http://localhost:5000/api/medications/reminders/today \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **✅ Emergency APIs**
```bash
# Create emergency alert
curl -X POST http://localhost:5000/api/emergency/alert \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alert_type":"manual","severity":"high","message":"I need immediate assistance","location_data":{"latitude":40.7128,"longitude":-74.0060}}'

# Get emergency alerts
curl -X GET http://localhost:5000/api/emergency/alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **✅ Messaging APIs**
```bash
# Send message
curl -X POST http://localhost:5000/api/messaging/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient_id":"RECIPIENT_USER_ID","message_text":"Hello, how are you feeling today?","message_type":"text"}'

# Get conversations
curl -X GET http://localhost:5000/api/messaging/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **✅ Dashboard APIs**
```bash
# Get dashboard data
curl -X GET http://localhost:5000/api/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get wellness summary
curl -X GET http://localhost:5000/api/dashboard/wellness-summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **✅ Premium Features APIs**
```bash
# Get AI wellness score
curl -X GET http://localhost:5000/api/premium/wellness-score \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Run anomaly detection
curl -X POST http://localhost:5000/api/premium/detect-anomalies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get AI insights
curl -X GET http://localhost:5000/api/premium/ai-insights \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚀 **QUICK START SETUP SCRIPT**

Create this setup script to get started quickly:

```bash
#!/bin/bash
# setup.sh - Quick setup for SeniorCare Hub

echo "🛡️ Setting up SeniorCare Hub..."

# Install dependencies
cd /app && npm install
cd /app/client && npm install --legacy-peer-deps

# Create environment files from templates
cp /app/.env.example /app/.env
cp /app/client/.env.example /app/client/.env

# Create logs directory
mkdir -p /app/server/logs

echo "✅ Basic setup complete!"
echo "📝 Next steps:"
echo "1. Set up PostgreSQL database"
echo "2. Set up Redis cache"  
echo "3. Configure API keys in .env files"
echo "4. Run: npm start (backend) and npm run dev:client (frontend)"
```

---

## 🎯 **PRIORITY ORDER FOR INTEGRATION**

1. **🔴 CRITICAL (Start Here):**
   - PostgreSQL + Redis (Local development)
   - Basic authentication testing

2. **🟡 HIGH PRIORITY:**
   - Firebase (Push notifications)
   - Twilio (SMS alerts)
   - SendGrid (Email)

3. **🟢 MEDIUM PRIORITY:**
   - Stripe (Payments)
   - AWS S3 (File storage)
   - OpenAI (AI features)

4. **🔵 LOW PRIORITY:**
   - Monitoring tools
   - Analytics
   - Advanced integrations

---

**Ready to start with Database setup and then move to full frontend development!** 🚀