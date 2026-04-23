'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const GOALS = [
  { id: 'lose_weight', emoji: '⚖️', label: 'Lose weight', desc: 'Lower calorie options' },
  { id: 'build_muscle', emoji: '💪', label: 'Build muscle', desc: 'High protein focus' },
  { id: 'eat_healthy', emoji: '🥗', label: 'Eat healthier', desc: 'Whole foods, balanced meals' },
  { id: 'no_goal', emoji: '😌', label: 'No specific goal', desc: 'Just help me decide what to cook' },
]

const CUISINES = [
  'Italian', 'Japanese', 'Mexican', 'Indian', 'Chinese', 'Thai',
  'Mediterranean', 'American', 'Korean', 'French', 'Greek', 'Vietnamese'
]

const RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free',
  'Halal', 'Kosher', 'No pork', 'No shellfish', 'Nut-free'
]

const SKILLS = [
  { id: 'beginner', label: 'Beginner', desc: 'Simple recipes, under 30 min' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Comfortable with most techniques' },
  { id: 'advanced', label: 'Advanced', desc: 'Bring on the complexity' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [goalType, setGoalType] = useState('')
  const [calorieTarget, setCalorieTarget] = useState(2000)
  const [proteinTarget, setProteinTarget] = useState(120)
  const [cuisinesLiked, setCuisinesLiked] = useState<string[]>([])
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [skill, setSkill] = useState('')
  const [maxCookTime, setMaxCookTime] = useState(45)
  const [weeklyBudget, setWeeklyBudget] = useState(100)
  const [servings, setServings] = useState(2)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  async function saveProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      goal_type: goalType,
      calorie_target: calorieTarget,
      protein_target: proteinTarget,
      cuisines_liked: cuisinesLiked,
      dietary_restrictions: restrictions,
      cooking_skill: skill,
      max_cook_time: maxCookTime,
      weekly_budget: weeklyBudget,
      servings,
      updated_at: new Date().toISOString(),
    })

    if (error) { console.error(error); setLoading(false); return }
    router.push('/pantry')  // go straight to pantry setup after onboarding
  }

  // Step 1: Goal
  if (step === 1) return (
    <OnboardingShell step={1} total={3} title="What's your main goal?" onNext={() => goalType && setStep(2)} nextDisabled={!goalType}>
      <div className="grid grid-cols-2 gap-3">
        {GOALS.map(g => (
          <button key={g.id} onClick={() => setGoalType(g.id)}
            className={`p-4 rounded-xl border text-left transition-all ${goalType === g.id ? 'border-orange-500 bg-orange-500/10' : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'}`}>
            <div className="text-xl mb-1">{g.emoji}</div>
            <div className="font-medium text-sm text-white">{g.label}</div>
            <div className="text-neutral-400 text-xs mt-1">{g.desc}</div>
          </button>
        ))}
      </div>

      {goalType && goalType !== 'no_goal' && (
        <div className="space-y-4 pt-2">
          <SliderField label="Daily calorie target" value={calorieTarget} setValue={setCalorieTarget} min={1200} max={3500} step={50} unit="kcal" />
          <SliderField label="Daily protein target" value={proteinTarget} setValue={setProteinTarget} min={50} max={250} step={5} unit="g" />
        </div>
      )}
    </OnboardingShell>
  )

  // Step 2: Cuisine + restrictions
  if (step === 2) return (
    <OnboardingShell step={2} total={3} title="What do you like to eat?" onNext={() => setStep(3)} onBack={() => setStep(1)}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-neutral-400 mb-3">Cuisines you love (pick any)</p>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map(c => (
              <button key={c} onClick={() => toggleItem(cuisinesLiked, setCuisinesLiked, c)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${cuisinesLiked.includes(c) ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-neutral-400 mb-3">Dietary restrictions</p>
          <div className="flex flex-wrap gap-2">
            {RESTRICTIONS.map(r => (
              <button key={r} onClick={() => toggleItem(restrictions, setRestrictions, r)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${restrictions.includes(r) ? 'border-red-500 bg-red-500/10 text-red-300' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </OnboardingShell>
  )

  // Step 3: Practical constraints
  return (
    <OnboardingShell step={3} total={3} title="Last few things" onNext={saveProfile} onBack={() => setStep(2)} nextLabel={loading ? 'Saving...' : 'Set up my pantry →'} nextDisabled={!skill || loading}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-neutral-400 mb-3">Cooking skill level</p>
          <div className="space-y-2">
            {SKILLS.map(s => (
              <button key={s.id} onClick={() => setSkill(s.id)}
                className={`w-full p-3 rounded-xl border text-left transition-all ${skill === s.id ? 'border-orange-500 bg-orange-500/10' : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'}`}>
                <span className="font-medium text-sm text-white">{s.label}</span>
                <span className="text-neutral-400 text-xs ml-2">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <SliderField label="Max cook time" value={maxCookTime} setValue={setMaxCookTime} min={15} max={120} step={5} unit="min" />
        <SliderField label="Weekly grocery budget" value={weeklyBudget} setValue={setWeeklyBudget} min={30} max={300} step={10} unit="$" prefix />
        <SliderField label="Cooking for how many?" value={servings} setValue={setServings} min={1} max={6} step={1} unit="people" />
      </div>
    </OnboardingShell>
  )
}

// ── Reusable sub-components ──────────────────────────────────────

function OnboardingShell({ step, total, title, children, onNext, onBack, nextLabel = 'Continue →', nextDisabled = false }: {
  step: number, total: number, title: string, children: React.ReactNode,
  onNext: () => void, onBack?: () => void, nextLabel?: string, nextDisabled?: boolean
}) {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-md mx-auto space-y-6 py-8">
        <div className="flex gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-orange-500' : 'bg-neutral-700'}`} />
          ))}
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="space-y-4">{children}</div>
        <div className="flex gap-3 pt-4">
          {onBack && (
            <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-neutral-700 text-neutral-300 hover:border-neutral-600 transition-colors">
              ← Back
            </button>
          )}
          <button onClick={onNext} disabled={nextDisabled}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold py-3 rounded-xl transition-colors">
            {nextLabel}
          </button>
        </div>
      </div>
    </main>
  )
}

function SliderField({ label, value, setValue, min, max, step, unit, prefix = false }: {
  label: string, value: number, setValue: (v: number) => void,
  min: number, max: number, step: number, unit: string, prefix?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-neutral-400">{label}</span>
        <span className="text-orange-400 font-semibold">
          {prefix ? `${unit}${value}` : `${value} ${unit}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-orange-500" />
    </div>
  )
}