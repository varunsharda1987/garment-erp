// Authentication controller
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt.utils';
import { RegisterRequest, LoginRequest, AuthResponse } from '../types/auth.types';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Register a new user
 * Note: Request body is pre-validated by Zod middleware (validates email format, password strength, etc.)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Body is already validated and transformed by middleware
    const { email, password, firstName, lastName, phone, role }: RegisterRequest = req.body;

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate required fields
    if (!firstName || !lastName) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'First name and last name are required',
      });
      return;
    }

    // Validate role is provided
    if (!role) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Role is required for registration',
      });
      return;
    }

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
  } catch (error) {
    logError('Registration error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user',
    });
  }
};

/**
 * Login user
 * Note: Request body is pre-validated by Zod middleware
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Body is already validated and transformed by middleware
    const { email, password }: LoginRequest = req.body;

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(403).json({
        error: 'Access Denied',
        message: 'Your account has been deactivated',
      });
      return;
    }

    // Check if user is approved
    if (!user.isApproved) {
      res.status(403).json({
        error: 'Pending Approval',
        message: 'Your account is pending admin approval. Please contact your administrator.',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
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
  } catch (error) {
    logError('Login error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login',
    });
  }
};

/**
 * Get current user (requires authentication)
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // User is set by auth middleware
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
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
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    logError('Get current user error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user',
    });
  }
};
