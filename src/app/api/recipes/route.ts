export { POST } from '@/app/api/recipe/route'

export async function GET() {
  return Response.json({
    ok: true,
    route: '/api/recipes',
    aliasFor: '/api/recipe',
  })
}
