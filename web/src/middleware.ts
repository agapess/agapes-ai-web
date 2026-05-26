export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/api/projects/:path*',
  ],
}
