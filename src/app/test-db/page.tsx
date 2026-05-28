'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestDBPage() {
    const [status, setStatus] = useState('Initializing...')
    const [sessionInfo, setSessionInfo] = useState<any>(null)
    const [menusData, setMenusData] = useState<any>(null)
    const [menusError, setMenusError] = useState<any>(null)
    const [profilesData, setProfilesData] = useState<any>(null)
    const [profilesError, setProfilesError] = useState<any>(null)

    useEffect(() => {
        async function runTests() {
            try {
                setStatus('Fetching session...')
                const { data: { session } } = await supabase.auth.getSession()
                setSessionInfo(session)

                setStatus('Fetching menus...')
                const { data: menus, error: mError } = await supabase
                    .from('menus')
                    .select('*')
                setMenusData(menus)
                setMenusError(mError)

                if (session?.user) {
                    setStatus('Fetching profile...')
                    const { data: profile, error: pError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()
                    setProfilesData(profile)
                    setProfilesError(pError)
                }

                setStatus('Done')
            } catch (e: any) {
                setStatus(`Crash: ${e.message}`)
            }
        }

        runTests()
    }, [])

    return (
        <main className="p-8 bg-slate-900 text-white min-h-screen font-mono text-xs">
            <h1 className="text-xl font-bold mb-4">Supabase Database Debugger</h1>
            <p className="mb-4">Status: <span className="font-bold text-yellow-400">{status}</span></p>

            <div className="flex flex-col gap-6">
                <section className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <h2 className="text-sm font-bold text-emerald-400 mb-2">1. Auth Session Info</h2>
                    {sessionInfo ? (
                        <div>
                            <p>Logged In User: <span className="text-white font-bold">{sessionInfo.user.email}</span></p>
                            <p>User ID: {sessionInfo.user.id}</p>
                            <p>Role in JWT: {sessionInfo.user.role}</p>
                            <details className="mt-2">
                                <summary className="cursor-pointer text-slate-400">View Full JWT Payload</summary>
                                <pre className="bg-slate-950 p-2 rounded mt-1 overflow-x-auto text-[10px]">
                                    {JSON.stringify(sessionInfo.user, null, 2)}
                                </pre>
                            </details>
                        </div>
                    ) : (
                        <p className="text-slate-400 font-bold">No active session (Anonymous Role)</p>
                    )}
                </section>

                <section className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <h2 className="text-sm font-bold text-emerald-400 mb-2">2. Menus Query Result</h2>
                    {menusError ? (
                        <div className="bg-rose-500/20 border border-rose-500 p-3 rounded-lg text-rose-300 font-bold">
                            Error: {menusError.message} (Code: {menusError.code})
                        </div>
                    ) : menusData ? (
                        <div>
                            <p className="font-bold text-white mb-2">Count: {menusData.length} items found</p>
                            <pre className="bg-slate-950 p-2 rounded max-h-60 overflow-y-auto text-[10px]">
                                {JSON.stringify(menusData, null, 2)}
                            </pre>
                        </div>
                    ) : (
                        <p className="text-slate-400">Loading menus...</p>
                    )}
                </section>

                {sessionInfo?.user && (
                    <section className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <h2 className="text-sm font-bold text-emerald-400 mb-2">3. Profiles Query Result</h2>
                        {profilesError ? (
                            <div className="bg-rose-500/20 border border-rose-500 p-3 rounded-lg text-rose-300 font-bold">
                                Error: {profilesError.message} (Code: {profilesError.code})
                            </div>
                        ) : profilesData ? (
                            <div>
                                <p>Role in profiles table: <span className="font-bold text-white">{profilesData.role}</span></p>
                                <pre className="bg-slate-950 p-2 rounded mt-2 text-[10px]">
                                    {JSON.stringify(profilesData, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <p className="text-slate-400">Loading profile...</p>
                        )}
                    </section>
                )}

                <button
                    onClick={() => {
                        supabase.auth.signOut().then(() => window.location.reload())
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold p-3 rounded-xl uppercase tracking-wider active:scale-95 transition-transform w-max"
                >
                    Logout and Clear Session
                </button>
            </div>
        </main>
    )
}
