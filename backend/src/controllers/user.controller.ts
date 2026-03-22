// User management controller
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { UserRole, Prisma } from '@prisma/client';
import { logInfo } from '../utils/logger';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError, UnauthorizedError } from '../errors';

/**
 * Get all users (paginated)
 * GET /api/users
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  // Pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string;

  // Build search filter
  const whereClause: Prisma.usersWhereInput = {};
  if (search) {
    whereClause.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Get total count
  const totalUsers = await prisma.users.count({ where: whereClause });

  // Get users (exclude password)
  const users = await prisma.users.findMany({
    where: whereClause,
    skip,
    take: limit,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      department: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.status(200).json({
    data: users,
    pagination: {
      page,
      limit,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
    },
  });
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      department: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  res.status(200).json({ data: user });
};

/**
 * Create new user (Admin only)
 * POST /api/users
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName, phone, role, department } = req.body;

  // Validation
  if (!email || !password || !firstName || !lastName) {
    throw new ValidationError('Email, password, firstName, and lastName are required');
  }

  // Check if user already exists
  const existingUser = await prisma.users.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Validate role if provided
  if (role && !Object.values(UserRole).includes(role)) {
    throw new ValidationError('Invalid role specified');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user (auto-approved when admin creates)
  const user = await prisma.users.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      role: role || UserRole.SALES, // Default role
      department: department || null,
      isActive: true,
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: req.user?.userId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({
    data: user,
    message: 'User created successfully',
  });
};

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { email, firstName, lastName, phone, department, password, isActive } = req.body;

  // Check if user exists
  const existingUser = await prisma.users.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new NotFoundError('User', id);
  }

  // Authorization check: Users can only update themselves unless they're ADMIN
  if (req.user?.userId !== id && req.user?.role !== UserRole.ADMIN) {
    throw new ForbiddenError('You can only update your own profile');
  }

  // If email is being changed, check if new email is available
  if (email && email !== existingUser.email) {
    const emailTaken = await prisma.users.findUnique({
      where: { email },
    });

    if (emailTaken) {
      throw new ConflictError('Email already in use');
    }
  }

  // Prepare update data
  const updateData: Prisma.usersUpdateInput = {
    ...(email && { email }),
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(phone !== undefined && { phone: phone || null }),
    ...(department !== undefined && { department: department || null }),
  };

  // Only admins can update isActive status
  if (isActive !== undefined && req.user?.role === UserRole.ADMIN) {
    updateData.isActive = isActive;
  }

  // Hash new password if provided
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  // Update user
  const updatedUser = await prisma.users.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(200).json({
    data: updatedUser,
    message: 'User updated successfully',
  });
};

/**
 * Update user role (Admin only)
 * PUT /api/users/:id/role
 */
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role } = req.body;

  // Validation
  if (!role || !Object.values(UserRole).includes(role)) {
    throw new ValidationError('Valid role is required');
  }

  // Check if user exists
  const existingUser = await prisma.users.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new NotFoundError('User', id);
  }

  // Update role
  const updatedUser = await prisma.users.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      department: true,
      isActive: true,
      updatedAt: true,
    },
  });

  res.status(200).json({
    data: updatedUser,
    message: 'User role updated successfully',
  });
};

/**
 * Delete user (Admin only)
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check if user exists
  const existingUser = await prisma.users.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new NotFoundError('User', id);
  }

  // Prevent self-deletion
  if (req.user?.userId === id) {
    throw new ValidationError('You cannot delete your own account');
  }

  // Instead of hard delete, we'll deactivate the user
  // This is better for data integrity and audit trails
  await prisma.users.update({
    where: { id },
    data: { isActive: false },
  });

  res.status(200).json({
    message: 'User deactivated successfully',
  });
};

/**
 * Permanently delete user (Admin only)
 * DELETE /api/users/:id/permanent
 */
export const permanentDeleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check if user exists
  const existingUser = await prisma.users.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new NotFoundError('User', id);
  }

  // Prevent self-deletion
  if (req.user?.userId === id) {
    throw new ValidationError('You cannot delete your own account');
  }

  // Hard delete the user
  await prisma.users.delete({
    where: { id },
  });

  logInfo(`User permanently deleted: ${existingUser.email} by ${req.user?.userId}`);

  res.status(200).json({
    message: 'User permanently deleted',
  });
};

/**
 * Change user password
 * PUT /api/users/:id/change-password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Validation
  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters long');
  }

  // Authorization check: Users can only change their own password
  if (req.user?.userId !== id) {
    throw new ForbiddenError('You can only change your own password');
  }

  // Get user with password
  const user = await prisma.users.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.users.update({
    where: { id },
    data: { password: hashedPassword },
  });

  logInfo(`Password changed for user: ${user.email}`);

  res.status(200).json({
    message: 'Password changed successfully',
  });
};

/**
 * Get pending users (awaiting approval)
 * GET /api/users/pending
 */
export const getPendingUsers = async (req: Request, res: Response): Promise<void> => {
  const users = await prisma.users.findMany({
    where: {
      isApproved: false,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      department: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.status(200).json({
    data: users,
    count: users.length,
  });
};

/**
 * Approve user registration
 * POST /api/users/:id/approve
 */
export const approveUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check if user exists
  const user = await prisma.users.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  if (user.isApproved) {
    throw new ValidationError('User is already approved');
  }

  // Approve user
  const approvedUser = await prisma.users.update({
    where: { id },
    data: {
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: req.user?.userId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isApproved: true,
      approvedAt: true,
    },
  });

  logInfo(`User approved: ${user.email} by ${req.user?.userId}`);

  res.status(200).json({
    data: approvedUser,
    message: 'User approved successfully',
  });
};

/**
 * Reject user registration
 * POST /api/users/:id/reject
 */
export const rejectUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check if user exists
  const user = await prisma.users.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  if (user.isApproved) {
    throw new ValidationError('Cannot reject an already approved user. Use deactivate instead.');
  }

  // Delete the pending user
  await prisma.users.delete({
    where: { id },
  });

  logInfo(`User registration rejected and deleted: ${user.email} by ${req.user?.userId}`);

  res.status(200).json({
    message: 'User registration rejected successfully',
  });
};
