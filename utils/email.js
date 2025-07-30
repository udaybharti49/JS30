const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email function
const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"MLM Platform" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send bulk emails
const sendBulkEmail = async (recipients, subject, htmlContent, textContent = null) => {
  try {
    const transporter = createTransporter();
    const results = [];

    // Send emails in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          const mailOptions = {
            from: `"MLM Platform" <${process.env.EMAIL_USER}>`,
            to: recipient.email,
            subject: subject,
            html: htmlContent.replace(/{{name}}/g, recipient.name || 'User'),
            text: textContent
          };

          const result = await transporter.sendMail(mailOptions);
          return {
            email: recipient.email,
            success: true,
            messageId: result.messageId
          };
        } catch (error) {
          return {
            email: recipient.email,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Wait 1 second between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      results: results,
      total: recipients.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

  } catch (error) {
    console.error('Error sending bulk emails:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Email templates
const emailTemplates = {
  welcome: (userName, referralCode) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .referral-code { background: #e3f2fd; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }
        .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to MLM Platform!</h1>
        </div>
        <div class="content">
          <p>Dear ${userName},</p>
          <p>Welcome to our MLM platform! Your account has been successfully created and you're now part of our growing community.</p>
          
          <div class="referral-code">
            <h3>Your Referral Code</h3>
            <h2 style="color: #2196F3; font-size: 24px; margin: 10px 0;">${referralCode}</h2>
            <p>Share this code with friends and family to earn commissions!</p>
          </div>
          
          <h3>🚀 What's Next?</h3>
          <ul>
            <li>Complete your KYC verification to unlock all services</li>
            <li>Explore our digital courses marketplace</li>
            <li>Start using recharge services</li>
            <li>Apply for loans and insurance</li>
            <li>Open your Kotak bank account</li>
          </ul>
          
          <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
          
          <div class="footer">
            <p>Best regards,<br>MLM Platform Team</p>
            <p><small>This is an automated email. Please do not reply.</small></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  rechargeSuccess: (userName, amount, mobile, operator) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Recharge Successful!</h1>
        </div>
        <div class="content">
          <div class="success-icon">🎉</div>
          <p>Dear ${userName},</p>
          <p>Your recharge has been completed successfully!</p>
          
          <div class="details">
            <h3>Recharge Details:</h3>
            <p><strong>Mobile Number:</strong> ${mobile}</p>
            <p><strong>Operator:</strong> ${operator}</p>
            <p><strong>Amount:</strong> ₹${amount}</p>
            <p><strong>Status:</strong> <span style="color: #4CAF50;">Completed</span></p>
          </div>
          
          <p>Thank you for using our recharge service!</p>
          
          <div style="text-align: center; margin-top: 30px; color: #666;">
            <p>Best regards,<br>MLM Platform Team</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  commissionEarned: (userName, amount, level, sourceUser) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 36px; color: #4CAF50; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 Commission Earned!</h1>
        </div>
        <div class="content">
          <p>Dear ${userName},</p>
          <p>Congratulations! You've earned a commission from your network activity.</p>
          
          <div class="amount">₹${amount}</div>
          
          <div class="details">
            <h3>Commission Details:</h3>
            <p><strong>Level:</strong> ${level}</p>
            <p><strong>Source:</strong> ${sourceUser}</p>
            <p><strong>Amount:</strong> ₹${amount}</p>
            <p><strong>Status:</strong> <span style="color: #4CAF50;">Credited to wallet</span></p>
          </div>
          
          <p>Keep growing your network to earn more commissions!</p>
          
          <div style="text-align: center; margin-top: 30px; color: #666;">
            <p>Best regards,<br>MLM Platform Team</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  emailTemplates
};