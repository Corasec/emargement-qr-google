# Option 1 — Google (Sheets + Drive + Apps Script)

Une page d’émargement avec **signature au doigt**, accessible par QR code sans compte. Les données
vont dans **une Google Sheet et un dossier Google Drive du compte de votre structure**. Personne
d’autre n’y a accès.

**Ce que vous obtenez**

| | |
|---|---|
| QR code + affiche A4 à imprimer | ✅ |
| Formulaire (dont le genre) + signature au doigt, sans compte | ✅ |
| Un émargement par personne et par jour (contrôle par e-mail **ou** téléphone) | ✅ |
| Numéro d’ordre par jour (1, 2, 3…) | ✅ |
| Page « Ai-je émargé ? » et liste publique (n°, nom abrégé, structure) | ✅ |
| Feuille d’émargement PDF avec les signatures et les totaux femmes / hommes par jour | ✅ (générée dans votre Drive) |
| Export Excel (.xlsx) sans les signatures, pour trier et filtrer les données | ✅ (généré dans votre Drive) |
| Coût | Gratuit |

**Temps d’installation** : environ 20 minutes, une seule fois. Pas besoin de savoir programmer : il
suffit de copier-coller trois fichiers, puis de mettre en ligne une page.

---

## Avant de commencer

- Utilisez **un compte Google de la structure** (par ex. `emargement@ma-structure.org` ou un Gmail
  créé pour l’occasion), pas un compte personnel. Toutes les données lui appartiendront.
- Gardez ce dossier ouvert : vous allez copier le contenu de `Code.gs`, `Signer.html` et
  `Affiche.html`. Ouvrez-les avec le Bloc-notes, ou tout autre éditeur de texte.

## Étape 1 — Créer la feuille

1. Allez sur <https://sheets.google.com> et créez une **feuille vierge**.
2. Nommez-la, par exemple « Émargement — Ma structure ».

## Étape 2 — Coller le script

1. Dans la feuille : menu **Extensions › Apps Script**. Un nouvel onglet s’ouvre.
2. Dans le fichier `Code.gs` déjà présent, **effacez tout**. Collez à la place **tout** le contenu de
   notre fichier `Code.gs`.
3. Ajoutez la page de signature : à gauche, cliquez sur **＋** à côté de « Fichiers », puis **HTML**.
   Nommez le fichier exactement `Signer` (sans « .html »). Effacez son contenu et collez celui de
   `Signer.html`.
4. Faites de même avec un fichier HTML nommé exactement `Affiche`, et collez-y le contenu
   d’`Affiche.html`.
5. Cliquez sur l’icône **Enregistrer** (💾).
6. Réglez le fuseau horaire : roue dentée **⚙ Paramètres du projet** › **Fuseau horaire**. Choisissez
   celui du lieu des évènements, par exemple « (GMT+01:00) Porto-Novo ». C’est lui qui décide du
   « jour » de l’émargement.

## Étape 3 — Installer

1. Revenez à l’onglet de la feuille et **rechargez la page** (F5). Après quelques secondes, un menu
   **Émargement** apparaît à droite de « Aide ».
2. Cliquez sur **Émargement › 1. Installer (une seule fois)**.
3. Google demande une autorisation. C’est normal : le script doit pouvoir écrire dans la feuille et
   dans votre Drive.
   - Choisissez votre compte.
   - Si un écran affiche **« Google n’a pas validé cette application »**, cliquez sur
     **Paramètres avancés**, puis **Accéder à … (non sécurisé)**. Le script est le vôtre : il
     n’envoie rien ailleurs.
   - Cliquez sur **Autoriser**.
4. Relancez **Émargement › 1. Installer** si la première fois s’est arrêtée à l’autorisation.
   Résultat : deux onglets, **Évènements** et **Émargements**, plus trois dossiers dans votre Drive :
   « Émargement — signatures », « Émargement — feuilles PDF » et « Émargement — exports Excel ».

## Étape 4 — Publier la page d’émargement

1. Dans l’onglet Apps Script : bouton bleu **Déployer › Nouveau déploiement**.
2. Roue dentée à côté de « Sélectionner le type » › **Application Web**.
3. Remplissez :
   - **Description** : `Émargement`
   - **Exécuter en tant que** : **Moi** (votre adresse)
   - **Qui a accès** : **Tout le monde**. C’est indispensable : les participants n’ont pas de compte.
4. Cliquez sur **Déployer**. Copiez l’adresse **Application Web**, celle qui se termine par `/exec`.
5. Revenez à la feuille : **Émargement › 2. Enregistrer l’adresse de l’application web**, collez
   l’adresse, puis OK.

## Étape 5 — Héberger la page publique (fortement recommandé)

**Pourquoi ?** Sur un téléphone connecté à **plusieurs comptes Google** (très fréquent sur Android), la
page servie par Google affiche « Impossible d’ouvrir le fichier pour le moment » : Google ajoute
`/u/0/` ou `/u/1/` dans l’adresse et se perd entre les comptes. Personne ne peut corriger ce bug côté
Google. La solution consiste à servir le formulaire depuis une petite page **hors de Google**. Elle
envoie les données au script en arrière-plan, sans les cookies Google du téléphone. Les données
restent dans votre feuille et votre Drive, comme avant.

1. Ouvrez `page-publique/index.html` avec le Bloc-notes. Tout en haut du `<script>`, remplacez
   `COLLEZ_ICI_L_ADRESSE_DE_L_APPLICATION_WEB` par l’adresse `/exec` de l’étape 4, en gardant les
   apostrophes :
   `var API = 'https://script.google.com/macros/s/AKfy…/exec';`
2. Mettez ce fichier en ligne sur un hébergeur gratuit de pages statiques. Au choix :
   - **Netlify Drop**, le plus simple : allez sur <https://app.netlify.com/drop>, créez un compte
     gratuit, puis glissez-déposez le **dossier** `page-publique`. Netlify donne une adresse du type
     `https://nom-au-hasard.netlify.app/`. Vous pouvez la renommer dans les paramètres du site.
   - **GitHub Pages** : créez un dépôt public, déposez-y `index.html`, puis activez **Settings ›
     Pages** (branche `main`). L’adresse ressemble à `https://mon-compte.github.io/mon-depot/`.
3. Revenez à la feuille : **Émargement › 3. Enregistrer l’adresse de la page publique**, collez
   l’adresse donnée par l’hébergeur, puis OK.

Les QR codes et affiches générés ensuite pointent vers cette page. **Réimprimez les affiches
générées avant cette étape.** Pour revenir à la page Google, relancez le menu 3 et laissez la
case vide.

> La page publique ne contient aucune donnée. Elle contient seulement l’adresse de votre
> application web, qui est de toute façon visible dans les QR codes.

L’installation est terminée.

---

## Utilisation, pour chaque évènement

1. **Créer** : menu **Émargement › Nouvel évènement…**, puis indiquez le titre, le premier jour et
   le dernier jour (JJ/MM/AAAA). L’évènement est créé en statut **Brouillon**, donc invisible du
   public.
2. **Ouvrir** : dans l’onglet **Évènements**, passez la colonne **Statut** à **Ouvert**. Les
   signatures ne sont acceptées que les jours de l’évènement.
3. **QR code et affiche** : cliquez sur la ligne de l’évènement, puis **Émargement › QR code et
   affiche**. Vous pouvez :
   - ouvrir l’**affiche A4** et l’imprimer, ou l’enregistrer en PDF ;
   - télécharger le QR code en image (pour un écran, une présentation, un message WhatsApp) ;
   - tester la page vous-même.
4. **Pendant l’évènement**, les participants scannent, remplissent et signent. Chaque signature
   arrive en direct dans l’onglet **Émargements**.
5. **Feuille d’émargement** : cliquez sur la ligne de l’évènement, puis **Émargement › Feuille
   d’émargement PDF**. Indiquez un jour, ou laissez vide pour tous les jours. Le PDF est enregistré
   dans le dossier « Émargement — feuilles PDF ».
6. **Export Excel** : cliquez sur la ligne de l’évènement, puis **Émargement › Export Excel, sans
   signatures**. Indiquez un jour, ou laissez vide pour tous les jours. Le fichier `.xlsx` est
   enregistré dans le dossier « Émargement — exports Excel ». Il contient deux onglets :
   **Participants** (une ligne par émargement : jour, n°, nom, genre, structure, fonction, pays,
   ville, e-mail, téléphone, heure) et **Totaux** (par jour : total, femmes, hommes, non précisé).
   La première fois, Google demande une **nouvelle autorisation** pour convertir le fichier en
   Excel. Acceptez-la comme à l’étape 3.
7. **Clore** : passez le **Statut** à **Clos**. La page affiche alors « La liste de présence de cet
   évènement est close ».

> ⚠️ Ne modifiez pas la colonne **Jeton** : c’est l’identifiant de l’évènement dans l’adresse du
> QR code.

## Si vous modifiez le script plus tard

Après toute modification du code : **Déployer › Gérer les déploiements** › crayon ✏️ › Version :
**Nouvelle version** › **Déployer**. L’adresse (et donc les QR codes déjà imprimés) ne change pas.

## Mettre à jour la page publique déployée

`page-publique/index.html` est le **modèle** : il garde le texte
`COLLEZ_ICI_L_ADRESSE_DE_L_APPLICATION_WEB` pour rester réutilisable. Ne mettez pas votre adresse
`/exec` dans ce dépôt. La page en ligne est une **copie** du modèle, dans laquelle seule la ligne
`var API = '…'` change.

Après une modification du modèle, recopiez-le vers la page en ligne en y injectant l’adresse `/exec`.
Si la page est hébergée sur GitHub Pages, lancez depuis ce dossier :

```bash
PAGE_REPO=../attendance-sheet   # clone local du dépôt de la page en ligne
API_URL='https://script.google.com/macros/s/AKfy…/exec'   # adresse de l’étape 4

sed "s#COLLEZ_ICI_L_ADRESSE_DE_L_APPLICATION_WEB#${API_URL}#" page-publique/index.html > "$PAGE_REPO/index.html"
git -C "$PAGE_REPO" diff --stat          # vérifier : rien d’autre que les changements du modèle
git -C "$PAGE_REPO" commit -am "Synchronise la page publique" && git -C "$PAGE_REPO" push
```

Pour vérifier que la page en ligne est à jour (aucune sortie = identique) :

```bash
sed "s#COLLEZ_ICI_L_ADRESSE_DE_L_APPLICATION_WEB#${API_URL}#" page-publique/index.html | diff - "$PAGE_REPO/index.html"
```

Avec Netlify Drop, faites le même remplacement dans une copie du dossier `page-publique`, puis
glissez-déposez cette copie sur votre site Netlify existant (zone de dépôt de la page des déploiements)
pour conserver la même adresse.

> L’adresse `/exec` reste la même tant que vous publiez une **nouvelle version** du même déploiement.
> Si vous créez un **nouveau déploiement**, l’adresse change : mettez à jour la page en ligne et le menu
> **Émargement › 2**. Les QR codes ne changent pas, car ils pointent vers la page publique.

**Exemple d’installation** : modèle dans `Corasec/emargement-qr-google` (privé), page
en ligne dans `Corasec/attendance-sheet` (public), servie sur <https://corasec.github.io/attendance-sheet/>.

---

## Bon à savoir (limites)

- **Bandeau Google** : avec un compte Gmail gratuit, la page affiche en haut « Cette application a
  été créée par un utilisateur de Google Apps Script ». C’est normal et sans danger.
- **Google Workspace** (compte professionnel Google) : si l’option « Tout le monde » n’apparaît pas
  à l’étape 4, l’administrateur du domaine l’a bloquée. Demandez-lui de l’autoriser, ou utilisez un
  compte Gmail dédié.
- **Affluence** : les signatures sont enregistrées **une par une** pour garantir des numéros sans
  doublon (1 à 2 secondes chacune). Lors d’un pic de 100 personnes en même temps, certaines
  attendront quelques secondes ; au-delà de 30 secondes, la page leur demande de réessayer.
  Conseil : affichez le QR code à plusieurs endroits et laissez la page ouverte dès l’accueil.
- **PDF** : Google limite un traitement à 6 minutes. Pour plus de 300 signatures environ, générez
  le PDF **jour par jour**.
- **Réseau** : la page a besoin d’Internet au moment de signer (pas de mode hors-ligne).
- **Confidentialité** : partagez la feuille et les dossiers Drive uniquement avec l’équipe. Les
  signatures ne sont jamais visibles du public. Supprimez les données quand elles ne sont plus
  nécessaires (durée de conservation selon votre politique et la loi applicable).
- **Copie sur SharePoint** : si vous le souhaitez, téléchargez la feuille (Fichier › Télécharger ›
  Excel) et le PDF après l’évènement, puis déposez-les sur votre SharePoint.

## En cas de problème

| Symptôme | Solution |
|---|---|
| Pas de menu « Émargement » | Rechargez la feuille (F5) et attendez 10 secondes. Vérifiez que le script est bien enregistré. |
| « Cette page n’existe pas » en scannant | L’évènement est en Brouillon, ou le jeton a été modifié. |
| « La liste n’est pas ouverte aujourd’hui » | Statut différent de « Ouvert », date hors de l’évènement, ou mauvais fuseau horaire (étape 2.6). |
| Sur téléphone : « Impossible d’ouvrir le fichier pour le moment » (adresse avec `/u/0/` ou `/u/1/`) | Le téléphone est connecté à plusieurs comptes Google. Faites l’étape 5 (page publique) et réimprimez le QR code. En attendant, ouvrir le lien en navigation privée fonctionne. |
| La page publique affiche « La connexion a échoué » | Vérifiez l’adresse `API` dans `index.html`. Vérifiez aussi qu’une **nouvelle version** du script a été déployée (Gérer les déploiements) et que « Qui a accès » est « Tout le monde ». |
| La page publique affiche « Page mal configurée » | L’adresse `API` n’a pas été remplacée dans `index.html`, ou elle ne se termine pas par `/exec`. |
| Le QR code mène à une page Google « accès refusé » | À l’étape 4, « Qui a accès » n’est pas « Tout le monde ». Corrigez via Gérer les déploiements. |
| Le menu « Export Excel » n’apparaît pas | Rechargez la feuille (F5) après avoir collé le nouveau script. |
| « (signature introuvable) » dans le PDF | Le fichier PNG a été supprimé ou déplacé du dossier « Émargement — signatures ». |
