/**
 * Database test helpers
 * Provides utilities for setting up and tearing down test database
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer;

/**
 * Connect to in-memory MongoDB instance
 */
export async function connectTestDB() {
  try {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect mongoose to in-memory database
    await mongoose.connect(mongoUri);

    console.log('Connected to in-memory test database');
  } catch (error) {
    console.error('Error connecting to test database:', error);
    throw error;
  }
}

/**
 * Disconnect and stop in-memory MongoDB instance
 */
export async function disconnectTestDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (mongoServer) {
      await mongoServer.stop();
    }

    console.log('Disconnected from test database');
  } catch (error) {
    console.error('Error disconnecting from test database:', error);
    throw error;
  }
}

/**
 * Clear all collections in the test database
 */
export async function clearTestDB() {
  try {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    console.log('Cleared all test database collections');
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
}

/**
 * Drop all collections in the test database
 */
export async function dropTestDB() {
  try {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.drop();
    }

    console.log('Dropped all test database collections');
  } catch (error) {
    console.error('Error dropping test database:', error);
    throw error;
  }
}
