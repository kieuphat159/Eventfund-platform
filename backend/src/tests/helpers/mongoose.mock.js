/**
 * Mongoose Mock Helpers
 *
 * Provides utilities for mocking Mongoose models and documents
 * with chainable methods like populate(), lean(), etc.
 */

import { jest } from '@jest/globals';

/**
 * Create a mock Mongoose document with toJSON() method
 *
 * @param {object} data - Document data
 * @returns {object} Mock document with Mongoose methods
 */
export function createMockDocument(data) {
  const mockDoc = {
    ...data,
    toJSON() {
      const { ...rest } = this;
      delete rest.toJSON;
      delete rest.save;
      delete rest.remove;
      delete rest.deleteOne;
      return rest;
    }
  };

  // Add methods after mockDoc is defined to avoid temporal dead zone
  mockDoc.save = jest.fn().mockResolvedValue(mockDoc);
  mockDoc.remove = jest.fn().mockResolvedValue(mockDoc);
  mockDoc.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

  return mockDoc;
}

/**
 * Create a mock Mongoose query with chainable methods
 *
 * @param {any} resolvedValue - Value to resolve when query executes
 * @returns {object} Mock query with chainable methods
 */
export function createMockQuery(resolvedValue = null) {
  const mockQuery = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn((resolve) => Promise.resolve(resolvedValue).then(resolve))
  };

  // Make the query thenable so it can be awaited directly
  mockQuery.then = jest.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));

  return mockQuery;
}

/**
 * Create a mock Mongoose model with common methods
 *
 * @param {string} modelName - Name of the model
 * @returns {object} Mock model with Mongoose static methods
 */
export function createMockModel(modelName = 'MockModel') {
  const mockModel = jest.fn();

  mockModel.find = jest.fn(() => createMockQuery([]));
  mockModel.findOne = jest.fn(() => createMockQuery(null));
  mockModel.findById = jest.fn(() => createMockQuery(null));
  mockModel.findByIdAndUpdate = jest.fn(() => createMockQuery(null));
  mockModel.findByIdAndDelete = jest.fn(() => createMockQuery(null));
  mockModel.findOneAndUpdate = jest.fn(() => createMockQuery(null));
  mockModel.findOneAndDelete = jest.fn(() => createMockQuery(null));
  mockModel.create = jest.fn();
  mockModel.insertMany = jest.fn();
  mockModel.updateOne = jest.fn();
  mockModel.updateMany = jest.fn();
  mockModel.deleteOne = jest.fn();
  mockModel.deleteMany = jest.fn();
  mockModel.countDocuments = jest.fn();
  mockModel.aggregate = jest.fn();
  mockModel.paginate = jest.fn();

  mockModel.modelName = modelName;

  return mockModel;
}

/**
 * Create a mock aggregate pipeline
 *
 * @param {any} resolvedValue - Value to resolve when pipeline executes
 * @returns {Array} Mock aggregate pipeline
 */
export function createMockAggregate(resolvedValue = []) {
  const mockAggregate = [];
  mockAggregate.exec = jest.fn().mockResolvedValue(resolvedValue);
  mockAggregate.then = jest.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));

  return mockAggregate;
}
