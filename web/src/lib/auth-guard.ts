import { auth } from './auth';
import { AppError } from './api-error';

/**
 * Resolves the current session and throws AppError(401) if the user is not
 * an authenticated admin.
 *
 * Usage inside a withApiHandler-wrapped route:
 *   const session = await requireAdmin();
 *   // execution continues only for admins
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) throw new AppError(401, 'Unauthorized');
  return session;
}
