import { createRoot } from 'react-dom/client'
import './estilos/global.css'
import { App } from './App'

// Sem StrictMode: a montagem dupla do modo estrito desmonta os rótulos <Html> do drei no meio da renderização
// (aviso "Attempted to synchronously unmount a root while React was already rendering").
createRoot(document.getElementById('root')!).render(<App />)
