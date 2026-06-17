import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { TuningProvider } from './theory/useTuning.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TuningProvider>
      <App />
    </TuningProvider>
  </StrictMode>,
)
