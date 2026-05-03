import React, { useCallback, useRef, useState } from "react";

export default function DropZone({ onFile, loading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragging(false);
      handleFile(event.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const onDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);
  const onChange = (event) => handleFile(event.target.files[0]);

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl
        border-2 border-dashed p-10 transition-all duration-300 select-none glass
        ${
          dragging
            ? "scale-[1.01] border-green-400 bg-green-900/30 forest-glow"
            : "border-green-800/50 hover:border-green-600/70 hover:bg-forest-900/20"
        }
        ${loading ? "pointer-events-none opacity-60" : ""}
      `}
      style={{ minHeight: 220 }}
    >
      <span className="absolute right-6 top-4 select-none text-5xl opacity-10">O</span>
      <span className="absolute bottom-4 left-6 rotate-12 select-none text-4xl opacity-10">+</span>

      <div
        className={`
          flex h-16 w-16 items-center justify-center rounded-full border border-green-700/50
          bg-green-900/60 transition-transform duration-300
          ${dragging ? "scale-110" : ""}
        `}
      >
        <svg className="h-7 w-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="font-display text-xl font-light text-green-200">
          {dragging ? "Release to analyze" : "Drop your orchid image here"}
        </p>
        <p className="mt-1 text-sm text-green-600 font-body">
          or <span className="text-green-400 underline underline-offset-2">browse files</span> · JPG, PNG, WEBP
        </p>
        <p className="mt-2 text-xs text-green-700 font-body">
          Orchid species only. Non-orchid plants will be rejected.
        </p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
