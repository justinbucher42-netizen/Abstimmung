import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import SetupNotice from './components/SetupNotice'
import { ToastProvider } from './components/Toast'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import CreatePage from './pages/Create'
import PollPage from './pages/Poll'
import JoinRedirect from './pages/JoinRedirect'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        {!isConfigured ? (
          <SetupNotice />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/vote/:code" element={<PollPage />} />
            <Route path="/join/:code" element={<JoinRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </Layout>
    </ToastProvider>
  )
}
