import asyncHandler from '../utils/asyncHandler.js';
import * as adminService from '../services/admin/admin.service.js';

/**
 * AdminController - Handles administrative endpoints
 */
class AdminController {
  constructor(service = adminService) {
    this.adminService = service;
  }

  getPlatformStats = asyncHandler(async (req, res) => {
    const stats = await this.adminService.getPlatformStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  });

  getUsers = asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;

    const result = await this.adminService.getUsers(query);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.validated?.body || req.body;
    const { walletAddress } = req.params;

    const user = await this.adminService.updateUserRole(walletAddress, role);

    res.status(200).json({
      success: true,
      data: user
    });
  });

  getEvents = asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;

    const result = await this.adminService.getEvents(query);

    res.status(200).json({
      success: true,
      data: result
    });
  });

  getEventById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const event = await this.adminService.getEventById(id);

    res.status(200).json({
      success: true,
      data: event
    });
  });

  updateEvent = asyncHandler(async (req, res) => {
    const updates = req.validated?.body || req.body;
    const { id } = req.params;

    const event = await this.adminService.updateEvent(id, updates);

    res.status(200).json({
      success: true,
      data: event
    });
  });

  updateEventStatus = asyncHandler(async (req, res) => {
    const body = req.validated?.body || req.body;
    const { status } = body;
    const { id } = req.params;

    const event = await this.adminService.updateEventStatus(id, status, body);

    res.status(200).json({
      success: true,
      data: event
    });
  });

  getEventInvestments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const query = req.validated?.query || req.query;

    const investments = await this.adminService.getEventInvestments(id, query);

    res.status(200).json({
      success: true,
      data: investments
    });
  });

  getSystemHealth = asyncHandler(async (req, res) => {
    const health = await this.adminService.getSystemHealth();

    res.status(200).json({
      success: true,
      data: health
    });
  });

  getFraudOverview = asyncHandler(async (req, res) => {
    const data = await this.adminService.getFraudOverview();

    res.status(200).json({
      success: true,
      data,
    });
  });

  getFinanceOverview = asyncHandler(async (req, res) => {
    const data = await this.adminService.getFinanceOverview();

    res.status(200).json({
      success: true,
      data,
    });
  });

  getAnalyticsOverview = asyncHandler(async (req, res) => {
    const data = await this.adminService.getAnalyticsOverview();

    res.status(200).json({
      success: true,
      data,
    });
  });

  deleteUser = asyncHandler(async (req, res) => {
    const { walletAddress } = req.params;

    const user = await this.adminService.deleteUser(walletAddress);

    res.status(200).json({
      success: true,
      data: user
    });
  });
}

export default AdminController;
