import { useEffect, useRef, useState } from 'react'
import { Application } from 'pixi.js'
import type { SceneId } from './catalog'
import { drawScene, SCENE_HEIGHT, SCENE_WIDTH, type SceneDrawing } from './drawScene'

interface Props {
  scene: SceneId
  selectedId: string | null
  onSelect: (id: string) => void
}

interface Runtime {
  app: Application
  drawing: SceneDrawing | null
  scene: SceneId | null
  resize: () => void
}

/** React owns selection; Pixi draws it and reports pointer selections. */
export function SceneCanvas({ scene, selectedId, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<Runtime | null>(null)
  const latestRef = useRef({ scene, selectedId, onSelect })
  const [failed, setFailed] = useState(false)
  latestRef.current = { scene, selectedId, onSelect }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let observer: ResizeObserver | undefined
    let runtime: Runtime | null = null
    const app = new Application()

    const start = async () => {
      try {
        await app.init({ antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1, autoStart: false, background: 0xd6ded0 })
        // init is asynchronous; a previous React mount may already have gone away.
        if (disposed) {
          app.destroy({ removeView: true }, { children: true })
          return
        }
        host.appendChild(app.canvas)
        runtime = {
          app,
          drawing: null,
          scene: null,
          resize: () => {
            if (!runtime) return
            const width = Math.max(1, host.clientWidth)
            const height = Math.max(1, host.clientHeight)
            app.renderer.resize(width, height)
            if (runtime.drawing) {
              const scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT)
              runtime.drawing.container.scale.set(scale)
              runtime.drawing.container.position.set((width - SCENE_WIDTH * scale) / 2, (height - SCENE_HEIGHT * scale) / 2)
            }
            app.render()
          },
        }
        runtimeRef.current = runtime
        update(runtime, latestRef.current, (id) => latestRef.current.onSelect(id))
        observer = new ResizeObserver(() => runtime?.resize())
        observer.observe(host)
      } catch {
        if (!disposed) setFailed(true)
      }
    }
    void start()

    return () => {
      disposed = true
      observer?.disconnect()
      if (runtime) {
        runtimeRef.current = null
        app.destroy({ removeView: true }, { children: true })
        runtime = null
      }
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (runtime) update(runtime, latestRef.current, (id) => latestRef.current.onSelect(id))
  }, [scene, selectedId])

  return (
    <div className="scene-canvas" ref={hostRef} aria-hidden="true">
      {failed && <div className="scene-fallback">Scene illustration unavailable</div>}
    </div>
  )
}

function update(runtime: Runtime, props: Props, onSelect: (id: string) => void) {
  if (runtime.scene !== props.scene) {
    if (runtime.drawing) {
      runtime.app.stage.removeChild(runtime.drawing.container)
      runtime.drawing.container.destroy({ children: true })
    }
    runtime.drawing = drawScene(props.scene, onSelect)
    runtime.scene = props.scene
    runtime.app.stage.addChild(runtime.drawing.container)
  }
  runtime.drawing?.select(props.selectedId)
  runtime.resize()
}
