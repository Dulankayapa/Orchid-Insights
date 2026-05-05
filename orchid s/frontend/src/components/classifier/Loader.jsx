import React from 'react'

export default function Loader() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 animate-fade-in">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-[#c9ddd0]" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#66d38b] border-r-[#66d38b] animate-spin" />
        <div className="absolute inset-3 rounded-full bg-[#edf7ef]" />
      </div>

      <div className="text-center">
        <p className="font-['Cormorant_Garamond'] text-[2rem] leading-none text-[#6f9a82]">Analysing orchid...</p>
        <p className="mt-1 font-['DM_Sans'] text-xs uppercase tracking-[0.22em] text-[#8eb39d]">
          EfficientNetB0 · OOD detection
        </p>
      </div>
    </div>
  )
}
