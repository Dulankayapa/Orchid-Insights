import React, { useCallback, useState, useRef } from 'react'

export default function DropZone({ onFile, loading }) {
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

  const onDragOver = (e) => { e.preventDefault(); setDragging(true)  }
  const onDragLeave = ()   => setDragging(false)
  const onChange   = (e)   => handleFile(e.target.files[0])

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative cursor-pointer rounded-2xl transition-all duration-300 p-10
        flex flex-col items-center justify-center gap-4 select-none
        glass border-2 border-dashed
        ${dragging
          ? 'border-green-400 bg-green-900/30 scale-[1.01] forest-glow'
          : 'border-green-800/50 hover:border-green-600/70 hover:bg-forest-900/20'}
        ${loading ? 'pointer-events-none opacity-60' : ''}
      `}
      style={{ minHeight: 220 }}
    >
      {/* Decorative petals */}
      <span className="absolute top-4 right-6 text-5xl opacity-10 select-none">🌸</span>
      <span className="absolute bottom-4 left-6 text-4xl opacity-10 select-none rotate-12">🌿</span>

      <div className={`
        w-16 h-16 rounded-full flex items-center justify-center
        bg-green-900/60 border border-green-700/50
        transition-transform duration-300
        ${dragging ? 'scale-110' : ''}
      `}>
        <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>

      <div className="text-center">
        <p className="font-display text-xl font-light text-green-200">
          {dragging ? 'Release to analyse' : 'Drop your orchid image here'}
        </p>
        <p className="text-sm text-green-600 mt-1 font-body">
          or <span className="text-green-400 underline underline-offset-2">browse files</span> · JPG, PNG, WEBP
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
