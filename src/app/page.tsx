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
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-lime-50 to-emerald-100 text-stone-800 pb-24">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-7">

        {/* Header */}
        <div className="pt-3 space-y-5">
          <div className="text-center">
            <h1 className="font-heading text-4xl md:text-5xl font-semibold tracking-tight text-stone-900">What Do I Eat?</h1>
            <p className="text-stone-600 text-lg mt-2">What are we cooking?</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/pantry"
              className="flex items-center gap-2 bg-white/90 hover:bg-white border border-stone-300 px-4 py-2.5 rounded-full text-base transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <span>🧺</span>
              <span className="text-stone-800">{pantryCount > 0 ? `${pantryCount} items` : 'Pantry'}</span>
            </Link>
            <Link href="/grocery"
              className="flex items-center gap-2 bg-white/90 hover:bg-white border border-stone-300 px-4 py-2.5 rounded-full text-base transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
              <span>🛒</span>
              <span className="text-stone-800">{savedGroceryItems.length > 0 ? `Grocery (${savedGroceryItems.length})` : 'Grocery'}</span>
            </Link>
          </div>
        </div>

        {/* Pantry hint */}
        {pantryCount === 0 && (
          <Link href="/pantry" className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 text-base text-amber-900 hover:bg-amber-100 transition-colors text-center shadow-sm">
             Add items to your pantry and we'll find recipes that use what you have →
          </Link>
        )}

        {/* Mood input */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 space-y-4 shadow-sm backdrop-blur-sm">
            <p className="text-lg text-stone-800 font-semibold text-center">Tonight's preferences</p>
            <div className="space-y-2">
              <p className="text-sm text-stone-500 uppercase tracking-wider text-center">Health goal</p>
              <div className="flex flex-wrap justify-center gap-2">
                {HEALTH_GOAL_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option, healthGoals, setHealthGoals)}
                    className={`text-sm px-4 py-2 rounded-full border transition-all hover:-translate-y-0.5 active:scale-95 ${
                      healthGoals.includes(option)
                        ? 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-stone-500 uppercase tracking-wider text-center">Dietary restrictions</p>
              <div className="flex flex-wrap justify-center gap-2">
                {DIETARY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option, dietaryRestrictions, setDietaryRestrictions)}
                    className={`text-sm px-4 py-2 rounded-full border transition-all hover:-translate-y-0.5 active:scale-95 ${
                      dietaryRestrictions.includes(option)
                        ? 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-stone-500 uppercase tracking-wider text-center">Cuisine</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CUISINE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleOption(option, cuisines, setCuisines)}
                    className={`text-sm px-4 py-2 rounded-full border transition-all hover:-translate-y-0.5 active:scale-95 ${
                      cuisines.includes(option)
                        ? 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm'
                        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="timeMinutes" className="text-sm text-stone-500 uppercase tracking-wider block text-center">
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
                className="w-48 mx-auto block bg-white border border-stone-300 rounded-xl px-3 py-2.5 text-base text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && getMealPlan(false)}
            placeholder="What are you feeling? (spicy, sweet, simple, cozy...)"
            className="w-full bg-white border border-stone-300 rounded-2xl px-5 py-4 text-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-center shadow-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => getMealPlan(false)}
              disabled={loading || !mood.trim()}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-200 disabled:text-stone-500 text-white font-semibold text-lg py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
            >
              Show meal ideas
            </button>
            <button
              onClick={() => getMealPlan(true)}
              disabled={loading || !mood.trim()}
              className="flex-1 bg-amber-300 hover:bg-amber-400 disabled:bg-stone-200 disabled:text-stone-500 text-stone-900 font-semibold text-lg py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
            >
              {loading ? 'Thinking...' : ' Decide for me'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 rounded-2xl p-4 text-red-700 text-base text-center">{error}</div>
        )}

        {chosenSuggestion && decision && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 space-y-3 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <span className="text-amber-800 text-sm font-semibold uppercase tracking-wider">✨ Tonight's pick</span>
            </div>
            <h2 className="font-heading text-3xl font-semibold text-stone-900">{chosenSuggestion.title}</h2>
            <p className="text-lg text-stone-700">{chosenSuggestion.reason}</p>
            <p className="text-base text-stone-500">~{chosenSuggestion.cookTimeMinutes} min</p>
            {chosenSuggestion.pantryIngredientsUsed.length > 0 && (
              <p className="text-base text-emerald-700">
                Uses pantry: {chosenSuggestion.pantryIngredientsUsed.join(', ')}
              </p>
            )}
            <button
              onClick={() => setSelectedSuggestionIndex(0)}
              className={`mt-1 text-sm px-4 py-2 rounded-xl border transition-all hover:-translate-y-0.5 mx-auto block ${
                selectedSuggestionIndex === 0
                  ? 'border-amber-400 text-amber-900 bg-amber-100'
                  : 'border-stone-300 text-stone-700 bg-white hover:border-stone-400'
              }`}
            >
              {selectedSuggestionIndex === 0 ? 'Picked' : 'Pick this meal'}
            </button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-stone-600 text-base text-center">{suggestions.length} meal ideas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={`${suggestion.title}-${idx}`}
                  className={`rounded-2xl border p-5 space-y-3 h-full transition-all hover:-translate-y-1 hover:shadow-lg ${
                    selectedSuggestionIndex === idx
                      ? 'border-amber-300 bg-amber-50 shadow-md'
                      : 'border-stone-200 bg-white shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading text-2xl font-semibold text-stone-900">{suggestion.title}</h3>
                    <span className="text-sm text-stone-500">{suggestion.cookTimeMinutes} min</span>
                  </div>
                  <p className="text-base text-stone-700 text-center">{suggestion.reason}</p>
                  {suggestion.pantryIngredientsUsed.length > 0 && (
                    <p className="text-sm text-emerald-700">Pantry: {suggestion.pantryIngredientsUsed.join(', ')}</p>
                  )}
                  {suggestion.missingIngredients.length > 0 && (
                    <p className="text-sm text-amber-800">Need: {suggestion.missingIngredients.join(', ')}</p>
                  )}
                  <button
                    onClick={() => setSelectedSuggestionIndex(idx)}
                    className={`mt-2 text-sm px-4 py-2 rounded-xl border transition-all hover:-translate-y-0.5 mx-auto block ${
                      selectedSuggestionIndex === idx
                        ? 'border-amber-400 text-amber-900 bg-amber-100'
                        : 'border-stone-300 text-stone-700 bg-white hover:border-stone-400'
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
            <h2 className="font-heading text-3xl font-semibold text-center text-stone-900">Grocery List</h2>
            <p className="text-sm text-stone-600 text-center">
              Showing ingredients needed for: <span className="text-stone-800 font-medium">{chosenSuggestion?.title}</span>
            </p>
            {Object.entries(groceryBySection).map(([section, items]) => (
              <div key={section}>
                <p className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-2 text-center">{section}</p>
                <div className="space-y-1">
                  {items.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="rounded-xl border border-stone-200 bg-white p-3.5 text-base flex justify-between gap-3 shadow-sm">
                      <span className="capitalize">{item.name}</span>
                      {item.inPantry ? (
                        <span className="text-emerald-700 text-sm">In pantry</span>
                      ) : (
                        <button
                          onClick={() => addToSavedGrocery(item)}
                          className="text-sm px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:border-amber-400 hover:text-amber-900 transition-all"
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
              className="inline-flex text-base text-amber-800 hover:text-amber-900 justify-center w-full font-medium"
            >
              Open saved grocery list →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}