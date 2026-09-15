import { HashUtil } from '../../utils/hash.js';
import { JwtUtil } from '../../utils/jwt.js';
import { EmailUtil } from '../../utils/email.js';

/**
 * Auth Service Layer
 * Handles business logic for authentication, registration, and password recovery
 */
export class AuthService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async registerUser(userData) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: userData.email },
          { username: userData.username }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new Error('Email is already registered');
      }
      throw new Error('Username is already taken');
    }

    // Hash the password
    const hashedPassword = await HashUtil.hash(userData.password);

    // Create the new user
    const newUser = await this.prisma.user.create({
      data: {
        name: userData.name,
        username: userData.username,
        email: userData.email,
        phone: userData.phone,
        country: userData.country,
        bio: userData.bio,
        socialLinks: userData.socialLinks || {},
        avatar: userData.avatar,
        coverPhoto: userData.coverPhoto,
        introVideo: userData.introVideo,
        password: hashedPassword,
        // New registered users are set to PENDING or ACTIVE based on your business logic.
        // Assuming ACTIVE here so they can login immediately.
        status: 'ACTIVE',
        isVerified: true, // Email verification is not required for this app
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        coverPhoto: true,
        introVideo: true,
        createdAt: true,
      }
    });

    return newUser;
  }

  async loginUser(email, password) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Email not found');
    }

    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      throw new Error('Account is suspended or banned');
    }

    const isValidPassword = await HashUtil.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Password doesn't match");
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate Access Token (JWT)
    const token = JwtUtil.generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Return only essential public fields in the login response
    const essentialUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      avatar: user.avatar,
      // You can add more here if the frontend strictly requires it upon login, 
      // but usually the frontend fetches the full profile later.
    };

    return {
      user: essentialUser,
      accessToken: token
    };
  }

  async sendForgotPasswordOtp(email) {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Email not found');
    }

    // Generate 4 digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpires: expiresAt,
        otpPurpose: 'PASSWORD_RESET'
      }
    });

    // Send email asynchronously in the background so the API responds instantly
    EmailUtil.sendOtp(email, otp).catch(err => {
      console.error(`Failed to send OTP email to ${email} in background:`, err);
    });
    
    return true;
  }

  async verifyOtp(email, otp) {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Invalid OTP or email');
    }

    if (user.otpCode !== otp || user.otpPurpose !== 'PASSWORD_RESET') {
      throw new Error('Invalid OTP');
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      throw new Error('OTP has expired');
    }

    // Generate a reset token for the final step
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins for token

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
        // Clear OTP fields as they've been used
        otpCode: null,
        otpExpires: null,
        otpPurpose: null
      }
    });

    return resetToken;
  }

  async resetPassword(token, newPassword) {
    const user = await this.prisma.user.findFirst({
      where: { resetPasswordToken: token }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await HashUtil.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // Clear reset token
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    });

    return true;
  }
}
