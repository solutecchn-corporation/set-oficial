import React, { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';

export default function RegistroProducto() {
  const [productos, setProductos] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [productoId, setProductoId] = useState<string | number>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [referencia, setReferencia] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProductos = async () => {
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select('id, nombre, sku')
        .order('nombre', { ascending: true });
      if (error) throw error;
      setProductos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading productos', err);
      setProductos([]);
    }
  };

  const loadMovimientos = async () => {
    try {
      const { data, error } = await supabase
        .from('registro_de_inventario')
        .select('*')
        .order('fecha_salida', { ascending: false })
        .limit(100);
      if (error) throw error;
      setMovimientos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading movimientos', err);
      setMovimientos([]);
    }
  };

  useEffect(() => {
    loadProductos();
    loadMovimientos();
  }, []);

  const getUserName = () => {
    try {
      const raw = localStorage.getItem('user');
      const parsed = raw ? JSON.parse(raw) : null;
      return (
        parsed && (parsed.username || parsed.user?.username || parsed.name || parsed.user?.name)
      ) || 'sistema';
    } catch (e) {
      return 'sistema';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoId) {
      setMessage('Seleccione un producto');
      return;
    }
    if (!cantidad || cantidad <= 0) {
      setMessage('Ingrese una cantidad válida');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const usuario = getUserName();
      const payload = {
        producto_id: productoId,
        cantidad: cantidad,
        tipo_de_movimiento: tipo,
        referencia: referencia || `${tipo} manual desde admin`,
        usuario,
        fecha_salida: new Date().toISOString(),
      } as any;

      const { data, error } = await supabase
        .from('registro_de_inventario')
        .insert([payload]);

      if (error) throw error;

      setMessage('Movimiento registrado correctamente');
      setCantidad(1);
      setReferencia('');
      setProductoId('');
      // recargar lista
      await loadMovimientos();
    } catch (err: any) {
      console.error('Error inserting movimiento', err);
      setMessage('Error al registrar movimiento: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // helper to map producto id to nombre
  const productoMap = productos.reduce((acc: Record<string, string>, p: any) => {
    acc[String(p.id)] = p.nombre || `#${p.id}`;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>Registro de producto</h2>

      <div style={{ display: 'flex', gap: 20 }}>
        <form onSubmit={handleSubmit} style={{ width: 380, background: 'white', padding: 16, borderRadius: 8 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>Producto</label>
            <select className="input" value={String(productoId)} onChange={e => setProductoId(e.target.value)}>
              <option value="">-- Seleccione --</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} {p.sku ? `(${p.sku})` : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>Tipo</label>
            <select className="input" value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="ENTRADA">ENTRADA</option>
              <option value="SALIDA">SALIDA</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>Cantidad</label>
            <input className="input" type="number" min={1} value={cantidad} onChange={e => setCantidad(Number(e.target.value))} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#475569' }}>Referencia</label>
            <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Opcional" />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Registrar'}</button>
          </div>

          {message && <div style={{ marginTop: 12, color: message.startsWith('Error') ? '#ef4444' : '#10b981' }}>{message}</div>}
        </form>

        <div style={{ flex: 1 }}>
          <div style={{ background: 'white', padding: 12, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Últimos movimientos</h3>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Fecha</th>
                    <th style={{ padding: 8 }}>Producto</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Cantidad</th>
                    <th style={{ padding: 8 }}>Tipo</th>
                    <th style={{ padding: 8 }}>Referencia</th>
                    <th style={{ padding: 8 }}>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 8 }}>{m.fecha_salida ? new Date(m.fecha_salida).toLocaleString() : '-'}</td>
                      <td style={{ padding: 8 }}>{productoMap[String(m.producto_id)] || String(m.producto_id)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{m.cantidad}</td>
                      <td style={{ padding: 8 }}>{m.tipo_de_movimiento}</td>
                      <td style={{ padding: 8 }}>{m.referencia}</td>
                      <td style={{ padding: 8 }}>{m.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movimientos.length === 0 && <div style={{ padding: 16, color: '#94a3b8' }}>No hay movimientos registrados.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

