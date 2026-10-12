import { createContext } from 'react';
export const SurfaceContext = createContext<string | null>(null);
/** Possible painted colours where an image watermark sits behind sibling text. */
export const SurfaceArtworkContext = createContext<string[]>([]);
