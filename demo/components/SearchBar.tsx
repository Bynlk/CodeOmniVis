'use client'

import { useState } from 'react'

export default function SearchBar() {
  const [query, setQuery] = useState('')

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bookings..."
      />
    </div>
  )
}
