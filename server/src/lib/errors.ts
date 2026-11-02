/** Error codes match the ones the client already maps to messages. */
export type ErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'invalid-argument'
  | 'resource-exhausted'
  | 'internal';

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'already-exists': 409,
  'failed-precondition': 412,
  'invalid-argument': 400,
  'resource-exhausted': 429,
  internal: 500,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
