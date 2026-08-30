import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import StatusBar from './components/StatusBar.jsx'
import TabBar from './components/TabBar.jsx'
import Home from './pages/Home.jsx'
import Discover from './pages/Discover.jsx'
import VenueDetail from './pages/VenueDetail.jsx'
import Profile from './pages/Profile.jsx'
import MyCheckins from './pages/MyCheckins.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="app-shell relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-mist">
      <ScrollToTop />
      <StatusBar />
      <div className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/venue/:id" element={<VenueDetail />} />
          <Route path="/checkins" element={<MyCheckins />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      {/* 底部导航高度占位（真实导航为 fixed） */}
      <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))]" aria-hidden="true" />
      <TabBar />
    </div>
  )
}
