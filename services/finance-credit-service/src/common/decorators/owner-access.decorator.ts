import { SetMetadata } from '@nestjs/common';

export const OWNER_ACCESS_KEY = 'ownerAccess';

/**
 * Marks a route whose access control is based on **ownership**, not on a role allowlist.
 *
 * Such a route is open to any authenticated user at the HTTP guard level: the real
 * decision — "is the requester the owner of this resource, or does their role grant
 * privileged access to someone else's resource?" — belongs to the service layer,
 * which is the only place that knows the resource.
 *
 * Why this decorator exists rather than simply omitting `@Roles()`:
 * an absent `@Roles()` used to mean "check forgotten" in this service (see the N1
 * normalisation of 2026-06-28). `@OwnerAccess()` states the intent explicitly, so a
 * later reader does not "fix" it by adding a role allowlist that would once again
 * lock the owner out of their own data.
 *
 * A role allowlist on an owner-scoped read is a bug factory: every new role has to be
 * remembered in every list. `formateur` and `animateur_pedagogique` were missing from
 * the financial profile / archive lists, which denied teachers access to their own
 * financial data (fixed 2026-08-11).
 *
 * IMPORTANT: this decorator applies to **reads**. Write routes keep their explicit
 * `@Roles(...)` allowlist.
 */
export const OwnerAccess = () => SetMetadata(OWNER_ACCESS_KEY, true);
