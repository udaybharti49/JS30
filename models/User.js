const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  
  // MLM Structure
  referralCode: {
    type: String,
    unique: true,
    required: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referredUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  level: {
    type: Number,
    default: 1
  },
  uplineUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    level: Number
  }],
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'agent'],
    default: 'user'
  },
  
  // Financial Information
  wallet: {
    balance: {
      type: Number,
      default: 0
    },
    frozenAmount: {
      type: Number,
      default: 0
    }
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    branchName: String,
    accountHolderName: String,
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  
  // KYC Information
  kyc: {
    aadharNumber: String,
    panNumber: String,
    aadharImage: String,
    panImage: String,
    photoImage: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    submittedAt: Date,
    approvedAt: Date,
    rejectionReason: String
  },
  
  // Services Status
  services: {
    recharge: {
      isActive: { type: Boolean, default: true },
      totalRecharges: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 }
    },
    courses: {
      purchasedCourses: [{
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        purchaseDate: { type: Date, default: Date.now },
        amount: Number,
        status: { type: String, enum: ['active', 'completed'], default: 'active' }
      }],
      totalSpent: { type: Number, default: 0 }
    },
    loans: {
      currentLoans: [{
        loanId: String,
        amount: Number,
        status: String,
        appliedDate: Date
      }],
      creditScore: Number,
      eligibleAmount: { type: Number, default: 0 }
    },
    insurance: {
      policies: [{
        policyId: String,
        type: String,
        premium: Number,
        coverageAmount: Number,
        status: String,
        startDate: Date,
        endDate: Date
      }]
    },
    banking: {
      kotakAccount: {
        accountNumber: String,
        status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
        appliedDate: Date,
        approvedDate: Date
      }
    }
  },
  
  // Commission and Earnings
  earnings: {
    totalEarnings: { type: Number, default: 0 },
    referralBonus: { type: Number, default: 0 },
    levelCommissions: {
      level1: { type: Number, default: 0 },
      level2: { type: Number, default: 0 },
      level3: { type: Number, default: 0 }
    },
    courseCommissions: { type: Number, default: 0 },
    serviceCommissions: { type: Number, default: 0 },
    monthlyEarnings: [{
      month: String,
      year: Number,
      amount: Number
    }]
  },
  
  // Notifications and Preferences
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  },
  
  lastLogin: Date,
  profileImage: String,
  
}, {
  timestamps: true
});

// Create referral code before saving
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.referralCode) {
    const code = 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase();
    this.referralCode = code;
  }
  
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Calculate user's network size
userSchema.methods.getNetworkSize = async function() {
  const User = this.constructor;
  
  const level1Count = await User.countDocuments({ referredBy: this._id });
  
  const level1Users = await User.find({ referredBy: this._id });
  let level2Count = 0;
  let level3Count = 0;
  
  for (let user of level1Users) {
    const level2Users = await User.find({ referredBy: user._id });
    level2Count += level2Users.length;
    
    for (let level2User of level2Users) {
      const level3Users = await User.find({ referredBy: level2User._id });
      level3Count += level3Users.length;
    }
  }
  
  return {
    level1: level1Count,
    level2: level2Count,
    level3: level3Count,
    total: level1Count + level2Count + level3Count
  };
};

module.exports = mongoose.model('User', userSchema);