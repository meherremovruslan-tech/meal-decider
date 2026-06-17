import './globals.css';
import Providers from './components/Providers';
import Header from './components/Header';
import AnalyticsProvider from './components/AnalyticsProvider';

export const metadata = {
  title: 'AI Meal Decider',
  description: "Tell AI what's in your fridge, spin the wheel, get a recipe.",
};

export default function RootLayout({ children }) {
  return (
    <Providers>
      <html lang="en">
        <body>
          <Header />
          {children}
          <AnalyticsProvider />
        </body>
      </html>
    </Providers>
  );
}
