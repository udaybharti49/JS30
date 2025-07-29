const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      address,
      referralCode
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone number'
      });
    }

    // Validate referral code if provided
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
      }
      referredBy = referrer._id;
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      dateOfBirth,
      address,
      referredBy
    });

    await user.save();

    // Update referrer's referral list and level structure
    if (referredBy) {
      await updateMLMStructure(user._id, referredBy);
    }

    // Generate token
    const token = generateToken(user._id);

    // Send welcome email
    await sendWelcomeEmail(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          referralCode: user.referralCode,
          referredBy: referredBy
        },
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          referralCode: user.referralCode,
          role: user.role,
          isVerified: user.isVerified,
          kycStatus: user.kyc.status,
          walletBalance: user.wallet.balance
        },
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('referredBy', 'firstName lastName email referralCode')
      .populate('referredUsers', 'firstName lastName email referralCode createdAt');

    const networkSize = await user.getNetworkSize();

    res.json({
      success: true,
      data: {
        user,
        networkSize
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'address', 
      'bankDetails', 'notifications'
    ];

    // Filter allowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save reset token (you might want to add these fields to User model)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Send reset email
    await sendPasswordResetEmail(user, resetToken);

    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request',
      error: error.message
    });
  }
});

// Change password
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Update MLM structure when new user joins
async function updateMLMStructure(newUserId, referrerId) {
  try {
    // Add new user to referrer's referral list
    await User.findByIdAndUpdate(referrerId, {
      $push: { referredUsers: newUserId }
    });

    // Build upline structure for new user
    const referrer = await User.findById(referrerId).populate('uplineUsers.userId');
    const uplineUsers = [];

    // Add direct referrer (level 1)
    uplineUsers.push({
      userId: referrerId,
      level: 1
    });

    // Add referrer's upline (level 2, 3, etc.)
    if (referrer.uplineUsers && referrer.uplineUsers.length > 0) {
      referrer.uplineUsers.forEach(upline => {
        if (upline.level < parseInt(process.env.MAX_LEVELS)) {
          uplineUsers.push({
            userId: upline.userId._id,
            level: upline.level + 1
          });
        }
      });
    }

    // Update new user's upline structure
    await User.findByIdAndUpdate(newUserId, {
      uplineUsers: uplineUsers,
      level: 1
    });

    // Give referral bonus to direct referrer
    const referralBonusPercentage = parseFloat(process.env.REFERRAL_BONUS_PERCENTAGE) || 10;
    const bonusAmount = 100; // Fixed bonus amount for new registration

    await User.findByIdAndUpdate(referrerId, {
      $inc: {
        'earnings.referralBonus': bonusAmount,
        'earnings.totalEarnings': bonusAmount,
        'wallet.balance': bonusAmount
      }
    });

  } catch (error) {
    console.error('Error updating MLM structure:', error);
  }
}

// Send welcome email
async function sendWelcomeEmail(user) {
  try {
    const emailContent = `
      <h2>Welcome to MLM Platform!</h2>
      <p>Dear ${user.firstName},</p>
      <p>Welcome to our MLM platform! Your account has been successfully created.</p>
      <p><strong>Your Referral Code:</strong> ${user.referralCode}</p>
      <p>Share this code with friends and family to earn commissions on their activities.</p>
      <p>Best regards,<br>MLM Platform Team</p>
    `;

    await sendEmail(user.email, 'Welcome to MLM Platform', emailContent);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Send password reset email
async function sendPasswordResetEmail(user, resetToken) {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const emailContent = `
      <h2>Password Reset Request</h2>
      <p>Dear ${user.firstName},</p>
      <p>You have requested to reset your password. Please click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>MLM Platform Team</p>
    `;

    await sendEmail(user.email, 'Password Reset Request', emailContent);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
}

module.exports = router;