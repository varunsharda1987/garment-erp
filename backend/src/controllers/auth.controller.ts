// Authentication controller
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
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
  const hashedPassword = await bcrypt.hash(password, 10);

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
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  // Body is already validated and transformed by middleware
  const { email, password }: LoginRequest = req.body;

  // Find user
  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ForbiddenError('Your account has been deactivated');
  }

  // Check if user is approved
  if (!user.isApproved) {
    throw new ForbiddenError('Your account is pending admin approval. Please contact your administrator.');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

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
      name: `${user.firstName} ${user.lastName}`,
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
