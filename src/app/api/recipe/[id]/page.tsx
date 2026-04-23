'use client'

import Link from 'next/link'

export default function RecipePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-24">
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Recipe detail pages are paused</h1>
        <p className="text-neutral-300 text-sm">
          Phase 1 now uses Anthropic-only meal planning from the home page, with no recipe card/detail flow.
        </p>
        <Link href="/" className="inline-block bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-semibold">
          Back to meal planner
        </Link>
      </div>
    </main>
  )
}