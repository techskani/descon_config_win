'use client'

import { DataProvider } from '@/contexts/Datacontext'
import { WebSocketProvider } from '@/contexts/WebSocketContext'
import React from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <WebSocketProvider>
        {children}
      </WebSocketProvider>
    </DataProvider>
  )
}