import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import "../globals.css";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'トランス詳細設定',
  description: 'DESCONトランス詳細設定画面',
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
    </>
  )
} 