import { SetMetadata } from '@nestjs/common';

export const OWNER_ACCESS_KEY = 'ownerAccess';

/**
 * Marque une route dont le contrôle d'accès repose sur la RELATION ou la
 * PROPRIÉTÉ, jamais sur une liste de rôles.
 *
 * Une telle route est ouverte à tout compte authentifié au niveau du guard : la
 * vraie décision — « le demandeur est-il le titulaire, ou relié à lui ? » —
 * appartient à la couche service, seule à savoir interroger `profile-service`.
 *
 * Pourquoi ce décorateur plutôt qu'une simple absence de `@Roles()` : une
 * absence se lit « contrôle oublié », et le lecteur suivant la « corrige » en
 * ajoutant une liste de rôles. `@OwnerAccess()` dit l'intention à voix haute.
 * Une liste de rôles sur une lecture pilotée par la relation est une fabrique à
 * bugs : elle oublie un rôle à chaque évolution. `formateur` et
 * `animateur_pedagogique` manquaient ainsi dans `finance-credit-service`, qui
 * refusait à un formateur ses PROPRES données financières (corrigé le
 * 2026-08-11) ; `profile-service` a repris la même forme le même jour, et ce
 * service la reprend à son tour, volontairement à l'identique.
 *
 * IMPORTANT : ce décorateur vaut pour les LECTURES. Les écritures gardent leur
 * `@Roles(...)` explicite — une relation ouvre la lecture, jamais l'écriture
 * (arbitrage du 2026-08-07).
 */
export const OwnerAccess = () => SetMetadata(OWNER_ACCESS_KEY, true);
