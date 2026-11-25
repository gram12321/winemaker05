import { Application } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import type { SceneId, SceneObjectId } from "../experience";
import type { SceneVisuals } from "./sceneVisuals";
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, type DrawnScene } from "./drawScenes";

interface SceneCanvasProps {
  scene: SceneId;
  selected: SceneObjectId | null;
  onSelect: (id: SceneObjectId) => void;
  visuals?: SceneVisuals;
}

export function SceneCanvas({ scene, selected, onSelect, visuals }: SceneCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const drawingRef = useRef<DrawnScene | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const visualsRef = useRef(visuals);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    selectedRef.current = selected;
    onSelectRef.current = onSelect;
    visualsRef.current = visuals;
  }, [selected, onSelect, visuals]);

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
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          backgroundAlpha: 0,
          preference: "webgl",
        });
        initialized = true;
        if (cancelled) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }

        app.canvas.setAttribute("aria-hidden", "true");
        host?.appendChild(app.canvas);
        const drawing = drawScene(scene, (id) => onSelectRef.current(id), visualsRef.current);
        drawing.setSelection(selectedRef.current);
        app.stage.addChild(drawing.root);
        appRef.current = app;
        drawingRef.current = drawing;
        app.stop();
        app.render();
      } catch {
        if (appRef.current === app) {
          appRef.current = null;
          drawingRef.current = null;
        }
        const stage = app.stage;
        try {
          if (app.renderer) app.destroy({ removeView: true }, { children: true });
          else stage.destroy({ children: true });
        } catch {
          try { stage.destroy({ children: true }); } catch { /* The failed renderer already released its stage. */ }
        } finally {
          initialized = false;
        }
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
      if (initialized) app.destroy({ removeView: true }, { children: true });
    };
  }, [scene]);

  useEffect(() => {
    drawingRef.current?.setSelection(selected);
    appRef.current?.render();
  }, [selected]);

  useEffect(() => {
    if (!visuals) return;
    drawingRef.current?.setVisuals(visuals);
    appRef.current?.render();
  }, [visuals]);

  return (
    <div className="scene-canvas" ref={hostRef}>
      {unavailable && <p className="scene-fallback">The scene is unavailable. Use the places listed below.</p>}
    </div>
  );
}
