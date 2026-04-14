import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0')
  res.redirect('/')
}
