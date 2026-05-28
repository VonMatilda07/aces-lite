// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    console.log(`=== [SERVER PROXY] Bypassing auth check for path: ${request.nextUrl.pathname} ===`)
    return NextResponse.next()
}

export const config = {
    matcher: ['/waiter/:path*', '/admin/:path*'],
}