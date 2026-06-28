import { useState, useRef, useEffect } from 'react'

export default function SearchableSelect({ options, value, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  // Find currently selected option
  const selectedOption = options.find(opt => opt.value === value)

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Filter options based on search query
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggle = () => {
    if (disabled) return
    setIsOpen(!isOpen)
    setSearch('') // reset search on toggle
  }

  const handleSelect = (val) => {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Target display box */}
      <div
        onClick={handleToggle}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid var(--gray-200)',
          background: disabled ? 'var(--gray-50)' : 'var(--surface)',
          color: selectedOption ? 'var(--gray-800)' : 'var(--gray-400)',
          fontSize: '13px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
          boxSizing: 'border-box',
          minHeight: '34px'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--gray-400)', marginLeft: 8 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          minWidth: '320px',
          marginTop: '4px',
          background: 'var(--surface)',
          border: '1px solid var(--gray-200)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,.08)',
          zIndex: 999,
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '260px',
          boxSizing: 'border-box'
        }}>
          {/* Search Input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari mata kuliah..."
            autoFocus
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid var(--gray-200)',
              fontSize: '12.5px',
              outline: 'none',
              boxSizing: 'border-box',
              background: 'var(--surface)',
              color: 'var(--gray-800)'
            }}
          />

          {/* Options list */}
          <div style={{
            overflowY: 'auto',
            maxHeight: '180px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {filteredOptions.length === 0 ? (
              <div style={{
                padding: '8px 10px',
                fontSize: '12.5px',
                color: 'var(--gray-400)',
                textAlign: 'center'
              }}>
                Tidak ada hasil
              </div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: opt.value === value ? 'var(--indigo-600)' : 'var(--gray-700)',
                    background: opt.value === value ? 'var(--indigo-50)' : 'transparent',
                    transition: 'all 0.15s ease',
                    wordBreak: 'break-word',
                    lineHeight: '1.4'
                  }}
                  onMouseEnter={e => {
                    if (opt.value !== value) e.currentTarget.style.background = 'var(--gray-50)'
                  }}
                  onMouseLeave={e => {
                    if (opt.value !== value) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
