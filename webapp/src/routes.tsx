import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { AppPage, HomePage, RootLayout } from './pages'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppPage,
})

const appAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/admin',
  component: AppPage,
})

const appAdminManagersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/admin/managers',
  component: AppPage,
})

const appAdminManagerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/admin/managers/$id',
  component: AppPage,
})

const appAdminFunctionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/admin/functions',
  component: AppPage,
})

const appAdminScriptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/admin/scripts',
  component: AppPage,
})

const appAdminMetricsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/admin/metrics',
  component: AppPage,
})

const appLeadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/leads',
  component: AppPage,
})

const appSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/settings',
  component: AppPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute,
  appAdminRoute,
  appAdminManagersRoute,
  appAdminManagerDetailRoute,
  appAdminFunctionsRoute,
  appAdminScriptsRoute,
  appAdminMetricsRoute,
  appLeadsRoute,
  appSettingsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
