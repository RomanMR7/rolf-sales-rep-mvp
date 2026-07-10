import { z } from 'zod'

export const userRoleSchema = z.enum(['OWNER', 'ADMIN', 'SUPERVISOR', 'MANAGER', 'VIEWER'])
export const clientPointTypeSchema = z.enum(['AUTO_SHOP', 'SERVICE_STATION', 'WHOLESALE', 'RETAIL', 'OTHER'])
export const clientPointStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'LEAD', 'ARCHIVED'])
export const visitStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'])
export const visitResultSchema = z.enum(['ORDER_CREATED', 'NO_NEED', 'CLIENT_ABSENT', 'CALLBACK_REQUIRED', 'OTHER'])
export const orderStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'IN_DELIVERY', 'COMPLETED', 'CANCELLED'])

export const idParamSchema = z.object({ id: z.string().min(1) })

export const clientPointSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: clientPointTypeSchema,
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string(),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  assignedRepId: z.string(),
  status: clientPointStatusSchema,
  comment: z.string().nullable(),
  lastVisitAt: z.string().datetime().nullable(),
  nextVisitAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const clientPointInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: clientPointTypeSchema,
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(2).max(240),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  assignedRepId: z.string().min(1).optional(),
  status: clientPointStatusSchema.optional(),
  comment: z.string().trim().max(1000).optional(),
  lastVisitAt: z.string().datetime().optional(),
  nextVisitAt: z.string().datetime().optional(),
})

export const productCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const productCategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional(),
})

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  category: productCategorySchema.optional(),
  viscosity: z.string().nullable(),
  volume: z.string(),
  sku: z.string(),
  basePrice: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  stock: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  categoryId: z.string().min(1),
  viscosity: z.string().trim().max(40).optional(),
  volume: z.string().trim().min(1).max(40),
  sku: z.string().trim().min(2).max(80),
  basePrice: z.number().nonnegative(),
  currency: z.string().trim().min(3).max(3).default('AED'),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
  stock: z.number().int().nonnegative().optional(),
})

export const visitSchema = z.object({
  id: z.string(),
  clientPointId: z.string(),
  salesRepId: z.string(),
  clientPoint: clientPointSchema.optional(),
  plannedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  status: visitStatusSchema,
  result: visitResultSchema.nullable(),
  comment: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const visitInputSchema = z.object({
  clientPointId: z.string().min(1),
  salesRepId: z.string().min(1).optional(),
  plannedAt: z.string().datetime(),
  status: visitStatusSchema.optional(),
  result: visitResultSchema.optional(),
  comment: z.string().trim().max(1000).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
})

export const orderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  product: productSchema.optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  discount: z.number(),
  lineTotal: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  clientPointId: z.string(),
  salesRepId: z.string(),
  visitId: z.string().nullable(),
  status: orderStatusSchema,
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  comment: z.string().nullable(),
  managerComment: z.string().nullable(),
  clientPoint: clientPointSchema.optional(),
  items: z.array(orderItemSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const orderInputSchema = z.object({
  clientPointId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  comment: z.string().trim().max(1000).optional(),
  discount: z.number().nonnegative().optional(),
  items: z.array(orderItemInputSchema).min(1),
})

export const orderPatchSchema = z.object({
  comment: z.string().trim().max(1000).optional(),
  managerComment: z.string().trim().max(1000).optional(),
  discount: z.number().nonnegative().optional(),
  items: z.array(orderItemInputSchema).min(1).optional(),
})

export const dashboardSchema = z.object({
  visitsToday: z.number(),
  ordersToday: z.number(),
  ordersTodayTotal: z.number(),
  clients: z.number(),
  activeSalesReps: z.number().optional(),
  latestOrders: z.array(orderSchema),
})

export const listClientsResponseSchema = z.object({ clients: z.array(clientPointSchema) })
export const clientResponseSchema = z.object({ client: clientPointSchema })
export const listProductCategoriesResponseSchema = z.object({ categories: z.array(productCategorySchema) })
export const productCategoryResponseSchema = z.object({ category: productCategorySchema })
export const listProductsResponseSchema = z.object({ products: z.array(productSchema) })
export const productResponseSchema = z.object({ product: productSchema })
export const listVisitsResponseSchema = z.object({ visits: z.array(visitSchema) })
export const visitResponseSchema = z.object({ visit: visitSchema })
export const listOrdersResponseSchema = z.object({ orders: z.array(orderSchema) })
export const orderResponseSchema = z.object({ order: orderSchema })
export const dashboardResponseSchema = z.object({ dashboard: dashboardSchema })

export type ClientPointDto = z.infer<typeof clientPointSchema>
export type ClientPointInput = z.infer<typeof clientPointInputSchema>
export type ProductCategoryDto = z.infer<typeof productCategorySchema>
export type ProductCategoryInput = z.infer<typeof productCategoryInputSchema>
export type ProductDto = z.infer<typeof productSchema>
export type ProductInput = z.infer<typeof productInputSchema>
export type VisitDto = z.infer<typeof visitSchema>
export type VisitInput = z.infer<typeof visitInputSchema>
export type OrderDto = z.infer<typeof orderSchema>
export type OrderInput = z.infer<typeof orderInputSchema>
export type OrderPatch = z.infer<typeof orderPatchSchema>
export type DashboardDto = z.infer<typeof dashboardSchema>
