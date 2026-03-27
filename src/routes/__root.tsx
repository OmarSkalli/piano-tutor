import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { MidiModal } from '@/components/MidiModal'
import { MidiProvider } from '@/context/MidiContext'

function Root() {
  useEffect(() => {
    document.getElementById('loading-bar')?.remove()
  }, [])
  return (
    <MidiProvider>
      <Outlet />
      <MidiModal />
    </MidiProvider>
  )
}

export const Route = createRootRoute({
  component: Root,
})
