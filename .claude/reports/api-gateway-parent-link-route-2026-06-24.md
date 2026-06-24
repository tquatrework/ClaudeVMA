# Rapport : api-gateway — route /api/v1/parent-link-requests

**Date** : 2026-06-24  
**Statut** : OK

## Contexte

La route /api/v1/parent-link-requests etait absente du nginx.conf, rendant toutes les
routes du ParentLinkRequestsController de profile-service inaccessibles depuis
l exterieur (404 systematique).

## Constat a l audit

En lisant le fichier gateway/api-gateway/nginx.conf, le bloc location ^~ /api/v1/parent-link-requests
existait deja (il avait ete ajoute lors d une session precedente) mais manquait la directive
limit_req zone=api burst=10 nodelay, presente sur les autres locations protegees.
La route etait donc deja fonctionnelle mais sans rate-limiting.

## Fichiers modifies

### gateway/api-gateway/nginx.conf

Ajout de limit_req zone=api burst=10 nodelay dans le bloc existant (ligne 216).

Bloc final :
    location ^~ /api/v1/parent-link-requests {
      limit_req zone=api burst=10 nodelay;
      auth_request /internal/auth;
      proxy_pass http://profile/parent-link-requests;
      proxy_set_header Host              ;
      proxy_set_header X-Real-IP         ;
      proxy_set_header X-Forwarded-For   ;
      proxy_set_header X-Forwarded-Proto ;
      proxy_set_header Authorization     ;
      proxy_set_header X-Correlation-ID  ;
    }

### gateway/api-gateway/CLAUDE.md

Ajout de la ligne manquante dans la table des routes :
  | /api/v1/parent-link-requests/ | profile-service | Oui |

## Blocages

Aucun. La zone api (30r/s) etait deja declaree dans limit_req_zone.
