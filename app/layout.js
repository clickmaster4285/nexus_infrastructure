import './globals.css';

export const metadata = {
  title: 'Nexus — Infrastructure Monitor',
  description: 'Infrastructure health and performance at a glance.',
  icons: {
    icon: '/nexus-mark.svg',
    shortcut: '/nexus-mark.svg',
    apple: '/nexus-mark.svg',
  },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
