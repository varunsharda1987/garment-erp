// Authentication controller
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { BCRYPT_ROUNDS } from '../config/security.config';
import { generateToken, generateRefreshToken } from '../utils/jwt.utils';
import { RegisterRequest, LoginRequest, AuthResponse } from '../types/auth.types';
import { logInfo, logWarn } from '../utils/logger';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../errors';

/**
 * Register a new user
 * Note: Request body is pre-validated by Zod middleware (validates email format, password strength, etc.)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  // Body is already validated and transformed by middleware.
  // SECURITY: `role` is intentionally NOT read from the request body — public self-registration must
  // not let the caller choose their own role (that allowed self-service ADMIN escalation). New
  // self-registrations get the least-privileged default and stay pending admin approval; an admin
  // assigns the real role afterwards via the user-management endpoints.
  const { email, password, firstName, lastName, phone }: RegisterRequest = req.body;
  const role = UserRole.SALES; // safe non-admin default for self-registration

  // Check if user already exists
  const existingUser = await prisma.users.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Validate required fields
  if (!firstName || !lastName) {
    throw new ValidationError('First name and last name are required');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create user (pending approval)
  const user = await prisma.users.create({
    data: {
      email,
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone || null,
      role,
      isActive: true,
      isApproved: false, // Requires admin approval
    },
  });

  logInfo(`New user registration pending approval: ${email} (${role})`);

  // Return success without token (user must be approved first)
  res.status(201).json({
    message: 'Registration successful. Your account is pending admin approval.',
    user: {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      isApproved: false,
    },
  });
};

/**
 * Login user
 * Note: Request body is pre-validated by Zod middleware
 *
 * BUG-AUTH2: Includes tokenVersion in JWT payload for session invalidation on password change.
 * BUG-AUTH6: Generates refresh token for token refresh mechanism.
 *
 * BUG-AUTH11 fix: Per-account rate limiting would be implemented here.
 * Currently only IP-based rate limiting exists (see security.middleware.ts).
 * To add per-account protection:
 * - Check user.lockedUntil before password verification
 * - Increment user.failedLoginAttempts on failure
 * - Reset failedLoginAttempts on success
 * See security.middleware.ts for full implementation notes.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  // Body is already validated and transformed by middleware
  const { email, password }: LoginRequest = req.body;

  // Find user with tokenVersion for BUG-AUTH2 fix
  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    // BUG-AUTH11: No per-account tracking for non-existent users.
    // This is acceptable - can't lock accounts that don't exist.
    throw new UnauthorizedError('Invalid email or password');
  }

  // BUG-AUTH11: Per-account lockout check would go here:
  // if (user.lockedUntil && user.lockedUntil > new Date()) {
  //   throw new ForbiddenError('Account temporarily locked due to too many failed attempts');
  // }

  // Verify password first to prevent user enumeration attacks
  // (don't reveal account status before password is verified)
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // BUG-AUTH11: Per-account failure tracking would go here:
    // await prisma.users.update({
    //   where: { id: user.id },
    //   data: {
    //     failedLoginAttempts: { increment: 1 },
    //     lastFailedLogin: new Date(),
    //     lockedUntil: user.failedLoginAttempts >= 4 ? addMinutes(new Date(), 15) : null
    //   }
    // });
    throw new UnauthorizedError('Invalid email or password');
  }

  // Only reveal account status after password is verified
  if (!user.isActive) {
    throw new ForbiddenError('Your account has been deactivated');
  }

  if (!user.isApproved) {
    throw new ForbiddenError('Your account is pending admin approval. Please contact your administrator.');
  }

  // Generate refresh token (BUG-AUTH6)
  const { token: refreshTokenValue, expiresAt: refreshTokenExpiry } = generateRefreshToken();

  // Store refresh token and update lastLogin in a single transaction
  // BUG-AUTH11: Per-account failure reset would go here in the update
  const [, refreshToken] = await prisma.$transaction([
    prisma.users.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    }),
    prisma.refresh_tokens.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
        ipAddress: req.ip || undefined,
        deviceInfo: req.headers['user-agent'] || undefined,
      },
    }),
  ]);

  // Generate JWT token with tokenVersion (BUG-AUTH2)
  const token = generateToken({
    userId: user.id,
    id: user.id, // Alias for userId - both are available for convenience
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // Prepare response
  const response: AuthResponse & { refreshToken: string } = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`, // kept for backward compatibility
      role: user.role,
    },
    token,
    refreshToken: refreshToken.token,
  };

  res.status(200).json(response);
};

/**
 * Refresh access token using a valid refresh token
 * POST /api/auth/refresh
 *
 * BUG-AUTH6: Implements refresh token rotation - old refresh token is revoked
 * and a new one is issued for security.
 */
export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Find the refresh token in database
  const storedToken = await prisma.refresh_tokens.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if token is revoked or expired
  if (storedToken.isRevoked) {
    // Potential token reuse attack - revoke all tokens for this user
    logWarn(`Refresh token reuse detected for user ${storedToken.userId}. Revoking all tokens.`);
    await prisma.refresh_tokens.updateMany({
      where: { userId: storedToken.userId },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token has been revoked. Please log in again.');
  }

  if (storedToken.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.refresh_tokens.delete({ where: { id: storedToken.id } });
    throw new UnauthorizedError('Refresh token has expired. Please log in again.');
  }

  const user = storedToken.user;

  // Verify user is still active and approved
  if (!user.isActive || !user.isApproved) {
    // Revoke the token
    await prisma.refresh_tokens.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });
    throw new UnauthorizedError('Account is inactive or unapproved');
  }

  // Refresh token rotation: revoke old token and create new one
  const { token: newRefreshTokenValue, expiresAt: newRefreshTokenExpiry } = generateRefreshToken();

  const [, newRefreshToken] = await prisma.$transaction([
    prisma.refresh_tokens.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    }),
    prisma.refresh_tokens.create({
      data: {
        token: newRefreshTokenValue,
        userId: user.id,
        expiresAt: newRefreshTokenExpiry,
        ipAddress: req.ip || undefined,
        deviceInfo: req.headers['user-agent'] || undefined,
      },
    }),
  ]);

  // Generate new access token with current tokenVersion
  const newAccessToken = generateToken({
    userId: user.id,
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  res.status(200).json({
    token: newAccessToken,
    refreshToken: newRefreshToken.token,
  });
};

/**
 * Logout user - revokes the refresh token
 * POST /api/auth/logout
 *
 * Note: The access token (JWT) cannot be invalidated without server-side state.
 * Clients should discard the access token. For critical scenarios (password change,
 * security breach), tokenVersion increment invalidates all access tokens immediately.
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Revoke the specific refresh token
    await prisma.refresh_tokens.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  res.status(200).json({ message: 'Logged out successfully' });
};

/**
 * Logout from all devices - revokes all refresh tokens for the user
 * POST /api/auth/logout-all
 *
 * This also increments tokenVersion to invalidate all existing access tokens.
 */
export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Revoke all refresh tokens and increment tokenVersion in a transaction
  await prisma.$transaction([
    prisma.refresh_tokens.updateMany({
      where: { userId: req.user.userId },
      data: { isRevoked: true, revokedAt: new Date() },
    }),
    prisma.users.update({
      where: { id: req.user.userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);

  logInfo(`User ${req.user.email} logged out from all devices`);

  res.status(200).json({ message: 'Logged out from all devices successfully' });
};

/**
 * Get current user (requires authentication)
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  // User is set by auth middleware
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Fetch full user details
  const user = await prisma.users.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      department: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User', req.user.userId);
  }

  res.status(200).json(user);
};
