// The hero wave's own colours, in one place.
//
// WaveField takes these as its defaults, and the landing's ambient light field
// below the hero is mixed from the same emissive value — so the light that
// spills past the hero boundary is literally the wave's colour rather than a
// blue picked to look close to it.

/** Base colour of the instanced bars. */
export const WAVE_COLOR = "hsl(230, 90%, 58%)";

/** The emissive the bars glow with, and what bloom smears into the air
 *  around them. This is the electric blue the hero reads as. */
export const WAVE_EMISSIVE = "#5d6bff";
