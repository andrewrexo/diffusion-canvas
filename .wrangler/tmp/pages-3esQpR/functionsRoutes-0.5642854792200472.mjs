import { onRequest as __api_rd___path___ts_onRequest } from "/Users/samson/projects/diffusion-canvas/functions/api/rd/[[path]].ts"

export const routes = [
    {
      routePath: "/api/rd/:path*",
      mountPath: "/api/rd",
      method: "",
      middlewares: [],
      modules: [__api_rd___path___ts_onRequest],
    },
  ]