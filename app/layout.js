export const metadata = {
  title: 'AI Meal Decider',
  description: 'Tell AI what\'s in your fridge, spin the wheel, get a recipe.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
