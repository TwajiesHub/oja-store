import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { apiGet } from './lib/api.js'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/home.css'
import './styles/brand.css'
import './styles/product.css'
import './styles/edit.css'

// Wake the serverless function while the page loads, so the first real request is fast.
apiGet('/health').catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
