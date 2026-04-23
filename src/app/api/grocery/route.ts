import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/grocery',
    mode: 'anthropic-only phase 1',
  })
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated in anthropic-only phase 1. Use POST /api/recipe for suggestions + grocery list.',
    },
    { status: 410 }
  )
}
