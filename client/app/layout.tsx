export const metadata = {
  title: 'Reel Wallet',
  description: 'Admin-locked build',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
