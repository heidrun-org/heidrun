import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  TorusKnotGeometry,
  WebGLRenderer,
} from "three";

/**
 * The 3D scene of the window "Three.js demo": one torus knot that turns, lit by one directional light and one
 * ambient light, drawn on a canvas with WebGL. The constructor throws when the web view cannot create a WebGL context.
 */
export class ThreeJsDemoScene {
  /** The renderer that draws the scene on the canvas. */
  private readonly _renderer: WebGLRenderer;
  /** The scene that holds the torus knot and the two lights. */
  private readonly _scene = new Scene();
  /** The camera that looks at the torus knot. */
  private readonly _camera = new PerspectiveCamera(45, 1, 0.1, 100);
  /** The torus knot that turns. */
  private readonly _mesh: Mesh<TorusKnotGeometry, MeshStandardMaterial>;
  /** The identifier of the pending animation frame, or null when the animation is stopped. */
  private _frameId: number | null = null;

  /**
   * @param canvas - The canvas on which the scene is drawn.
   */
  constructor(canvas: HTMLCanvasElement) {
    this._renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._mesh = new Mesh(new TorusKnotGeometry(1, 0.34, 160, 24), new MeshStandardMaterial({ color: 0x4f8cff, roughness: 0.35, metalness: 0.25 }));
    const directionalLight = new DirectionalLight(0xffffff, 3);
    directionalLight.position.set(3, 4, 5);
    this._scene.add(this._mesh, directionalLight, new AmbientLight(0xffffff, 0.6));
    this._camera.position.set(0, 0, 4.5);
  }

  /** The version text of the WebGL context, for example "WebGL 2.0 (OpenGL ES 3.0 Metal)". */
  get webGlVersion(): string {
    const context = this._renderer.getContext();
    return String(context.getParameter(context.VERSION));
  }

  /**
   * Gives the canvas a new size, and keeps the shape of the torus knot.
   *
   * @param width - The new width of the canvas, in CSS pixels.
   * @param height - The new height of the canvas, in CSS pixels.
   */
  resize(width: number, height: number): void {
    if (width === 0 || height === 0) {
      return;
    }
    this._renderer.setSize(width, height, false);
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.render(this._scene, this._camera);
  }

  /** Starts the animation: the torus knot turns until `dispose` is called. */
  start(): void {
    if (this._frameId !== null) {
      return;
    }
    const drawFrame = (): void => {
      this._mesh.rotation.x += 0.008;
      this._mesh.rotation.y += 0.013;
      this._renderer.render(this._scene, this._camera);
      this._frameId = requestAnimationFrame(drawFrame);
    };
    this._frameId = requestAnimationFrame(drawFrame);
  }

  /** Stops the animation, and frees the graphics memory of the torus knot and of the renderer. */
  dispose(): void {
    if (this._frameId !== null) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
    this._mesh.geometry.dispose();
    this._mesh.material.dispose();
    this._renderer.dispose();
  }
}
