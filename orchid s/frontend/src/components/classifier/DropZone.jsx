import React, { useCallback, useRef, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'

export default function DropZone({ onFile, loading }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback(
    (file) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.')
        return
      }
      onFile(file)
    },
    [onFile]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      handleFile(e.dataTransfer.files[0])
    },
    [handleFile]
  )

  const onDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => setDragging(false)
  const onChange = (e) => handleFile(e.target.files[0])

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative overflow-hidden rounded-[26px] border-2 border-dashed px-8 py-10 text-center
        transition-all duration-300 select-none
        ${loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
      `}
      style={{
        minHeight: 182,
        borderColor: dragging
          ? (isDark ? '#7fb49a' : '#7fa892')
          : (isDark ? '#6f9a82' : '#9eb8a8'),
        background: dragging
          ? (isDark ? '#112018' : '#f6fbf6')
          : (isDark ? 'rgba(14, 26, 20, 0.92)' : 'rgba(255,255,255,0.88)'),
        boxShadow: dragging
          ? (isDark
            ? '0 24px 50px -34px rgba(0,0,0,0.6)'
            : '0 24px 50px -34px rgba(99,145,115,0.45)')
          : 'none',
        transform: dragging ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      <span
        className="pointer-events-none absolute right-6 top-4 text-[54px] leading-none opacity-70"
        style={{ color: isDark ? '#d99db9' : '#f0bfd3' }}
      >
        ✿
      </span>
      <span
        className="pointer-events-none absolute bottom-5 left-8 text-[28px] leading-none opacity-90"
        style={{ color: isDark ? '#9dbb88' : '#bfd4a9' }}
      >
        ❦
      </span>

      <div
        className={`
          mx-auto flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300
          ${dragging ? 'scale-110' : ''}
        `}
        style={{
          border: `1px solid ${isDark ? '#7aa88b' : '#86b69a'}`,
          background: isDark ? '#3d5a47' : '#8ba08f',
          color: isDark ? '#9ff2bb' : '#1f7a46',
        }}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <div className="mt-5 text-center">
        <p
          className="font-['Cormorant_Garamond'] text-[2rem] leading-none md:text-[2.15rem]"
          style={{ color: isDark ? '#eff9f0' : '#365443' }}
        >
          {dragging ? 'Release to analyse' : 'Drop your orchid image here'}
        </p>
        <p
          className="mt-2 font-['DM_Sans'] text-[0.95rem]"
          style={{ color: isDark ? '#a9cfb4' : '#517d61' }}
        >
          or{' '}
          <span
            className="font-semibold underline underline-offset-4"
            style={{ color: isDark ? '#d8f4de' : '#2f6f42' }}
          >
            browse files
          </span>{' '}
          · JPG, PNG, WEBP
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
    </div>
  )
}
