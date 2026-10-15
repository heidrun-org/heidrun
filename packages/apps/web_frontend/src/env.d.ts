/// <reference types="vite/client" />

/** The date and time of the build, as `<year><month><day>-<hours><minutes><seconds>`. Set by `vite.config.ts`. */
declare const __BUILD_TIME__: string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, any>;
  export default component;
}
