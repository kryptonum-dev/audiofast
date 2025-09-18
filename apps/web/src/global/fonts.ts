import { Poppins } from 'next/font/google';
import localFont from 'next/font/local';

// Google Fonts - Poppins (300, 400)
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400'],
  display: 'swap',
  variable: '--font-poppins',
  preload: true,
});

// Local Font - Switzer (Optimized for Latin characters only)
export const switzer = localFont({
  src: [
    {
      path: '../../public/fonts/Switzer-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Switzer-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-switzer',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
});
