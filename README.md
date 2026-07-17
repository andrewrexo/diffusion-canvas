# Diffusion Canvas

An infinite canvas for making pixel art with [Retro Diffusion](https://retrodiffusion.ai).

![Diffusion Canvas](docs/screenshot.png)

Drop in reference images, wire them into generator nodes, and iterate on the results with a
built-in pixel editor — img2img, palette constraints, and hand editing in one place instead of
bouncing between a prompt box and an image editor.

## How it works

- **Generators are nodes.** Each generator card holds a prompt, a Retro Diffusion style
  (Plus / Fast / Pro families), output size, and an optional seed. Results land on the canvas
  as image nodes, linked back to the generator that produced them.
- **Images feed generators.** Drag from an image's output port into a generator's `src` port
  for img2img with an adjustable strength, or into `pal` to constrain the output to that
  image's colors. Reconnect or unplug edges by dragging them off a port.
- **Everything is editable.** Double-click any image to open the pixel editor: pencil, eraser,
  flood fill, line, rectangle, and eyedropper, with brush sizes, the image's extracted color
  palette, Sweetie 16, and per-session undo. Save writes back to the node, so a touched-up
  sprite can go straight back into another generation.
- Projects autosave to the browser. Any image exports as PNG at 1×, 4×, or 8×.

## Running it

You'll need [Bun](https://bun.sh) (Node + npm works too) and a Retro Diffusion API key.

```sh
bun install
bun run dev
```

Open the app and add your key in settings (top right). The key stays in localStorage, and API
calls go through Vite's dev-server proxy, so there are no CORS issues and no backend to run.

Press `?` in the app for keyboard shortcuts — most of the canvas is driveable without the
mouse leaving the node you're working on.

## Stack

React 19, TypeScript, Zustand, and Vite. The canvas, node graph, and pixel editor are
hand-rolled on DOM transforms and a single `<canvas>` — no diagramming or drawing libraries.

## License

MIT
