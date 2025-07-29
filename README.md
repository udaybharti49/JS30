# MLM Platform - Complete Financial Services Platform

एक comprehensive MLM (Multi-Level Marketing) प्लेटफॉर्म जो विभिन्न financial services प्रदान करता है और automatic commission distribution के साथ network building की सुविधा देता है।

## 🚀 Features

### Core Services
1. **Mobile & DTH Recharge** - सभी operators के लिए instant recharge
2. **Digital Course Marketplace** - Online courses with MLM commission
3. **Loan Facility** - Personal, business और home loans
4. **Life Insurance** - Comprehensive insurance coverage
5. **Kotak Bank Account Opening** - Zero balance account opening
6. **MLM Commission System** - 3-level commission structure

### MLM Features
- **3-Level Commission Structure**: 5%, 3%, 2%
- **Automatic Commission Distribution**
- **Real-time Earnings Tracking**
- **Network Analytics & Statistics**
- **Referral Link Generation**
- **Rank & Achievement System**

### Technical Features
- **JWT Authentication**
- **Secure API Endpoints**
- **Transaction Management**
- **Email Notifications**
- **Payment Gateway Integration**
- **Admin Dashboard**
- **Mobile Responsive Design**

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Nodemailer** - Email service

### Frontend
- **HTML5, CSS3, JavaScript**
- **Bootstrap 5** - UI framework
- **Font Awesome** - Icons
- **Responsive Design**

### APIs & Integrations
- **Razorpay** - Payment gateway
- **Recharge API** - Mobile/DTH recharge
- **Banking API** - Account opening
- **Insurance API** - Policy management
- **Loan API** - Loan processing

## 📁 Project Structure

```
mlm-platform/
├── models/
│   ├── User.js              # User model with MLM structure
│   ├── Course.js            # Digital course model
│   └── Transaction.js       # Transaction management
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── recharge.js          # Recharge services
│   ├── courses.js           # Course marketplace
│   ├── loans.js             # Loan services
│   ├── insurance.js         # Insurance services
│   ├── banking.js           # Banking services
│   ├── mlm.js              # MLM specific routes
│   ├── dashboard.js         # Dashboard APIs
│   └── users.js            # User management
├── middleware/
│   └── auth.js              # Authentication middleware
├── utils/
│   ├── commission.js        # Commission processing
│   └── email.js            # Email utilities
├── services/
│   └── rechargeService.js   # External API integration
├── public/
│   ├── index.html           # Landing page
│   └── dashboard.html       # User dashboard
├── server.js               # Main server file
├── package.json            # Dependencies
└── .env                    # Environment variables
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd mlm-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start MongoDB**
```bash
# Make sure MongoDB is running
mongod
```

5. **Run the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

6. **Access the application**
- Frontend: http://localhost:5000
- API: http://localhost:5000/api
- Health Check: http://localhost:5000/api/health

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/mlm_platform

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# External API Keys
RECHARGE_API_KEY=your_recharge_api_key
KOTAK_API_KEY=your_kotak_api_key
INSURANCE_API_KEY=your_insurance_api_key
LOAN_API_KEY=your_loan_api_key

# MLM Configuration
REFERRAL_BONUS_PERCENTAGE=10
LEVEL_1_COMMISSION=5
LEVEL_2_COMMISSION=3
LEVEL_3_COMMISSION=2
MAX_LEVELS=3

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## 📚 API Documentation

### Authentication
```bash
# Register new user
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "password123",
  "dateOfBirth": "1990-01-01",
  "referralCode": "REF123ABC"
}

# Login
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Recharge Services
```bash
# Mobile recharge
POST /api/recharge/mobile
Authorization: Bearer <token>
{
  "mobileNumber": "9876543210",
  "operatorCode": "JIO",
  "amount": 149
}

# Get operators
GET /api/recharge/operators?type=mobile
```

### MLM Features
```bash
# Get referral details
GET /api/mlm/referral
Authorization: Bearer <token>

# Get commission history
GET /api/mlm/commissions
Authorization: Bearer <token>

# Get network tree
GET /api/mlm/network-tree
Authorization: Bearer <token>
```

## 💰 MLM Commission Structure

### Commission Levels
- **Level 1 (Direct Referrals)**: 5% commission
- **Level 2 (Indirect)**: 3% commission  
- **Level 3 (Sub-Indirect)**: 2% commission

### Earning Sources
1. **Recharge Commissions** - हर recharge पर commission
2. **Course Sales** - Digital course sales पर high commission
3. **Service Commissions** - Loans, insurance पर commission
4. **Referral Bonus** - नए user join करने पर bonus

### Rank System
- **Starter** - Default rank
- **Bronze** - 25+ network, ₹2,500+ earnings
- **Silver** - 100+ network, ₹10,000+ earnings
- **Gold** - 500+ network, ₹50,000+ earnings
- **Diamond** - 1000+ network, ₹1,00,000+ earnings

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt encryption
- **Rate Limiting** - API abuse protection
- **Input Validation** - Data sanitization
- **CORS Protection** - Cross-origin security
- **Helmet.js** - Security headers

## 📱 Frontend Features

### Landing Page
- **Hero Section** - Platform introduction
- **Services Overview** - All available services
- **MLM Plan Details** - Commission structure
- **Earnings Calculator** - Potential earnings
- **Registration Form** - User signup

### Dashboard
- **Overview Stats** - Wallet, earnings, network
- **Referral Tools** - Code sharing & tracking
- **Service Access** - Quick service buttons
- **Transaction History** - Recent activities
- **Wallet Management** - Add money, view balance

## 🚀 Deployment

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name "mlm-platform"

# Monitor
pm2 monit

# Restart
pm2 restart mlm-platform
```

### Using Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Setup
1. **Production MongoDB** - MongoDB Atlas या dedicated server
2. **SSL Certificate** - HTTPS के लिए SSL setup
3. **Domain Configuration** - Custom domain setup
4. **Email Service** - SMTP server configuration
5. **Payment Gateway** - Live API keys
6. **External APIs** - Production API keys

## 🧪 Testing

```bash
# Install dev dependencies
npm install --dev

# Run tests (if implemented)
npm test

# Test API endpoints
curl http://localhost:5000/api/health
```

## 📞 Support & Contact

### Technical Support
- **Email**: support@mlmplatform.com
- **Phone**: +91-XXXXXXXXXX
- **Documentation**: [API Docs](https://docs.mlmplatform.com)

### Business Inquiries
- **Email**: business@mlmplatform.com
- **WhatsApp**: +91-XXXXXXXXXX

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔄 Version History

- **v1.0.0** - Initial release with all core features
- **v1.1.0** - Enhanced MLM analytics
- **v1.2.0** - Mobile app integration

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- **Bootstrap** - UI Framework
- **MongoDB** - Database
- **Express.js** - Web Framework
- **Node.js** - Runtime Environment

---

**Made with ❤️ for MLM Business Growth**

*आपका business बढ़ाने के लिए complete solution*