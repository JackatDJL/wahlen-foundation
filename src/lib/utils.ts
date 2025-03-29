import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class values into a merged Tailwind CSS class string.
 *
 * This utility function accepts multiple class values—which can be strings, arrays, or objects—and uses `clsx` to
 * conditionally join them into a single string. It then applies `twMerge` to reconcile any conflicting Tailwind CSS classes,
 * returning a merged class string suitable for HTML element class attributes.
 *
 * @example
 * const buttonClass = cn('px-4', 'py-2', { 'bg-blue-500': isActive });
 *
 * @param inputs - A list of class values to be combined.
 * @returns A string with merged Tailwind CSS classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
