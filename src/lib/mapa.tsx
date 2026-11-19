// O tamanho da tela, acompanhado a cada mudança de tamanho da janela.

import { useEffect, useState } from 'react'

export function useTela() {
  const [t, setT] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const f = () => setT({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return t
}
