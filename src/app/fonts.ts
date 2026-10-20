import { Cormorant_Garamond, Inter, Manrope, Marcellus, Montserrat, Playfair_Display, Poppins } from "next/font/google";

// Fonts available to the theme editor (src/lib/theme.ts FONT_OPTIONS). Each
// exposes a CSS variable; the active theme points --font-sans/--font-heading at
// one of them. Only the defaults are preloaded; others download on demand.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-cormorant", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", preload: false });
const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--font-marcellus", display: "swap", preload: false });

export const fontVariables = [inter, manrope, poppins, montserrat, cormorant, playfair, marcellus].map((f) => f.variable).join(" ");
