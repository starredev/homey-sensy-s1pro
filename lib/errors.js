/**
 * Error hierarchy of the app. Every error carries a stable machine-readable
 * `code` so API consumers (widget, settings page) can react without parsing
 * human-readable messages.
 */
export class SensyError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: unknown }} [options]
   */
  constructor(message, { code = 'SENSY_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
  }
}

/** Input that does not satisfy the domain rules. */
export class ValidationError extends SensyError {
  /** @param {string} message */
  constructor(message) {
    super(message, { code: 'VALIDATION' });
  }
}

/** A command was issued while the sensor is offline. */
export class NotConnectedError extends SensyError {
  /** @param {string} [detail] */
  constructor(detail) {
    super(detail ? `Sensor not connected (${detail})` : 'Sensor not connected', { code: 'NOT_CONNECTED' });
  }
}

/** A requested resource (sensor, zone, entity) does not exist. */
export class NotFoundError extends SensyError {
  /** @param {string} message */
  constructor(message) {
    super(message, { code: 'NOT_FOUND' });
  }
}

/** Nothing answered the ESPHome native API at an address. */
export class NotReachableError extends SensyError {
  /**
   * @param {string} address
   * @param {unknown} [cause]
   */
  constructor(address, cause) {
    super(`No ESPHome device answered at ${address}`, { code: 'NOT_REACHABLE', cause });
  }
}

/** The sensor at an address is already added to Homey. */
export class AlreadyAddedError extends SensyError {
  /** @param {string} id */
  constructor(id) {
    super(`Sensor ${id} is already added`, { code: 'ALREADY_ADDED' });
  }
}

/** An ESPHome device answered, but it is not a device this app supports. */
export class UnsupportedDeviceError extends SensyError {
  /** @param {string} projectName the ESPHome project name the device reported */
  constructor(projectName) {
    super(`Unsupported ESPHome device (project "${projectName || 'none'}")`, { code: 'UNSUPPORTED_DEVICE' });
  }
}
