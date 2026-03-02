/**
 * BigInt Utilities
 *
 * Utilities for handling BigInt values in Ethereum context.
 * Mongoose natively supports BigInt type (stored as BSON Long in MongoDB).
 * These utilities provide validation and arithmetic operations.
 *
 * @module utils/bigint
 */

/**
 * Validates if a value is a valid BigInt or can be converted to BigInt
 *
 * @param {bigint|number|string} value - Value to validate
 * @returns {boolean} True if valid BigInt or convertible to BigInt
 *
 * @example
 * isValidBigInt(1000n) // true
 * isValidBigInt(1000) // true
 * isValidBigInt("1000") // true
 * isValidBigInt("abc") // false
 * isValidBigInt("1.5") // false (decimals not allowed)
 */
export const isValidBigInt = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  // BigInt is always valid
  if (typeof value === 'bigint') {
    return true;
  }

  // Try to convert to BigInt
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Converts a value to BigInt
 *
 * @param {bigint|number|string} value - Value to convert
 * @returns {bigint} BigInt value
 * @throws {Error} If value cannot be converted to BigInt
 *
 * @example
 * toBigInt(1000) // 1000n
 * toBigInt("1000000000000000000") // 1000000000000000000n
 * toBigInt(1000n) // 1000n
 */
export const toBigInt = (value) => {
  if (value === null || value === undefined) {
    throw new Error('Value cannot be null or undefined');
  }

  if (typeof value === 'bigint') {
    return value;
  }

  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Cannot convert value to BigInt: ${value}`);
  }
};

/**
 * Compares two BigInt values
 *
 * @param {bigint|number|string} a - First value
 * @param {bigint|number|string} b - Second value
 * @returns {number} -1 if a < b, 0 if a === b, 1 if a > b
 * @throws {Error} If values cannot be converted to BigInt
 *
 * @example
 * compareBigInt(1000n, 2000n) // -1
 * compareBigInt("2000", "1000") // 1
 * compareBigInt(1000, 1000) // 0
 */
export const compareBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);

  if (bigIntA < bigIntB) return -1;
  if (bigIntA > bigIntB) return 1;
  return 0;
};

/**
 * Checks if a BigInt value is positive (greater than 0)
 *
 * @param {bigint|number|string} value - Value to check
 * @returns {boolean} True if value is positive
 *
 * @example
 * isPositiveBigInt(1000n) // true
 * isPositiveBigInt(0n) // false
 * isPositiveBigInt(-100n) // false
 */
export const isPositiveBigInt = (value) => {
  try {
    const bigIntValue = toBigInt(value);
    return bigIntValue > 0n;
  } catch {
    return false;
  }
};

/**
 * Checks if a BigInt value is zero or positive (greater than or equal to 0)
 *
 * @param {bigint|number|string} value - Value to check
 * @returns {boolean} True if value is non-negative
 *
 * @example
 * isNonNegativeBigInt(1000n) // true
 * isNonNegativeBigInt(0n) // true
 * isNonNegativeBigInt(-100n) // false
 */
export const isNonNegativeBigInt = (value) => {
  try {
    const bigIntValue = toBigInt(value);
    return bigIntValue >= 0n;
  } catch {
    return false;
  }
};

/**
 * Adds two BigInt values
 *
 * @param {bigint|number|string} a - First value
 * @param {bigint|number|string} b - Second value
 * @returns {bigint} Sum
 *
 * @example
 * addBigInt(1000n, 2000n) // 3000n
 * addBigInt("1000", "2000") // 3000n
 */
export const addBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);
  return bigIntA + bigIntB;
};

/**
 * Subtracts two BigInt values
 *
 * @param {bigint|number|string} a - First value
 * @param {bigint|number|string} b - Second value
 * @returns {bigint} Difference
 *
 * @example
 * subtractBigInt(2000n, 1000n) // 1000n
 * subtractBigInt("2000", "1000") // 1000n
 */
export const subtractBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);
  return bigIntA - bigIntB;
};

/**
 * Multiplies two BigInt values
 *
 * @param {bigint|number|string} a - First value
 * @param {bigint|number|string} b - Second value
 * @returns {bigint} Product
 *
 * @example
 * multiplyBigInt(1000n, 2n) // 2000n
 * multiplyBigInt("1000", "2") // 2000n
 */
export const multiplyBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);
  return bigIntA * bigIntB;
};

/**
 * Divides two BigInt values (integer division)
 *
 * @param {bigint|number|string} a - Dividend
 * @param {bigint|number|string} b - Divisor
 * @returns {bigint} Quotient
 * @throws {Error} If divisor is zero
 *
 * @example
 * divideBigInt(1000n, 2n) // 500n
 * divideBigInt("1000", "2") // 500n
 */
export const divideBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);

  if (bigIntB === 0n) {
    throw new Error('Division by zero');
  }

  return bigIntA / bigIntB;
};

/**
 * Calculates percentage of a BigInt value
 *
 * @param {bigint|number|string} value - Value to calculate percentage of
 * @param {number} percentage - Percentage (0-100)
 * @returns {bigint} Calculated percentage
 *
 * @example
 * percentageOf(1000n, 10) // 100n (10% of 1000)
 * percentageOf("1000000", 5) // 50000n (5% of 1000000)
 */
export const percentageOf = (value, percentage) => {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }

  const bigIntValue = toBigInt(value);
  const percentageBigInt = BigInt(Math.floor(percentage * 100)); // Convert to basis points
  return (bigIntValue * percentageBigInt) / 10000n;
};

export default {
  isValidBigInt,
  toBigInt,
  compareBigInt,
  isPositiveBigInt,
  isNonNegativeBigInt,
  addBigInt,
  subtractBigInt,
  multiplyBigInt,
  divideBigInt,
  percentageOf,
};

/**
 * Converts BigInt fields in an object to strings for JSON serialization
 *
 * @param {object} obj - Object to convert
 * @returns {object} Object with BigInt fields converted to strings
 *
 * @example
 * convertBigIntToString({ amount: 1000n, name: "test" }) // { amount: "1000", name: "test" }
 */
export const convertBigIntToString = (obj) => {
  if (!obj) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }

  // Handle Mongoose documents
  const plainObj = obj.toObject ? obj.toObject() : obj;

  // Convert BigInt fields
  const converted = { ...plainObj };
  for (const key in converted) {
    if (typeof converted[key] === 'bigint') {
      converted[key] = converted[key].toString();
    } else if (converted[key] && typeof converted[key] === 'object') {
      converted[key] = convertBigIntToString(converted[key]);
    }
  }

  return converted;
};
