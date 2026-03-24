# Politique de sécurité

## Versions supportées

Seule la dernière version publiée reçoit des correctifs de sécurité.

| Version | Support |
|---------|---------|
| 1.x (latest) | Oui |
| < 1.0 | Non |

## Signaler une vulnérabilité

**Ne pas ouvrir une issue publique pour une vulnérabilité de sécurité.**

Envoyez un rapport privé via **GitHub Security Advisories** :
1. Onglet **Security** du dépôt
2. **Report a vulnerability**
3. Décrivez le problème, les étapes de reproduction et l'impact potentiel

Vous recevrez une réponse sous 7 jours ouvrés. Si la vulnérabilité est confirmée, un correctif sera publié dès que possible avec mention dans les notes de version.

## Périmètre

Ce projet est une application desktop Windows. Les éléments dans le périmètre de sécurité incluent :

- Fuite de credentials Azure AD / tokens Microsoft
- Exécution de code arbitraire via les fonctionnalités de l'application
- Contournement du stockage sécurisé (Windows Credential Manager)
- Vulnérabilités dans les dépendances Rust ou npm incluses dans le binaire final
