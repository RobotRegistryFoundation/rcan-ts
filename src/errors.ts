/**
 * RCAN error class hierarchy.
 * All errors extend RCANError which extends the built-in Error.
 */

export class RCANError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RCANError";
    // Restore prototype chain for instanceof checks in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RCANAddressError extends RCANError {
  constructor(message: string) {
    super(message);
    this.name = "RCANAddressError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RCANValidationError extends RCANError {
  constructor(message: string) {
    super(message);
    this.name = "RCANValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RCANGateError extends RCANError {
  constructor(
    message: string,
    public gateType: string,
    public value?: number,
    public threshold?: number
  ) {
    super(message);
    this.name = "RCANGateError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RCANSignatureError extends RCANError {
  constructor(message: string) {
    super(message);
    this.name = "RCANSignatureError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RCANRegistryError extends RCANError {
  constructor(message: string) {
    super(message);
    this.name = "RCANRegistryError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Node / Federation errors ──────────────────────────────────────────────────

export class RCANNodeError extends RCANError {
  constructor(message: string, public readonly nodeUrl?: string) {
    super(message);
    this.name = "RCANNodeError";
    Object.setPrototypeOf(this, RCANNodeError.prototype);
  }
}

export class RCANNodeNotFoundError extends RCANNodeError {
  constructor(public readonly rrn: string, nodeUrl?: string) {
    super(`RRN not found in federation: ${rrn}`, nodeUrl);
    this.name = "RCANNodeNotFoundError";
    Object.setPrototypeOf(this, RCANNodeNotFoundError.prototype);
  }
}

export class RCANNodeSyncError extends RCANNodeError {
  constructor(
    message: string,
    nodeUrl?: string,
    public readonly cause?: Error
  ) {
    super(message, nodeUrl);
    this.name = "RCANNodeSyncError";
    Object.setPrototypeOf(this, RCANNodeSyncError.prototype);
  }
}

export class RCANNodeTrustError extends RCANNodeError {
  public readonly reason: "invalid_signature" | "expired_cert" | "unknown_issuer" | "missing_pubkey";

  constructor(reason: RCANNodeTrustError["reason"], nodeUrl?: string) {
    super(`Node trust verification failed: ${reason}`, nodeUrl);
    this.name = "RCANNodeTrustError";
    this.reason = reason;
    Object.setPrototypeOf(this, RCANNodeTrustError.prototype);
  }
}

// ── v1.5 errors ───────────────────────────────────────────────────────────────

/** Thrown when an incoming message has an incompatible MAJOR version */
export class RCANVersionIncompatibleError extends RCANError {
  constructor(incomingVersion: string, localVersion: string) {
    super(`VERSION_INCOMPATIBLE: incoming=${incomingVersion}, local=${localVersion}`);
    this.name = "RCANVersionIncompatibleError";
    Object.setPrototypeOf(this, RCANVersionIncompatibleError.prototype);
  }
}

/** Thrown when a replay attack is detected */
export class RCANReplayAttackError extends RCANError {
  constructor(reason: string) {
    super(`REPLAY_DETECTED: ${reason}`);
    this.name = "RCANReplayAttackError";
    Object.setPrototypeOf(this, RCANReplayAttackError.prototype);
  }
}

/** Thrown when a delegation chain is invalid or too deep */
export class RCANDelegationChainError extends RCANError {
  constructor(reason: string) {
    super(`DELEGATION_CHAIN_ERROR: ${reason}`);
    this.name = "RCANDelegationChainError";
    Object.setPrototypeOf(this, RCANDelegationChainError.prototype);
  }
}

/** Thrown when a config update is unauthorized or has a hash mismatch */
export class RCANConfigAuthorizationError extends RCANError {
  constructor(reason: string) {
    super(`CONFIG_AUTH_ERROR: ${reason}`);
    this.name = "RCANConfigAuthorizationError";
    Object.setPrototypeOf(this, RCANConfigAuthorizationError.prototype);
  }
}

/**
 * Thrown by canonicalJson for a value that has no canonical form (RFC 8785):
 * NaN or Infinity ("non_finite_number"), or a string or member name with an
 * unpaired surrogate ("invalid_string").
 */
export class RCANEncodingError extends RCANError {
  public readonly code: "non_finite_number" | "invalid_string";
  constructor(code: "non_finite_number" | "invalid_string", message: string) {
    super(message);
    this.name = "RCANEncodingError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
