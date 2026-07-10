import { createPrisma } from '../src/db'
import { hashPassword } from '../src/auth/passwords'
import { ClientPointStatus, ClientPointType, OrderStatus, UserRole, VisitResult, VisitStatus } from '../src/generated/prisma/client'

const databaseUrl = Bun.env.DATABASE_URL ?? 'postgresql://superuser:superpassword@localhost:54331/rolf_sales_rep_mvp?schema=public'
const db = createPrisma(databaseUrl)

const password = 'DemoPass123!'

const users = [
  { email: 'admin@rolf-demo.local', displayName: 'Dubai Owner', role: UserRole.OWNER },
  { email: 'manager@rolf-demo.local', displayName: 'Dubai Sales Supervisor', role: UserRole.SUPERVISOR },
  { email: 'rep1@rolf-demo.local', displayName: 'Omar Al Farsi', role: UserRole.MANAGER, telegramId: '200001', telegramUsername: 'omar_rolf' },
  { email: 'rep2@rolf-demo.local', displayName: 'Nina Petrova', role: UserRole.MANAGER, telegramId: '200002', telegramUsername: 'nina_rolf' },
  { email: 'rep3@rolf-demo.local', displayName: 'Karim Haddad', role: UserRole.MANAGER, telegramId: '200003', telegramUsername: 'karim_rolf' },
]

const categories = [
  ['engine-oils', 'Engine oils', 'Demo engine oil range for passenger cars and fleets'],
  ['transmission-oils', 'Transmission oils', 'Demo ATF and gear oils'],
  ['antifreeze-coolants', 'Antifreeze and coolants', 'Demo coolant range'],
  ['greases', 'Greases', 'Demo grease products'],
  ['special-fluids', 'Special fluids', 'Demo service fluids'],
] as const

const products = [
  ['ROLF Oils Demo 5W-30 1L', 'engine-oils', '5W-30', '1L', 'DXB-5W30-1L', 38, 120],
  ['ROLF Oils Demo 5W-30 4L', 'engine-oils', '5W-30', '4L', 'DXB-5W30-4L', 128, 88],
  ['ROLF Oils Demo 5W-40 4L', 'engine-oils', '5W-40', '4L', 'DXB-5W40-4L', 136, 76],
  ['ROLF Oils Demo 10W-40 4L', 'engine-oils', '10W-40', '4L', 'DXB-10W40-4L', 104, 95],
  ['ROLF Oils Demo 5W-40 20L', 'engine-oils', '5W-40', '20L', 'DXB-5W40-20L', 590, 20],
  ['ROLF Oils Demo 5W-40 208L', 'engine-oils', '5W-40', '208L', 'DXB-5W40-208L', 4950, 8],
  ['ROLF Oils Demo ATF 1L', 'transmission-oils', 'ATF', '1L', 'DXB-ATF-1L', 39, 130],
  ['ROLF Oils Demo ATF 20L', 'transmission-oils', 'ATF', '20L', 'DXB-ATF-20L', 610, 16],
  ['ROLF Oils Demo Gear 75W-90 1L', 'transmission-oils', '75W-90', '1L', 'DXB-G75W90-1L', 46, 110],
  ['ROLF Oils Demo Gear 80W-90 20L', 'transmission-oils', '80W-90', '20L', 'DXB-G80W90-20L', 520, 14],
  ['ROLF Oils Demo Coolant G12 1L', 'antifreeze-coolants', null, '1L', 'DXB-G12-1L', 24, 150],
  ['ROLF Oils Demo Coolant G12 5L', 'antifreeze-coolants', null, '5L', 'DXB-G12-5L', 82, 90],
  ['ROLF Oils Demo Coolant HD 20L', 'antifreeze-coolants', null, '20L', 'DXB-COOL-HD-20L', 280, 22],
  ['ROLF Oils Demo Lithium Grease 400g', 'greases', null, '400g', 'DXB-GR-LI-400', 18, 200],
  ['ROLF Oils Demo EP Grease 18kg', 'greases', null, '18kg', 'DXB-GR-EP-18', 330, 12],
  ['ROLF Oils Demo Brake Fluid DOT4 0.5L', 'special-fluids', 'DOT4', '0.5L', 'DXB-DOT4-05', 19, 160],
  ['ROLF Oils Demo Brake Fluid DOT4 1L', 'special-fluids', 'DOT4', '1L', 'DXB-DOT4-1L', 31, 130],
  ['ROLF Oils Demo Power Steering 1L', 'special-fluids', null, '1L', 'DXB-PSF-1L', 29, 100],
  ['ROLF Oils Demo Washer Fluid 5L', 'special-fluids', null, '5L', 'DXB-WSH-5L', 21, 180],
  ['ROLF Oils Demo Fleet 15W-40 20L', 'engine-oils', '15W-40', '20L', 'DXB-15W40-20L', 420, 30],
  ['ROLF Oils Demo Fleet 15W-40 208L', 'engine-oils', '15W-40', '208L', 'DXB-15W40-208L', 3850, 6],
  ['ROLF Oils Demo CVT Fluid 1L', 'transmission-oils', 'CVT', '1L', 'DXB-CVT-1L', 48, 90],
] as const

const clientNames = [
  ['Al Quoz Auto Care', ClientPointType.SERVICE_STATION, 'Al Quoz', 'Al Quoz Industrial Area 3'],
  ['Jebel Ali Fleet Parts', ClientPointType.WHOLESALE, 'Dubai', 'JAFZA South'],
  ['Deira Motor Supplies', ClientPointType.AUTO_SHOP, 'Dubai', 'Naif Road, Deira'],
  ['Ras Al Khor Workshop Hub', ClientPointType.SERVICE_STATION, 'Dubai', 'Ras Al Khor Industrial Area'],
  ['Mirdif Auto Retail', ClientPointType.RETAIL, 'Dubai', 'Mirdif City Centre Area'],
  ['Sharjah Industrial Oils', ClientPointType.WHOLESALE, 'Sharjah', 'Industrial Area 4'],
  ['Ajman Quick Service', ClientPointType.SERVICE_STATION, 'Ajman', 'Al Nuaimiya'],
  ['Business Bay Auto Parts', ClientPointType.AUTO_SHOP, 'Dubai', 'Business Bay'],
  ['Dubai Marina Car Care', ClientPointType.SERVICE_STATION, 'Dubai', 'Al Marsa Street'],
  ['Karama Motor Shop', ClientPointType.RETAIL, 'Dubai', 'Al Karama'],
  ['Al Barsha Service Point', ClientPointType.SERVICE_STATION, 'Dubai', 'Al Barsha 1'],
  ['Umm Ramool Fleet Garage', ClientPointType.SERVICE_STATION, 'Dubai', 'Umm Ramool'],
  ['Garhoud Auto Market', ClientPointType.AUTO_SHOP, 'Dubai', 'Al Garhoud'],
  ['DIP Heavy Fleet', ClientPointType.WHOLESALE, 'Dubai', 'Dubai Investments Park'],
  ['Satwa Parts Trading', ClientPointType.AUTO_SHOP, 'Dubai', 'Al Satwa'],
  ['Al Qusais Lube Center', ClientPointType.RETAIL, 'Dubai', 'Al Qusais'],
  ['Jumeirah Premium Garage', ClientPointType.SERVICE_STATION, 'Dubai', 'Jumeirah 3'],
  ['Abu Dhabi Fleet Supply', ClientPointType.WHOLESALE, 'Abu Dhabi', 'Mussafah'],
  ['Silicon Oasis Auto Care', ClientPointType.SERVICE_STATION, 'Dubai', 'Dubai Silicon Oasis'],
  ['Nad Al Hamar Auto Shop', ClientPointType.AUTO_SHOP, 'Dubai', 'Nad Al Hamar'],
] as const

async function main() {
  const passwordHash = await hashPassword(password)
  const savedUsers = new Map<string, { id: string }>()

  for (const user of users) {
    const existingByEmail = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    })
    const existingByTelegramId = user.telegramId
      ? await db.user.findUnique({
          where: { telegramId: user.telegramId },
          select: { id: true },
        })
      : null
    const existing = existingByEmail ?? existingByTelegramId
    const saved = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: { ...user, status: 'ACTIVE', passwordHash },
          select: { id: true },
        })
      : await db.user.create({
          data: { ...user, status: 'ACTIVE', passwordHash },
          select: { id: true },
        })
    savedUsers.set(user.email, saved)
  }

  const supervisor = savedUsers.get('manager@rolf-demo.local')!
  const reps = users.filter((user) => user.role === UserRole.MANAGER).map((user) => savedUsers.get(user.email)!)
  for (const user of users.filter((candidate) => candidate.role === UserRole.MANAGER)) {
    const saved = savedUsers.get(user.email)!
    await db.user.update({ where: { id: saved.id }, data: { supervisorId: supervisor.id } })
    await db.managerProfile.upsert({
      where: { userId: saved.id },
      update: { displayName: user.displayName, timezone: 'Asia/Dubai', workingStatus: 'available', dailyLimit: 25, monthlyLimit: 520 },
      create: { userId: saved.id, displayName: user.displayName, timezone: 'Asia/Dubai', workingStatus: 'available', dailyLimit: 25, monthlyLimit: 520 },
    })
  }

  const savedCategories = new Map<string, { id: string }>()
  for (const [slug, name, description] of categories) {
    const saved = await db.productCategory.upsert({
      where: { slug },
      update: {},
      create: { slug, name, description },
      select: { id: true, slug: true },
    })
    savedCategories.set(saved.slug, saved)
  }

  const savedProducts = []
  for (const [name, categorySlug, viscosity, volume, sku, basePrice, stock] of products) {
    savedProducts.push(await db.product.upsert({
      where: { sku },
      update: {},
      create: {
        name,
        categoryId: savedCategories.get(categorySlug)!.id,
        viscosity,
        volume,
        sku,
        basePrice,
        currency: 'AED',
        stock,
        description: 'Demo nomenclature, replace with the client price list.',
      },
      select: { id: true, sku: true, basePrice: true },
    }))
  }

  const savedClients = []
  for (const [index, client] of clientNames.entries()) {
    const [name, type, city, address] = client
    savedClients.push(await db.clientPoint.upsert({
      where: { id: await stableId('client', index) },
      update: {},
      create: {
        id: await stableId('client', index),
        name,
        type,
        contactPerson: `Contact ${index + 1}`,
        phone: `+97150000${String(index + 1).padStart(4, '0')}`,
        city,
        address,
        assignedRepId: reps[index % reps.length].id,
        status: index % 7 === 0 ? ClientPointStatus.LEAD : ClientPointStatus.ACTIVE,
        comment: 'Dubai demo client point.',
      },
      select: { id: true, assignedRepId: true },
    }))
  }

  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  for (let index = 0; index < 10; index += 1) {
    const client = savedClients[index]
    await db.visit.upsert({
      where: { id: await stableId('visit', index) },
      update: {},
      create: {
        id: await stableId('visit', index),
        clientPointId: client.id,
        salesRepId: client.assignedRepId,
        plannedAt: addHours(index < 6 ? today : tomorrow, 9 + (index % 6)),
        status: index === 1 ? VisitStatus.IN_PROGRESS : index === 2 ? VisitStatus.COMPLETED : VisitStatus.PLANNED,
        startedAt: index === 1 || index === 2 ? addHours(today, 9) : null,
        completedAt: index === 2 ? addHours(today, 10) : null,
        result: index === 2 ? VisitResult.ORDER_CREATED : null,
        comment: 'Seeded Dubai route visit.',
      },
    })
  }

  const orderStatuses = [OrderStatus.DRAFT, OrderStatus.SUBMITTED, OrderStatus.APPROVED, OrderStatus.COMPLETED]
  for (let index = 0; index < 6; index += 1) {
    const client = savedClients[index]
    const firstProduct = savedProducts[index]
    const secondProduct = savedProducts[index + 1]
    const quantity = 2 + index
    const secondQuantity = 1
    const lineOne = Number(firstProduct.basePrice) * quantity
    const lineTwo = Number(secondProduct.basePrice) * secondQuantity
    const discount = index % 2 === 0 ? 25 : 0
    const subtotal = lineOne + lineTwo
    const total = subtotal - discount
    const order = await db.order.upsert({
      where: { orderNumber: `DXB-${String(1001 + index)}` },
      update: {},
      create: {
        orderNumber: `DXB-${String(1001 + index)}`,
        clientPointId: client.id,
        salesRepId: client.assignedRepId,
        status: orderStatuses[index % orderStatuses.length],
        subtotal,
        discount,
        total,
        comment: 'Seeded demo order.',
      },
    })
    await db.orderItem.upsert({
      where: { id: await stableId('order-item-a', index) },
      update: {},
      create: {
          id: await stableId('order-item-a', index),
          orderId: order.id,
          productId: firstProduct.id,
          quantity,
          unitPrice: firstProduct.basePrice,
          discount: 0,
          lineTotal: lineOne,
      },
    })
    await db.orderItem.upsert({
      where: { id: await stableId('order-item-b', index) },
      update: {},
      create: {
          id: await stableId('order-item-b', index),
          orderId: order.id,
          productId: secondProduct.id,
          quantity: secondQuantity,
          unitPrice: secondProduct.basePrice,
          discount,
          lineTotal: lineTwo - discount,
      },
    })
  }

  await seedAdminManagementData(reps)

  console.log('Seed data is ready.')
}

async function seedAdminManagementData(reps: Array<{ id: string }>) {
  const today = startOfDay(new Date())
  for (const [index, rep] of reps.entries()) {
    await db.managerDailyMetric.upsert({
      where: { managerId_date: { managerId: rep.id, date: today } },
      update: {
        leadsNew: 8 + index,
        leadsTaken: 6 + index,
        dealsSuccess: 3 + index,
        dealsCancelled: index,
        totalAmount: 4200 + index * 1700,
        avgResponseSeconds: 90 + index * 35,
        messagesCount: 70 + index * 18,
        conversionRate: 32 + index * 6,
      },
      create: {
        managerId: rep.id,
        date: today,
        leadsNew: 8 + index,
        leadsTaken: 6 + index,
        dealsSuccess: 3 + index,
        dealsCancelled: index,
        totalAmount: 4200 + index * 1700,
        avgResponseSeconds: 90 + index * 35,
        messagesCount: 70 + index * 18,
        conversionRate: 32 + index * 6,
      },
    })
  }

  const functionSeeds = [
    ['lead_auto_assign', 'Lead auto assignment', 'Distribute new Telegram leads between active managers.', { mode: 'round_robin' }],
    ['daily_limits', 'Manager daily limits', 'Caps the amount of new leads a manager can receive per day.', { defaultLimit: 25 }],
    ['admin_notifications', 'Admin notifications', 'Notify owners when manager status or scripts change.', { enabled: true }],
  ] as const
  for (const [key, title, description, valueJson] of functionSeeds) {
    await db.functionSetting.upsert({
      where: { key },
      update: { title, description, valueJson, enabled: true },
      create: { key, title, description, valueJson, enabled: true },
    })
  }

  const scriptSeeds = [
    ['First contact', 'Hello! I am checking your current motor oil stock and delivery schedule.', 'opening'],
    ['Follow-up', 'I can reserve today pricing and confirm delivery options for this week.', 'follow_up'],
  ] as const
  for (const [index, [title, body, category]] of scriptSeeds.entries()) {
    await db.salesScript.upsert({
      where: { id: await stableId('sales-script', index) },
      update: { title, body, category, enabled: true },
      create: { id: await stableId('sales-script', index), title, body, category, enabled: true },
    })
  }

  for (const [index, rep] of reps.entries()) {
    await db.deal.upsert({
      where: { id: await stableId('deal', index) },
      update: {},
      create: {
        id: await stableId('deal', index),
        title: `Fleet lead ${index + 1}`,
        clientName: ['Palm Fleet Service', 'Emirates Workshop Group', 'Desert Logistics'][index] ?? `Client ${index + 1}`,
        source: 'telegram',
        status: index === 0 ? 'SUCCESS' : index === 1 ? 'IN_PROGRESS' : 'NEW',
        amount: 2500 + index * 1800,
        assignedManagerId: rep.id,
        createdBy: rep.id,
        closedAt: index === 0 ? new Date() : null,
      },
    })
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addHours(date: Date, hours: number) {
  const next = new Date(date)
  next.setHours(hours, 0, 0, 0)
  return next
}

async function stableId(prefix: string, index: number) {
  const { createHash } = await import('node:crypto')
  const hex = createHash('sha256').update(`${prefix}-${index}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

await main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
