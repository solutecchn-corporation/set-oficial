import React, { useState } from 'react'
import supabase from '../lib/supabaseClient'

type User = {
  id: number
  username: string
  password: string
  role?: string
  email?: string
}

type LoginProps = {
  onLogin?: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    try {
      // Autenticación únicamente contra la tabla `users` en Supabase
      const { data: sbData, error: sbError } = await supabase
        .from('users')
        .select('id, username, password, role')
        .eq('username', username)
        .limit(1)
        .single()

      if (sbError) {
        // Problema al consultar Supabase
        setMessage('Error al consultar el servicio de autenticación')
        console.error('Supabase error:', sbError)
        // Si es un error de columna inexistente, dar una sugerencia
        if ((sbError as any)?.code === '42703') {
          console.warn('La consulta solicita una columna inexistente en la tabla `users`. Verifica el DDL y ajusta `.select(...)` según las columnas reales.')
        }
        return
      }

      if (!sbData) {
        setMessage('Credenciales inválidas')
        return
      }

      const found = sbData as User
      // Nota importante: en producción NO se deben guardar ni comparar contraseñas en texto plano.
      if (found.password === password) {
        const toStore = { id: found.id, username: found.username, role: found.role }
        localStorage.setItem('user', JSON.stringify(toStore))
        try { console.debug('Login: stored localStorage.user =', toStore) } catch (e) {}
        // Si es cajero, intentar cargar CAI más reciente y guardarlo en localStorage.caiInfo
          try {
          if (found.role === 'cajero') {
            const { data: caiRows, error: caiErr } = await supabase
              .from('cai')
              .select('id, cai, identificador, rango_de, rango_hasta, fecha_vencimiento, secuencia_actual')
              .eq('cajero', found.username)
              .order('id', { ascending: false })
              .limit(1)
            if (!caiErr && Array.isArray(caiRows) && caiRows.length > 0) {
              try { localStorage.setItem('caiInfo', JSON.stringify(caiRows[0])) } catch (e) {}
              try { console.debug('Login: stored localStorage.caiInfo =', caiRows[0]) } catch (e) {}
            } else {
              try { localStorage.removeItem('caiInfo') } catch (e) {}
            }
          }
        } catch (e) {
          console.debug('Login: error fetching cai for cajero', e)
        }
        // Additionally, try to fetch and store ncInfo (nota de crédito info) for cajero
        try {
          if (found.role === 'cajero') {
            const { data: ncRows, error: ncErr } = await supabase
              .from('ncredito')
              .select('id, cai, identificador, rango_de, rango_hasta, fecha_vencimiento, secuencia_actual, caja, cajero, usuario_id')
              .eq('cajero', found.username)
              .order('id', { ascending: false })
              .limit(1)
            if (!ncErr && Array.isArray(ncRows) && ncRows.length > 0) {
              try { localStorage.setItem('ncInfo', JSON.stringify(ncRows[0])) } catch (e) {}
              try { console.debug('Login: stored localStorage.ncInfo =', ncRows[0]) } catch (e) {}
            } else {
              try { localStorage.removeItem('ncInfo') } catch (e) {}
            }
          }
        } catch (e) {
          console.debug('Login: error fetching ncredito info for cajero', e)
        }
        setMessage('Inicio de sesión correcto')
        if (typeof onLogin === 'function') onLogin()
      } else {
        setMessage('Credenciales inválidas')
      }
    } catch (err: any) {
      setMessage(err.message || 'Error al consultar la base de datos')
    }
  }

  return (
    <div className="login-root">
      <div className="login-card" role="region" aria-label="login panel">
        <h3 className="login-title">Bienvenido a SET</h3>
        <div className="login-sub">Inicia sesión con tu cuenta</div>

        <div className="login-inner">
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="usuario"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="contraseña"
                required
                autoComplete="current-password"
              />
            </div>

            <div>
              <button className="btn-primary" type="submit">Entrar</button>
            </div>
          </form>

          {message && <p style={{ marginTop: 12 }}>{message}</p>}

          <div className="login-foot">
            Credenciales de prueba: <span className="hint">admin / admin</span>
          </div>
        </div>
      </div>
    </div>
  )
}
