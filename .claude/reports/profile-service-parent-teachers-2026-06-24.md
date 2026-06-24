# Rapport — profile-service : accès PARENT_FINANCEUR à getTeachersByStudent
Date : 2026-06-24
Statut : ✅

## Fichiers modifiés

- `services/profile-service/src/relations/relations.service.ts`
- `services/profile-service/src/relations/relations.controller.ts`
- `services/profile-service/test/unit/relations/relations.service.spec.ts`

## Logique ajoutée

Dans `RelationsService.getTeachersByStudent()`, après le bloc `FORMATEUR`, ajout d'un bloc `PARENT_FINANCEUR` :

```typescript
if (actor.role === UserRole.PARENT_FINANCEUR) {
  const parentStudentLink = await this.financeRepo.findOne({
    where: { financeOwnerId: actor.id, studentId },
  });
  if (!parentStudentLink) {
    throw new ForbiddenException(
      'You are not linked to this student and cannot list their teachers',
    );
  }
  return this.teacherRepo.find({ where: { studentId }, order: { createdAt: 'ASC' } });
}
```

La vérification relationnelle interroge la table `finance_owner_student_links` avec le couple `(financeOwnerId = actor.id, studentId = studentId)`. Si aucune ligne n'existe, `ForbiddenException` est levée. Si le lien existe, la liste complète des formateurs de l'élève est retournée (même comportement que pour RP/TI/élève).

## Tests ajoutés (relations.service.spec.ts)

Remplacement du test existant (qui vérifiait un refus systématique pour `PARENT_FINANCEUR`) par deux tests :

1. **Cas nominal** : `PARENT_FINANCEUR` lié → `financeRepo.findOne` retourne un lien → la liste des formateurs est retournée, et `financeRepo.findOne` est appelé avec `{ financeOwnerId: 'parent-uuid', studentId: 'student-uuid' }`.
2. **Cas erreur** : `PARENT_FINANCEUR` non lié → `financeRepo.findOne` retourne `null` → `ForbiddenException`.

## Résultats des tests

23/23 tests passent (suite complète `relations.service.spec.ts`), dont les 2 nouveaux.

## Documentation Swagger

Description de `GET /relations/teacher-student/:studentId` mise à jour pour mentionner `PARENT_FINANCEUR` lié parmi les acteurs autorisés.

## Blocages

Aucun.
