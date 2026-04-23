import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET: fetch all pantry items for logged-in user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_available', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ items: data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch pantry' }, { status: 500 })
  }
}

// POST: add one or many items to pantry
export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json() // array of items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const rows = items
      .map((item: any) => {
        const name = typeof item?.name === 'string' ? item.name.toLowerCase().trim() : ''
        if (!name) return null

        return {
          user_id: user.id,
          name,
          category: item.category || categorizePantryItem(name),
          quantity: parseQuantity(item.quantity),
          unit: typeof item.unit === 'string' && item.unit.trim().length > 0 ? item.unit.trim() : null,
          expires_at: item.expires_at || null,
          is_available: true,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid pantry items found' }, { status: 400 })
    }

    const firstInsert = await supabase
      .from('pantry_items')
      .insert(rows)
      .select()

    if (!firstInsert.error) {
      return NextResponse.json({ items: firstInsert.data })
    }

    // If the FK points to profiles(id), users who skipped onboarding may not have a profile row yet.
    if (isMissingParentUserError(firstInsert.error)) {
      const profileUpsert = await supabase.from('profiles').upsert(
        {
          id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

      if (!profileUpsert.error) {
        const secondInsert = await supabase
          .from('pantry_items')
          .insert(rows)
          .select()

        if (!secondInsert.error) {
          return NextResponse.json({ items: secondInsert.data })
        }

        return NextResponse.json(
          { error: secondInsert.error.message, code: secondInsert.error.code, details: secondInsert.error.details },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: firstInsert.error.message, code: firstInsert.error.code, details: firstInsert.error.details },
      { status: 500 }
    )
  } catch (error) {
    console.error('POST /api/pantry failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add items' },
      { status: 500 }
    )
  }
}

function parseQuantity(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value.trim())
    return Number.isFinite(numeric) ? numeric : null
  }
  return null
}

function isMissingParentUserError(error: { code?: string; message?: string; details?: string | null }): boolean {
  if (error.code !== '23503') return false
  return (
    error.message?.includes('pantry_items_user_id_fkey') === true ||
    error.details?.includes('pantry_items_user_id_fkey') === true
  )
}

// PATCH: mark item as used up (or restore it)
export async function PATCH(request: NextRequest) {
  try {
    const { id, is_available } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { error } = await supabase
      .from('pantry_items')
      .update({ is_available, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE: permanently remove item
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}

// Auto-categorize based on ingredient name
function categorizePantryItem(name: string): string {
  const n = name.toLowerCase()
  if (['chicken', 'beef', 'pork', 'salmon', 'tuna', 'shrimp', 'turkey', 'egg', 'tofu'].some(k => n.includes(k))) return 'protein'
  if (['milk', 'cheese', 'butter', 'cream', 'yogurt', 'cheddar', 'mozzarella'].some(k => n.includes(k))) return 'dairy'
  if (['onion', 'garlic', 'tomato', 'spinach', 'broccoli', 'carrot', 'pepper', 'potato', 'mushroom', 'lettuce', 'cucumber', 'zucchini', 'lemon', 'lime'].some(k => n.includes(k))) return 'produce'
  if (['flour', 'sugar', 'rice', 'pasta', 'bread', 'oat', 'quinoa', 'lentil', 'bean', 'chickpea'].some(k => n.includes(k))) return 'grains & legumes'
  if (['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme', 'cinnamon', 'turmeric', 'chili', 'powder'].some(k => n.includes(k))) return 'spices'
  if (['oil', 'vinegar', 'soy sauce', 'sauce', 'stock', 'broth', 'can', 'paste', 'honey', 'mustard'].some(k => n.includes(k))) return 'pantry staples'
  return 'other'
}