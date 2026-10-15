import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sprints", "routes/sprints.tsx"),
] satisfies RouteConfig;
