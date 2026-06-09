// src/components/admin/ImageEditorModal.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { RotateCw, Check, X, RefreshCw, Move } from 'lucide-react'

interface ImageEditorModalProps {
    isOpen: boolean
    imageSrc: string
    onClose: () => void
    onSave: (file: File) => void
}

const MAX_PREVIEW_SIZE = 280 // Ukuran batas maksimal container preview editor

export default function ImageEditorModal({ isOpen, imageSrc, onClose, onSave }: ImageEditorModalProps) {
    const [rotatedImageSrc, setRotatedImageSrc] = useState('')
    const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
    
    // Ukuran kontainer preview (menyesuaikan aspek rasio gambar ter-render)
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
    
    // Koordinat crop box persegi { x, y, size } relatif terhadap kontainer preview
    const [crop, setCrop] = useState({ x: 0, y: 0, size: 0 })
    
    const [dragMode, setDragMode] = useState<'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null>(null)
    const dragStartRef = useRef({ clientX: 0, clientY: 0, crop: { x: 0, y: 0, size: 0 } })

    // Inisialisasi/Reset saat file gambar baru terpilih
    useEffect(() => {
        if (imageSrc) {
            setRotatedImageSrc(imageSrc)
        }
    }, [imageSrc])

    // Load gambar saat source berubah (baik karena ganti file atau diputar/rotated)
    useEffect(() => {
        if (!rotatedImageSrc) return

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = rotatedImageSrc
        img.onload = () => {
            setImageElement(img)
            
            // Hitung ukuran kontainer agar fit di area MAX_PREVIEW_SIZE x MAX_PREVIEW_SIZE
            const scale = Math.min(MAX_PREVIEW_SIZE / img.width, MAX_PREVIEW_SIZE / img.height)
            const w = img.width * scale
            const h = img.height * scale
            setContainerSize({ width: w, height: h })

            // Inisialisasi crop box persegi (1:1) pas di tengah gambar
            const boxSize = Math.min(w, h) * 0.8 // 80% dari ukuran sisi terkecil
            setCrop({
                x: (w - boxSize) / 2,
                y: (h - boxSize) / 2,
                size: boxSize
            })
        }
    }, [rotatedImageSrc])

    // Handler Drag & Resize
    const handleDragStart = (clientX: number, clientY: number, mode: typeof dragMode) => {
        if (!imageElement) return
        setDragMode(mode)
        dragStartRef.current = {
            clientX,
            clientY,
            crop: { ...crop }
        }
    };

    const handleDragMove = (clientX: number, clientY: number) => {
        if (!dragMode || !imageElement) return

        const dx = clientX - dragStartRef.current.clientX
        const dy = clientY - dragStartRef.current.clientY
        const startCrop = dragStartRef.current.crop

        if (dragMode === 'move') {
            // Memindahkan posisi crop box
            let newX = startCrop.x + dx
            let newY = startCrop.y + dy

            // Batasi agar tidak keluar dari area kontainer gambar
            newX = Math.max(0, Math.min(containerSize.width - crop.size, newX))
            newY = Math.max(0, Math.min(containerSize.height - crop.size, newY))

            setCrop((prev) => ({ ...prev, x: newX, y: newY }))
        } else {
            // Resizing dengan rasio 1:1 dikunci
            let newSize = startCrop.size
            let newX = startCrop.x
            let newY = startCrop.y

            if (dragMode === 'resize-br') {
                // Pojok Kanan-Bawah: dx menentukan perubahan ukuran
                newSize = startCrop.size + dx
                const maxSize = Math.min(containerSize.width - startCrop.x, containerSize.height - startCrop.y)
                newSize = Math.max(50, Math.min(maxSize, newSize))
            } 
            else if (dragMode === 'resize-tl') {
                // Pojok Kiri-Atas: -dx menentukan ukuran, x dan y bergeser
                newSize = startCrop.size - dx
                const maxSize = Math.min(startCrop.size + startCrop.x, startCrop.size + startCrop.y)
                newSize = Math.max(50, Math.min(maxSize, newSize))
                const diff = newSize - startCrop.size
                newX = startCrop.x - diff
                newY = startCrop.y - diff
            } 
            else if (dragMode === 'resize-tr') {
                // Pojok Kanan-Atas: -dy menentukan ukuran, y bergeser
                newSize = startCrop.size - dy
                const maxSize = Math.min(containerSize.width - startCrop.x, startCrop.size + startCrop.y)
                newSize = Math.max(50, Math.min(maxSize, newSize))
                const diff = newSize - startCrop.size
                newY = startCrop.y - diff
            } 
            else if (dragMode === 'resize-bl') {
                // Pojok Kiri-Bawah: -dx menentukan ukuran, x bergeser
                newSize = startCrop.size - dx
                const maxSize = Math.min(startCrop.size + startCrop.x, containerSize.height - startCrop.y)
                newSize = Math.max(50, Math.min(maxSize, newSize))
                const diff = newSize - startCrop.size
                newX = startCrop.x - diff
            }

            setCrop({ x: newX, y: newY, size: newSize })
        }
    };

    const handleDragEnd = () => {
        setDragMode(null)
    };

    // Memutar gambar 90 derajat secara internal menggunakan canvas offscreen
    const handleRotate = () => {
        if (!imageElement) return

        const tempCanvas = document.createElement('canvas')
        // Swap lebar & tinggi untuk rotasi 90 derajat
        tempCanvas.width = imageElement.height
        tempCanvas.height = imageElement.width
        
        const ctx = tempCanvas.getContext('2d')
        if (!ctx) return

        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2)
        ctx.rotate((90 * Math.PI) / 180)
        ctx.drawImage(imageElement, -imageElement.width / 2, -imageElement.height / 2)

        const rotatedDataUrl = tempCanvas.toDataURL('image/jpeg', 0.95)
        setRotatedImageSrc(rotatedDataUrl)
    };

    // Reset editor kembali ke kondisi file asli
    const handleReset = () => {
        setRotatedImageSrc(imageSrc)
    };

    // Ekspor area crop ke canvas 800x800px & konversi ke File
    const handleSave = () => {
        if (!imageElement) return

        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = 800
        exportCanvas.height = 800
        
        const ctx = exportCanvas.getContext('2d')
        if (!ctx) return

        // Hitung skala perbandingan dari preview container ke resolusi asli gambar
        const scaleX = imageElement.width / containerSize.width
        const scaleY = imageElement.height / containerSize.height

        const sX = crop.x * scaleX
        const sY = crop.y * scaleY
        const sW = crop.size * scaleX
        const sH = crop.size * scaleY

        ctx.clearRect(0, 0, 800, 800)
        // Gambar bagian crop dari imageElement ke kanvas 800x800
        ctx.drawImage(imageElement, sX, sY, sW, sH, 0, 0, 800, 800)

        exportCanvas.toBlob(
            (blob) => {
                if (blob) {
                    const finalFile = new File([blob], 'product-image.jpg', {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    })
                    onSave(finalFile)
                }
            },
            'image/jpeg',
            0.85
        )
    };

    // Tambahkan event global untuk membatalkan drag di luar area modal
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (dragMode) handleDragEnd()
        }
        window.addEventListener('mouseup', handleGlobalMouseUp)
        window.addEventListener('touchend', handleGlobalMouseUp)
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp)
            window.removeEventListener('touchend', handleGlobalMouseUp)
        }
    }, [dragMode])

    if (!isOpen || !imageSrc) return null

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-wide">Pangkas & Sesuaikan</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Crop & Atur Foto Produk</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="bg-slate-800 p-2 rounded-full text-slate-350 hover:text-white transition-colors"
                        type="button"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body: Crop Preview Container */}
                <div className="p-6 bg-slate-50 flex flex-col items-center justify-center relative select-none">
                    {/* Image Wrapper (Pembatas agar box shadow crop tidak meluber keluar) */}
                    <div 
                        className="relative overflow-hidden border border-slate-200 shadow-inner rounded-xl bg-slate-200"
                        style={{
                            width: `${containerSize.width}px`,
                            height: `${containerSize.height}px`
                        }}
                        onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                        onTouchMove={(e) => {
                            if (e.touches[0]) handleDragMove(e.touches[0].clientX, e.touches[0].clientY)
                        }}
                    >
                        {/* Checkered pattern background */}
                        <div 
                            className="absolute inset-0 opacity-10 pointer-events-none"
                            style={{
                                backgroundImage: 'radial-gradient(#000 20%, transparent 20%), radial-gradient(#000 20%, transparent 20%)',
                                backgroundPosition: '0 0, 10px 10px',
                                backgroundSize: '20px 20px'
                            }}
                        />

                        {/* Foto Produk Asli */}
                        {imageElement && (
                            <img 
                                src={rotatedImageSrc} 
                                alt="Original product" 
                                className="w-full h-full object-contain pointer-events-none select-none"
                            />
                        )}

                        {/* CROP BOX (Draggable & Resizable) */}
                        <div
                            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY, 'move')}
                            onTouchStart={(e) => {
                                if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY, 'move')
                            }}
                            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] cursor-move rounded-lg"
                            style={{
                                left: `${crop.x}px`,
                                top: `${crop.y}px`,
                                width: `${crop.size}px`,
                                height: `${crop.size}px`
                            }}
                        >
                            {/* Grid Lines (Garis di Frame) */}
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                                <div className="border-r border-b border-white/20 border-dashed"></div>
                                <div className="border-r border-b border-white/20 border-dashed"></div>
                                <div className="border-b border-white/20 border-dashed"></div>
                                <div className="border-r border-b border-white/20 border-dashed"></div>
                                <div className="border-r border-b border-white/20 border-dashed"></div>
                                <div className="border-b border-white/20 border-dashed"></div>
                                <div className="border-r border-white/20 border-dashed"></div>
                                <div className="border-r border-white/20 border-dashed"></div>
                                <div></div>
                            </div>

                            {/* Center Grab Icon Indicator (Shows on hover) */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 pointer-events-none">
                                <Move size={20} className="text-white drop-shadow" />
                            </div>

                            {/* Corner Drag Handles (T touch-friendly target area) */}
                            {/* Top-Left */}
                            <div 
                                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'resize-tl'); }}
                                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY, 'resize-tl'); }}
                                className="absolute -top-3.5 -left-3.5 w-7 h-7 flex items-center justify-center cursor-nwse-resize z-10"
                            >
                                <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-white drop-shadow"></div>
                            </div>

                            {/* Top-Right */}
                            <div 
                                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'resize-tr'); }}
                                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY, 'resize-tr'); }}
                                className="absolute -top-3.5 -right-3.5 w-7 h-7 flex items-center justify-center cursor-nesw-resize z-10"
                            >
                                <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-white drop-shadow"></div>
                            </div>

                            {/* Bottom-Left */}
                            <div 
                                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'resize-bl'); }}
                                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY, 'resize-bl'); }}
                                className="absolute -bottom-3.5 -left-3.5 w-7 h-7 flex items-center justify-center cursor-nesw-resize z-10"
                            >
                                <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-white drop-shadow"></div>
                            </div>

                            {/* Bottom-Right */}
                            <div 
                                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e.clientX, e.clientY, 'resize-br'); }}
                                onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY, 'resize-br'); }}
                                className="absolute -bottom-3.5 -right-3.5 w-7 h-7 flex items-center justify-center cursor-nwse-resize z-10"
                            >
                                <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-white drop-shadow"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Control Panel Footer */}
                <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex gap-2 items-center justify-between">
                        <button
                            type="button"
                            onClick={handleRotate}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm border border-slate-200"
                        >
                            <RotateCw size={14} /> Putar 90°
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleReset}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold p-2.5 rounded-xl transition-all active:scale-95 shadow-sm border border-slate-150"
                            title="Reset Editor"
                        >
                            <RefreshCw size={14} />
                        </button>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="bg-slate-50 hover:bg-slate-100 text-slate-650 text-xs font-bold px-4.5 py-2.5 rounded-xl transition-all active:scale-95 border border-slate-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-4.5 py-2.5 rounded-xl transition-all flex items-center gap-1 active:scale-95 shadow-md"
                            >
                                <Check size={14} /> Pangkas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
