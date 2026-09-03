# Architecture microservices VisioMath

> Scindé le 2026-09-03 en fichiers thématiques sous `docs/architecture/`, ce fichier devenant
> un index. Le contenu n'a pas changé de fond — seulement d'emplacement — et aucune ligne
> d'arbitrage n'a été supprimée dans l'opération (log append-only, cf. les nombreux arbitrages
> qui posent cette règle pour les données métier elles-mêmes ; le même principe s'applique à ce
> journal de décisions d'architecture).

## Sommaire

- [docs/architecture/overview.md](architecture/overview.md) — Principe de découpage, liste des
  16 microservices, services de phase 1, priorisation par phase, services transverses recommandés.
- [docs/architecture/identite-profils-acces.md](architecture/identite-profils-acces.md) —
  Propriété des données d'identité, profils administratif/pédagogique, droits de lecture/écriture,
  consentements RGPD, visibilité champ par champ, UUID, stockage des binaires (photo de profil),
  chargement des écrans, accès aux statistiques/archives, rupture d'un lien parent↔élève.
- [docs/architecture/demande-professeur.md](architecture/demande-professeur.md) — Flow complet de
  la demande de professeur, résolution de noms interservices, frontière service métier /
  orchestrateur, annuaire des formateurs validés, validation des nouveaux formateurs, fin d'une
  relation élève↔formateur, reprise de candidature après refus.
- [docs/architecture/cahier-texte-notifications-carnet.md](architecture/cahier-texte-notifications-carnet.md)
  — Système de notifications transversal (cloche), défauts de visibilité champ par champ, liens et
  pièces jointes du cahier de texte, syntaxe légère pour le texte enrichi, carnet personnel
  (spécification, généralisation aux autres rôles, accès administratif/parental).
- [docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md](architecture/contenu-pedagogique-quizz-exercices-evaluations.md)
  — Quizz, Exercices et Évaluations : modèle, droits, validation, import tableur, barème, et
  visibilité du contenu en attente de validation pour son validateur.
- [docs/architecture/rail-rp-et-points-ouverts.md](architecture/rail-rp-et-points-ouverts.md) —
  Reconstruction du rail gauche du RP (dont l'écran Visualisation) et points ouverts à arbitrer.
