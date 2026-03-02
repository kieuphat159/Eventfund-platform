import asyncHandler from '../utils/asyncHandler.js';
import * as adminService from '../services/admin.service.js';
import { convertBigIntToString } from '../utils/bigint.js';

/**
 * AdminController - Handles administrative endpoints
 */
class AdminController {
  constructor(service = adminService) {
    this.adminService = service;
  }

  getPlatformStats = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (admin role)
    if (req.user.role !== 'admin') {
      const error = new Error('Admin role required');
      error.statusCode = 403;
      return next(error);
    }

    // Get platform stats
    const stats = await this.adminService.getPlatformStats();

    res.status(200).json({
      success: true,
      data: convertBigIntToString(stats)
    });
  });

  getUsers = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (admin role)
    if (req.user.role !== 'admin') {
      const error = new Error('Admin role required');
      error.statusCode = 403;
      return next(error);
    }

    const filters = {};
    const pagination = {};

    // Extract filters
    if (req.query.role) {
      filters.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }

    // Extract pagination
    if (req.query.page) {
      pagination.page = parseInt(req.query.page, 10);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit, 10);
    }
    if (req.query.sort) {
      pagination.sort = req.query.sort;
    }

    // Get users
    const result = await this.adminService.getUsers(filters, pagination);

    res.status(200).json({
      success: true,
      data: convertBigIntToString(result)
    });
  });

  updateUserRole = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (admin role)
    if (req.user.role !== 'admin') {
      const error = new Error('Admin role required');
      error.statusCode = 403;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;
    const { role } = validatedData;

    if (!role) {
      const error = new Error('Role is required');
      error.statusCode = 400;
      return next(error);
    }

    // Update user role
    try {
      const user = await this.adminService.updateUserRole(req.params.walletAddress, role);

      res.status(200).json({
        success: true,
        data: convertBigIntToString(user)
      });
    } catch (error) {
      if (error.message === 'User not found') {
        error.statusCode = 404;
      } else {
        error.statusCode = 400;
      }
      return next(error);
    }
  });

  getEvents = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (admin role)
    if (req.user.role !== 'admin') {
      const error = new Error('Admin role required');
      error.statusCode = 403;
      return next(error);
    }

    const filters = {};
    const pagination = {};

    // Extract filters
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.organizer) {
      filters.organizer = req.query.organizer;
    }

    // Extract pagination
    if (req.query.page) {
      pagination.page = parseInt(req.query.page, 10);
    }
    if (req.query.limit) {
      pagination.limit = parseInt(req.query.limit, 10);
    }
    if (req.query.sort) {
      pagination.sort = req.query.sort;
    }

    // Get events
    const result = await this.adminService.getEvents(filters, pagination);

    // Convert BigInt fields
    const convertedResult = {
      ...result,
      docs: convertBigIntToString(result.docs)
    };

    res.status(200).json({
      success: true,
      data: convertedResult
    });
  });

  updateEventStatus = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (admin role)
    if (req.user.role !== 'admin') {
      const error = new Error('Admin role required');
      error.statusCode = 403;
      return next(error);
    }

    // Get validated data or fallback to body
    const validatedData = req.validated?.body || req.body;
    const { status } = validatedData;

    if (!status) {
      const error = new Error('Status is required');
      error.statusCode = 400;
      return next(error);
    }

    // Update event status
    try {
      const event = await this.adminService.updateEventStatus(req.params.id, status);

      res.status(200).json({
        success: true,
        data: convertBigIntToString(event)
      });
    } catch (error) {
      if (error.message === 'Event not found') {
        error.statusCode = 404;
      } else {
        error.statusCode = 400;
      }
      return next(error);
    }
  });

  getSystemHealth = asyncHandler(async (req, res, next) => {
    // Check authentication
    if (!req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    // Check authorization (admin role)
    if (req.user.role !== 'admin') {
      const error = new Error('Admin role required');
      error.statusCode = 403;
      return next(error);
    }

    // Get system health
    const health = await this.adminService.getSystemHealth();

    res.status(200).json({
      success: true,
      data: convertBigIntToString(health)
    });
  });
}

export default AdminController;
