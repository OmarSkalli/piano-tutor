import { ENHARMONIC } from './constants'

export function normalizeNote(name: string): string {
  return ENHARMONIC[name] ?? name
}
