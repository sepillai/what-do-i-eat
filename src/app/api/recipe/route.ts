import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

type UserProfile = {
  calorie_target?: number
  protein_target?: number
  cuisines_liked?: string[]
  dietary_restrictions?: string[]
  max_cook_time?: number
  weekly_budget?: number
  goal_type?: string
  cooking_skill?: string
  servings?: number
}

type RecommendationHistory = {
  recipe_title?: string
  mood_input?: string
  created_at?: string
}

type MealSuggestion = {
  title: string
  reason: string
  cookTimeMinutes: number
  pantryIngredientsUsed: string[]
  missingIngredients: string[]
}

type GroceryItem = {
  name: string
  section: string
  inPantry: boolean
}

type PlannerResponse = {
  chosenIndex: number
  decisionReason: string
  suggestions: MealSuggestion[]
  groceryList: GroceryItem[]
}

type TonightPreferences = {
  healthGoals: string[]
  dietaryRestrictions: string[]
  cuisinePreferences: string[]
  maxCookTime: number | null
}

function toUserFriendlyReason(reason: string, fallback: string): string {
  const compact = reason.replace(/\s+/g, ' ').trim()
  const withoutTechnicalLead = compact
    .replace(/^since decide\s*=\s*false[^.]*\.\s*/i, '')
    .replace(/^if decide\s*=\s*false[^.]*\.\s*/i, '')
    .replace(/^because decide\s*=\s*false[^.]*\.\s*/i, '')
    .replace(/^no decision requested[^.]*\.\s*/i, '')
    .replace(/^decide\s*=\s*false[^.]*\.\s*/i, '')
    .replace(/^defaulting chosenindex to \d+[^.]*\.\s*/i, '')
    .trim()
  if (/no decision requested|defaulting chosenindex|decide\s*=\s*false/i.test(withoutTechnicalLead)) {
    return fallback
  }
  const firstSentence = withoutTechnicalLead.split(/(?<=[.!?])\s+/)[0]?.trim() || ''
  if (firstSentence.length > 0) return firstSentence
  return fallback
}

function parseJsonFromModel(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/i, '')
    const withoutFenceEnd = withoutFenceStart.replace(/\s*```$/, '')
    return JSON.parse(withoutFenceEnd)
  }
  return JSON.parse(trimmed)
}

async function buildPlan(
  profile: UserProfile | null,
  mood: string,
  pantryItems: string[],
  history: RecommendationHistory[],
  decide: boolean,
  tonight: TonightPreferences
): Promise<PlannerResponse> {
  const combinedRestrictions = Array.from(
    new Set([...(profile?.dietary_restrictions || []), ...tonight.dietaryRestrictions])
  )
  const cuisineChoices = tonight.cuisinePreferences.length > 0
    ? tonight.cuisinePreferences
    : (profile?.cuisines_liked || [])
  const effectiveCookTime = tonight.maxCookTime ?? profile?.max_cook_time ?? null
  const historyContext = history.length > 0
    ? `Recently made:\n${history.map(h => `- ${h.recipe_title || 'Unknown'} (mood: ${h.mood_input || 'n/a'})`).join('\n')}`
    : 'No cooking history yet.'

  const prompt = `You are a personal chef + grocery planner.

Health goal: ${profile?.goal_type?.replace('_', ' ') || 'eat well'}
Target per meal: ~${profile?.calorie_target ? Math.round(profile.calorie_target / 3) : 600} cal, ~${profile?.protein_target ? Math.round(profile.protein_target / 3) : 40}g protein
Skill level: ${profile?.cooking_skill || 'intermediate'}
Mood/craving: "${mood}"
Tonight health goals: ${tonight.healthGoals.length > 0 ? tonight.healthGoals.join(', ') : 'none selected'}
Weekly grocery budget: ${profile?.weekly_budget ? `$${profile.weekly_budget}/week` : 'not set'}
Max cook time preference: ${effectiveCookTime ? `${effectiveCookTime} minutes` : 'not set'}
Household servings target: ${Math.max(profile?.servings || 2, 1)}
Dietary restrictions: ${combinedRestrictions.join(', ') || 'none'}
Preferred cuisines: ${cuisineChoices.join(', ') || 'none'}

Pantry items available: ${pantryItems.join(', ') || 'none'}

${historyContext}

Create 5 meal suggestions with pantry-aware ingredients.
If decide=${decide ? 'true' : 'false'}, set chosenIndex to best suggestion index when true, else set chosenIndex to 0.
Include only realistic ingredients and keep grocery list deduplicated.
For each suggestion.reason, write exactly one user-facing sentence explaining why this meal fits tonight's selected goals/restrictions/cuisines/mood/time.

Respond ONLY with valid JSON (no markdown fences) in this schema:
{
  "chosenIndex": 0,
  "decisionReason": "One short user-facing sentence about why the selected meal fits goals/preferences (never mention decide flags, chosenIndex, defaults, or technical logic).",
  "suggestions": [
    {
      "title": "string",
      "reason": "string",
      "cookTimeMinutes": 30,
      "pantryIngredientsUsed": ["string"],
      "missingIngredients": ["string"]
    }
  ],
  "groceryList": [
    {
      "name": "string",
      "section": "Produce | Protein | Dairy | Grains | Spices | Pantry Staples | Frozen | Other",
      "inPantry": false
    }
  ]
}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const parsed = parseJsonFromModel(text) as PlannerResponse
  const safeIndex = Number.isInteger(parsed.chosenIndex) ? parsed.chosenIndex : 0
  const chosen = parsed.suggestions?.[safeIndex] || parsed.suggestions?.[0]
  const fallbackReason = chosen?.reason
    ? `Great choice for your craving: ${chosen.reason}`
    : 'Great choice based on your craving and pantry.'
  return {
    ...parsed,
    chosenIndex: decide ? safeIndex : 0,
    decisionReason: toUserFriendlyReason(parsed.decisionReason || '', fallbackReason),
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      mood,
      decide = false,
      healthGoals = [],
      dietaryRestrictions = [],
      cuisinePreferences = [],
      maxCookTime = null,
    } = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Fetch profile
    let profile = null
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      profile = data
    }

    // Fetch pantry items — this is what makes the recs smart
    let pantryItems: string[] = []
    if (user) {
      const { data } = await supabase
        .from('pantry_items')
        .select('name')
        .eq('user_id', user.id)
        .eq('is_available', true)
      pantryItems = data?.map((i: { name: string }) => i.name) || []
    }

    // Fetch recent history for memory
    let history: RecommendationHistory[] = []
    if (user) {
      const { data } = await supabase
        .from('recipe_recommendations')
        .select('recipe_title, mood_input, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)
      history = data || []
    }

    const plan = await buildPlan(profile, mood, pantryItems, history, decide, {
      healthGoals: Array.isArray(healthGoals) ? healthGoals.filter((v: unknown) => typeof v === 'string') : [],
      dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions.filter((v: unknown) => typeof v === 'string') : [],
      cuisinePreferences: Array.isArray(cuisinePreferences) ? cuisinePreferences.filter((v: unknown) => typeof v === 'string') : [],
      maxCookTime: typeof maxCookTime === 'number' && Number.isFinite(maxCookTime) ? maxCookTime : null,
    })

    if (user && plan.suggestions[plan.chosenIndex]) {
      const chosen = plan.suggestions[plan.chosenIndex]
      await supabase.from('recipe_recommendations').insert({
        user_id: user.id,
        spoonacular_id: null,
        recipe_title: chosen.title,
        mood_input: mood,
        used_pantry_items: chosen.pantryIngredientsUsed,
      })
    }

    return NextResponse.json({
      suggestions: plan.suggestions,
      decision: {
        chosenIndex: plan.chosenIndex,
        reason: plan.decisionReason,
      },
      groceryList: plan.groceryList,
      pantryCount: pantryItems.length,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/recipe',
    mode: 'anthropic-only phase 1',
  })
}