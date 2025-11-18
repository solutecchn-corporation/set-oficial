import React, { useEffect, useState } from 'react'

const menuItems: any[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'datos', label: 'Datos de mi empresa' },
  {
    id: 'usuarios',
    label: 'Usuarios / Cajeros',
    children: [
      { id: 'usuarios_internal', label: 'Usuarios internos (users)' },
      { id: 'usuarios_web', label: 'Usuarios web (usuarios_web)' }
    ]
  },
  {
    id: 'factura',
    label: 'Factura y CAI',
    children: [
      { id: 'cai', label: 'CAI (cai)' },
      { id: 'facturas', label: 'Facturas (ventas)' },
      { id: 'historial_facturas', label: 'Historial de facturas' }
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    children: [
      { id: 'inventario_productos', label: 'Productos (Inventario)' },
      { id: 'inventario_salidas', label: 'Entradas/Salidas (salidas_inventario)' },
      { id: 'inventario_categorias', label: 'Categorías / Marcas (opcional)' }
    ]
  },
  {
    id: 'compras',
    label: 'Compras y Proveedores',
    children: [
      { id: 'compras_main', label: 'Compras (compras)' },
      { id: 'compras_detalle', label: 'Detalle de compras (compras_detalle)' },
      { id: 'proveedores', label: 'Proveedores (proveedores)' }
    ]
  },
  {
    id: 'cierres',
    label: 'Cierres de caja',
    children: [
      { id: 'caja_sesiones', label: 'Sesiones de caja (caja_sesiones)' },
      { id: 'caja_movimientos', label: 'Movimientos de caja (caja_movimientos)' }
    ]
  },
  {
    id: 'pedidos',
    label: 'Pedidos web / Ecommerce',
    children: [
      { id: 'pedidos_web', label: 'Pedidos web (pedidos_web)' },
      { id: 'pedidos_detalle', label: 'Detalle de pedidos (pedidos_web_detalle)' },
      { id: 'pagos_web', label: 'Pagos web (pagos_web)' }
    ]
  },
  {
    id: 'cotizaciones',
    label: 'Cotizaciones',
    children: [
      { id: 'cotizaciones', label: 'Cotizaciones (cotizaciones)' },
      { id: 'cotizaciones_detalle', label: 'Detalle de cotizaciones (cotizaciones_detalle)' }
    ]
  },
  {
    id: 'reportes',
    label: 'Reportes',
    children: [
      { id: 'rep_ventas', label: 'Ventas (ventas + ventas_detalle)' },
      { id: 'rep_devoluciones', label: 'Devoluciones (devoluciones_ventas)' },
      { id: 'rep_ingresos_egresos', label: 'Ingresos / Egresos (caja_movimientos)' },
      { id: 'rep_compras', label: 'Compras' },
      { id: 'rep_inventario', label: 'Inventario' },
      { id: 'rep_export', label: 'Exportar reportes generales (PDF / Excel)' }
    ]
  },
  {
    id: 'contaduria',
    label: 'Contaduría / Libro Diario',
    children: [
      { id: 'cuentas_contables', label: 'Cuentas contables (cuentas_contables)' },
      { id: 'libro_diario', label: 'Libro diario (libro_diario)' },
      { id: 'auditoria', label: 'Auditoría (auditoria)' }
    ]
  },
  { id: 'salir', label: 'Salir' }
]

function Placeholder({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ marginTop: 8, color: '#475569' }}>{children}</div>
    </div>
  )
}

export default function PanelAdmin({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState('dashboard')
  const [subActive, setSubActive] = useState<string | null>(null)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const [dashboardData, setDashboardData] = useState<any | null>(null)
  const [supUsers, setSupUsers] = useState<any[]>([])
  const [supUsersLoading, setSupUsersLoading] = useState(false)
  const [supInventory, setSupInventory] = useState<any[]>([])
  const [supInventoryLoading, setSupInventoryLoading] = useState(false)
  const [usersCajeros, setUsersCajeros] = useState<any[]>([])
  const [company, setCompany] = useState<any | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  useEffect(() => {
    const stored = localStorage.getItem('companyData')
    if (stored) {
      try { setCompany(JSON.parse(stored)); return } catch {}
    }
    fetch('/data-base/company.json')
      .then(r => r.json())
      .then(d => setCompany(d))
      .catch(() => setCompany(null))
  }, [])

  useEffect(() => {
    fetch('/data-base/dashboard-data.json')
      .then(r => r.json())
      .then(data => setDashboardData(data))
      .catch(() => setDashboardData(null))
  }, [])

  useEffect(() => { if (company) setEditForm(company) }, [company])

  function startEdit() { setEditing(true); setEditForm(company || {}) }
  function cancelEdit() { setEditing(false); setEditForm(company || {}) }
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) { const { name, value } = e.target; setEditForm((s: any) => ({ ...s, [name]: value })) }
  function saveCompany() { setCompany(editForm); localStorage.setItem('companyData', JSON.stringify(editForm)); setEditing(false) }
  function resetToJson() { fetch('/data-base/company.json').then(r=>r.json()).then(d => { setCompany(d); setEditForm(d); localStorage.removeItem('companyData')}).catch(()=>{}) }
  const USERS_STORAGE_KEY = 'usersData'

  useEffect(() => {
    // prefer Supabase for users; fallback to localStorage/public JSON if needed
    let mounted = true
    ;(async () => {
      try {
        const sup = (await import('../lib/supabaseClient')).default
        const { data, error } = await sup.from('users').select('id, username, role').limit(200)
        if (error) throw error
        if (!mounted) return
        const all = Array.isArray(data) ? data : []
        const cajeros = all.filter((u: any) => u.role === 'cajero')
        setUsersCajeros(cajeros)
        // store fetched users for offline edits
        try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(all)) } catch {}
        return
      } catch (err) {
        // fallback: try storage then public JSON
        const stored = localStorage.getItem(USERS_STORAGE_KEY)
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (mounted) setUsersCajeros(Array.isArray(parsed) ? parsed.filter((u: any) => u.role === 'cajero') : [])
            return
          } catch {}
        }
        try {
          const res = await fetch('/data-base/data.json')
          if (!res.ok) throw new Error('no json')
          const d = await res.json()
          const users = Array.isArray(d.users) ? d.users : []
          if (mounted) setUsersCajeros(users.filter((u: any) => u.role === 'cajero'))
          return
        } catch {
          if (mounted) setUsersCajeros([])
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  function saveUsersToStorage(list: any[]) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list))
  }

  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState<any>({ username: '', email: '', role: 'cajero', password: '' })
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingUserForm, setEditingUserForm] = useState<any>({})

  function handleNewChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setNewUser((s: any) => ({ ...s, [name]: value }))
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setEditingUserForm((s: any) => ({ ...s, [name]: value }))
  }

  function addUser() {
    if (!newUser.username) return
    const all = [...usersCajeros]
    // generate id using max id from storage or fallback
    const storedAll = (() => {
      const s = localStorage.getItem(USERS_STORAGE_KEY)
      if (!s) return null
      try { return JSON.parse(s) } catch { return null }
    })()
    const maxId = Array.isArray(storedAll) && storedAll.length > 0 ? Math.max(...storedAll.map((u: any) => u.id || 0)) : (all.length > 0 ? Math.max(...all.map((u: any) => u.id || 0)) : 0)
    const id = (maxId || 0) + 1
    const toAdd = { id, username: newUser.username, email: newUser.email || '', role: 'cajero', password: newUser.password || '' }
    const updated = [...usersCajeros, toAdd]
    setUsersCajeros(updated)
    // persist full users list: combine with other roles from storage if present
    const otherStored = (() => {
      const s = localStorage.getItem(USERS_STORAGE_KEY)
      if (!s) return []
      try { return JSON.parse(s).filter((u: any) => u.role !== 'cajero') } catch { return [] }
    })()
    saveUsersToStorage([...otherStored, ...updated])
    setNewUser({ username: '', email: '', role: 'cajero', password: '' })
    setShowAddForm(false)
  }

  function startEditUser(u: any) {
    setEditingUserId(u.id)
    setEditingUserForm({ username: u.username, email: u.email, password: u.password })
  }

  function cancelEditUser() {
    setEditingUserId(null)
    setEditingUserForm({})
  }

  function saveEditUser() {
    if (editingUserId == null) return
    const updated = usersCajeros.map(u => u.id === editingUserId ? { ...u, ...editingUserForm } : u)
    setUsersCajeros(updated)
    // merge with other roles present in storage
    const otherStored = (() => {
      const s = localStorage.getItem(USERS_STORAGE_KEY)
      if (!s) return []
      try { return JSON.parse(s).filter((x: any) => x.role !== 'cajero') } catch { return [] }
    })()
    saveUsersToStorage([...otherStored, ...updated])
    setEditingUserId(null)
    setEditingUserForm({})
  }

  function deleteUser(id: number) {
    if (!confirm('¿Eliminar este cajero? Esta acción no se puede deshacer.')) return
    const updated = usersCajeros.filter(u => u.id !== id)
    setUsersCajeros(updated)
    const otherStored = (() => {
      const s = localStorage.getItem(USERS_STORAGE_KEY)
      if (!s) return []
      try { return JSON.parse(s).filter((x: any) => x.role !== 'cajero') } catch { return [] }
    })()
    saveUsersToStorage([...otherStored, ...updated])
  }
  
  // Facturas / CAI (CRUD)
  const [facturas, setFacturas] = useState<any[]>([])
  const FACTURAS_KEY = 'facturasCai'
  const [showAddFactura, setShowAddFactura] = useState(false)
  const [newFactura, setNewFactura] = useState<any>({ cajero: '', cai: '', rangoDe: '', rangoHasta: '', fechaVencimiento: '' })
  const [editingFacturaId, setEditingFacturaId] = useState<number | null>(null)
  const [editingFacturaForm, setEditingFacturaForm] = useState<any>({})

  useEffect(() => {
    const stored = localStorage.getItem(FACTURAS_KEY)
    if (stored) {
      try { const parsed = JSON.parse(stored); setFacturas(Array.isArray(parsed) ? parsed : []); return } catch {}
    }
    fetch('/data-base/facturas-cai.json')
      .then(r => r.json())
      .then(d => setFacturas(Array.isArray(d.facturas) ? d.facturas : []))
      .catch(() => setFacturas([]))
  }, [])

  function saveFacturasToStorage(list: any[]) { localStorage.setItem(FACTURAS_KEY, JSON.stringify(list)) }

  function handleNewFacturaChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) { const { name, value } = e.target as HTMLInputElement | HTMLSelectElement; setNewFactura((s: any) => ({ ...s, [name]: value })) }
  function handleEditFacturaChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) { const { name, value } = e.target as HTMLInputElement | HTMLSelectElement; setEditingFacturaForm((s: any) => ({ ...s, [name]: value })) }

  function addFactura() {
    if (!newFactura.cajero || !newFactura.cai) return
    const maxId = facturas.length ? Math.max(...facturas.map(f => f.id || 0)) : 0
    const id = maxId + 1
    const toAdd = { id, ...newFactura }
    const updated = [...facturas, toAdd]
    setFacturas(updated)
    saveFacturasToStorage(updated)
    setNewFactura({ cajero: '', cai: '', rangoDe: '', rangoHasta: '', fechaVencimiento: '' })
    setShowAddFactura(false)
  }

  function startEditFactura(f: any) { setEditingFacturaId(f.id); setEditingFacturaForm({ cajero: f.cajero, cai: f.cai, rangoDe: f.rangoDe, rangoHasta: f.rangoHasta, fechaVencimiento: f.fechaVencimiento }) }
  function cancelEditFactura() { setEditingFacturaId(null); setEditingFacturaForm({}) }
  function saveEditFactura() {
    if (editingFacturaId == null) return
    const updated = facturas.map(f => f.id === editingFacturaId ? { ...f, ...editingFacturaForm } : f)
    setFacturas(updated)
    saveFacturasToStorage(updated)
    setEditingFacturaId(null)
    setEditingFacturaForm({})
  }

  function deleteFactura(id: number) {
    if (!confirm('¿Eliminar este registro de CAI?')) return
    const updated = facturas.filter(f => f.id !== id)
    setFacturas(updated)
    saveFacturasToStorage(updated)
  }

  // Inventario (CRUD) — lee public/data-base/inventario.json y muestra todos los campos
  const [inventory, setInventory] = useState<any[]>([])
  const INVENTORY_KEY = 'inventoryData'
  const [showAddInventory, setShowAddInventory] = useState(false)
  const [newInventoryItem, setNewInventoryItem] = useState<any>({ sku: '', producto: '', descripcion: '', ubicacion: { seccion: '', bloque: '', estante: '' }, cantidad: 0, precio: 0, imagen: '' })
  const [editingInventoryId, setEditingInventoryId] = useState<number | null>(null)
  const [editingInventoryForm, setEditingInventoryForm] = useState<any>({})
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => { const s = localStorage.getItem('inventoryLowStockThreshold'); return s ? Number(s) : 5 })
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem(INVENTORY_KEY)
    if (stored) {
      try { const parsed = JSON.parse(stored); setInventory(Array.isArray(parsed) ? parsed : []); return } catch {}
    }
    fetch('/data-base/inventario.json')
      .then(r => r.json())
      .then(d => {
        const items = Array.isArray(d) ? d : (Array.isArray(d.items) ? d.items : [])
        // normalizar: garantizar id y campos esperados (producto, cantidad, ubicacion)
        const normalized = items.map((it: any, idx: number) => ({
          id: it.id || (idx + 1),
          sku: it.sku || it.SKU || '',
          producto: it.producto || it.producto || it.nombre || '',
          descripcion: it.descripcion || it.descripcion || '',
          ubicacion: it.ubicacion || { seccion: '', bloque: '', estante: '' },
          cantidad: typeof it.cantidad === 'number' ? it.cantidad : (it.stock || 0),
          ultimoMovimiento: it.ultimoMovimiento || it.ultimoMovimiento || null,
          precio: typeof it.precio === 'number' ? it.precio : (it.precio || 0),
          imagen: it.imagen || ''
        }))
        setInventory(normalized)
      })
      .catch(() => setInventory([]))
  }, [])

  function saveInventoryToStorage(list: any[]) { localStorage.setItem(INVENTORY_KEY, JSON.stringify(list)) }

  function handleNewInventoryChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target as HTMLInputElement | HTMLSelectElement
    if (name.startsWith('ubicacion.')) {
      const key = name.split('.')[1]
      setNewInventoryItem((s: any) => ({ ...s, ubicacion: { ...(s.ubicacion || {}), [key]: value } }))
      return
    }
    setNewInventoryItem((s: any) => ({ ...s, [name]: name === 'cantidad' || name === 'precio' ? Number(value) : value }))
  }

  function handleEditInventoryChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target as HTMLInputElement | HTMLSelectElement
    if (name.startsWith('ubicacion.')) {
      const key = name.split('.')[1]
      setEditingInventoryForm((s: any) => ({ ...s, ubicacion: { ...(s.ubicacion || {}), [key]: value } }))
      return
    }
    setEditingInventoryForm((s: any) => ({ ...s, [name]: name === 'cantidad' || name === 'precio' ? Number(value) : value }))
  }

  function addInventory() {
    if (!newInventoryItem.sku || !newInventoryItem.producto) return
    const storedAll = (() => {
      const s = localStorage.getItem(INVENTORY_KEY)
      if (!s) return null
      try { return JSON.parse(s) } catch { return null }
    })()
    const maxId = Array.isArray(storedAll) && storedAll.length > 0 ? Math.max(...storedAll.map((i: any) => i.id || 0)) : (inventory.length > 0 ? Math.max(...inventory.map((i: any) => i.id || 0)) : 0)
    const id = (maxId || 0) + 1
    const toAdd = { id, ...newInventoryItem, ultimoMovimiento: new Date().toISOString() }
    const updated = [...inventory, toAdd]
    setInventory(updated)
    saveInventoryToStorage(updated)
    setNewInventoryItem({ sku: '', producto: '', descripcion: '', ubicacion: { seccion: '', bloque: '', estante: '' }, cantidad: 0, precio: 0, imagen: '' })
    setShowAddInventory(false)
  }

  function startEditInventory(it: any) {
    setEditingInventoryId(it.id)
    setEditingInventoryForm({ sku: it.sku, producto: it.producto, descripcion: it.descripcion, ubicacion: it.ubicacion || { seccion: '', bloque: '', estante: '' }, cantidad: it.cantidad, precio: it.precio || 0, imagen: it.imagen })
  }

  function cancelEditInventory() { setEditingInventoryId(null); setEditingInventoryForm({}) }

  function saveEditInventory() {
    if (editingInventoryId == null) return
    const updated = inventory.map(i => i.id === editingInventoryId ? { ...i, ...editingInventoryForm, ultimoMovimiento: new Date().toISOString() } : i)
    setInventory(updated)
    saveInventoryToStorage(updated)
    setEditingInventoryId(null)
    setEditingInventoryForm({})
  }

  function deleteInventory(id: number) {
    if (!confirm('¿Eliminar este artículo del inventario?')) return
    const updated = inventory.filter(i => i.id !== id)
    setInventory(updated)
    saveInventoryToStorage(updated)
  }

  function setThreshold(v: number) { setLowStockThreshold(v); localStorage.setItem('inventoryLowStockThreshold', String(v)) }
  const filteredInventory = inventory.filter((it) => {
    const q = (searchQuery || '').toString().trim().toLowerCase()
    if (!q) return true
    const sku = (it.sku || '').toString().toLowerCase()
    const producto = (it.producto || it.nombre || '').toString().toLowerCase()
    const descripcion = (it.descripcion || '').toString().toLowerCase()
    const ubic = it.ubicacion ? `${it.ubicacion.seccion || ''} ${it.ubicacion.bloque || ''} ${it.ubicacion.estante || ''}`.toLowerCase() : ''
    return sku.includes(q) || producto.includes(q) || descripcion.includes(q) || ubic.includes(q)
  })

  // Cierres de caja (solo lectura por ahora) — seed desde public/data-base/cierres-caja.json
  const [cierres, setCierres] = useState<any[]>([])
  const CIERRES_KEY = 'cierresData'
  useEffect(() => {
    const stored = localStorage.getItem(CIERRES_KEY)
    if (stored) {
      try { setCierres(JSON.parse(stored)); return } catch {}
    }
    fetch('/data-base/cierres-caja.json')
      .then(r => r.json())
      .then(d => setCierres(Array.isArray(d.cierres) ? d.cierres : []))
      .catch(() => setCierres([]))
  }, [])

  // Reportes: ventas, devoluciones, ingresos, egresos (solo lectura, seed desde public/data-base)
  const [ventas, setVentas] = useState<any[]>([])
  const VENTAS_KEY = 'ventasData'
  useEffect(() => {
    const stored = localStorage.getItem(VENTAS_KEY)
    if (stored) { try { setVentas(JSON.parse(stored)); return } catch {} }
    fetch('/data-base/reportes-ventas.json')
      .then(r => r.json())
      .then(d => setVentas(Array.isArray(d.ventas) ? d.ventas : []))
      .catch(() => setVentas([]))
  }, [])

  // Contaduría: cargar contaduria.json (plan de cuentas, diario, mayor, estado, cxc, cxp, balances)
  const [contaduria, setContaduria] = useState<any | null>(null)
  const [contActive, setContActive] = useState<string>('plan')
  useEffect(() => {
    const stored = localStorage.getItem('contaduriaData')
    if (stored) {
      try { setContaduria(JSON.parse(stored)); return } catch {}
    }
    fetch('/data-base/contaduria.json')
      .then(r => r.json())
      .then(d => setContaduria(d))
      .catch(() => setContaduria(null))
  }, [])

  const [devoluciones, setDevoluciones] = useState<any[]>([])
  const DEVOL_KEY = 'devolucionesData'
  useEffect(() => {
    const stored = localStorage.getItem(DEVOL_KEY)
    if (stored) { try { setDevoluciones(JSON.parse(stored)); return } catch {} }
    fetch('/data-base/reportes-devoluciones.json')
      .then(r => r.json())
      .then(d => setDevoluciones(Array.isArray(d.devoluciones) ? d.devoluciones : []))
      .catch(() => setDevoluciones([]))
  }, [])

  const [ingresos, setIngresos] = useState<any[]>([])
  const ING_KEY = 'ingresosData'
  useEffect(() => {
    const stored = localStorage.getItem(ING_KEY)
    if (stored) { try { setIngresos(JSON.parse(stored)); return } catch {} }
    fetch('/data-base/reportes-ingresos.json')
      .then(r => r.json())
      .then(d => setIngresos(Array.isArray(d.ingresos) ? d.ingresos : []))
      .catch(() => setIngresos([]))
  }, [])

  const [egresos, setEgresos] = useState<any[]>([])
  const EGR_KEY = 'egresosData'
  useEffect(() => {
    const stored = localStorage.getItem(EGR_KEY)
    if (stored) { try { setEgresos(JSON.parse(stored)); return } catch {} }
    fetch('/data-base/reportes-egresos.json')
      .then(r => r.json())
      .then(d => setEgresos(Array.isArray(d.egresos) ? d.egresos : []))
      .catch(() => setEgresos([]))
  }, [])

  // Fetch supabase-backed data for specific subviews when requested
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (subActive === 'usuarios_internal') {
        setSupUsersLoading(true)
        try {
          const sup = (await import('../lib/supabaseClient')).default
          const { data, error } = await sup.from('users').select('id, username, role')
          if (error) throw error
          if (!mounted) return
          setSupUsers(Array.isArray(data) ? data : [])
        } catch (err) {
          console.error('Error loading users from Supabase', err)
          if (mounted) setSupUsers([])
        } finally {
          if (mounted) setSupUsersLoading(false)
        }
      }

      if (subActive === 'inventario_productos') {
        setSupInventoryLoading(true)
        try {
          const sup = (await import('../lib/supabaseClient')).default
          const { data, error } = await sup.from('Inventario').select('*').limit(500)
          if (error) throw error
          if (!mounted) return
          setSupInventory(Array.isArray(data) ? data : [])
        } catch (err) {
          console.error('Error loading inventory from Supabase', err)
          if (mounted) setSupInventory([])
        } finally {
          if (mounted) setSupInventoryLoading(false)
        }
      }
    })()
    return () => { mounted = false }
  }, [subActive])


  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <aside style={{ width: 260, background: '#0f1724', color: 'white', padding: 18, boxShadow: '2px 0 6px rgba(2,6,23,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <strong>Panel Admin</strong>
          <button onClick={onLogout} className="btn-opaque" style={{ background: '#ef4444', padding: '6px 8px' }}>Salir</button>
        </div>

        <nav>
          {menuItems.map(mi => (
            <div key={mi.id} style={{ marginBottom: 6 }}>
              {/* Parent item */}
              <div onClick={() => {
                if (mi.id === 'salir') return onLogout()
                if (Array.isArray(mi.children) && mi.children.length > 0) {
                  setExpandedMenus(s => ({ ...s, [mi.id]: !s[mi.id] }))
                } else {
                  setActive(mi.id)
                  setSubActive(null)
                }
              }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderRadius: 6, cursor: 'pointer', background: active === mi.id ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                <span>{mi.label}</span>
                {Array.isArray(mi.children) && mi.children.length > 0 ? (
                  <span style={{ marginLeft: 8 }}>{expandedMenus[mi.id] ? '▾' : '▸'}</span>
                ) : null}
              </div>

              {/* Children (expandable) */}
              {Array.isArray(mi.children) && mi.children.length > 0 && expandedMenus[mi.id] && (
                <div style={{ marginLeft: 12, marginTop: 6 }}>
                  {mi.children.map((ch:any) => (
                    <div key={ch.id} onClick={() => { setActive(mi.id); setSubActive(ch.id) }} style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, fontSize: 13, color: subActive === ch.id ? '#e2e8f0' : '#cbd5e1', background: subActive === ch.id ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                      {ch.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, padding: 24 }}>
        {active === 'dashboard' && (
          <Placeholder title="Dashboard">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <h3>Ventas (últimos días)</h3>
                {dashboardData ? <LineChartPlaceholder data={dashboardData.sales} /> : <div>Cargando...</div>}
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <h3>Flujo de caja</h3>
                {dashboardData ? <BarChartPlaceholder data={dashboardData.cashflow} /> : <div>Cargando...</div>}
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <h3>Inventario por categoría</h3>
                {dashboardData ? <DoughnutChartPlaceholder data={dashboardData.inventory} /> : <div>Cargando...</div>}
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                <h3>Promedios</h3>
                {dashboardData ? (
                  <div>
                    <p>Venta diaria promedio: <b>{dashboardData.averages.dailyAverageSales}</b></p>
                    <p>Profit estimado: <b>{dashboardData.averages.profit}</b></p>
                  </div>
                ) : <div>Cargando...</div>}
              </div>
            </div>
          </Placeholder>
        )}

        {active === 'datos' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Datos de mi empresa</h2>
            {!company ? (
              <div>Cargando datos de la empresa...</div>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ background: '#fff', padding: 18, borderRadius: 8, minWidth: 420, boxShadow: '0 1px 3px rgba(2,6,23,0.06)' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 120, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                      <img src={editing ? (editForm.logo || '/logo192.png') : (company.logo || '/logo192.png')} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    <h3 style={{ marginTop: 0 }}>{company.nombre}</h3>
                  </div>
                  <div style={{ marginTop: 8, color: '#334155' }}>
                    <div style={{ marginBottom: 8 }}><strong>RTN:</strong> {editing ? (
                      <input name="rtn" value={editForm.rtn || ''} onChange={handleChange} className="input" />
                    ) : company.rtn}</div>
                    <div style={{ marginBottom: 8 }}><strong>Teléfono:</strong> {editing ? (
                      <input name="telefono" value={editForm.telefono || ''} onChange={handleChange} className="input" />
                    ) : company.telefono}</div>
                    <div style={{ marginBottom: 8 }}><strong>Correo:</strong> {editing ? (
                      <input name="email" value={editForm.email || ''} onChange={handleChange} className="input" />
                    ) : company.email}</div>
                    <div style={{ marginBottom: 8 }}><strong>Dirección:</strong> {editing ? (
                      <textarea name="direccion" value={editForm.direccion || ''} onChange={handleChange} className="input" style={{ minHeight: 64 }} />
                    ) : company.direccion}</div>
                    <div style={{ marginBottom: 8 }}><strong>Logo (URL):</strong> {editing ? (
                      <input name="logo" value={editForm.logo || ''} onChange={handleChange} className="input" placeholder="https://.../logo.png" />
                    ) : (<span style={{ marginLeft: 6 }}>{company.logo ? 'URL configurada' : 'No hay logo'}</span>)}</div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    {editing ? (
                      <>
                        <button type="button" onClick={saveCompany} className="btn-primary">Guardar</button>
                        <button type="button" onClick={cancelEdit} className="btn-opaque">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={startEdit} className="btn-primary">Actualizar datos</button>
                        <button type="button" onClick={resetToJson} className="btn-opaque">Restaurar valores</button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 320 }}>
                  <div style={{ background: '#fff', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 220, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                      <img
                        src={editing ? (editForm.logo || '/logo192.png') : (company.logo || '/logo192.png')}
                        alt="logo"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <h4 style={{ margin: 0, marginBottom: 8 }}>Detalles rápidos</h4>
                    <p style={{ margin: 0 }}>RTN: <strong>{company.rtn}</strong></p>
                    <p style={{ margin: 0 }}>Teléfono: <strong>{company.telefono}</strong></p>
                    <p style={{ marginTop: 8 }}>Correo: <strong>{company.email}</strong></p>
                    <p style={{ marginTop: 8 }}>Dirección: <strong>{company.direccion}</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {active === 'usuarios' && subActive === 'usuarios_internal' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Usuarios internos (users)</h2>
            {supUsersLoading ? (
              <div>Cargando usuarios desde Supabase...</div>
            ) : (
              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                {supUsers.length === 0 ? (
                  <div>No se encontraron usuarios internos.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead><tr><th>ID</th><th>Usuario</th><th>Rol</th></tr></thead>
                      <tbody>
                        {supUsers.map(u => (
                          <tr key={u.id}><td>{u.id}</td><td>{u.username}</td><td>{u.role}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {active === 'usuarios' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Usuarios / Cajeros</h2>
            <p style={{ color: '#475569' }}>Listado de usuarios con rol <strong>cajero</strong> cargados desde <code>public/data-base/data.json</code>.</p>
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => {
                fetch('/data-base/data.json')
                  .then(r => r.json())
                  .then(d => {
                    const users = Array.isArray(d.users) ? d.users : []
                    setUsersCajeros(users.filter((u: any) => u.role === 'cajero'))
                  })
                  .catch(() => setUsersCajeros([]))
              }} className="btn-opaque">Recargar</button>
            </div>

            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {usersCajeros.length === 0 ? (
                <div>No se encontraron usuarios con rol <strong>cajero</strong>.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <button type="button" onClick={() => setShowAddForm(s => !s)} className="btn-primary">{showAddForm ? 'Cancelar' : 'Nuevo cajero'}</button>
                    </div>
                  </div>

                  {showAddForm && (
                    <div style={{ background: '#f8fafc', padding: 12, marginBottom: 12, borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input name="username" value={newUser.username} onChange={handleNewChange} placeholder="Usuario" className="input" />
                        <input name="email" value={newUser.email} onChange={handleNewChange} placeholder="Email" className="input" />
                        <input name="password" value={newUser.password} onChange={handleNewChange} placeholder="Contraseña" className="input" />
                        <button type="button" onClick={addUser} className="btn-primary">Guardar</button>
                      </div>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <colgroup>
                        <col style={{ width: '60px' }} />
                        <col style={{ width: '220px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '260px' }} />
                        <col style={{ width: '160px' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Email</th>
                          <th style={{ textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersCajeros.map(u => (
                          <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>
                              {editingUserId === u.id ? (
                                <input name="username" value={editingUserForm.username || ''} onChange={handleEditChange} className="input" />
                              ) : (u.username || u.name || '-')}
                            </td>
                            <td>{u.role}</td>
                            <td>
                              {editingUserId === u.id ? (
                                <input name="email" value={editingUserForm.email || ''} onChange={handleEditChange} className="input" />
                              ) : (u.email || '-')}
                            </td>
                            <td>
                              <div className="admin-actions">
                                {editingUserId === u.id ? (
                                  <>
                                    <button type="button" onClick={saveEditUser} className="btn-primary">Guardar</button>
                                    <button type="button" onClick={cancelEditUser} className="btn-opaque">Cancelar</button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => startEditUser(u)} className="btn-opaque">Editar</button>
                                    <button type="button" onClick={() => deleteUser(u.id)} className="btn-danger">Eliminar</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'factura' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Factura y CAI</h2>
            <p style={{ color: '#475569' }}>Administrar CAI y rangos de facturación.</p>
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setShowAddFactura(s => !s)} className="btn-primary">{showAddFactura ? 'Cancelar' : 'Nuevo registro'}</button>
            </div>

            {showAddFactura && (
              <div style={{ background: '#f8fafc', padding: 12, marginTop: 12, borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select name="cajero" value={newFactura.cajero} onChange={handleNewFacturaChange} className="input" style={{ minWidth: 180 }}>
                    <option value="">-- Seleccione cajero --</option>
                    {usersCajeros.map(u => (
                      <option key={u.id} value={u.username}>{u.username}</option>
                    ))}
                  </select>
                  <input name="cai" value={newFactura.cai} onChange={handleNewFacturaChange} placeholder="CAI" className="input" style={{ minWidth: 220 }} />
                  <input name="rangoDe" value={newFactura.rangoDe} onChange={handleNewFacturaChange} placeholder="Rango - Desde" className="input" style={{ minWidth: 120 }} />
                  <input name="rangoHasta" value={newFactura.rangoHasta} onChange={handleNewFacturaChange} placeholder="Rango - Hasta" className="input" style={{ minWidth: 120 }} />
                  <input type="date" name="fechaVencimiento" value={newFactura.fechaVencimiento} onChange={handleNewFacturaChange} className="input" style={{ minWidth: 160 }} />
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button type="button" onClick={addFactura} className="btn-primary">Guardar</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {facturas.length === 0 ? (
                <div>No hay registros de facturas/CAI.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <colgroup>
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '220px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '160px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Cajero</th>
                        <th>CAI</th>
                        <th>Rango De</th>
                        <th>Rango Hasta</th>
                        <th style={{ textAlign: 'center' }}>Fecha venc.</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturas.map(f => (
                        <tr key={f.id}>
                          <td style={{ maxWidth: 140 }}>
                            {editingFacturaId === f.id ? (
                              <select name="cajero" value={editingFacturaForm.cajero || ''} onChange={handleEditFacturaChange} className="input">
                                <option value="">-- Seleccione cajero --</option>
                                {usersCajeros.map(u => (
                                  <option key={u.id} value={u.username}>{u.username}</option>
                                ))}
                              </select>
                            ) : f.cajero}
                          </td>
                          <td>
                            {editingFacturaId === f.id ? (
                              <input name="cai" value={editingFacturaForm.cai || ''} onChange={handleEditFacturaChange} className="input" />
                            ) : f.cai}
                          </td>
                          <td>
                            {editingFacturaId === f.id ? (
                              <input name="rangoDe" value={editingFacturaForm.rangoDe || ''} onChange={handleEditFacturaChange} className="input" />
                            ) : f.rangoDe}
                          </td>
                          <td>
                            {editingFacturaId === f.id ? (
                              <input name="rangoHasta" value={editingFacturaForm.rangoHasta || ''} onChange={handleEditFacturaChange} className="input" />
                            ) : f.rangoHasta}
                          </td>
                          <td>
                            {editingFacturaId === f.id ? (
                              <input type="date" name="fechaVencimiento" value={editingFacturaForm.fechaVencimiento || ''} onChange={handleEditFacturaChange} className="input" />
                            ) : f.fechaVencimiento}
                          </td>
                          <td>
                            <div className="admin-actions">
                              {editingFacturaId === f.id ? (
                                <>
                                  <button type="button" onClick={saveEditFactura} className="btn-primary">Guardar</button>
                                  <button type="button" onClick={cancelEditFactura} className="btn-opaque">Cancelar</button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => startEditFactura(f)} className="btn-opaque">Editar</button>
                                  <button type="button" onClick={() => deleteFactura(f.id)} className="btn-danger">Eliminar</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'inventario' && subActive === 'inventario_productos' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Productos (Inventario)</h2>
            {supInventoryLoading ? (
              <div>Cargando productos desde Supabase...</div>
            ) : (
              <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
                {supInventory.length === 0 ? (
                  <div>No se encontraron productos en la tabla `Inventario`.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr><th>ID</th><th>Nombre</th><th>SKU</th><th>Descripción</th></tr>
                      </thead>
                      <tbody>
                        {supInventory.map((p:any) => (
                          <tr key={p.id}><td>{p.id}</td><td>{p.nombre || p.producto || p.nombre}</td><td>{p.sku}</td><td>{p.descripcion || '-'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {active === 'inventario' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Inventario</h2>
            <p style={{ color: '#475569' }}>Ver y gestionar los artículos del inventario. Los datos se cargan desde <code>public/data-base/inventario.json</code> y se persisten en <code>localStorage</code>.</p>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div>
                <button type="button" onClick={() => setShowAddInventory(s => !s)} className="btn-primary">{showAddInventory ? 'Cancelar' : 'Nuevo artículo'}</button>
                <button type="button" onClick={() => { localStorage.removeItem(INVENTORY_KEY); window.location.reload() }} className="btn-opaque" style={{ marginLeft: 8 }}>Restaurar desde JSON</button>
              </div>
              <div style={{ marginLeft: 12 }}>
                <input
                  placeholder="Buscar SKU, producto, descripción o ubicación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input"
                  style={{ minWidth: 360 }}
                />
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ color: '#475569' }}>Umbral bajo stock:</label>
                <input type="number" value={lowStockThreshold} onChange={(e) => setThreshold(Number(e.target.value || 0))} className="input" style={{ width: 80 }} />
              </div>
            </div>

            {showAddInventory && (
              <div style={{ background: '#f8fafc', padding: 12, marginTop: 12, borderRadius: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 220px 120px 120px', gap: 8, alignItems: 'center' }}>
                  <input name="sku" value={newInventoryItem.sku} onChange={handleNewInventoryChange} placeholder="SKU" className="input" />
                  <input name="producto" value={newInventoryItem.producto} onChange={handleNewInventoryChange} placeholder="Producto" className="input" />
                  <input name="descripcion" value={newInventoryItem.descripcion} onChange={handleNewInventoryChange} placeholder="Descripción" className="input" />
                  <input name="cantidad" type="number" value={newInventoryItem.cantidad} onChange={handleNewInventoryChange} placeholder="Cantidad" className="input" />
                  <input name="precio" type="number" value={newInventoryItem.precio} onChange={handleNewInventoryChange} placeholder="Precio" className="input" />
                  <input name="ubicacion.seccion" value={newInventoryItem.ubicacion.seccion} onChange={handleNewInventoryChange} placeholder="Sección" className="input" />
                  <input name="ubicacion.bloque" value={newInventoryItem.ubicacion.bloque} onChange={handleNewInventoryChange} placeholder="Bloque" className="input" />
                  <input name="ubicacion.estante" value={newInventoryItem.ubicacion.estante} onChange={handleNewInventoryChange} placeholder="Estante" className="input" />
                  <input name="imagen" value={newInventoryItem.imagen} onChange={handleNewInventoryChange} placeholder="URL imagen" className="input" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={addInventory} className="btn-primary">Guardar</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {inventory.length === 0 ? (
                <div>No hay artículos en el inventario.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <colgroup>
                      <col style={{ width: '60px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '240px' }} />
                      <col style={{ width: '320px' }} />
                      <col style={{ width: '160px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '140px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>SKU</th>
                        <th>Producto</th>
                        <th>Descripción / Ubicación</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>ISV (15%)</th>
                        <th>Precio c/ISV</th>
                        <th>Img</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map(it => {
                        const precio = Number(it.precio || 0)
                        const isv = +(precio * 0.15).toFixed(2)
                        const precioConIsv = +(precio + isv).toFixed(2)
                        const ubic = it.ubicacion ? `${it.ubicacion.seccion || ''} ${it.ubicacion.bloque ? '/ ' + it.ubicacion.bloque : ''} ${it.ubicacion.estante ? '/ ' + it.ubicacion.estante : ''}` : '-'
                        const isLow = typeof it.cantidad === 'number' && it.cantidad <= lowStockThreshold
                        return (
                          <tr key={it.id}>
                            <td>{it.id}</td>
                            <td>
                              {editingInventoryId === it.id ? (
                                <input name="sku" value={editingInventoryForm.sku || ''} onChange={handleEditInventoryChange} className="input" />
                              ) : it.sku}
                            </td>
                            <td>
                              {editingInventoryId === it.id ? (
                                <input name="producto" value={editingInventoryForm.producto || ''} onChange={handleEditInventoryChange} className="input" />
                              ) : it.producto}
                            </td>
                            <td style={{ maxWidth: 420 }}>
                              {editingInventoryId === it.id ? (
                                <input name="descripcion" value={editingInventoryForm.descripcion || ''} onChange={handleEditInventoryChange} className="input" />
                              ) : (
                                <div>
                                  <div style={{ color: '#334155' }}>{it.descripcion}</div>
                                  <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>{ubic}</div>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {editingInventoryId === it.id ? (
                                <input name="cantidad" type="number" value={editingInventoryForm.cantidad || 0} onChange={handleEditInventoryChange} className="input" style={{ width: 80 }} />
                              ) : (
                                <div>
                                  <div>{it.cantidad}</div>
                                  {isLow && <div style={{ color: '#b91c1c', fontSize: 12 }}>BAJO STO CON: {lowStockThreshold}</div>}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {editingInventoryId === it.id ? (
                                <input name="precio" type="number" value={editingInventoryForm.precio || 0} onChange={handleEditInventoryChange} className="input" style={{ width: 100 }} />
                              ) : (precio ? `$ ${precio.toFixed(2)}` : '-')}
                            </td>
                            <td style={{ textAlign: 'right' }}>{`$ ${isv.toFixed(2)}`}</td>
                            <td style={{ textAlign: 'right' }}>{`$ ${precioConIsv.toFixed(2)}`}</td>
                            <td style={{ textAlign: 'center' }}>
                              {it.imagen ? (
                                <a href={it.imagen} target="_blank" rel="noreferrer">
                                  <img src={it.imagen} alt={it.producto} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                                </a>
                              ) : ('-')}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                {editingInventoryId === it.id ? (
                                  <>
                                    <button type="button" onClick={saveEditInventory} className="btn-primary">Guardar</button>
                                    <button type="button" onClick={cancelEditInventory} className="btn-opaque">Cancelar</button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => startEditInventory(it)} className="btn-opaque">Editar</button>
                                    <button type="button" onClick={() => deleteInventory(it.id)} className="btn-danger">Eliminar</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'cierres' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Cierres de caja</h2>
            <p style={{ color: '#475569' }}>Tabla de cierres (datos ficticios desde <code>public/data-base/cierres-caja.json</code>).</p>

            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {cierres.length === 0 ? (
                <div>No hay registros de cierres.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <colgroup>
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '140px' }} />
                      <col style={{ width: '200px' }} />
                      <col style={{ width: '140px' }} />
                      <col style={{ width: '140px' }} />
                      <col style={{ width: '140px' }} />
                      <col style={{ width: '260px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tipo</th>
                        <th>Cajero</th>
                        <th>Fecha</th>
                        <th>Efectivo inicial</th>
                        <th>Efectivo final</th>
                        <th>Total ventas</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierres.map(c => (
                        <tr key={c.id}>
                          <td>{c.id}</td>
                          <td>{c.tipo}</td>
                          <td>{c.cajero}</td>
                          <td>{c.fecha ? new Date(c.fecha).toLocaleString() : '-'}</td>
                          <td style={{ textAlign: 'right' }}>{typeof c.efectivoInicial === 'number' ? `$ ${c.efectivoInicial.toFixed(2)}` : '-'}</td>
                          <td style={{ textAlign: 'right' }}>{typeof c.efectivoFinal === 'number' ? `$ ${c.efectivoFinal.toFixed(2)}` : '-'}</td>
                          <td style={{ textAlign: 'right' }}>{typeof c.totalVentas === 'number' ? `$ ${c.totalVentas.toFixed(2)}` : '-'}</td>
                          <td style={{ maxWidth: 260 }}>{c.observaciones || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'rep_ventas' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Reportes de ventas</h2>
            <p style={{ color: '#475569' }}>Datos ficticios de ventas cargados desde <code>public/data-base/reportes-ventas.json</code>.</p>
            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {ventas.length === 0 ? (
                <div>No hay registros de ventas.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Cajero</th>
                        <th>Total ventas</th>
                        <th>Nº facturas</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventas.map(v => (
                        <tr key={v.id}>
                          <td>{v.id}</td>
                          <td>{v.fecha ? new Date(v.fecha).toLocaleString() : '-'}</td>
                          <td>{v.cajero}</td>
                          <td style={{ textAlign: 'right' }}>{typeof v.totalVentas === 'number' ? `$ ${v.totalVentas.toFixed(2)}` : '-'}</td>
                          <td style={{ textAlign: 'center' }}>{v.numFacturas || '-'}</td>
                          <td>{v.notas || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'rep_devoluciones' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Reporte de devoluciones</h2>
            <p style={{ color: '#475569' }}>Listado de devoluciones (datos ficticios).</p>
            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {devoluciones.length === 0 ? (
                <div>No hay devoluciones registradas.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Cajero</th>
                        <th>Factura ID</th>
                        <th>Monto</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devoluciones.map(d => (
                        <tr key={d.id}>
                          <td>{d.id}</td>
                          <td>{d.fecha ? new Date(d.fecha).toLocaleString() : '-'}</td>
                          <td>{d.cajero}</td>
                          <td style={{ textAlign: 'center' }}>{d.facturaId || '-'}</td>
                          <td style={{ textAlign: 'right' }}>{typeof d.monto === 'number' ? `$ ${d.monto.toFixed(2)}` : '-'}</td>
                          <td>{d.motivo || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'rep_ingresos' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Reporte de ingresos</h2>
            <p style={{ color: '#475569' }}>Movimientos de ingresos (datos ficticios).</p>
            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {ingresos.length === 0 ? (
                <div>No hay registros de ingresos.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Origen</th>
                        <th>Monto</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingresos.map(i => (
                        <tr key={i.id}>
                          <td>{i.id}</td>
                          <td>{i.fecha ? new Date(i.fecha).toLocaleString() : '-'}</td>
                          <td>{i.origen}</td>
                          <td style={{ textAlign: 'right' }}>{typeof i.monto === 'number' ? `$ ${i.monto.toFixed(2)}` : '-'}</td>
                          <td>{i.detalle || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'rep_egresos' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Reportes de egresos</h2>
            <p style={{ color: '#475569' }}>Movimientos de egresos (datos ficticios).</p>
            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {egresos.length === 0 ? (
                <div>No hay registros de egresos.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Categoría</th>
                        <th>Monto</th>
                        <th>Autorizado por</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {egresos.map(e => (
                        <tr key={e.id}>
                          <td>{e.id}</td>
                          <td>{e.fecha ? new Date(e.fecha).toLocaleString() : '-'}</td>
                          <td>{e.categoria}</td>
                          <td style={{ textAlign: 'right' }}>{typeof e.monto === 'number' ? `$ ${e.monto.toFixed(2)}` : '-'}</td>
                          <td>{e.autorizadoPor || '-'}</td>
                          <td>{e.detalle || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {active === 'impresion' && (
          <Placeholder title="Impresión de reportes generales">Opciones de impresión y exportación de reportes.</Placeholder>
        )}

        {active === 'contaduria' && (
          <div style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Contaduría</h2>
            <p style={{ color: '#475569' }}>Secciones contables: plan de cuentas, libro diario, libro mayor, estado de resultados, cuentas por pagar/cobrar y balances.</p>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              {['plan','diario','mayor','estado','cxp','cxc','balances'].map(id => (
                <button key={id} onClick={() => setContActive(id)} className={contActive === id ? 'btn-primary' : 'btn-opaque'} style={{ textTransform: 'capitalize' }}>{id}</button>
              ))}
            </div>

            <div style={{ marginTop: 12, background: '#fff', padding: 12, borderRadius: 8 }}>
              {!contaduria ? (
                <div>Cargando datos contables...</div>
              ) : (
                <div>
                  {contActive === 'plan' && (
                    <div>
                      <h3>Plan de cuentas</h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                          <thead>
                            <tr><th>Código</th><th>Nombre</th><th>Tipo</th></tr>
                          </thead>
                          <tbody>
                            {Array.isArray(contaduria.chartOfAccounts) && contaduria.chartOfAccounts.map((a:any)=> (
                              <tr key={a.code}><td>{a.code}</td><td>{a.name}</td><td>{a.type}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {contActive === 'diario' && (
                    <div>
                      <h3>Libro Diario</h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                          <thead><tr><th>ID</th><th>Fecha</th><th>Descripción</th><th>Detalle</th></tr></thead>
                          <tbody>
                            {Array.isArray(contaduria.diario) && contaduria.diario.map((d:any)=> (
                              <tr key={d.id}>
                                <td>{d.id}</td>
                                <td>{d.date ? new Date(d.date).toLocaleString() : '-'}</td>
                                <td>{d.description}</td>
                                <td>
                                  <table style={{ width: '100%' }}>
                                    <thead><tr><th>Cuenta</th><th>Debe</th><th>Haber</th></tr></thead>
                                    <tbody>
                                      {Array.isArray(d.lines) && d.lines.map((l:any, idx:number)=> (
                                        <tr key={idx}><td>{l.account}</td><td style={{ textAlign:'right' }}>{l.debit?`$ ${l.debit.toFixed(2)}`:'-'}</td><td style={{ textAlign:'right' }}>{l.credit?`$ ${l.credit.toFixed(2)}`:'-'}</td></tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {contActive === 'mayor' && (
                    <div>
                      <h3>Libro Mayor</h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                          <thead><tr><th>Cuenta</th><th>Nombre</th><th>Fecha</th><th>Descripción</th><th>Debe</th><th>Haber</th><th>Balance</th></tr></thead>
                          <tbody>
                            {Array.isArray(contaduria.mayor) && contaduria.mayor.map((m:any)=> (
                              m.entries.map((e:any, idx:number)=> (
                                <tr key={`${m.account}-${idx}`}>
                                  <td>{m.account}</td>
                                  <td>{m.name}</td>
                                  <td>{e.date}</td>
                                  <td>{e.desc}</td>
                                  <td style={{ textAlign:'right' }}>{e.debit?`$ ${e.debit.toFixed(2)}`:'-'}</td>
                                  <td style={{ textAlign:'right' }}>{e.credit?`$ ${e.credit.toFixed(2)}`:'-'}</td>
                                  <td style={{ textAlign:'right' }}>{typeof e.balance === 'number' ? `$ ${e.balance.toFixed(2)}` : '-'}</td>
                                </tr>
                              ))
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {contActive === 'estado' && (
                    <div>
                      <h3>Estado de Resultados</h3>
                      <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background:'#f8fafc', padding:12, borderRadius:6 }}>
                          <p>Periodo: <strong>{contaduria.estadoResultado?.periodStart}</strong> - <strong>{contaduria.estadoResultado?.periodEnd}</strong></p>
                          <p>Ingresos: <strong>{`$ ${contaduria.estadoResultado?.ingresos?.toFixed(2) || '0.00'}`}</strong></p>
                          <p>Costo de Ventas: <strong>{`$ ${contaduria.estadoResultado?.costoVentas?.toFixed(2) || '0.00'}`}</strong></p>
                        </div>
                        <div style={{ background:'#f8fafc', padding:12, borderRadius:6 }}>
                          <p>Gastos Operación: <strong>{`$ ${contaduria.estadoResultado?.gastosOperacion?.toFixed(2) || '0.00'}`}</strong></p>
                          <p>Gastos Financieros: <strong>{`$ ${contaduria.estadoResultado?.gastosFinancieros?.toFixed(2) || '0.00'}`}</strong></p>
                          <p>Utilidad Neta: <strong>{`$ ${contaduria.estadoResultado?.utilidadNeta?.toFixed(2) || '0.00'}`}</strong></p>
                        </div>
                      </div>
                    </div>
                  )}

                  {contActive === 'cxp' && (
                    <div>
                      <h3>Cuentas por Pagar</h3>
                      <div style={{ overflowX:'auto' }}>
                        <table className="admin-table">
                          <thead><tr><th>ID</th><th>Proveedor</th><th>Fecha Venc.</th><th>Monto</th><th>Saldo</th></tr></thead>
                          <tbody>
                            {Array.isArray(contaduria.cuentasPorPagar) && contaduria.cuentasPorPagar.map((p:any)=>(
                              <tr key={p.id}><td>{p.id}</td><td>{p.proveedor}</td><td>{p.fechaVenc}</td><td style={{textAlign:'right'}}>{`$ ${p.monto.toFixed(2)}`}</td><td style={{textAlign:'right'}}>{`$ ${p.saldo.toFixed(2)}`}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {contActive === 'cxc' && (
                    <div>
                      <h3>Cuentas por Cobrar</h3>
                      <div style={{ overflowX:'auto' }}>
                        <table className="admin-table">
                          <thead><tr><th>ID</th><th>Cliente</th><th>Fecha Venc.</th><th>Monto</th><th>Saldo</th></tr></thead>
                          <tbody>
                            {Array.isArray(contaduria.cuentasPorCobrar) && contaduria.cuentasPorCobrar.map((c:any)=>(
                              <tr key={c.id}><td>{c.id}</td><td>{c.cliente}</td><td>{c.fechaVenc}</td><td style={{textAlign:'right'}}>{`$ ${c.monto.toFixed(2)}`}</td><td style={{textAlign:'right'}}>{`$ ${c.saldo.toFixed(2)}`}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {contActive === 'balances' && (
                    <div>
                      <h3>Balance General</h3>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                        <div style={{ background:'#f8fafc', padding:12, borderRadius:6 }}>
                          <h4>Activos</h4>
                          <ul>
                            {Array.isArray(contaduria.balances?.assets) && contaduria.balances.assets.map((a:any)=>(<li key={a.account}>{a.name}: <strong>{`$ ${a.amount.toFixed(2)}`}</strong></li>))}
                          </ul>
                        </div>
                        <div style={{ background:'#f8fafc', padding:12, borderRadius:6 }}>
                          <h4>Pasivos</h4>
                          <ul>
                            {Array.isArray(contaduria.balances?.liabilities) && contaduria.balances.liabilities.map((l:any)=>(<li key={l.account}>{l.name}: <strong>{`$ ${l.amount.toFixed(2)}`}</strong></li>))}
                          </ul>
                        </div>
                        <div style={{ background:'#f8fafc', padding:12, borderRadius:6 }}>
                          <h4>Patrimonio</h4>
                          <ul>
                            {Array.isArray(contaduria.balances?.equity) && contaduria.balances.equity.map((e:any)=>(<li key={e.account}>{e.name}: <strong>{`$ ${e.amount.toFixed(2)}`}</strong></li>))}
                          </ul>
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <strong>Totales:</strong> Activos: {`$ ${contaduria.balances?.totals?.assets?.toFixed(2) || '0.00'}`}, Pasivos: {`$ ${contaduria.balances?.totals?.liabilities?.toFixed(2) || '0.00'}`}, Patrimonio: {`$ ${contaduria.balances?.totals?.equity?.toFixed(2) || '0.00'}`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}



function LineChartPlaceholder({ data }: { data: any }) {
  const [ChartComp, setChartComp] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    // register chart.js auto (registers scales/elements) and then load react-chartjs-2
    Promise.all([
      import('chart.js/auto').catch(() => null),
      import('react-chartjs-2').catch(() => null)
    ]).then(([_, mod]) => {
      if (!mounted) return
      if (mod && mod.Line) setChartComp(() => mod.Line)
      else setChartComp(null)
    }).catch(() => setChartComp(null))
    return () => { mounted = false }
  }, [])

  if (!ChartComp) {
    // fallback simple SVG/HTML chart
    return (
      <div style={{ height: 140 }}>
        <svg width="100%" height="100%">
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2"
            points={data.values.map((v: number, i: number) => `${(i/(data.values.length-1))*100},${100-(v/Math.max(...data.values))*100}`).join(' ')} />
        </svg>
      </div>
    )
  }

  const chartData = {
    labels: data.labels,
    datasets: [{ label: 'Ventas', data: data.values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)' }]
  }

  return (
    // @ts-ignore
    <ChartComp data={chartData} />
  )
}

function BarChartPlaceholder({ data }: { data: any }) {
  const [ChartComp, setChartComp] = useState<any>(null)
  useEffect(() => {
    let mounted = true
    Promise.all([
      import('chart.js/auto').catch(() => null),
      import('react-chartjs-2').catch(() => null)
    ]).then(([_, mod]) => { if (!mounted) return; if (mod && mod.Bar) setChartComp(() => mod.Bar); else setChartComp(null) }).catch(() => setChartComp(null))
    return () => { mounted = false }
  }, [])

  if (!ChartComp) {
    return <div style={{ height: 140 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', height: 120 }}>
        {data.incomes.map((v: number, i: number) => (
          <div key={i} style={{ width: 24, height: `${(v/Math.max(...data.incomes))*100}%`, background: '#10b981' }}></div>
        ))}
      </div>
    </div>
  }

  const chartData = {
    labels: data.labels,
    datasets: [
      { label: 'Ingresos', data: data.incomes, backgroundColor: '#10b981' },
      { label: 'Egresos', data: data.expenses, backgroundColor: '#ef4444' }
    ]
  }
  // @ts-ignore
  return <ChartComp data={chartData} />
}

function DoughnutChartPlaceholder({ data }: { data: any }) {
  const [ChartComp, setChartComp] = useState<any>(null)
  useEffect(() => {
    let mounted = true
    Promise.all([
      import('chart.js/auto').catch(() => null),
      import('react-chartjs-2').catch(() => null)
    ]).then(([_, mod]) => { if (!mounted) return; if (mod && mod.Doughnut) setChartComp(() => mod.Doughnut); else setChartComp(null) }).catch(() => setChartComp(null))
    return () => { mounted = false }
  }, [])

  if (!ChartComp) {
    return <div style={{ height: 140 }}>
      <ul>
        {data.categories.map((c: string, i: number) => <li key={i}>{c}: {data.counts[i]}</li>)}
      </ul>
    </div>
  }

  const chartData = {
    labels: data.categories,
    datasets: [{ data: data.counts, backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }]
  }
  // @ts-ignore
  return <ChartComp data={chartData} />
}
