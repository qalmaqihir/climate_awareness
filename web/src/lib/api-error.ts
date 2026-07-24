import { NextResponse } from 'next/server';
import { createLogger } from './logger';

const logger = createLogger('api');

/**
 * Typed error for expected HTTP failure conditions (4xx, 5xx).
 * Throw inside any route handler — withApiHandler converts it to the right JSON response.
 *
 * Usage:
 *   throw new AppError(404, 'Event not found');
 *   throw new AppError(422, "Cannot transition from 'submitted' to 'published'");
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Wraps a Next.js route handler with a standardised error boundary.
 *
 * - AppError  → JSON { error } with the specified status code
 * - Any other thrown value → logged + 500 Internal Server Error
 *
 * Works with both simple and parameterised routes:
 *
 *   // Simple route
 *   export const GET = withApiHandler(async (req) => { ... });
 *
 *   // Parameterised route
 *   export const GET = withApiHandler(async (req, { params }) => {
 *     const { id } = await params;
 *     ...
 *   });
 */
export function withApiHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Unhandled route error', { error: msg });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
