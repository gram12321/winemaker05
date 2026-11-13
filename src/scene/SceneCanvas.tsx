import { Application } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import type { SceneId, SceneObjectId } from "../experience";
import { drawScene, type DrawnScene } from "./drawScenes";

interface SceneCanvasProps {
  scene: SceneId;
  selected: SceneObjectId | null;
  onSelect: (id: SceneObjectId) => void;
}

export function SceneCanvas({ scene, selected, onSelect }: SceneCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const drawingRef = useRef<DrawnScene | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    selectedRef.current = selected;
    onSelectRef.current = onSelect;
  }, [selected, onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;
    let initialized = false;
    setUnavailable(false);

    async function initialize() {
      try {
        await app.init({
          width: 1000,
          height: 530,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          backgroundAlpha: 0,
          preference: "webgl",
        });
        initialized = true;
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }

        app.canvas.setAttribute("aria-hidden", "true");
        host?.appendChild(app.canvas);
        const drawing = drawScene(scene, (id) => onSelectRef.current(id));
        drawing.setSelection(selectedRef.current);
        app.stage.addChild(drawing.root);
        appRef.current = app;
        drawingRef.current = drawing;
        app.stop();
        app.render();
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      if (appRef.current === app) {
        appRef.current = null;
        drawingRef.current = null;
      }
      if (initialized) app.destroy(true, { children: true });
    };
  }, [scene]);

  useEffect(() => {
    drawingRef.current?.setSelection(selected);
    appRef.current?.render();
  }, [selected]);

  return (
    <div className="scene-canvas" ref={hostRef}>
      {unavailable && <p className="scene-fallback">The scene is unavailable. Use the places listed below.</p>}
    </div>
  );
}
