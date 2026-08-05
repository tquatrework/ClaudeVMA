/**
 * Format de numéro de téléphone accepté sur les routes de création de compte
 * (le téléphone est saisi en complément de firstName/lastName lors de
 * l'inscription, cf. RegisterStudentPayload côté front — décision produit du
 * 2026-08-05). Volontairement permissif (chiffres, espaces, +, -, ., parenthèses,
 * 6 à 30 caractères) pour accepter aussi bien un format local (`06 01 02 03 04`)
 * qu'un format international (`+33 6 01 02 03 04`), sans imposer une norme stricte
 * (E.164) non confirmée côté produit. Longueur max alignée sur la validation
 * appliquée par profile-service (seul lieu de stockage de ce champ depuis le
 * 2026-08-05 — identity-access-service ne le persiste plus du tout localement).
 */
export const PHONE_NUMBER_REGEX = /^[0-9+()\-.\s]{6,30}$/;
