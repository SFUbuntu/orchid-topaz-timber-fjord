# VECTOR FANG

Juego de naves vertical, estilo 16 bits. TypeScript, React para los menús y canvas para la partida.

## Abrirlo en Visual Studio Code

1. Instala [Node.js 22](https://nodejs.org).
2. Clona este repositorio y ábrelo en VS Code (**Archivo → Abrir carpeta**).
3. En la terminal:

```bash
npm install
npm run dev
```

4. Abre http://localhost:8080

## Dónde está el juego

| Carpeta | Qué es |
|---|---|
| `src/game/engine.ts` | Partida: naves, enemigos, disparos, mando |
| `src/game/controls.ts` | Teclado y mando de PS4 |
| `src/components/VectorFang.tsx` | Menús |
| `public/sprites` | Dibujos |
| `public/music` | Música |
| `attachments` | Temas originales y referencias |
| `screenshots` | Capturas de prueba |

`package.json` es la ficha del proyecto. `package-lock.json` lo escribe npm; no hace falta editarlo.
