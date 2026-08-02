// Authentication controller
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { BCRYPT_ROUNDS } from '../config/security.config';
import { generateToken } from '../utils/jwt.utils';
import { RegisterRequest, LoginRequest, AuthResponse } from '../types/auth.types';
import { logInfo } from '../utils/logger';
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

  // Find user
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

  // Update lastLogin timestamp
  // BUG-AUTH11: Per-account failure reset would go here:
  // data: { lastLogin: new Date(), failedLoginAttempts: 0, lockedUntil: null }
  await prisma.users.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    id: user.id, // Alias for userId - both are available for convenience
    email: user.email,
    role: user.role,
  });

  // Prepare response
  const response: AuthResponse = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`, // kept for backward compatibility
      role: user.role,
    },
    token,
  };

  res.status(200).json(response);
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
