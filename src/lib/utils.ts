import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Helper untuk menggabungkan class Tailwind CSS secara kondisional dan bersih
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
