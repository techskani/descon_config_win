import Link from 'next/link'
import React from 'react'

const Header = () => {
  return (
    <header>
      <div className="flex items-center justify-between px-4 py-2 h-14 bg-white shadow-md">
        <nav className="flex space-x-4 md:flex-row md:space-x-6">
            <div>
                <Link className="text-lg text-gray-600 hover:text-blue-600 md:ml-14" href="/">
                    設定
                </Link>
            </div>
            <div>
                <Link
                className="text-lg text-gray-600 hover:text-blue-600 md:ml-5" href="/monitoring">
                監視
                </Link>
            </div>
        </nav>
      </div>
    </header>
  )
}

export default Header
