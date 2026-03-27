import { createContext, useCallback, useContext, useState } from 'react'
import { useMidi } from '@/hooks/useMidi'
import type { MidiState } from '@/hooks/useMidi'

interface MidiContextValue extends MidiState {
  isModalOpen: boolean
  openModal(): void
  closeModal(): void
}

const MidiContext = createContext<MidiContextValue | null>(null)

export function MidiProvider({ children }: { children: React.ReactNode }) {
  const midi = useMidi()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openModal = useCallback(() => {
    if (midi.status === 'idle') midi.requestAccess()
    setIsModalOpen(true)
  }, [midi])

  const closeModal = useCallback(() => setIsModalOpen(false), [])

  return (
    <MidiContext.Provider
      value={{ ...midi, isModalOpen, openModal, closeModal }}
    >
      {children}
    </MidiContext.Provider>
  )
}

export function useMidiContext(): MidiContextValue {
  const ctx = useContext(MidiContext)
  if (!ctx) throw new Error('useMidiContext must be used inside MidiProvider')
  return ctx
}
