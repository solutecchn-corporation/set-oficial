import React, { useEffect, useState } from 'react'

type Props = {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export default function ZoomWrapper({ children, style, className }: Props) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(t)
  }, [])

  const base: React.CSSProperties = {
    transform: entered ? 'scale(1)' : 'scale(0.94)',
    opacity: entered ? 1 : 0,
    transition: 'transform 180ms cubic-bezier(.2,.9,.2,1), opacity 160ms ease',
    transformOrigin: 'center center'
  }

  return (
    <div className={className} style={{ ...base, ...style }}>
      {children}
    </div>
  )
}
