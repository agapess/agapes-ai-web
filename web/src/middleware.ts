export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api/projects/:path*',
    '/api/providers/:path*',
    '/api/admin/:path*',
    '/api/chat-sessions/:path*',
    '/api/ai/:path*',
    '/api/billing/:path*',
    '/api/pages/:path*',
    '/api/export/:path*',
  ],
}
