# Mirror Code V5.1

Prototype Electron d’un IDE visuel à trois couches superposées : **Preview → Code → Caméra**.

## Installation

```bash
npm install
npm start
```

## Fonctionnement

- Ouvrez un projet avec **OPEN PROJECT**.
- Le terminal est attaché à la racine de ce projet.
- Pour un projet statique, Mirror Code sert automatiquement le `index.html` local.
- Pour Vite/React/Next/Node/Flask/FastAPI/Django ou un autre serveur web, lancez votre commande dans le terminal (`npm run dev`, `npm start`, `python app.py`, `flask run`, `uvicorn main:app`, etc.).
- Dès qu’une URL `localhost` / `127.0.0.1` apparaît dans la sortie du terminal, le Preview bascule automatiquement vers cette URL.
- Un script Python purement console reste naturellement affiché dans le terminal : il n’a pas de page web à prévisualiser.

## Contrôles

- Clic droit : bascule Code / Preview interactif.
- Roulette : synchronisation proportionnelle Code / Preview quand le contenu est accessible.
- PREVIEW / CODE / CAMERA : opacité indépendante.
- TERMINAL : ouvrir / fermer le panneau inférieur sans arrêter le processus.
- FULLSCREEN : plein écran.
- REC : capture de la fenêtre Mirror Code courante en WebM.

## Prérequis projet

Node.js, Python, Git et autres outils doivent être installés sur la machine si le projet les utilise.

## Limites connues

Le terminal utilise le shell système via stdin/stdout et convient aux commandes de développement courantes. Ce n’est pas encore une émulation PTY complète comme le terminal natif de VS Code. Certains programmes TUI interactifs peuvent donc ne pas se comporter exactement comme dans un terminal complet.


## V5.1 — Sablier 4D intérieur
Effet optique fixe en forme de sablier/tunnel intérieur sur la zone des trois couches. Les surfaces de code et de preview restent rectangulaires et interactives; aucun mouvement lié à la souris n’est ajouté. Les réglages de visibilité Preview / Code / Camera restent disponibles.


## V5.1
Les trois curseurs de visibilité PREVIEW / CODE / CAMERA sont de nouveau affichés en permanence, y compris en Focus et plein écran. Chaque valeur reste indépendante de 0 à 100 %.


## V5.1
- `Échap` quitte le mode Focus ; si Focus est déjà quitté, `Échap` peut quitter le plein écran.
- Champ de commande du terminal agrandi et rendu explicitement visible/focusable.


## V5.2
- Terminal redimensionnable verticalement avec une poignée horizontale.
- Hauteur mémorisée entre les sessions.
- Limites de hauteur pour conserver l'éditeur utilisable.
