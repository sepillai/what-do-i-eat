'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type PantryItem = {
  id: string
  name: string
  category: string
  quantity: string | null
  unit: string | null
  is_available: boolean
}

type ParsedPantryInputItem = {
  name: string
  quantity: number | null
  unit: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  'protein': '🥩',
  'produce': '🥦',
  'dairy': '🧀',
  'grains & legumes': '🌾',
  'spices': '🧂',
  'pantry staples': '🫙',
  'other': '📦',
}

// Common items for quick-add chips
const QUICK_ADD = [
  'chicken breast', 'eggs', 'garlic', 'onion', 'olive oil',
  'pasta', 'rice', 'canned tomatoes', 'butter', 'milk',
  'salt', 'black pepper', 'cumin', 'potatoes', 'lemon'
]

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [bulkParsing, setBulkParsing] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => { fetchPantry() }, [])

  async function fetchPantry() {
    const res = await fetch('/api/pantry')
    if (res.status === 401) { router.push('/auth'); return }
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  // Parse free-text input: "2 lbs chicken breast, garlic, 3 eggs"
  function parseInput(text: string) {
    return text.split(',').map(raw => {
      const trimmed = raw.trim()
      const match = trimmed.match(
        /^([\d.]+\s*)?((?:lbs?|oz|g|kg|cups?|tbsp|tsp|pieces?|cloves?|cans?)\b)?\s*(.+)$/i
      )
      return {
        quantity: match?.[1]?.trim() || null,
        unit: match?.[2]?.trim() || null,
        name: (match?.[3] || trimmed).trim().toLowerCase(),
      }
    }).filter(i => i.name.length > 0)
  }

  async function addItems(text: string) {
    if (!text.trim()) return
    setAdding(true)
    setAddError('')

    try {
      const parsed = parseInput(text)
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsed })
      })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/auth')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to add items')
      setItems(prev => [...prev, ...(data.items || [])])
      setInputValue('')
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Could not add items')
    } finally {
      setAdding(false)
    }
  }

  async function parseAndAddBulkItems() {
    if (!bulkInput.trim()) return
    setBulkParsing(true)
    setBulkError('')

    try {
      const parseRes = await fetch('/api/pantry/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkInput })
      })

      const parseData = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseData.error || 'Failed to parse text')

      const parsedItems: ParsedPantryInputItem[] = Array.isArray(parseData.items) ? parseData.items : []
      if (parsedItems.length === 0) {
        setBulkError('No ingredients found. Try adding more detail.')
        return
      }

      const addRes = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsedItems })
      })

      const addData = await addRes.json()
      if (!addRes.ok) throw new Error(addData.error || 'Failed to add parsed items')

      setItems(prev => [...prev, ...(addData.items || [])])
      setBulkInput('')
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Could not import items')
    } finally {
      setBulkParsing(false)
    }
  }

  async function toggleItem(id: string, current: boolean) {
    await fetch('/api/pantry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_available: !current })
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_available: !current } : i))
  }

  async function deleteItem(id: string) {
    await fetch('/api/pantry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // Group available items by category
  const available = items.filter(i => i.is_available)
  const unavailable = items.filter(i => !i.is_available)
  const categories = [...new Set(available.map(i => i.category))]

  const filtered = filter === 'all'
    ? categories
    : categories.filter(c => c === filter)

  const alreadyHave = QUICK_ADD.filter(name =>
    available.some(i => i.name.toLowerCase().includes(name.toLowerCase()))
  )

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <p className="text-neutral-400">Loading your pantry...</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-24">
      <div className="max-w-xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Pantry</h1>
            <p className="text-neutral-400 text-sm">{available.length} items available</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Find recipes →
          </button>
        </div>

        {/* Add items input */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-neutral-400">
            Add what you have. Separate multiple items with commas.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItems(inputValue)}
              placeholder="e.g. 2 lbs chicken, garlic, 3 eggs, olive oil"
              className="flex-1 bg-neutral-900 border border-neutral-600 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors text-sm"
            />
            <button
              onClick={() => addItems(inputValue)}
              disabled={adding || !inputValue.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-700 text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm"
            >
              {adding ? '...' : 'Add'}
            </button>
          </div>
          {addError && (
            <p className="text-xs text-red-400">{addError}</p>
          )}

          {/* Quick add chips */}
          <div>
            <p className="text-xs text-neutral-500 mb-2">Quick add common items:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ADD.filter(n => !alreadyHave.includes(n)).slice(0, 8).map(name => (
                <button
                  key={name}
                  onClick={() => addItems(name)}
                  className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded-lg text-xs transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-700 space-y-2">
            <p className="text-xs text-neutral-400">
              AI bulk import: paste a grocery receipt or messy list.
            </p>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="e.g. bought chicken breast 2lbs, got some eggs, milk, the usual pasta stuff"
              rows={4}
              className="w-full bg-neutral-900 border border-neutral-600 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors text-sm resize-y"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                Claude will extract structured items with quantities when possible.
              </p>
              <button
                onClick={parseAndAddBulkItems}
                disabled={bulkParsing || !bulkInput.trim()}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
              >
                {bulkParsing ? 'Parsing...' : 'Parse with AI'}
              </button>
            </div>
            {bulkError && (
              <p className="text-xs text-red-400">{bulkError}</p>
            )}
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['all', ...categories].map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  filter === cat
                    ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                {cat === 'all' ? `All (${available.length})` : `${CATEGORY_ICONS[cat] || '📦'} ${cat}`}
              </button>
            ))}
          </div>
        )}

        {/* Pantry items by category */}
        {available.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <div className="text-4xl mb-3">🛒</div>
            <p>Your pantry is empty.</p>
            <p className="text-sm mt-1">Add ingredients above to get started.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map(category => (
              <div key={category}>
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">
                  {CATEGORY_ICONS[category] || '📦'} {category}
                </h2>
                <div className="space-y-1">
                  {available.filter(i => i.category === category).map(item => (
                    <PantryItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleItem(item.id, item.is_available)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Used up / unavailable items */}
        {unavailable.length > 0 && (
          <div className="pt-4 border-t border-neutral-800">
            <h2 className="text-xs font-semibold text-neutral-600 uppercase tracking-widest mb-2">
              Used up / unavailable
            </h2>
            <div className="space-y-1">
              {unavailable.map(item => (
                <PantryItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleItem(item.id, item.is_available)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function PantryItemRow({ item, onToggle, onDelete }: {
  item: PantryItem
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
      item.is_available
        ? 'border-neutral-700 bg-neutral-800/50'
        : 'border-neutral-800 bg-neutral-900/30 opacity-50'
    }`}>
      <button onClick={onToggle}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          item.is_available ? 'border-green-500 bg-green-500' : 'border-neutral-600'
        }`}>
        {item.is_available && <span className="text-white text-xs">✓</span>}
      </button>
      <span className={`flex-1 text-sm capitalize ${item.is_available ? 'text-white' : 'text-neutral-500 line-through'}`}>
        {item.name}
      </span>
      {(item.quantity || item.unit) && (
        <span className="text-neutral-500 text-xs">{item.quantity} {item.unit}</span>
      )}
      <button onClick={onDelete} className="text-neutral-600 hover:text-red-400 transition-colors text-xs px-1">
        ✕
      </button>
    </div>
  )
}