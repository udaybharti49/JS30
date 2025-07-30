const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Transaction Basic Info
  transactionId: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Transaction Details
  type: {
    type: String,
    enum: [
      'recharge',
      'course_purchase',
      'commission_earned',
      'referral_bonus',
      'withdrawal',
      'deposit',
      'loan_disbursement',
      'loan_repayment',
      'insurance_premium',
      'bank_transfer',
      'refund',
      'penalty'
    ],
    required: true
  },
  
  subType: String, // mobile_recharge, dth_recharge, etc.
  
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  
  // Service Specific Details
  serviceDetails: {
    // For Recharge
    operatorName: String,
    operatorCode: String,
    mobileNumber: String,
    rechargeAmount: Number,
    
    // For Course Purchase
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    courseName: String,
    
    // For Commission/Bonus
    sourceUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sourceTransactionId: String,
    commissionLevel: Number,
    commissionPercentage: Number,
    
    // For Loans
    loanId: String,
    loanAmount: Number,
    interestRate: Number,
    tenure: Number,
    
    // For Insurance
    policyId: String,
    policyType: String,
    premiumAmount: Number,
    coverageAmount: Number,
    
    // For Banking
    bankAccount: String,
    ifscCode: String,
    beneficiaryName: String
  },
  
  // Payment Gateway Details
  paymentGateway: {
    provider: String, // razorpay, paytm, etc.
    gatewayTransactionId: String,
    gatewayOrderId: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  
  // Before and After Balances
  balanceDetails: {
    beforeBalance: Number,
    afterBalance: Number,
    walletUsed: Number,
    gatewayAmount: Number
  },
  
  // Commission Distribution (for purchases)
  commissionDistribution: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    level: Number,
    percentage: Number,
    amount: Number,
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' }
  }],
  
  // Additional Details
  description: String,
  notes: String,
  adminNotes: String,
  
  // API Response/Request Details
  apiDetails: {
    requestPayload: mongoose.Schema.Types.Mixed,
    responsePayload: mongoose.Schema.Types.Mixed,
    apiProvider: String,
    apiTransactionId: String
  },
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  failedAt: Date,
  
  // Error Details
  errorDetails: {
    errorCode: String,
    errorMessage: String,
    retryCount: { type: Number, default: 0 }
  },
  
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String,
    location: {
      city: String,
      state: String,
      country: String
    }
  }
  
}, {
  timestamps: true
});

// Generate transaction ID before saving
transactionSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.transactionId = `TXN${timestamp}${random}`;
  }
  next();
});

// Static method to generate unique transaction ID
transactionSchema.statics.generateTransactionId = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `TXN${timestamp}${random}`;
};

// Method to update transaction status
transactionSchema.methods.updateStatus = function(status, details = {}) {
  this.status = status;
  
  if (status === 'completed') {
    this.completedAt = new Date();
  } else if (status === 'failed') {
    this.failedAt = new Date();
    if (details.error) {
      this.errorDetails.errorCode = details.error.code;
      this.errorDetails.errorMessage = details.error.message;
    }
  }
  
  if (details.gatewayResponse) {
    this.paymentGateway.gatewayResponse = details.gatewayResponse;
  }
  
  return this.save();
};

// Get transaction summary for user
transactionSchema.statics.getUserTransactionSummary = async function(userId, dateRange = {}) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (dateRange.startDate || dateRange.endDate) {
    match.createdAt = {};
    if (dateRange.startDate) match.createdAt.$gte = new Date(dateRange.startDate);
    if (dateRange.endDate) match.createdAt.$lte = new Date(dateRange.endDate);
  }
  
  const summary = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        lastTransaction: { $max: '$createdAt' }
      }
    }
  ]);
  
  return summary;
};

module.exports = mongoose.model('Transaction', transactionSchema);