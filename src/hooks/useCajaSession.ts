import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabaseClient'
import useHondurasTime, { hondurasNowISO } from '../lib/useHondurasTime'

export type CajaSesion = {
    id: number
    usuario: string
    fecha_apertura: string
    monto_inicial: number
    total_ingresos: number
    total_egresos: number
    saldo_final: number | null
    fecha_cierre: string | null
    estado: 'abierta' | 'cerrada'
}

export default function useCajaSession() {
    const [session, setSession] = useState<CajaSesion | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { hondurasNowISO } = useHondurasTime()

    const getUser = () => {
        try {
            const raw = localStorage.getItem('user')
            if (!raw) return null
            const parsed = JSON.parse(raw)
            return parsed.username || parsed.user?.username || parsed.name || parsed.user?.name || null
        } catch {
            return null
        }
    }

    const fetchActiveSession = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const user = getUser()
            if (!user) {
                setSession(null)
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('caja_sesiones')
                .select('*')
                .eq('usuario', user)
                .eq('estado', 'abierta')
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) throw error
            setSession(data as CajaSesion | null)
        } catch (err: any) {
            console.error('Error fetching active session:', err)
            setError(err.message || 'Error cargando sesión de caja')
        } finally {
            setLoading(false)
        }
    }, [])

    const startSession = async (montoInicial: number) => {
        try {
            const user = getUser()
            if (!user) throw new Error('No hay usuario logueado')

            // Ensure no other open session exists
            if (session) throw new Error('Ya existe una sesión abierta')

            const payload = {
                usuario: user,
                fecha_apertura: hondurasNowISO(),
                monto_inicial: montoInicial,
                total_ingresos: 0,
                total_egresos: 0,
                estado: 'abierta'
            }

            const { data, error } = await supabase
                .from('caja_sesiones')
                .insert([payload])
                .select('*')
                .single()

            if (error) throw error
            setSession(data as CajaSesion)
            return data
        } catch (err: any) {
            console.error('Error starting session:', err)
            throw err
        }
    }

    const closeSession = async (finalData: {
        total_ingresos: number,
        total_egresos: number,
        saldo_final: number,
        efectivo_obtenido?: number,
        dolares_obtenido?: number,
        tarjeta_obtenido?: number,
        transferencia_obtenido?: number,
        efectivo_registrado?: number,
        dolares_registrado?: number,
        tarjeta_registrado?: number,
        transferencia_registrado?: number,
        diferencia?: number
    }) => {
        try {
            if (!session) throw new Error('No hay sesión activa para cerrar')

            const payload = {
                ...finalData,
                fecha_cierre: hondurasNowISO(),
                estado: 'cerrada'
            }

            const { data, error } = await supabase
                .from('caja_sesiones')
                .update(payload)
                .eq('id', session.id)
                .select('*')
                .single()

            if (error) throw error
            setSession(null) // Clear active session
            return data
        } catch (err: any) {
            console.error('Error closing session:', err)
            throw err
        }
    }

    useEffect(() => {
        fetchActiveSession()
    }, [fetchActiveSession])

    return {
        session,
        loading,
        error,
        refreshSession: fetchActiveSession,
        startSession,
        closeSession
    }
}
