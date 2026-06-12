# BUG-009b — Encodage corrompu : rapport de correction

**Date :** 2026-06-12
**Statut :** OK

## Fichiers traites

### gateway/api-gateway/nginx.conf
- **33 lignes modifiees** (sur les 33 contenant des caracteres non-ASCII)
- Caracteres remplaces dans les commentaires :
  - U+2500 BOX DRAWINGS LIGHT HORIZONTAL (`─`) -> `-`
  - U+2550 BOX DRAWINGS DOUBLE HORIZONTAL (`=`) -> `-`
  - U+2014 EM DASH (`--`) -> `--`
  - U+00E9 e-accent-aigu (`e`) -> `e` (ex: "assuree", "securisee")
  - U+00F4 o-accent-circonf (`o`) -> `o` (ex: "cote")
- Lignes concernees : bandeaux de section (`# -- Logging ---`), separateurs doubles (`# == ... ==`), tirets d'etiquettes (`# -- Upstreams --`), commentaires inline avec em-dash, commentaires avec accents francais (lignes 348-349)

### docker-compose.yml
- **4 lignes modifiees** : les 4 bandeaux de section en commentaire
  - `# -- Infrastructure --`, `# -- Frontend --`, `# -- API Gateway --`, `# -- Phase 1 Services --`
- Seuls les commentaires touches, aucune valeur de configuration modifiee

## Verification finale
```
grep -Pn '[^\x00-\x7F]' nginx.conf        -> 0 resultats (CLEAN)
grep -Pn '[^\x00-\x7F]' docker-compose.yml -> 0 resultats (CLEAN)
```

## Methode
Remplacement uniquement dans les portions commentaire de chaque ligne (a partir du premier `#`).
Aucune donnee de configuration ni aucune valeur fonctionnelle n'a ete touchee.
