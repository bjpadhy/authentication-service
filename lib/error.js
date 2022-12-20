/**
 * Class representing an internal error.
 * @extends Error
 */
export class InternalError extends Error {
  /**
   * Create an InternalError instance
   * @method
   * @param {String} message - The error message
   * @param {Object} data - Additional data for the error
   */
  constructor(message, data) {
    super(message);
    this.statusCode = 500;
    this.error = this.constructor.name;
    this.details = message;
    this.requestData = data;
    this.additionalData = { pid: process.pid, timestamp: new Date().toISOString() };
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Class representing a resource not found error.
 * @extends InternalError
 */
export class ResourceNotFoundError extends InternalError {
  /**
   * Create a ResourceNotFoundError instance
   * @method
   * @param {String} message - The error message
   * @param {Object} data - Additional data for the error
   */
  constructor(message, data) {
    super(message, data);
    this.statusCode = 404;
    this.requestData = data;
  }
}

/**
 * Class representing a malformed request body error.
 * @extends InternalError
 */
export class BadRequestInputError extends InternalError {
  /**
   * Create a BadRequestInputError instance
   * @method
   * @param {String} message - The error message
   * @param {Object} data - Additional data for the error
   */
  constructor(message, data) {
    super(message);
    this.statusCode = 400;
    this.requestData = data;
  }
}

/**
 * Class representing an authentication error.
 * @extends InternalError
 */
export class UnauthorizedError extends InternalError {
  /**
   * Create a UnauthorizedError instance
   * @method
   * @param {String} message - The error message
   * @param {Object} data - Additional data for the error
   */
  constructor(message, data) {
    super(message);
    this.statusCode = 401;
    this.requestData = data;
  }
}

/**
 * Class representing a resource conflict error.
 * @extends InternalError
 */
export class ResourceConflictError extends InternalError {
  /**
   * Create a UnauthorizedError instance
   * @method
   * @param {String} message - The error message
   * @param {Object} data - Additional data for the error
   */
  constructor(message, data) {
    super(message);
    this.statusCode = 409;
    this.requestData = data;
  }
}

/**
 * Handler for custom errors
 *
 * @function
 * @param {Object} payload - object encapsulating Error instance
 * @param {Object} payload.error - Error instance
 * @param {http.OutgoingMessage} response - Response object
 *
 * @returns {http.OutgoingMessage} User object
 */
export const errorHandler = ({ error }, response) => {
  const {
    req: { url, method, httpVersion, body },
  } = response;
  const isDebugMode = _.get(body, "dev_debug_mode", false);

  // Handle undefined errors
  if (!error.statusCode) {
    error = new InternalError("INTERNAL_SERVER_ERROR", {});
  }

  // Add error stacktrace if debug mode is active
  if (isDebugMode) {
    error.additionalData = isDebugMode
      ? { ...error.additionalData, debugData: JSON.parse(JSON.stringify(error.stack)) }
      : { ...error.additionalData };
  }

  // Add request related data to error object
  error = {
    ...error,
    additionalData: {
      ...error.additionalData,
      url,
      method,
      httpVersion,
    },
  };
  return response.status(error.statusCode).json({ error });
};
