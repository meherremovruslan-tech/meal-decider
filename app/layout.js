import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import Header from './components/Header';

export const metadata = {
  title: 'AI Meal Decider',
  description: "Tell AI what's in your fridge, spin the wheel, get a recipe.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en">
        <body>
          <Header />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
