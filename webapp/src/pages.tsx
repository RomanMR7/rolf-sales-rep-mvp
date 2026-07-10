import { Link, Outlet } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

const navLinkClass = cn(
  buttonVariants({ variant: 'ghost', size: 'sm' }),
  'text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground data-[status=active]:hover:bg-secondary/80'
)

type View = 'today' | 'leads' | 'managers' | 'metrics' | 'settings' | 'functions' | 'scripts' | 'clients' | 'catalog' | 'orders' | 'visits' | 'admin'

export function RootLayout() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/92 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <Typography as="span" variant="avatar" tone="inverse" className="grid size-10 place-items-center rounded-md bg-primary">
              RS
            </Typography>
            <span className="grid gap-0.5">
              <Typography as="span" variant="h6">ROLF Sales App</Typography>
              <Typography as="span" variant="bodyXs" tone="muted" className="block uppercase">Dubai MVP</Typography>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1" aria-label="Primary">
            <Typography asChild variant="control" tone="muted">
              <Link to="/" className={navLinkClass}>Mini App</Link>
            </Typography>
            <Typography asChild variant="control" tone="muted">
              <Link to="/app" className={navLinkClass}>Workspace</Link>
            </Typography>
          </nav>
        </div>
      </header>
      <Outlet />
    </main>
  )
}

export function HomePage() {
  return <Workspace />
}

export function AppPage() {
  return <Workspace />
}

function Workspace() {
  const auth = useAuth()
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname))
  const [selectedClientId, setSelectedClientId] = useState<string>('')

  if (auth.isBootstrapping) return <LoadingState />
  if (!auth.user) return <TelegramAuthScreen />

  const canAdmin = auth.user.role === 'OWNER' || auth.user.role === 'ADMIN'
  const canManageTeam = canAdmin || auth.user.role === 'SUPERVISOR'
  const canManage = canAdmin || auth.user.role === 'SUPERVISOR'
  const views: Array<[View, string]> = [
    ['today', 'Dashboard'],
    ['leads', 'Leads'],
    ...(canManageTeam ? [['managers', 'Managers'] as [View, string], ['metrics', 'Metrics'] as [View, string]] : []),
    ['settings', 'Settings'],
  ]

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 pb-24 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="border-amber-400/60 bg-amber-50 text-amber-900">
          {auth.user.role}
        </Badge>
        <Typography variant="h2">
          {auth.user.displayName ?? auth.user.email}
        </Typography>
        <Typography variant="bodySm" tone="muted">
          Вы вошли как {roleLabel(auth.user.role)}
        </Typography>
        <Button className="ml-auto" variant="outline" onClick={() => void auth.logout()}>
          Logout
        </Button>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 py-2 backdrop-blur sm:hidden">
        <nav className="mx-auto grid max-w-md grid-cols-5 gap-1" aria-label="Mini App">
          {views.slice(0, 5).map(([key, label]) => (
            <Button key={key} size="sm" variant={view === key ? 'default' : 'ghost'} className="h-11 px-1" onClick={() => setView(key)}>
              <Typography as="span" variant="controlXs">{label}</Typography>
            </Button>
          ))}
        </nav>
      </div>
      <div className="hidden gap-2 overflow-x-auto pb-1 sm:flex">
        {views.map(([key, label]) => (
          <Button key={key} variant={view === key ? 'default' : 'outline'} onClick={() => setView(key)}>
            {label}
          </Button>
        ))}
        {canAdmin && (
          <>
            <Button variant={view === 'functions' ? 'default' : 'outline'} onClick={() => setView('functions')}>Functions</Button>
            <Button variant={view === 'scripts' ? 'default' : 'outline'} onClick={() => setView('scripts')}>Scripts</Button>
          </>
        )}
      </div>
      {view === 'today' && <Dashboard />}
      {view === 'leads' && <Leads canManage={auth.user.role !== 'VIEWER'} />}
      {view === 'managers' && canManageTeam && <Managers />}
      {view === 'metrics' && canManageTeam && <Metrics />}
      {view === 'settings' && <Settings />}
      {view === 'functions' && canAdmin && <Functions />}
      {view === 'scripts' && canAdmin && <Scripts />}
      {view === 'clients' && <Clients onCreateOrder={(clientId) => { setSelectedClientId(clientId); setView('orders') }} />}
      {view === 'catalog' && <Catalog canManage={canManage} />}
      {view === 'orders' && <Orders canManage={canManage} selectedClientId={selectedClientId} onSelectedClientIdChange={setSelectedClientId} />}
      {view === 'visits' && <Visits />}
      {view === 'admin' && canAdmin && <Admin />}
    </section>
  )
}

function Dashboard() {
  const auth = useAuth()
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => auth.api.dashboard() })
  const visits = useQuery({ queryKey: ['visits', 'today'], queryFn: () => auth.api.visits(true) })
  const data = dashboard.data?.dashboard
  if (!data) return <LoadingCard title="Dashboard" />

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-2">
          <Typography variant="h6">{'MVP для демонстрации процесса: визит -> заказ -> согласование менеджером'}</Typography>
          <Typography variant="bodySm" tone="muted">
            Данные ограничиваются ролью пользователя: торговый представитель видит свой маршрут, менеджер и администратор видят всю команду.
          </Typography>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Визиты сегодня" value={data.visitsToday} />
        <Metric label="Заказы сегодня" value={data.ordersToday} />
        <Metric label="Сумма заказов" value={`AED ${data.ordersTodayTotal.toLocaleString()}`} />
        <Metric label="Клиенты" value={data.clients} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Последние заказы</CardTitle>
          <CardDescription>Рабочая лента для менеджера и представителя.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.latestOrders.map((order) => (
            <Row key={order.id} title={`${order.orderNumber} · ${order.status}`} detail={`${order.clientPoint?.name ?? 'Client'} · AED ${order.total}`} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ближайшие визиты</CardTitle>
          <CardDescription>Плановые точки на сегодня.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {visits.data?.visits.slice(0, 5).map((visit) => (
            <Row key={visit.id} title={`${visit.clientPoint?.name ?? 'Client'} · ${visit.status}`} detail={new Date(visit.plannedAt).toLocaleString()} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Clients({ onCreateOrder }: { onCreateOrder: (clientId: string) => void }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const clients = useQuery({ queryKey: ['clients', search], queryFn: () => auth.api.clients(search) })
  const createVisit = useMutation({
    mutationFn: (clientPointId: string) => auth.api.createVisit({ clientPointId, plannedAt: new Date().toISOString() }),
    onSuccess: () => {
      setMessage('Визит создан. Откройте вкладку "Визиты", чтобы начать его.')
      return queryClient.invalidateQueries({ queryKey: ['visits'] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Клиенты</CardTitle>
        <CardDescription>Sales rep видит только свои торговые точки.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <input className="h-10 rounded-md border bg-background px-3" placeholder="Поиск по названию, городу, адресу" value={search} onChange={(event) => setSearch(event.target.value)} />
        {message && <Typography variant="bodySm" className="text-emerald-700">{message}</Typography>}
        {createVisit.error && <ErrorText error={createVisit.error} />}
        <div className="grid gap-3 lg:grid-cols-2">
          {clients.data?.clients.map((client) => (
            <div key={client.id} className="grid gap-3 rounded-md border p-4">
              <Row title={client.name} detail={`${client.type} · ${client.city} · ${client.phone ?? 'no phone'} · ${client.status}`} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => createVisit.mutate(client.id)}>
                  Создать визит
                </Button>
                <Button size="sm" variant="outline" onClick={() => onCreateOrder(client.id)}>
                  Создать заказ
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Catalog({ canManage }: { canManage: boolean }) {
  const auth = useAuth()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const products = useQuery({ queryKey: ['products', search, categoryId], queryFn: () => auth.api.products(search, categoryId || undefined) })
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: () => auth.api.productCategories() })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Каталог</CardTitle>
        <CardDescription>Демо-номенклатура, заменить на реальный прайс клиента.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <input className="h-10 min-w-64 rounded-md border bg-background px-3" placeholder="Поиск по SKU или названию" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="h-10 rounded-md border bg-background px-3" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Все категории</option>
            {categories.data?.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {canManage && <Button variant="outline">Добавить товар</Button>}
        </div>
        <Typography variant="bodySm" tone="muted">
          Категорий: {categories.data?.categories.length ?? 0}
        </Typography>
        <div className="grid gap-3 lg:grid-cols-2">
          {products.data?.products.map((product) => (
            <Row key={product.id} title={product.name} detail={`${product.category?.name ?? 'Category'} · ${product.isActive ? 'active' : 'inactive'} · ${product.viscosity ?? 'n/a'} · ${product.volume} · ${product.sku} · AED ${product.basePrice}`} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Orders({
  canManage,
  selectedClientId,
  onSelectedClientIdChange,
}: {
  canManage: boolean
  selectedClientId: string
  onSelectedClientIdChange: (clientId: string) => void
}) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1, discount: 0 }])
  const [orderDiscount, setOrderDiscount] = useState(0)
  const [comment, setComment] = useState('')
  const [managerComments, setManagerComments] = useState<Record<string, string>>({})
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => auth.api.orders() })
  const clients = useQuery({ queryKey: ['clients', ''], queryFn: () => auth.api.clients() })
  const products = useQuery({ queryKey: ['products', ''], queryFn: () => auth.api.products() })
  const productsById = new Map((products.data?.products ?? []).map((product) => [product.id, product]))
  const totals = calculateDraftTotals(orderItems, productsById, orderDiscount)
  const createOrder = useMutation({
    mutationFn: async () => {
      const clientId = selectedClientId || clients.data?.clients[0]?.id
      if (!clientId) throw new Error('Выберите клиента')
      const items = orderItems
        .filter((item) => item.productId && item.quantity > 0)
        .slice(0, 3)
        .map((item) => ({ productId: item.productId, quantity: item.quantity, discount: item.discount }))
      if (items.length === 0) throw new Error('Добавьте хотя бы один товар')
      return auth.api.createOrder({
        clientPointId: clientId,
        comment: comment || 'Demo order from Mini App',
        discount: orderDiscount,
        items,
      })
    },
    onSuccess: async () => {
      setComment('')
      setOrderDiscount(0)
      setOrderItems([{ productId: '', quantity: 1, discount: 0 }])
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'approve' | 'reject' }) =>
      auth.api.orderAction(id, action, { managerComment: managerComments[id] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const visibleOrders = (orders.data?.orders ?? []).filter((order) => !statusFilter || order.status === statusFilter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Заказы</CardTitle>
        <CardDescription>Создание черновика, отправка менеджеру, approve/reject.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 rounded-md border bg-background p-4">
          <Typography variant="h6">Создать заказ</Typography>
          <select className="h-10 rounded-md border bg-background px-3" value={selectedClientId} onChange={(event) => onSelectedClientIdChange(event.target.value)}>
            <option value="">Выберите клиента</option>
            {clients.data?.clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <div className="grid gap-2">
            {orderItems.map((item, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_100px_120px_auto]">
                <select className="h-10 rounded-md border bg-background px-3" value={item.productId} onChange={(event) => updateOrderItem(index, { productId: event.target.value }, setOrderItems)}>
                  <option value="">Товар</option>
                  {products.data?.products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name} · AED {product.basePrice}</option>
                  ))}
                </select>
                <input className="h-10 rounded-md border bg-background px-3" type="number" min="1" value={item.quantity} onChange={(event) => updateOrderItem(index, { quantity: Number(event.target.value) }, setOrderItems)} />
                <input className="h-10 rounded-md border bg-background px-3" type="number" min="0" value={item.discount} onChange={(event) => updateOrderItem(index, { discount: Number(event.target.value) }, setOrderItems)} />
                <Button variant="outline" disabled={orderItems.length === 1} onClick={() => setOrderItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Убрать</Button>
              </div>
            ))}
            <Button className="w-fit" variant="outline" disabled={orderItems.length >= 3} onClick={() => setOrderItems((items) => [...items, { productId: '', quantity: 1, discount: 0 }])}>
              Добавить товар
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_160px]">
            <input className="h-10 rounded-md border bg-background px-3" placeholder="Комментарий" value={comment} onChange={(event) => setComment(event.target.value)} />
            <input className="h-10 rounded-md border bg-background px-3" type="number" min="0" placeholder="Скидка заказа" value={orderDiscount} onChange={(event) => setOrderDiscount(Number(event.target.value))} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Typography as="span" variant="bodySm">Subtotal: AED {totals.subtotal}</Typography>
            <Typography as="span" variant="bodySm">Discount: AED {totals.discount}</Typography>
            <Typography as="strong" variant="emphasis">Total: AED {totals.total}</Typography>
          </div>
          {createOrder.error && <ErrorText error={createOrder.error} />}
          <Button className="w-fit" onClick={() => createOrder.mutate()} disabled={createOrder.isPending}>
            Сохранить DRAFT
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-10 rounded-md border bg-background px-3" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Все статусы</option>
            {['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'IN_DELIVERY', 'COMPLETED', 'CANCELLED'].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        {action.error && <ErrorText error={action.error} />}
        <div className="grid gap-3">
          {visibleOrders.map((order) => (
            <div key={order.id} className="grid gap-3 rounded-md border p-4">
              <Row title={`${order.orderNumber} · ${order.status}`} detail={`${order.clientPoint?.name ?? 'Client'} · AED ${order.total}`} />
              <Typography variant="bodySm" tone="muted">
                Items: {order.items?.map((item) => `${item.product?.sku ?? 'SKU'} x${item.quantity}`).join(', ') || 'no items'}
              </Typography>
              <div className="flex flex-wrap gap-2">
                {order.status === 'DRAFT' && <Button size="sm" onClick={() => action.mutate({ id: order.id, action: 'submit' })}>Отправить</Button>}
                {canManage && order.status === 'SUBMITTED' && (
                  <>
                    <input className="h-9 rounded-md border bg-background px-3" placeholder="Manager comment" value={managerComments[order.id] ?? ''} onChange={(event) => setManagerComments((comments) => ({ ...comments, [order.id]: event.target.value }))} />
                    <Button size="sm" onClick={() => action.mutate({ id: order.id, action: 'approve' })}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: order.id, action: 'reject' })}>Reject</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Visits() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const visits = useQuery({ queryKey: ['visits'], queryFn: () => auth.api.visits() })
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'complete' | 'skip' }) => auth.api.visitAction(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Визиты</CardTitle>
        <CardDescription>План, старт, завершение и пропуск визита.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {visits.data?.visits.map((visit) => (
          <div key={visit.id} className="grid gap-3 rounded-md border p-4">
            <Row title={`${visit.clientPoint?.name ?? 'Client'} · ${visit.status}`} detail={new Date(visit.plannedAt).toLocaleString()} />
            <div className="flex flex-wrap gap-2">
              {visit.status === 'PLANNED' && <Button size="sm" onClick={() => action.mutate({ id: visit.id, action: 'start' })}>Начать</Button>}
              {visit.status === 'IN_PROGRESS' && <Button size="sm" onClick={() => action.mutate({ id: visit.id, action: 'complete' })}>Завершить</Button>}
              {visit.status !== 'COMPLETED' && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: visit.id, action: 'skip' })}>Пропустить</Button>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Leads({ canManage }: { canManage: boolean }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const leads = useQuery({ queryKey: ['leads'], queryFn: () => auth.api.leads() })
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const createLead = useMutation({
    mutationFn: () => auth.api.createLead({ title, clientName, source: 'telegram', amount: 0 }),
    onSuccess: async () => {
      setTitle('')
      setClientName('')
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>Role-scoped deal pipeline from Telegram and sales activity.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canManage && (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input className="h-10 rounded-md border bg-background px-3" placeholder="Lead title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <input className="h-10 rounded-md border bg-background px-3" placeholder="Client name" value={clientName} onChange={(event) => setClientName(event.target.value)} />
            <Button disabled={!title || !clientName || createLead.isPending} onClick={() => createLead.mutate()}>Add</Button>
          </div>
        )}
        {createLead.error && <ErrorText error={createLead.error} />}
        <div className="grid gap-3">
          {leads.isLoading && <LoadingCard title="leads" />}
          {leads.data?.leads.length === 0 && <EmptyState title="No leads yet" />}
          {leads.data?.leads.map((lead) => (
            <Row key={lead.id} title={`${lead.title} · ${lead.status}`} detail={`${lead.clientName} · ${lead.assignedManager?.displayName ?? 'Unassigned'} · AED ${lead.amount}`} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Managers() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const managers = useQuery({ queryKey: ['admin', 'managers'], queryFn: () => auth.api.adminManagers() })
  const [displayName, setDisplayName] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const createManager = useMutation({
    mutationFn: () => auth.api.createAdminUser({ displayName, telegramId: telegramId || undefined, role: 'MANAGER', status: 'INVITED', profile: { displayName } }),
    onSuccess: async () => {
      setDisplayName('')
      setTelegramId('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'managers'] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Managers</CardTitle>
        <CardDescription>Create, invite, and supervise managers.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {(auth.user?.role === 'OWNER' || auth.user?.role === 'ADMIN') && (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_160px_auto]">
            <input className="h-10 rounded-md border bg-background px-3" placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <input className="h-10 rounded-md border bg-background px-3" placeholder="Telegram ID" value={telegramId} onChange={(event) => setTelegramId(event.target.value)} />
            <Button disabled={!displayName || createManager.isPending} onClick={() => createManager.mutate()}>Invite</Button>
          </div>
        )}
        {createManager.error && <ErrorText error={createManager.error} />}
        <div className="grid gap-3 md:grid-cols-2">
          {managers.data?.managers.map((manager) => (
            <ManagerRow key={manager.id} manager={manager} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

type ManagerSummary = {
  id: string
  email: string
  displayName?: string | null
  role: string
  status: string
  managerProfile?: {
    workingStatus?: string | null
  } | null
}

function ManagerRow({ manager }: { manager: ManagerSummary }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const status = useMutation({
    mutationFn: (nextStatus: string) => auth.api.updateAdminUserStatus(manager.id, nextStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'managers'] }),
  })
  return (
    <div className="grid gap-3 rounded-md border p-4">
      <Row title={`${manager.displayName ?? manager.email} · ${manager.role}`} detail={`${manager.status} · ${manager.managerProfile?.workingStatus ?? 'profile pending'}`} />
      {(auth.user?.role === 'OWNER' || auth.user?.role === 'ADMIN') && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => status.mutate('ACTIVE')}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => status.mutate('DISABLED')}>Disable</Button>
        </div>
      )}
    </div>
  )
}

function Metrics() {
  const auth = useAuth()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    return query.size ? `?${query.toString()}` : ''
  }, [from, to])
  const overview = useQuery({ queryKey: ['admin', 'metrics', params], queryFn: () => auth.api.adminMetricsOverview(params) })
  const managers = useQuery({ queryKey: ['admin', 'metrics', 'managers', params], queryFn: () => auth.api.adminMetricsManagers(params) })
  const data = overview.data?.metrics

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap gap-2">
          <input className="h-10 rounded-md border bg-background px-3" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="h-10 rounded-md border bg-background px-3" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total managers" value={data?.totalManagers ?? 0} />
        <Metric label="Active managers" value={data?.activeManagers ?? 0} />
        <Metric label="Leads today" value={data?.leadsToday ?? 0} />
        <Metric label="Success deals" value={data?.successfulDealsToday ?? 0} />
        <Metric label="Cancelled" value={data?.cancelledDealsToday ?? 0} />
        <Metric label="Amount" value={`AED ${(data?.totalAmountToday ?? 0).toLocaleString()}`} />
        <Metric label="Conversion" value={`${data?.conversionRate ?? 0}%`} />
        <Metric label="Avg response" value={`${data?.averageResponseSeconds ?? 0}s`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Manager performance for the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {managers.data?.managers.map((row) => (
            <Row key={row.manager?.id ?? row.managerId} title={`${row.manager?.displayName ?? 'Manager'} · AED ${row.totalAmount}`} detail={`${row.dealsSuccess} success · ${row.dealsCancelled} cancelled · ${row.conversionRate}%`} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Functions() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const functions = useQuery({ queryKey: ['admin', 'functions'], queryFn: () => auth.api.adminFunctions() })
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => auth.api.updateAdminFunction(key, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'functions'] }),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Functions</CardTitle>
        <CardDescription>Editable operational toggles and JSON-backed settings.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {functions.data?.functions.map((setting) => (
          <div key={setting.key} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
            <Row title={setting.title} detail={`${setting.key} · ${setting.description ?? 'No description'}`} />
            <Button className="ml-auto" variant="outline" onClick={() => toggle.mutate({ key: setting.key, enabled: !setting.enabled })}>
              {setting.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Scripts() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const scripts = useQuery({ queryKey: ['admin', 'scripts'], queryFn: () => auth.api.adminScripts() })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const createScript = useMutation({
    mutationFn: () => auth.api.createAdminScript({ title, body, category: 'custom', enabled: true }),
    onSuccess: async () => {
      setTitle('')
      setBody('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scripts'] })
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Scripts</CardTitle>
        <CardDescription>Templates managers can use in Telegram lead conversations.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 rounded-md border p-3">
          <input className="h-10 rounded-md border bg-background px-3" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea className="min-h-24 rounded-md border bg-background px-3 py-2" placeholder="Script body" value={body} onChange={(event) => setBody(event.target.value)} />
          <Button className="w-fit" disabled={!title || !body || createScript.isPending} onClick={() => createScript.mutate()}>Save script</Button>
        </div>
        <div className="grid gap-3">
          {scripts.data?.scripts.map((script) => (
            <Row key={script.id} title={`${script.title} · ${script.enabled ? 'enabled' : 'disabled'}`} detail={script.body} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Settings() {
  const auth = useAuth()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>User and Mini App runtime details.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <StatusRow label="Role" value={auth.user?.role ?? 'unknown'} />
        <StatusRow label="Status" value={auth.user?.status ?? 'unknown'} />
        <StatusRow label="Telegram ID" value={auth.user?.telegramId ?? 'not linked'} />
      </CardContent>
    </Card>
  )
}

function Admin() {
  const auth = useAuth()
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => auth.api.dashboard() })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Админка</CardTitle>
        <CardDescription>Базовый manager/admin обзор.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Metric label="Активные торговые представители" value={dashboard.data?.dashboard.activeSalesReps ?? 0} />
        <Typography tone="muted">CRUD пользователей оставлен на следующий этап, каталог и клиенты уже доступны по роли.</Typography>
      </CardContent>
    </Card>
  )
}

function TelegramAuthScreen() {
  const auth = useAuth()
  const [telegramWebApp, setTelegramWebApp] = useState<TelegramWebApp | null>(null)
  const [email, setEmail] = useState('rep1@rolf-demo.local')
  const [password, setPassword] = useState('DemoPass123!')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const telegramUser = telegramWebApp?.initDataUnsafe?.user
  const initData = telegramWebApp?.initData ?? ''
  const isDev = import.meta.env.DEV

  useEffect(() => {
    if (!document.querySelector('script[data-telegram-webapp-sdk]')) {
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-web-app.js'
      script.async = true
      script.dataset.telegramWebappSdk = 'true'
      document.head.appendChild(script)
    }
    const webApp = window.Telegram?.WebApp ?? null
    webApp?.ready()
    webApp?.expand?.()
    setTelegramWebApp(webApp)
  }, [])

  const displayUser = useMemo(() => {
    if (!telegramUser) return null
    return [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || telegramUser.username || String(telegramUser.id ?? '')
  }, [telegramUser])

  async function submit(action: () => Promise<void>) {
    setError(null)
    setIsSubmitting(true)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <Badge variant="outline" className="w-fit border-amber-400/60 bg-amber-50 text-amber-900">Telegram Mini App</Badge>
          <CardTitle>ROLF Sales App</CardTitle>
          <CardDescription>Secure sign-in for the Dubai sales representative MVP.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <StatusRow label="Telegram WebApp" value={telegramWebApp ? 'detected' : 'not detected'} />
          <StatusRow label="initData" value={initData ? 'present' : 'missing'} />
          <StatusRow label="Telegram user" value={displayUser ?? 'not available'} />
          <Separator />
          <div className="flex flex-wrap gap-3">
            <Button disabled={!initData || isSubmitting} onClick={() => void submit(() => auth.telegramAuth({ initData }))}>
              Войти через Telegram
            </Button>
            {isDev && (
              <Button variant="outline" disabled={isSubmitting} onClick={() => void submit(() => auth.telegramAuth({ devUser: { telegramId: '100001', username: 'demo_sales_rep', firstName: 'Demo', lastName: 'Rep' } }))}>
                Dev login
              </Button>
            )}
          </div>
          {!telegramWebApp && (
            <Typography variant="bodySm" tone="muted">
              Open this URL from the configured Telegram bot menu or direct Mini App link. Browser mode does not grant admin access.
            </Typography>
          )}
          {isDev && (
            <>
              <Separator />
              <div className="grid gap-3">
                <Typography variant="h6">Local dev login</Typography>
                <input
                  aria-label="Demo email"
                  className="h-10 rounded-md border bg-background px-3"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <input
                  aria-label="Demo password"
                  className="h-10 rounded-md border bg-background px-3"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button className="w-fit" disabled={isSubmitting} onClick={() => void submit(() => auth.login({ email, password }))}>
                  Войти как local dev user
                </Button>
              </div>
            </>
          )}
          {error && <Typography variant="bodySm" className="text-destructive">{error}</Typography>}
        </CardContent>
      </Card>
      {isDev && (
        <Card>
          <CardHeader>
            <CardTitle>Local users</CardTitle>
            <CardDescription>Visible only in Vite development mode.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {['rep1@rolf-demo.local', 'manager@rolf-demo.local', 'admin@rolf-demo.local'].map((demoEmail) => (
              <Button key={demoEmail} variant="outline" onClick={() => setEmail(demoEmail)}>
                {demoEmail}
              </Button>
            ))}
            <Typography variant="bodySm" tone="muted">Password: DemoPass123!</Typography>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function LoadingState() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Card className="w-fit">
        <CardContent className="flex items-center gap-3">
          <Spinner />
          <Typography variant="bodySm" tone="muted">Checking session...</Typography>
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function Row({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-background p-3">
      <Typography variant="emphasis" wrap="break">{title}</Typography>
      <Typography variant="bodySm" tone="muted" wrap="break">{detail}</Typography>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-background p-3">
      <Typography variant="bodySm" tone="muted">{label}</Typography>
      <Typography variant="emphasis" wrap="break">{value}</Typography>
    </div>
  )
}

function LoadingCard({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <Spinner />
        <Typography variant="bodySm" tone="muted">Loading {title}...</Typography>
      </CardContent>
    </Card>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-dashed p-4">
      <Typography variant="bodySm" tone="muted">{title}</Typography>
    </div>
  )
}

function ErrorText({ error }: { error: unknown }) {
  return (
    <Typography variant="bodySm" className="text-destructive">
      {error instanceof Error ? error.message : 'Action failed'}
    </Typography>
  )
}

function roleLabel(role: string) {
  if (role === 'OWNER') return 'Владелец'
  if (role === 'ADMIN') return 'Администратор'
  if (role === 'SUPERVISOR') return 'Супервизор'
  if (role === 'MANAGER') return 'Менеджер'
  return 'Наблюдатель'
}

function viewFromPath(path: string): View {
  if (path.includes('/admin/managers')) return 'managers'
  if (path.includes('/admin/functions')) return 'functions'
  if (path.includes('/admin/scripts')) return 'scripts'
  if (path.includes('/admin/metrics')) return 'metrics'
  if (path.includes('/admin')) return 'admin'
  if (path.includes('/leads')) return 'leads'
  if (path.includes('/settings')) return 'settings'
  return 'today'
}

function updateOrderItem(
  index: number,
  patch: Partial<{ productId: string; quantity: number; discount: number }>,
  setOrderItems: (updater: (items: Array<{ productId: string; quantity: number; discount: number }>) => Array<{ productId: string; quantity: number; discount: number }>) => void,
) {
  setOrderItems((items) =>
    items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
  )
}

function calculateDraftTotals(
  items: Array<{ productId: string; quantity: number; discount: number }>,
  productsById: Map<string, { basePrice: number }>,
  orderDiscount: number,
) {
  const subtotal = items.reduce((sum, item) => {
    const product = productsById.get(item.productId)
    return sum + (product?.basePrice ?? 0) * item.quantity
  }, 0)
  const itemDiscount = items.reduce((sum, item) => sum + item.discount, 0)
  const discount = itemDiscount + orderDiscount
  return {
    subtotal: roundMoney(subtotal),
    discount: roundMoney(discount),
    total: roundMoney(Math.max(0, subtotal - discount)),
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
