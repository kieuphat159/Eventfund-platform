/**
 * BigInt Utilities
 *
 * Utilities for handling large numeric values in Ethereum context.
 * Values are stored as Strings in MongoDB to avoid JSON serialization issues.
 * These utilities provide validation, conversion, and arithmetic operations
 * by temporarily converting to BigInt for calculations, then back to String.
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

  // Validate string format
  if (typeof value === 'string') {
    if (value === '') {
      throw new Error('Cannot convert empty string to BigInt');
    }
    if (!/^-?[0-9]+$/.test(value)) {
      throw new Error(`Invalid string format for BigInt conversion: "${value}". Must match pattern /^-?[0-9]+$/`);
    }
  }

  // Validate number is integer
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`Cannot convert non-integer number to BigInt: ${value}`);
    }
  }

  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Cannot convert value to BigInt: ${value}`);
  }
};

/**
 * Converts a value to String representation
 *
 * @param {bigint|number|string} value - Value to convert
 * @returns {string} String representation of the value
 * @throws {Error} If value cannot be converted
 *
 * @example
 * toStringBigInt(1000n) // "1000"
 * toStringBigInt("1000000000000000000") // "1000000000000000000"
 * toStringBigInt(1000) // "1000"
 */
export const toStringBigInt = (value) => {
  if (value === null || value === undefined) {
    throw new Error('Value cannot be null or undefined');
  }

  // If already a string, validate and return
  if (typeof value === 'string') {
    if (value === '') {
      throw new Error('Cannot convert empty string');
    }
    if (!/^-?[0-9]+$/.test(value)) {
      throw new Error(`Invalid string format: "${value}". Must match pattern /^-?[0-9]+$/`);
    }
    return value;
  }

  // If BigInt, convert to string
  if (typeof value === 'bigint') {
    return value.toString();
  }

  // If number, validate integer and convert to BigInt first then to string
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`Cannot convert non-integer number to string: ${value}`);
    }
    return BigInt(value).toString();
  }

  throw new Error(`Cannot convert value to string: ${value}`);
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
 * @returns {string} Sum as string
 *
 * @example
 * addBigInt(1000n, 2000n) // "3000"
 * addBigInt("1000", "2000") // "3000"
 */
export const addBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);
  const result = bigIntA + bigIntB;
  return toStringBigInt(result);
};

/**
 * Subtracts two BigInt values
 *
 * @param {bigint|number|string} a - First value
 * @param {bigint|number|string} b - Second value
 * @returns {string} Difference as string
 *
 * @example
 * subtractBigInt(2000n, 1000n) // "1000"
 * subtractBigInt("2000", "1000") // "1000"
 */
export const subtractBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);
  const result = bigIntA - bigIntB;
  return toStringBigInt(result);
};

/**
 * Multiplies two BigInt values
 *
 * @param {bigint|number|string} a - First value
 * @param {bigint|number|string} b - Second value
 * @returns {string} Product as string
 *
 * @example
 * multiplyBigInt(1000n, 2n) // "2000"
 * multiplyBigInt("1000", "2") // "2000"
 */
export const multiplyBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);
  const result = bigIntA * bigIntB;
  return toStringBigInt(result);
};

/**
 * Divides two BigInt values (integer division)
 *
 * @param {bigint|number|string} a - Dividend
 * @param {bigint|number|string} b - Divisor
 * @returns {string} Quotient as string
 * @throws {Error} If divisor is zero
 *
 * @example
 * divideBigInt(1000n, 2n) // "500"
 * divideBigInt("1000", "2") // "500"
 */
export const divideBigInt = (a, b) => {
  const bigIntA = toBigInt(a);
  const bigIntB = toBigInt(b);

  if (bigIntB === 0n) {
    throw new Error('Division by zero: Cannot divide by zero');
  }

  const result = bigIntA / bigIntB;
  return toStringBigInt(result);
};

/**
 * Calculates percentage of a BigInt value
 *
 * @param {bigint|number|string} value - Value to calculate percentage of
 * @param {number} percentage - Percentage (0-100)
 * @returns {string} Calculated percentage as string
 *
 * @example
 * percentageOf(1000n, 10) // "100" (10% of 1000)
 * percentageOf("1000000", 5) // "50000" (5% of 1000000)
 */
export const percentageOf = (value, percentage) => {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }

  const bigIntValue = toBigInt(value);
  const percentageBigInt = BigInt(Math.floor(percentage * 100)); // Convert to basis points
  const result = (bigIntValue * percentageBigInt) / 10000n;
  return toStringBigInt(result);
};

export default {
  isValidBigInt,
  toBigInt,
  toStringBigInt,
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
