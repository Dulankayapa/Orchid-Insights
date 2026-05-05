import React, { useCallback, useRef, useState } from 'react'

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
        ${dragging
          ? 'border-[#7fb49a] bg-[#f6fbf6] scale-[1.01] shadow-[0_24px_50px_-34px_rgba(99,145,115,0.45)]'
          : 'border-[#9eb8a8] bg-white/88 hover:border-[#7fb49a] hover:bg-[#fcfdf9]'}
        ${loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
      `}
      style={{ minHeight: 182 }}
    >
      <span className="pointer-events-none absolute right-6 top-4 text-[54px] leading-none text-[#f7d8e6] opacity-70">✿</span>
      <span className="pointer-events-none absolute bottom-5 left-8 text-[28px] leading-none text-[#d7e8c8] opacity-90">❦</span>

      <div
        className={`
          mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#86b69a]
          bg-[#8ba08f] text-[#7af0a6] transition-transform duration-300
          ${dragging ? 'scale-110' : ''}
        `}
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
        <p className="font-['Cormorant_Garamond'] text-[2rem] leading-none text-[#e7f3e7] md:text-[2.15rem]">
          {dragging ? 'Release to analyse' : 'Drop your orchid image here'}
        </p>
        <p className="mt-2 font-['DM_Sans'] text-[0.95rem] text-[#6aa57c]">
          or <span className="font-semibold underline underline-offset-4">browse files</span> · JPG, PNG, WEBP
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
