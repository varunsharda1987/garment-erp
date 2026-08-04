// User management controller
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { BCRYPT_ROUNDS } from '../config/security.config';
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
      whatsappNumber: true,
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
      whatsappNumber: true,
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
  const { email, password, firstName, lastName, phone, whatsappNumber, role, department } = req.body;

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
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create user (auto-approved when admin creates)
  const user = await prisma.users.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      whatsappNumber: whatsappNumber || null,
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
      whatsappNumber: true,
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
  const { email, firstName, lastName, phone, whatsappNumber, department, password, isActive } = req.body;

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
    ...(whatsappNumber !== undefined && { whatsappNumber: whatsappNumber || null }),
    ...(department !== undefined && { department: department || null }),
  };

  // Only admins can update isActive status
  if (isActive !== undefined && req.user?.role === UserRole.ADMIN) {
    updateData.isActive = isActive;
  }

  // Hash new password if provided
  if (password) {
    updateData.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
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
      whatsappNumber: true,
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

  // BUG-AUTH10 fix: Check for related records before attempting delete
  // to provide clear error messages about what's blocking deletion
  const relatedRecords = await prisma.$transaction([
    prisma.orders.count({ where: { OR: [{ createdById: id }, { approvedById: id }] } }),
    prisma.purchase_orders.count({ where: { OR: [{ createdById: id }, { approvedById: id }] } }),
    prisma.goods_receiving_notes.count({ where: { OR: [{ receivedById: id }, { approvedById: id }] } }),
    prisma.material_requisitions.count({ where: { OR: [{ issuedById: id }, { receivedById: id }] } }),
    prisma.production_plans.count({ where: { OR: [{ createdById: id }, { approvedById: id }] } }),
    prisma.work_orders.count({ where: { OR: [{ createdById: id }, { approvedById: id }] } }),
    prisma.material_master.count({ where: { createdById: id } }),
  ]);

  const [ordersCount, poCount, grnCount, mrCount, ppCount, woCount, materialCount] = relatedRecords;
  const totalRelated = ordersCount + poCount + grnCount + mrCount + ppCount + woCount + materialCount;

  if (totalRelated > 0) {
    // Build a descriptive list of what's blocking deletion
    const blockingItems: string[] = [];
    if (ordersCount > 0) blockingItems.push(`${ordersCount} order(s)`);
    if (poCount > 0) blockingItems.push(`${poCount} purchase order(s)`);
    if (grnCount > 0) blockingItems.push(`${grnCount} GRN(s)`);
    if (mrCount > 0) blockingItems.push(`${mrCount} material requisition(s)`);
    if (ppCount > 0) blockingItems.push(`${ppCount} production plan(s)`);
    if (woCount > 0) blockingItems.push(`${woCount} work order(s)`);
    if (materialCount > 0) blockingItems.push(`${materialCount} material(s)`);

    throw new ValidationError(
      `Cannot permanently delete user "${existingUser.email}". ` +
        `User has ${totalRelated} related record(s): ${blockingItems.join(', ')}. ` +
        `Consider deactivating the user instead, or reassign these records to another user first.`
    );
  }

  // BUG-AUTH10 fix: Wrap delete in try-catch for any unexpected FK constraints
  try {
    await prisma.users.delete({
      where: { id },
    });
  } catch (error) {
    // Handle Prisma foreign key constraint error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      const constraintField = (error.meta?.field_name as string) || 'unknown';
      throw new ValidationError(
        `Cannot permanently delete user "${existingUser.email}". ` +
          `Foreign key constraint violation on "${constraintField}". ` +
          `The user has related records that must be removed or reassigned first.`
      );
    }
    // Re-throw unexpected errors
    throw error;
  }

  logInfo(`User permanently deleted: ${existingUser.email} by ${req.user?.userId}`);

  res.status(200).json({
    message: `User "${existingUser.email}" has been permanently deleted`,
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
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password and increment tokenVersion to invalidate all existing sessions
  // BUG-AUTH2 FIX: Incrementing tokenVersion causes auth middleware to reject all tokens
  // issued before this password change, effectively logging out all other sessions.
  await prisma.users.update({
    where: { id },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    },
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
