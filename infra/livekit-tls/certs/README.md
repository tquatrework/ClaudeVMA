# Certificat auto-signe — LiveKit, phase de test

**Ce dossier contient un certificat auto-signe ET sa cle privee, committes dans le
depot.** C'est une decision assumee, prise le 2026-08-19, pas un oubli de
securite — lire ce document avant de reutiliser ce pattern ailleurs.

## Pourquoi c'est acceptable ici

- Ce certificat n'a **aucune valeur de confiance**. Il n'est signe par aucune
  autorite reconnue ; tout navigateur qui s'y connecte affiche un avertissement
  que l'utilisateur doit accepter manuellement. Sa seule fonction est de
  permettre un chiffrement TLS pour que le navigateur accepte d'ouvrir une
  connexion WebSocket (`wss://`) vers LiveKit depuis une page servie en HTTPS —
  ce n'est **pas** un mecanisme d'authentification ni de confidentialite au sens
  ou un vrai certificat de production l'est.
- Le committer permet un deploiement reproductible sans etape manuelle
  supplementaire (generation a la main sur la machine cible, gestion hors
  depot, etc.) — coherent avec le choix explicite de l'utilisateur d'une
  solution rapide pour une preuve technique.
- Il est regenerable a tout moment avec la commande ci-dessous : rien n'est
  perdu si ce dossier est supprime et regenere.

## Ce que ceci n'autorise PAS

**Ne jamais reproduire ce pattern pour un vrai secret de production** —
`JWT_SECRET`, `INTERNAL_SECRET`, mots de passe de base de donnees, cles API
tierces, ou un futur certificat TLS a valeur de confiance reelle (Let's
Encrypt ou equivalent). Un certificat auto-signe sans autorite de confiance
n'est pas un secret au sens ou ces valeurs le sont : sa compromission n'ouvre
aucun acces qu'un attaquant n'aurait pas deja simplement en se connectant au
port ouvert. C'est cette absence de valeur qui justifie l'exception, pas une
tolerance generale a committer des cles privees.

## Regeneration

```bash
cd infra/livekit-tls/certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout livekit-selfsigned.key \
  -out livekit-selfsigned.crt \
  -days 825 \
  -config openssl-san.cnf \
  -extensions v3_req
```

`openssl-san.cnf` porte le SAN (`subjectAltName`) IP requis — un certificat
sans SAN IP est rejete par les navigateurs modernes meme apres acceptation
manuelle de l'avertissement (le CN seul ne suffit plus). Si l'IP publique de
la machine change, mettre a jour `IP.1` dans `openssl-san.cnf` avant de
regenerer.

Valide jusqu'au 2028-11-21 (825 jours). A regenerer avant cette date, ou plus
tot si ce chantier passe a un certificat de confiance reelle.
