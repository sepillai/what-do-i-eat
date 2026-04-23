'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type MealSuggestion = {
  title: string
  reason: string
  cookTimeMinutes: number
  pantryIngredientsUsed: string[]
  missingIngredients: string[]
}

type Decision = {
  chosenIndex: number
  reason: string
}

type GroceryItem = {
  name: string
  section: string
  inPantry: boolean
}

type SavedGroceryItem = {
  id: string
  name: string
  section: string
  addedAt: string
}

const GROCERY_STORAGE_KEY = 'wdei:grocery-list'
const HEALTH_GOAL_OPTIONS = ['High protein', 'Low calorie', 'High fiber', 'Low carb']
const DIETARY_OPTIONS = ['Vegetarian', 'Gluten free', 'No beef', 'Dairy free']
const CUISINE_OPTIONS = ['Italian', 'Mexican', 'Chinese', 'Indian', 'Mediterranean', 'Thai']

export default function HomePage() {
  const [mood, setMood] = useState('')
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([])
  const [decision, setDecision] = useState<Decision | null>(null)
  const [pantryCount, setPantryCount] = useState(0)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null)
  const [savedGroceryItems, setSavedGroceryItems] = useState<SavedGroceryItem[]>([])
  const [healthGoals, setHealthGoals] = useState<string[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [cuisines, setCuisines] = useState<string[]>([])
  const [timeMinutes, setTimeMinutes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROCERY_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        setSavedGroceryItems(parsed)
      }
    } catch {
      setSavedGroceryItems([])
    }
  }, [])

  function persistGrocery(items: SavedGroceryItem[]) {
    setSavedGroceryItems(items)
    localStorage.setItem(GROCERY_STORAGE_KEY, JSON.stringify(items))
  }

  function addToSavedGrocery(item: GroceryItem) {
    const normalizedName = item.name.trim().toLowerCase()
    if (!normalizedName) return
    const exists = savedGroceryItems.some((g) => g.name.toLowerCase() === normalizedName)
    if (exists) return
    const next: SavedGroceryItem[] = [
      ...savedGroceryItems,
      {
        id: crypto.randomUUID(),
        name: normalizedName,
        section: item.section || 'Other',
        addedAt: new Date().toISOString(),
      },
    ]
    persistGrocery(next)
  }

  function toggleOption(value: string, selected: string[], setSelected: (next: string[]) => void) {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value))
      return
    }
    setSelected([...selected, value])
  }

  async function getMealPlan(decide: boolean) {
    if (!mood.trim()) return
    setLoading(true)
    setError('')
    setSuggestions([])
    setDecision(null)

    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood,
          decide,
          healthGoals,
          dietaryRestrictions,
          cuisinePreferences: cuisines,
          maxCookTime: timeMinutes.trim() ? Number(timeMinutes) : null,
        })
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const body = await res.text()
        throw new Error(`Recipe API returned non-JSON (${res.status}): ${body.slice(0, 200)}`)
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuggestions(data.suggestions || [])
      setDecision(data.decision || null)
      setSelectedSuggestionIndex(0)
      setPantryCount(data.pantryCount || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const chosenSuggestion = selectedSuggestionIndex != null
    ? suggestions[selectedSuggestionIndex]
    : null
  const selectedMealGroceryList: GroceryItem[] = chosenSuggestion
    ? Array.from(new Set(chosenSuggestion.missingIngredients.map((item) => item.trim()).filter(Boolean)))
      .map((name) => ({
        name,
        section: 'For this meal',
        inPantry: false,
      }))
    : []
  const groceryBySection = selectedMealGroceryList.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-lime-100 text-neutral-900 pb-24">
      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="pt-2 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">🥘 What Do I Eat?</h1>
            <p className="text-lime-900/70 text-sm">What are we cooking?</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Link href="/pantry"
              className="flex items-center gap-1.5 bg-white/80 hover:bg-white border border-lime-300 px-3 py-2 rounded-xl text-sm transition-colors">
              <span>🧺</span>
              <span className="text-lime-900">{pantryCount > 0 ? `${pantryCount} items` : 'Pantry'}</span>
            </Link>
            <Link href="/grocery"
              className="flex items-center gap-1.5 bg-white/80 hover:bg-white border border-lime-300 px-3 py-2 rounded-xl text-sm transition-colors">
              <span>🛒</span>
              <span className="text-lime-900">{savedGroceryItems.length > 0 ? `Grocery (${savedGroceryItems.length})` : 'Grocery'}</span>
            </Link>
          </div>
        </div>

        {/* Pantry hint */}
        {pantryCount === 0 && (
          <Link href="/pantry" className="block bg-yellow-100 border border-yellow-300 rounded-xl p-3 text-sm text-yellow-900 hover:bg-yellow-200 transition-colors text-center">
            💡 Add items to your pantry and we'll find recipes that use what you have →
          </Link>
        )}

        {/* Mood input */}
        <div className="space-y-3">
          <div className="rounded-xl border border-lime-300 bg-white/70 p-4 space-y-3">
            <p className="text-sm text-lime-900 font-medium text-center">Tonight's preferences</p>
            <div className="space-y-2">
              <p className="text-xs text-lime-900/70 uppercase tracking-widest text-center">Health goal</p>
              <div className="flex flex-wrap justify-center gap-2">
                {HEALTH_GOAL_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option, healthGoals, setHealthGoals)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      healthGoals.includes(option)
                        ? 'border-yellow-400 bg-yellow-100 text-yellow-900'
                        : 'border-lime-300 text-lime-900 hover:border-lime-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-lime-900/70 uppercase tracking-widest text-center">Dietary restrictions</p>
              <div className="flex flex-wrap justify-center gap-2">
                {DIETARY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option, dietaryRestrictions, setDietaryRestrictions)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      dietaryRestrictions.includes(option)
                        ? 'border-yellow-400 bg-yellow-100 text-yellow-900'
                        : 'border-lime-300 text-lime-900 hover:border-lime-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-lime-900/70 uppercase tracking-widest text-center">Cuisine</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CUISINE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option, cuisines, setCuisines)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      cuisines.includes(option)
                        ? 'border-yellow-400 bg-yellow-100 text-yellow-900'
                        : 'border-lime-300 text-lime-900 hover:border-lime-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="timeMinutes" className="text-xs text-lime-900/70 uppercase tracking-widest block text-center">
                Time for meal (minutes)
              </label>
              <input
                id="timeMinutes"
                type="number"
                min={5}
                max={180}
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                placeholder="e.g. 25"
                className="w-40 mx-auto block bg-white border border-lime-300 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-lime-700/60 focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && getMealPlan(false)}
            placeholder="What are you feeling? (spicy, sweet, simple, cozy...)"
            className="w-full bg-white border border-lime-300 rounded-xl px-4 py-4 text-neutral-900 placeholder-lime-700/60 focus:outline-none focus:border-yellow-400 transition-colors text-center"
          />
          <div className="flex gap-2">
            <button
              onClick={() => getMealPlan(false)}
              disabled={loading || !mood.trim()}
              className="flex-1 bg-lime-700 hover:bg-lime-800 disabled:bg-lime-200 disabled:text-lime-600 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Show meal ideas
            </button>
            <button
              onClick={() => getMealPlan(true)}
              disabled={loading || !mood.trim()}
              className="flex-1 bg-yellow-300 hover:bg-yellow-400 disabled:bg-lime-200 disabled:text-lime-600 text-neutral-900 font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Thinking...' : '✨ Decide for me'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-red-700 text-sm text-center">{error}</div>
        )}

        {chosenSuggestion && decision && (
          <div className="bg-yellow-100 border-2 border-yellow-300 rounded-2xl p-5 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-yellow-800 text-xs font-bold uppercase tracking-widest">✨ Tonight's pick</span>
            </div>
            <h2 className="text-xl font-semibold">{chosenSuggestion.title}</h2>
            <p className="text-sm text-yellow-900">{chosenSuggestion.reason}</p>
            <p className="text-sm text-lime-900/70">~{chosenSuggestion.cookTimeMinutes} min</p>
            {chosenSuggestion.pantryIngredientsUsed.length > 0 && (
              <p className="text-sm text-green-300">
                Uses pantry: {chosenSuggestion.pantryIngredientsUsed.join(', ')}
              </p>
            )}
            <button
              onClick={() => setSelectedSuggestionIndex(0)}
              className={`mt-1 text-xs px-3 py-1.5 rounded-lg border transition-colors mx-auto block ${
                selectedSuggestionIndex === 0
                  ? 'border-yellow-500 text-yellow-900 bg-yellow-200'
                  : 'border-lime-400 text-lime-900 hover:border-lime-500'
              }`}
            >
              {selectedSuggestionIndex === 0 ? 'Picked' : 'Pick this meal'}
            </button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-lime-900/70 text-sm text-center">{suggestions.length} AI meal ideas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={`${suggestion.title}-${idx}`}
                  className={`rounded-xl border p-4 space-y-2 h-full ${
                    selectedSuggestionIndex === idx
                      ? 'border-yellow-400 bg-yellow-100'
                      : 'border-lime-300 bg-white/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{suggestion.title}</h3>
                    <span className="text-xs text-lime-900/70">{suggestion.cookTimeMinutes} min</span>
                  </div>
                  <p className="text-sm text-neutral-700 text-center">{suggestion.reason}</p>
                  {suggestion.pantryIngredientsUsed.length > 0 && (
                    <p className="text-xs text-green-400">Pantry: {suggestion.pantryIngredientsUsed.join(', ')}</p>
                  )}
                  {suggestion.missingIngredients.length > 0 && (
                    <p className="text-xs text-yellow-800">Need: {suggestion.missingIngredients.join(', ')}</p>
                  )}
                  <button
                    onClick={() => setSelectedSuggestionIndex(idx)}
                    className={`mt-2 text-xs px-3 py-1.5 rounded-lg border transition-colors mx-auto block ${
                      selectedSuggestionIndex === idx
                        ? 'border-yellow-500 text-yellow-900 bg-yellow-200'
                        : 'border-lime-400 text-lime-900 hover:border-lime-500'
                    }`}
                  >
                    {selectedSuggestionIndex === idx ? 'Picked' : 'Pick this meal'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedMealGroceryList.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-center">Grocery List</h2>
            <p className="text-xs text-lime-900/70 text-center">
              Showing ingredients needed for: <span className="text-lime-900">{chosenSuggestion?.title}</span>
            </p>
            {Object.entries(groceryBySection).map(([section, items]) => (
              <div key={section}>
                <p className="text-xs font-semibold text-lime-900/70 uppercase tracking-widest mb-2">{section}</p>
                <div className="space-y-1">
                  {items.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="rounded-lg border border-lime-300 bg-white/80 p-3 text-sm flex justify-between">
                      <span className="capitalize">{item.name}</span>
                      {item.inPantry ? (
                        <span className="text-green-400 text-xs">In pantry</span>
                      ) : (
                        <button
                          onClick={() => addToSavedGrocery(item)}
                          className="text-xs px-2 py-1 rounded-md border border-lime-400 text-lime-900 hover:border-yellow-500 hover:text-yellow-900 transition-colors"
                        >
                          {savedGroceryItems.some((g) => g.name.toLowerCase() === item.name.trim().toLowerCase()) ? 'Added' : 'Add'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/grocery"
              className="inline-flex text-sm text-yellow-800 hover:text-yellow-900 justify-center w-full"
            >
              Open saved grocery list →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}