import {
  apiErrorSchema,
  clientPointInputSchema,
  clientResponseSchema,
  dashboardResponseSchema,
  idParamSchema,
  listClientsResponseSchema,
  listOrdersResponseSchema,
  listProductCategoriesResponseSchema,
  listProductsResponseSchema,
  listVisitsResponseSchema,
  orderInputSchema,
  orderPatchSchema,
  orderResponseSchema,
  productCategoryInputSchema,
  productCategoryResponseSchema,
  productInputSchema,
  productResponseSchema,
  visitInputSchema,
  visitResponseSchema,
} from '@rolf-sales-rep-mvp/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'

import type { DbClient } from '../db'
import { OrderStatus, VisitResult, VisitStatus } from '../generated/prisma/client'
import type { AuthenticatedHonoEnv } from '../http/context'
import { AppError, validationErrorHook } from '../http/errors'
import { requireAuth } from '../auth/middleware'
import {
  assertManager,
  assertOwns,
  assertProductEditAllowed,
  calculateOrderTotals,
  isManagerRole,
  lineTotal,
  nextOrderStatus,
  nextVisitStatus,
} from './rules'

const errorResponseContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const clientPatchSchema = clientPointInputSchema.partial()
const productPatchSchema = productInputSchema.partial()
const productCategoryPatchSchema = productCategoryInputSchema.partial()
const visitPatchSchema = visitInputSchema.partial()
const transitionBodySchema = z.object({
  comment: z.string().max(1000).optional(),
  result: z.enum(['ORDER_CREATED', 'NO_NEED', 'CLIENT_ABSENT', 'CALLBACK_REQUIRED', 'OTHER']).optional(),
  managerComment: z.string().max(1000).optional(),
})

export function createBusinessRoutes(db: DbClient) {
  const routes = new OpenAPIHono<AuthenticatedHonoEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)

  routes.openapi(route('get', '/clients', listClientsResponseSchema), async (c) => {
    const actor = c.var.user
    const search = c.req.query('search')?.trim()
    const clients = await db.clientPoint.findMany({
      where: {
        ...(isManagerRole(actor) ? {} : { assignedRepId: actor.id }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    })
    return c.json({ clients: clients.map(clientDto) }, 200)
  })

  routes.openapi(route('get', '/clients/{id}', clientResponseSchema, undefined, idParamSchema), async (c) => {
    const client = await getClientForActor(db, c.req.param('id')!, c.var.user)
    return c.json({ client: clientDto(client) }, 200)
  })

  routes.openapi(route('post', '/clients', clientResponseSchema, clientPointInputSchema), async (c) => {
    const actor = c.var.user
    const input = clientPointInputSchema.parse(await c.req.json())
    const assignedRepId = isManagerRole(actor) ? input.assignedRepId ?? actor.id : actor.id
    const client = await db.clientPoint.create({
      data: {
        ...(clientInput(input) as any),
        assignedRepId,
      },
    })
    return c.json({ client: clientDto(client) }, 201)
  })

  routes.openapi(route('patch', '/clients/{id}', clientResponseSchema, clientPatchSchema, idParamSchema), async (c) => {
    const actor = c.var.user
    const id = c.req.param('id')!
    const existing = await getClientForActor(db, id, actor)
    const input = clientPatchSchema.parse(await c.req.json())
    const assignedRepId = isManagerRole(actor) ? input.assignedRepId : existing.assignedRepId
    const client = await db.clientPoint.update({
      where: { id },
      data: {
        ...(clientInput(input) as any),
        ...(assignedRepId ? { assignedRepId } : {}),
      },
    })
    return c.json({ client: clientDto(client) }, 200)
  })

  routes.openapi(route('delete', '/clients/{id}', clientResponseSchema, undefined, idParamSchema), async (c) => {
    const actor = c.var.user
    const existing = await getClientForActor(db, c.req.param('id')!, actor)
    if (!isManagerRole(actor)) assertOwns(actor, existing.assignedRepId)
    const client = await db.clientPoint.update({ where: { id: existing.id }, data: { status: 'ARCHIVED' } })
    return c.json({ client: clientDto(client) }, 200)
  })

  routes.openapi(route('get', '/product-categories', listProductCategoriesResponseSchema), async (c) => {
    const categories = await db.productCategory.findMany({ orderBy: { name: 'asc' } })
    return c.json({ categories: categories.map(categoryDto) }, 200)
  })

  routes.openapi(route('post', '/product-categories', productCategoryResponseSchema, productCategoryInputSchema), async (c) => {
    assertManager(c.var.user)
    const category = await db.productCategory.create({ data: productCategoryInputSchema.parse(await c.req.json()) })
    return c.json({ category: categoryDto(category) }, 201)
  })

  routes.openapi(route('patch', '/product-categories/{id}', productCategoryResponseSchema, productCategoryPatchSchema, idParamSchema), async (c) => {
    assertManager(c.var.user)
    const category = await db.productCategory.update({
      where: { id: c.req.param('id')! },
      data: productCategoryPatchSchema.parse(await c.req.json()),
    })
    return c.json({ category: categoryDto(category) }, 200)
  })

  routes.openapi(route('get', '/products', listProductsResponseSchema), async (c) => {
    const actor = c.var.user
    const search = c.req.query('search')?.trim()
    const categoryId = c.req.query('categoryId')
    const products = await db.product.findMany({
      where: {
        ...(isManagerRole(actor) ? {} : { isActive: true }),
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    })
    return c.json({ products: products.map(productDto) }, 200)
  })

  routes.openapi(route('get', '/products/{id}', productResponseSchema, undefined, idParamSchema), async (c) => {
    const product = await db.product.findUnique({ where: { id: c.req.param('id')! }, include: { category: true } })
    if (!product || (!product.isActive && !isManagerRole(c.var.user))) throw new AppError(404, 'NOT_FOUND', 'Product not found')
    return c.json({ product: productDto(product) }, 200)
  })

  routes.openapi(route('post', '/products', productResponseSchema, productInputSchema), async (c) => {
    assertProductEditAllowed(c.var.user)
    const product = await db.product.create({ data: productInput(productInputSchema.parse(await c.req.json())) as any, include: { category: true } })
    return c.json({ product: productDto(product) }, 201)
  })

  routes.openapi(route('patch', '/products/{id}', productResponseSchema, productPatchSchema, idParamSchema), async (c) => {
    assertProductEditAllowed(c.var.user)
    const product = await db.product.update({
      where: { id: c.req.param('id')! },
      data: productInput(productPatchSchema.parse(await c.req.json())) as any,
      include: { category: true },
    })
    return c.json({ product: productDto(product) }, 200)
  })

  routes.openapi(route('delete', '/products/{id}', productResponseSchema, undefined, idParamSchema), async (c) => {
    assertProductEditAllowed(c.var.user)
    const product = await db.product.update({
      where: { id: c.req.param('id')! },
      data: { isActive: false },
      include: { category: true },
    })
    return c.json({ product: productDto(product) }, 200)
  })

  routes.openapi(route('get', '/visits', listVisitsResponseSchema), async (c) => {
    const visits = await listVisits(db, c.var.user)
    return c.json({ visits: visits.map(visitDto) }, 200)
  })

  routes.openapi(route('get', '/visits/today', listVisitsResponseSchema), async (c) => {
    const [gte, lt] = dayRange(new Date())
    const visits = await listVisits(db, c.var.user, { plannedAt: { gte, lt } })
    return c.json({ visits: visits.map(visitDto) }, 200)
  })

  routes.openapi(route('get', '/visits/{id}', visitResponseSchema, undefined, idParamSchema), async (c) => {
    const visit = await getVisitForActor(db, c.req.param('id')!, c.var.user)
    return c.json({ visit: visitDto(visit) }, 200)
  })

  routes.openapi(route('post', '/visits', visitResponseSchema, visitInputSchema), async (c) => {
    const actor = c.var.user
    const input = visitInputSchema.parse(await c.req.json())
    const client = await getClientForActor(db, input.clientPointId, actor)
    const salesRepId = isManagerRole(actor) ? input.salesRepId ?? client.assignedRepId : actor.id
    const visit = await db.visit.create({
      data: {
        clientPointId: input.clientPointId,
        salesRepId,
        plannedAt: new Date(input.plannedAt),
        status: input.status,
        result: input.result,
        comment: input.comment,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      include: { clientPoint: true },
    })
    return c.json({ visit: visitDto(visit) }, 201)
  })

  routes.openapi(route('patch', '/visits/{id}', visitResponseSchema, visitPatchSchema, idParamSchema), async (c) => {
    const existing = await getVisitForActor(db, c.req.param('id')!, c.var.user)
    const input = visitPatchSchema.parse(await c.req.json())
    const visit = await db.visit.update({
      where: { id: existing.id },
      data: {
        ...(input.plannedAt ? { plannedAt: new Date(input.plannedAt) } : {}),
        status: input.status,
        result: input.result,
        comment: input.comment,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      include: { clientPoint: true },
    })
    return c.json({ visit: visitDto(visit) }, 200)
  })

  for (const action of ['start', 'complete', 'skip'] as const) {
    routes.openapi(route('post', `/visits/{id}/${action}`, visitResponseSchema, transitionBodySchema, idParamSchema), async (c) => {
      const existing = await getVisitForActor(db, c.req.param('id')!, c.var.user)
      const body = transitionBodySchema.parse(await c.req.json().catch(() => ({})))
      const status = nextVisitStatus(existing.status, action)
      const visit = await db.visit.update({
        where: { id: existing.id },
        data: {
          status,
          comment: body.comment ?? existing.comment,
          result: body.result ?? (action === 'complete' ? VisitResult.OTHER : existing.result),
          ...(action === 'start' ? { startedAt: new Date() } : {}),
          ...(action === 'complete' ? { completedAt: new Date() } : {}),
        },
        include: { clientPoint: true },
      })
      return c.json({ visit: visitDto(visit) }, 200)
    })
  }

  routes.openapi(route('get', '/orders', listOrdersResponseSchema), async (c) => {
    const orders = await listOrders(db, c.var.user)
    return c.json({ orders: orders.map(orderDto) }, 200)
  })

  routes.openapi(route('get', '/orders/{id}', orderResponseSchema, undefined, idParamSchema), async (c) => {
    const order = await getOrderForActor(db, c.req.param('id')!, c.var.user)
    return c.json({ order: orderDto(order) }, 200)
  })

  routes.openapi(route('post', '/orders', orderResponseSchema, orderInputSchema), async (c) => {
    const actor = c.var.user
    const input = orderInputSchema.parse(await c.req.json())
    const client = await getClientForActor(db, input.clientPointId, actor)
    const salesRepId = isManagerRole(actor) ? client.assignedRepId : actor.id
    const order = await createOrReplaceOrderItems(db, {
      clientPointId: client.id,
      salesRepId,
      visitId: input.visitId,
      comment: input.comment,
      discount: input.discount ?? 0,
      items: input.items,
    })
    return c.json({ order: orderDto(order) }, 201)
  })

  routes.openapi(route('patch', '/orders/{id}', orderResponseSchema, orderPatchSchema, idParamSchema), async (c) => {
    const actor = c.var.user
    const existing = await getOrderForActor(db, c.req.param('id')!, actor)
    if (!isManagerRole(actor) && existing.status !== OrderStatus.DRAFT) {
      throw new AppError(403, 'FORBIDDEN', 'Sales reps can edit only draft orders')
    }
    const input = orderPatchSchema.parse(await c.req.json())
    const order = input.items
      ? await createOrReplaceOrderItems(db, {
          id: existing.id,
          clientPointId: existing.clientPointId,
          salesRepId: existing.salesRepId,
          visitId: existing.visitId ?? undefined,
          comment: input.comment ?? existing.comment ?? undefined,
          managerComment: input.managerComment ?? existing.managerComment ?? undefined,
          discount: input.discount ?? Number(existing.discount),
          items: input.items,
        })
      : await db.order.update({
          where: { id: existing.id },
          data: {
            comment: input.comment,
            managerComment: isManagerRole(actor) ? input.managerComment : undefined,
            discount: input.discount,
          },
          include: orderInclude,
        })
    return c.json({ order: orderDto(order) }, 200)
  })

  for (const action of ['submit', 'approve', 'reject', 'cancel'] as const) {
    routes.openapi(route('post', `/orders/{id}/${action}`, orderResponseSchema, transitionBodySchema, idParamSchema), async (c) => {
      const actor = c.var.user
      const existing = await getOrderForActor(db, c.req.param('id')!, actor)
      if ((action === 'submit' || action === 'cancel') && !isManagerRole(actor)) assertOwns(actor, existing.salesRepId)
      const status = nextOrderStatus(actor, existing.status, action)
      const body = transitionBodySchema.parse(await c.req.json().catch(() => ({})))
      const order = await db.order.update({
        where: { id: existing.id },
        data: { status, managerComment: isManagerRole(actor) ? body.managerComment : existing.managerComment },
        include: orderInclude,
      })
      return c.json({ order: orderDto(order) }, 200)
    })
  }

  routes.openapi(route('get', '/dashboard', dashboardResponseSchema), async (c) => {
    const actor = c.var.user
    const [gte, lt] = dayRange(new Date())
    const own = isManagerRole(actor) ? {} : { salesRepId: actor.id }
    const clientOwn = isManagerRole(actor) ? {} : { assignedRepId: actor.id }
    const [visitsToday, ordersToday, aggregate, clients, activeSalesReps, latestOrders] = await Promise.all([
      db.visit.count({ where: { ...own, plannedAt: { gte, lt } } }),
      db.order.count({ where: { ...own, createdAt: { gte, lt } } }),
      db.order.aggregate({ where: { ...own, createdAt: { gte, lt } }, _sum: { total: true } }),
      db.clientPoint.count({ where: clientOwn }),
      isManagerRole(actor) ? db.user.count({ where: { role: 'SALES_REP' } }) : Promise.resolve(undefined),
      db.order.findMany({ where: own, include: orderInclude, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])
    return c.json({
      dashboard: {
        visitsToday,
        ordersToday,
        ordersTodayTotal: Number(aggregate._sum.total ?? 0),
        clients,
        activeSalesReps,
        latestOrders: latestOrders.map(orderDto),
      },
    }, 200)
  })

  return routes
}

function route(method: 'get' | 'post' | 'patch' | 'delete', path: string, responseSchema: z.ZodType, bodySchema?: z.ZodType, paramSchema?: z.ZodType) {
  return createRoute({
    method,
    path,
    request: {
      ...(paramSchema ? { params: paramSchema } : {}),
      ...(bodySchema
        ? { body: { content: { 'application/json': { schema: bodySchema } } } }
        : {}),
    },
    responses: {
      200: { content: { 'application/json': { schema: responseSchema } }, description: 'OK' },
      201: { content: { 'application/json': { schema: responseSchema } }, description: 'Created' },
      400: { content: errorResponseContent, description: 'Invalid payload' },
      401: { content: errorResponseContent, description: 'Unauthorized' },
      403: { content: errorResponseContent, description: 'Forbidden' },
      404: { content: errorResponseContent, description: 'Not found' },
      409: { content: errorResponseContent, description: 'Conflict' },
    },
  } as any)
}

const orderInclude = {
  clientPoint: true,
  items: { include: { product: { include: { category: true } } } },
} as const

async function getClientForActor(db: DbClient, id: string, actor: { id: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' }) {
  const client = await db.clientPoint.findUnique({ where: { id } })
  if (!client) throw new AppError(404, 'NOT_FOUND', 'Client not found')
  assertOwns(actor, client.assignedRepId)
  return client
}

async function getVisitForActor(db: DbClient, id: string, actor: { id: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' }) {
  const visit = await db.visit.findUnique({ where: { id }, include: { clientPoint: true } })
  if (!visit) throw new AppError(404, 'NOT_FOUND', 'Visit not found')
  assertOwns(actor, visit.salesRepId)
  return visit
}

async function getOrderForActor(db: DbClient, id: string, actor: { id: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' }) {
  const order = await db.order.findUnique({ where: { id }, include: orderInclude })
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found')
  assertOwns(actor, order.salesRepId)
  return order
}

function listVisits(db: DbClient, actor: { id: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' }, extraWhere = {}) {
  return db.visit.findMany({
    where: { ...(isManagerRole(actor) ? {} : { salesRepId: actor.id }), ...extraWhere },
    include: { clientPoint: true },
    orderBy: { plannedAt: 'asc' },
  })
}

function listOrders(db: DbClient, actor: { id: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' }) {
  return db.order.findMany({
    where: isManagerRole(actor) ? {} : { salesRepId: actor.id },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
}

async function createOrReplaceOrderItems(db: DbClient, input: {
  id?: string
  clientPointId: string
  salesRepId: string
  visitId?: string
  comment?: string
  managerComment?: string
  discount: number
  items: Array<{ productId: string; quantity: number; unitPrice?: number; discount?: number }>
}) {
  const products = await db.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) }, isActive: true } })
  const productById = new Map(products.map((product) => [product.id, product]))
  const normalizedItems = input.items.map((item) => {
    const product = productById.get(item.productId)
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found')
    const unitPrice = item.unitPrice ?? Number(product.basePrice)
    return { ...item, unitPrice, discount: item.discount ?? 0, lineTotal: lineTotal({ ...item, unitPrice }) }
  })
  const totals = calculateOrderTotals(normalizedItems, input.discount)

  return db.$transaction(async (tx) => {
    const order = input.id
      ? await tx.order.update({
          where: { id: input.id },
          data: { comment: input.comment, managerComment: input.managerComment, ...totals },
        })
      : await tx.order.create({
          data: {
            orderNumber: `DXB-${Date.now()}`,
            clientPointId: input.clientPointId,
            salesRepId: input.salesRepId,
            visitId: input.visitId,
            comment: input.comment,
            ...totals,
          },
        })
    if (input.id) await tx.orderItem.deleteMany({ where: { orderId: order.id } })
    await tx.orderItem.createMany({
      data: normalizedItems.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
      })),
    })
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude })
  })
}

function clientInput(input: Partial<z.infer<typeof clientPointInputSchema>>) {
  return {
    name: input.name,
    type: input.type,
    contactPerson: input.contactPerson,
    phone: input.phone,
    city: input.city,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    status: input.status,
    comment: input.comment,
    lastVisitAt: input.lastVisitAt ? new Date(input.lastVisitAt) : undefined,
    nextVisitAt: input.nextVisitAt ? new Date(input.nextVisitAt) : undefined,
  }
}

function productInput(input: Partial<z.infer<typeof productInputSchema>>) {
  return {
    name: input.name,
    categoryId: input.categoryId,
    viscosity: input.viscosity,
    volume: input.volume,
    sku: input.sku,
    basePrice: input.basePrice,
    currency: input.currency,
    description: input.description,
    isActive: input.isActive,
    stock: input.stock,
  }
}

function dayRange(date: Date) {
  const gte = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const lt = new Date(gte)
  lt.setDate(lt.getDate() + 1)
  return [gte, lt] as const
}

function date(value: Date | null) {
  return value?.toISOString() ?? null
}

function decimal(value: unknown) {
  return value === null || value === undefined ? null : Number(value)
}

function clientDto(client: any) {
  return {
    ...client,
    latitude: decimal(client.latitude),
    longitude: decimal(client.longitude),
    lastVisitAt: date(client.lastVisitAt),
    nextVisitAt: date(client.nextVisitAt),
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }
}

function categoryDto(category: any) {
  return {
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

function productDto(product: any) {
  return {
    ...product,
    basePrice: Number(product.basePrice),
    stock: product.stock ?? null,
    category: product.category ? categoryDto(product.category) : undefined,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function visitDto(visit: any) {
  return {
    ...visit,
    latitude: decimal(visit.latitude),
    longitude: decimal(visit.longitude),
    clientPoint: visit.clientPoint ? clientDto(visit.clientPoint) : undefined,
    plannedAt: visit.plannedAt.toISOString(),
    startedAt: date(visit.startedAt),
    completedAt: date(visit.completedAt),
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  }
}

function orderDto(order: any) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    clientPoint: order.clientPoint ? clientDto(order.clientPoint) : undefined,
    items: order.items?.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      lineTotal: Number(item.lineTotal),
      product: item.product ? productDto(item.product) : undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}
