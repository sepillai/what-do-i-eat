import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type ParsedPantryItem = {
  name: string
  quantity: number | null
  unit: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const completion = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1200,
      temperature: 0,
      system:
        'You extract grocery or pantry ingredients from messy free text. Return strict JSON only.',
      messages: [
        {
          role: 'user',
          content: `Parse this text into a JSON array of pantry items.

Rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Each item must match: { "name": string, "quantity": number | null, "unit": string | null }.
- "name" should be normalized to a concise ingredient/item name.
- If quantity is uncertain, set quantity to null.
- If unit is absent or unclear, set unit to null.
- Do not include non-food household products unless the text clearly indicates they are pantry food items.
- Deduplicate obvious duplicates.

Text:
${text}`,
        },
      ],
    })

    const textBlock = completion.content.find((part) => part.type === 'text')
    const raw = textBlock?.type === 'text' ? textBlock.text : ''
    const items = normalizeParsedItems(raw)

    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse pantry text' }, { status: 500 })
  }
}

function normalizeParsedItems(rawResponse: string): ParsedPantryItem[] {
  const cleaned = stripCodeFences(rawResponse).trim()
  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => normalizeItem(item))
    .filter((item): item is ParsedPantryItem => item !== null)
}

function normalizeItem(item: unknown): ParsedPantryItem | null {
  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>
  const nameValue = typeof record.name === 'string' ? record.name.trim().toLowerCase() : ''
  if (!nameValue) return null

  const quantityValue =
    typeof record.quantity === 'number' && Number.isFinite(record.quantity)
      ? record.quantity
      : null

  const unitValue =
    typeof record.unit === 'string' && record.unit.trim().length > 0
      ? record.unit.trim().toLowerCase()
      : null

  return {
    name: nameValue,
    quantity: quantityValue,
    unit: unitValue,
  }
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim()
  if (!trimmed.startsWith('```')) return trimmed

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}
