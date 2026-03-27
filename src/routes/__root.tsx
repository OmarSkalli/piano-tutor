import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'

function Root() {
  useEffect(() => {
    document.getElementById('loading-bar')?.remove()
  }, [])
  return <Outlet />
}

export const Route = createRootRoute({
  component: Root,
})
