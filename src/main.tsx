import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'

import App from './App'
import { ManualRegistrationHost } from './manual-registration-host'
import './styles.css'
import './header-alignment.css'
import './product-polish.css'

// Panel data changes at collection cadence, not per click. Without these
// defaults every remount and every return to the browser tab refetched the
// whole dashboard at once. Mutations still invalidate what they change, and
// queries that need live status override these options explicitly.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ManualRegistrationHost />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
