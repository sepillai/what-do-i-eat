'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type SavedGroceryItem = {
  id: string
  name: string
  section: string
  addedAt: string
}

const GROCERY_STORAGE_KEY = 'wdei:grocery-list'

function sectionToPantryCategory(section: string): string {
  const normalized = section.toLowerCase()
  if (normalized.includes('produce')) return 'produce'
  if (normalized.includes('protein')) return 'protein'
  if (normalized.includes('dairy')) return 'dairy'
  if (normalized.includes('grain')) return 'grains & legumes'
  if (normalized.includes('spice')) return 'spices'
  if (normalized.includes('pantry')) return 'pantry staples'
  return 'other'
}

export default function GroceryPage() {
  const router = useRouter()
  const [items, setItems] = useState<SavedGroceryItem[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROCERY_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      setItems(Array.isArray(parsed) ? parsed : [])
    } catch {
      setItems([])
    }
  }, [])

  function persist(next: SavedGroceryItem[]) {
    setItems(next)
    localStorage.setItem(GROCERY_STORAGE_KEY, JSON.stringify(next))
  }

  async function moveToPantry(item: SavedGroceryItem) {
    setAddingId(item.id)
    setError('')
    try {
      const response = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              name: item.name,
              category: sectionToPantryCategory(item.section),
              quantity: null,
              unit: null,
            },
          ],
        }),
      })
      if (response.status === 401) {
        router.push('/auth')
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to move item to pantry')
      persist(items.filter((g) => g.id !== item.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move item to pantry')
    } finally {
      setAddingId(null)
    }
  }

  function removeItem(id: string) {
    persist(items.filter((g) => g.id !== id))
  }

  const grouped = useMemo(() => {
    return items.reduce<Record<string, SavedGroceryItem[]>>((acc, item) => {
      if (!acc[item.section]) acc[item.section] = []
      acc[item.section].push(item)
      return acc
    }, {})
  }, [items])

  return (
    <main className="min-h-screen bg-lime-100 text-neutral-900 pb-24">
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grocery List</h1>
            <p className="text-lime-900/70 text-sm">{items.length} items saved</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="bg-white/80 hover:bg-white border border-lime-300 text-sm px-3 py-2 rounded-xl"
            >
              Recipes
            </Link>
            <Link
              href="/pantry"
              className="bg-yellow-300 hover:bg-yellow-400 text-neutral-900 text-sm font-semibold px-3 py-2 rounded-xl"
            >
              Pantry
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-lime-300 bg-white/70 p-8 text-center text-lime-900/70">
            No saved grocery items yet. Add ingredients from recipe ideas.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([section, sectionItems]) => (
              <div key={section} className="space-y-2">
                <p className="text-xs font-semibold text-lime-900/70 uppercase tracking-widest">{section}</p>
                <div className="space-y-1">
                  {sectionItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-lime-300 bg-white/80 p-3 flex items-center justify-between gap-3"
                    >
                      <span className="capitalize text-sm">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveToPantry(item)}
                          disabled={addingId === item.id}
                          className="text-xs px-2.5 py-1.5 rounded-md border border-green-600 text-green-700 hover:bg-green-100 disabled:opacity-60"
                        >
                          {addingId === item.id ? 'Adding...' : 'Add to pantry'}
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-xs px-2.5 py-1.5 rounded-md border border-lime-400 text-lime-900 hover:border-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
